/**
 * Puts each advocate's signed tracker URL onto their Brevo contact as
 * REFERRAL_SHARE_URL, which is what the campaign email's button points at.
 *
 *   node scripts/sync-share-urls.mjs           # dry run
 *   node scripts/sync-share-urls.mjs --execute
 *
 * The token is an HMAC of the code under REFERRAL_SHARE_SECRET. That secret
 * MUST be the one production verifies with, or every link 404s — the script
 * refuses to run if .env.local and the Vercel production value disagree, since
 * that mismatch is invisible until a real person clicks a dead link.
 */
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim().replace(/^"|"$/g, '');
}

const EXECUTE = process.argv.includes('--execute');
const ORIGIN = 'https://www.fourteenfisherman.com';
const secret = process.env.REFERRAL_SHARE_SECRET;
const brevoKey = process.env.BREVO_API_KEY;
if (!secret) { console.error('REFERRAL_SHARE_SECRET not set'); process.exit(1); }
if (!brevoKey) { console.error('BREVO_API_KEY not set'); process.exit(1); }

const shareUrl = (code) =>
  `${ORIGIN}/share/${code}?t=${createHmac('sha256', secret).update(code).digest('hex').slice(0, 32)}`;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: codes, error } = await sb
  .from('referral_codes')
  .select('code, owner_email, active')
  .eq('active', true);
if (error) { console.error('code query failed', error); process.exit(1); }

console.log(`${EXECUTE ? 'EXECUTE' : 'DRY RUN'} — ${codes.length} active codes`);
console.log('example:', shareUrl(codes[0].code));

if (!EXECUTE) process.exit(0);

// Brevo silently ignores attributes it doesn't know, so an unregistered name
// makes every write look like a success while changing nothing. Register first.
{
  const res = await fetch('https://api.brevo.com/v3/contacts/attributes/normal/REFERRAL_SHARE_URL', {
    method: 'POST',
    headers: { 'api-key': brevoKey, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'text' }),
  });
  const body = res.ok ? '' : await res.text();
  if (!res.ok && !/already exist|must be unique/i.test(body)) {
    console.error('attribute create failed:', res.status, body.slice(0, 150));
    process.exit(1);
  }
  console.log('attribute REFERRAL_SHARE_URL ready');
}

let ok = 0, failed = 0;
for (const c of codes) {
  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': brevoKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      email: c.owner_email,
      updateEnabled: true,
      attributes: { REFERRAL_SHARE_URL: shareUrl(c.code) },
    }),
  });
  if (res.ok || res.status === 204) ok += 1;
  else { failed += 1; console.error(`  failed ${c.owner_email}: ${res.status} ${(await res.text()).slice(0, 90)}`); }
  await new Promise((r) => setTimeout(r, 110));
}
console.log(`wrote ${ok}${failed ? ` | failed ${failed}` : ''}`);

// Read one back. A 2xx from Brevo is not proof the attribute landed, and a sync
// that reports success while changing nothing is worse than one that fails.
const probe = codes[0];
const check = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(probe.owner_email)}`, {
  headers: { 'api-key': brevoKey },
});
const contact = await check.json();
const got = contact?.attributes?.REFERRAL_SHARE_URL;
if (got === shareUrl(probe.code)) {
  console.log(`VERIFIED on ${probe.owner_email}`);
} else {
  console.error(`VERIFY FAILED for ${probe.owner_email}: attribute is ${got ?? 'missing'}`);
  process.exit(1);
}
