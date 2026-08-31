/**
 * Get (or mint) one person's referral links.
 *
 *   node scripts/referral-link.mjs someone@example.com [First Name]
 *
 * Idempotent: an existing code is returned as-is; a missing one is minted,
 * activated, and synced to the person's Brevo contact. Prints the two links:
 * their private page (tracker + share button) and the /r/ link friends click.
 *
 * Needs BREVO_API_KEY in the environment (pull it from Vercel prod);
 * Supabase creds and REFERRAL_SHARE_SECRET come from .env.local.
 */
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const ORIGIN = 'https://www.fourteenfisherman.com';
const email = (process.argv[2] ?? '').trim().toLowerCase();
const name = process.argv.slice(3).join(' ').trim();
if (!email.includes('@')) {
  console.error('usage: node scripts/referral-link.mjs <email> [name]');
  process.exit(1);
}
const secret = process.env.REFERRAL_SHARE_SECRET;
if (!secret) { console.error('REFERRAL_SHARE_SECRET missing from .env.local'); process.exit(1); }

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Mirrors lib/commerce/referrals.ts exactly.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateCode(n) {
  const prefix = (n.split(/\s+/)[0] ?? '').toUpperCase().replace(/[^A-Z]/g, '').replace(/[ILO]/g, '').slice(0, 4) || 'FF';
  let sfx = '';
  for (let i = 0; i < 4; i += 1) sfx += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return prefix + sfx;
}

let { data: row, error } = await supabase
  .from('referral_codes').select('code, active').eq('owner_email', email).maybeSingle();
if (error) { console.error('lookup failed:', error.message); process.exit(1); }

if (row && !row.active) {
  const { error: e } = await supabase.from('referral_codes').update({ active: true }).eq('code', row.code);
  if (e) { console.error('reactivate failed:', e.message); process.exit(1); }
  console.log(`reactivated ${row.code}`);
}

if (!row) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateCode(name || email.split('@')[0]);
    const { error: e } = await supabase.from('referral_codes').insert({
      code, owner_email: email, owner_name: name || email.split('@')[0],
      active: true, code_type: 'affiliate', reward_override_pence: null,
    });
    if (!e) { row = { code }; console.log(`minted ${code}`); break; }
    if (e.code !== '23505' || !e.message.includes('pkey')) { console.error('insert failed:', e.message); process.exit(1); }
  }
  if (!row) { console.error('could not find a free code after 6 tries'); process.exit(1); }
}

const token = createHmac('sha256', secret).update(row.code).digest('hex').slice(0, 32);
const pageUrl = `${ORIGIN}/share/${row.code}/${token}`;
const refUrl = `${ORIGIN}/r/${row.code}`;

// Sync Brevo so campaign follow-ups can address them; skipped without a key.
if (process.env.BREVO_API_KEY) {
  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      email, updateEnabled: true,
      attributes: {
        ...(name ? { FIRSTNAME: name.split(/\s+/)[0] } : {}),
        REFERRAL_CODE: row.code, REFERRAL_URL: refUrl, REFERRAL_SHARE_URL: pageUrl,
      },
    }),
  });
  console.log(res.ok || res.status === 204 ? 'brevo synced' : `brevo sync FAILED (${res.status}) — links still valid`);
} else {
  console.log('brevo NOT synced (no BREVO_API_KEY) — links still valid');
}

const live = await fetch(pageUrl, { method: 'HEAD' }).then((r) => r.status).catch(() => 'unreachable');
console.log(`\npage verified: HTTP ${live}`);
console.log(`\nTheir page (send THEM this — tracker + share button):\n  ${pageUrl}`);
console.log(`\nTheir referral link (what friends click; also on their page):\n  ${refUrl}`);
