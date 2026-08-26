/**
 * Bulk-mints a personal referral code for every waitlist entry and trial lead,
 * then stamps each person's shareable link onto their Brevo contact so the
 * campaign email can render "Share my link" per-recipient.
 *
 *   node scripts/bulk-mint-referral-codes.mjs              # DRY RUN — no writes
 *   node scripts/bulk-mint-referral-codes.mjs --execute    # mint + sync Brevo
 *   node scripts/bulk-mint-referral-codes.mjs --execute --skip-brevo
 *
 * Design decisions:
 *  - reward_override_pence is NULL: everyone earns the standard plan tiers
 *    (£100 Complete / £50 Self-Study), matching the campaign copy. The five
 *    hand-issued affiliate codes keep their negotiated flat overrides.
 *  - code_type 'affiliate' to match the existing hand-issued codes (the only
 *    other allowed value, 'customer', is reserved for buyers-become-advocates).
 *  - invited_at stays NULL — the Brevo campaign is the invite, not the
 *    transactional advocate email.
 *  - Idempotent: emails that already own a code are skipped (owner_email is
 *    UNIQUE), and re-running only syncs Brevo for rows minted by this script.
 *
 * Brevo: creates the REFERRAL_CODE / REFERRAL_URL text attributes if missing,
 * then upserts each contact with their link. Campaign templates reference them
 * as {{ contact.REFERRAL_URL }}.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const EXECUTE = process.argv.includes('--execute');
const SKIP_BREVO = process.argv.includes('--skip-brevo');
// --limit N mints only the first N (a pilot batch to eyeball end-to-end);
// a later full run skips them via the owner_email idempotency check.
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;
const ORIGIN = 'https://www.fourteenfisherman.com';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── Code generation: mirrors lib/commerce/referrals.ts exactly ─────────────
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateReferralCode(name) {
  const firstWord = (name ?? '').trim().split(/\s+/)[0] ?? '';
  const prefix =
    firstWord.toUpperCase().replace(/[^A-Z]/g, '').replace(/[ILO]/g, '').slice(0, 4) || 'FF';
  let suffix = '';
  for (let i = 0; i < 4; i += 1) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `${prefix}${suffix}`;
}
const normalizeEmail = (e) => e.trim().toLowerCase();

// ── Gather leads ───────────────────────────────────────────────────────────
const [{ data: waitlist, error: wErr }, { data: trials, error: tErr }, { data: existing, error: eErr }] =
  await Promise.all([
    supabase.from('waitlist_entries').select('email, full_name'),
    supabase.from('trial_leads').select('email, first_name'),
    supabase.from('referral_codes').select('code, owner_email'),
  ]);
if (wErr || tErr || eErr) {
  console.error('load failed', wErr ?? tErr ?? eErr);
  process.exit(1);
}

const owned = new Map(existing.map((r) => [normalizeEmail(r.owner_email), r.code]));
const takenCodes = new Set(existing.map((r) => r.code));

// Dedup by email; a record with a name beats one without.
const leads = new Map();
for (const w of waitlist) {
  const email = normalizeEmail(w.email ?? '');
  if (!email.includes('@')) continue;
  leads.set(email, { email, name: (w.full_name ?? '').trim(), source: 'waitlist' });
}
for (const t of trials) {
  const email = normalizeEmail(t.email ?? '');
  if (!email.includes('@')) continue;
  const prev = leads.get(email);
  const name = (t.first_name ?? '').trim();
  if (!prev) leads.set(email, { email, name, source: 'trial' });
  else if (!prev.name && name) prev.name = name;
}

const eligible = [...leads.values()].filter((l) => !owned.has(l.email));
const toMint = eligible.slice(0, LIMIT);
const alreadyOwned = leads.size - eligible.length;

console.log(`${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`);
console.log(`leads: ${leads.size} unique (${waitlist.length} waitlist + ${trials.length} trial rows)`);
console.log(`already own a code: ${alreadyOwned} — skipped`);
console.log(`to mint: ${toMint.length}${toMint.length < eligible.length ? ` (of ${eligible.length} eligible — --limit)` : ''}\n`);

// ── Mint ───────────────────────────────────────────────────────────────────
const minted = [];
let failed = 0;
for (const lead of toMint) {
  let code = generateReferralCode(lead.name);
  while (takenCodes.has(code)) code = generateReferralCode(lead.name);

  if (EXECUTE) {
    // Insert one at a time so a PK collision (concurrent mint) retries rather
    // than failing the batch. owner_email UNIQUE makes re-runs idempotent.
    let attempts = 0;
    for (;;) {
      const { error } = await supabase.from('referral_codes').insert({
        code,
        owner_email: lead.email,
        owner_name: lead.name || lead.email.split('@')[0],
        active: true,
        code_type: 'affiliate',
        reward_override_pence: null,
      });
      if (!error) break;
      if (error.code === '23505' && error.message.includes('pkey') && attempts < 5) {
        attempts += 1;
        code = generateReferralCode(lead.name);
        continue;
      }
      if (error.code === '23505') { code = null; break; } // owner already has one (race) — skip
      console.error(`  insert failed for ${lead.email}:`, error.message);
      code = null; failed += 1;
      break;
    }
    if (!code) continue;
  }

  takenCodes.add(code);
  minted.push({ ...lead, code, url: `${ORIGIN}/r/${code}` });
}

console.log(`minted: ${minted.length}${EXECUTE ? '' : ' (simulated)'}${failed ? ` | failed: ${failed}` : ''}`);
for (const m of minted.slice(0, 8)) console.log(`  ${m.email} -> ${m.url} (${m.source})`);
if (minted.length > 8) console.log(`  … and ${minted.length - 8} more`);

// CSV for eyeballing / manual fallback.
const csvPath = `${process.env.TMPDIR ?? '/tmp'}referral-mint-${EXECUTE ? 'live' : 'dry'}.csv`;
writeFileSync(csvPath, 'email,name,source,code,url\n' + minted.map((m) =>
  [m.email, `"${m.name.replace(/"/g, "'")}"`, m.source, m.code, m.url].join(',')).join('\n'));
console.log(`\ncsv: ${csvPath}`);

// ── Brevo sync ─────────────────────────────────────────────────────────────
if (!EXECUTE || SKIP_BREVO) {
  console.log('brevo: skipped' + (EXECUTE ? ' (--skip-brevo)' : ' (dry run)'));
  process.exit(0);
}
const brevoKey = process.env.BREVO_API_KEY;
if (!brevoKey) { console.error('brevo: BREVO_API_KEY not set'); process.exit(1); }

// Ensure the attributes exist (409 = already there).
for (const attr of ['REFERRAL_CODE', 'REFERRAL_URL']) {
  const res = await fetch(`https://api.brevo.com/v3/contacts/attributes/normal/${attr}`, {
    method: 'POST',
    headers: { 'api-key': brevoKey, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'text' }),
  });
  if (!res.ok && res.status !== 409) {
    const body = await res.text();
    if (!/already exist|must be unique/i.test(body)) { console.error(`brevo attribute ${attr}:`, res.status, body.slice(0, 120)); process.exit(1); }
  }
}

// Sync EVERY lead with a code (newly minted + previously minted), so a re-run
// heals partial Brevo failures. Hand-issued affiliates are left untouched
// unless they happen to also be leads.
const toSync = [...leads.values()]
  .map((l) => ({ ...l, code: owned.get(l.email) ?? minted.find((m) => m.email === l.email)?.code }))
  .filter((l) => l.code);

let synced = 0, brevoFailed = 0;
for (const l of toSync) {
  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': brevoKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      email: l.email,
      updateEnabled: true,
      attributes: { REFERRAL_CODE: l.code, REFERRAL_URL: `${ORIGIN}/r/${l.code}` },
    }),
  });
  if (res.ok || res.status === 204) synced += 1;
  else { brevoFailed += 1; console.error(`  brevo failed ${l.email}: ${res.status} ${(await res.text()).slice(0, 100)}`); }
  await new Promise((r) => setTimeout(r, 120)); // ~8 req/s, well under Brevo's limit
}
console.log(`brevo: synced ${synced}${brevoFailed ? ` | failed ${brevoFailed}` : ''}`);
