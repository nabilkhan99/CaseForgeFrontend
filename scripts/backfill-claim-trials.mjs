/**
 * Retroactively attaches guest free mocks to the accounts that later bought.
 *
 *   node scripts/backfill-claim-trials.mjs            # DRY RUN — reports, writes nothing
 *   node scripts/backfill-claim-trials.mjs --apply    # actually claims
 *
 * Provisioning now claims a buyer's free mock at the moment their account is
 * created, and the dashboard claims once per browser session for everyone else.
 * Neither reaches backwards: every account provisioned before this shipped, and
 * every hand-provisioned account, still has its /try consultation sitting in
 * `clinical_sessions` with `user_id null` — invisible from the dashboard the
 * person is paying for. This drains that backlog in one pass.
 *
 * The matching rules MIRROR lib/auth/claimTrialSessions.ts exactly, and have to
 * stay in step with it:
 *   - the trial lead must have VERIFIED its email (`email_verified_at`), because
 *     anyone can type any address into the gate;
 *   - matching is case-insensitive (`trial_leads` is unique on lower(email));
 *   - a session that already has an owner is NEVER reassigned.
 * The logic is duplicated rather than imported because this is a plain .mjs
 * script and the helper is TypeScript with a `server-only` import; keeping it a
 * dependency-free script is what makes it runnable against prod in one command.
 *
 * Idempotent: re-running claims nothing, because everything it claimed the
 * first time now has an owner.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const APPLY = process.argv.includes('--apply');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const normalizeEmail = (email) => (email ?? '').trim().toLowerCase();

// ── Every auth user, by email ──────────────────────────────────────────────
// `profiles` is written by the `on_auth_user_created` trigger, one row per auth
// user carrying id + email, so it is a complete map and avoids paging the
// GoTrue admin API.
const { data: profiles, error: profileError } = await supabase
  .from('profiles')
  .select('id, email');

if (profileError) {
  console.error('profiles lookup failed:', profileError.message);
  process.exit(1);
}

const userIdByEmail = new Map();
for (const profile of profiles ?? []) {
  const email = normalizeEmail(profile.email);
  if (email && profile.id) userIdByEmail.set(email, profile.id);
}

// ── Every verified trial lead ──────────────────────────────────────────────
const { data: leads, error: leadError } = await supabase
  .from('trial_leads')
  .select('email, session_id, email_verified_at')
  .not('email_verified_at', 'is', null);

if (leadError) {
  console.error('trial_leads lookup failed:', leadError.message);
  process.exit(1);
}

// ── Pair them up ───────────────────────────────────────────────────────────
/** sessionId -> { userId, email } for leads whose address has an account. */
const candidates = new Map();
for (const lead of leads ?? []) {
  const email = normalizeEmail(lead.email);
  const userId = userIdByEmail.get(email);
  if (userId && lead.session_id) candidates.set(lead.session_id, { userId, email });
}

console.log(
  `${userIdByEmail.size} accounts · ${(leads ?? []).length} verified leads · ` +
    `${candidates.size} leads whose address has an account`,
);

if (candidates.size === 0) {
  console.log('Nothing to do.');
  process.exit(0);
}

// Only the sessions that are still unowned are worth reporting or writing —
// everything else has already been claimed, by an earlier run or at signup.
const sessionIds = [...candidates.keys()];
const { data: sessions, error: sessionError } = await supabase
  .from('clinical_sessions')
  .select('id, status, started_at, user_id')
  .in('id', sessionIds)
  .is('user_id', null);

if (sessionError) {
  console.error('clinical_sessions lookup failed:', sessionError.message);
  process.exit(1);
}

const unowned = sessions ?? [];
console.log(`\n${unowned.length} unowned guest session(s) to claim:\n`);
for (const session of unowned) {
  const { userId, email } = candidates.get(session.id);
  console.log(
    `  ${session.id}  ${String(session.status).padEnd(10)}  ${String(session.started_at).slice(0, 10)}  ` +
      `${email} -> ${userId}`,
  );
}

if (!APPLY) {
  console.log('\nDRY RUN — nothing written. Re-run with --apply to claim these.');
  process.exit(0);
}

// ── Write ──────────────────────────────────────────────────────────────────
// One statement per owner rather than per session: a handful of users covers
// the whole backlog, and the `user_id is null` guard makes each one safe to
// re-run. Grouped so a single owner's sessions are claimed atomically.
const idsByUser = new Map();
for (const session of unowned) {
  const { userId } = candidates.get(session.id);
  idsByUser.set(userId, [...(idsByUser.get(userId) ?? []), session.id]);
}

let claimed = 0;
for (const [userId, ids] of idsByUser) {
  const { data, error } = await supabase
    .from('clinical_sessions')
    .update({ user_id: userId })
    .in('id', ids)
    .is('user_id', null)
    .select('id');

  if (error) {
    console.error(`  FAILED for ${userId}:`, error.message);
    continue;
  }
  claimed += data?.length ?? 0;
  console.log(`  ${userId}: claimed ${data?.length ?? 0}/${ids.length}`);
}

console.log(`\nDone. ${claimed} session(s) claimed.`);
