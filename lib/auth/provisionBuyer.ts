import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { claimTrialSessionsForUser } from './claimTrialSessions';
import { provisionAccountForPurchase, sendSetPasswordLink } from './provisioning';

/**
 * Turning a paid purchase into an account the buyer can sign into, and
 * recording on the row exactly how far that got.
 *
 * Lives here rather than inside the Stripe webhook route for one reason: it is
 * a state machine with a race in it, and a Next.js route module cannot export
 * anything a test can reach. Everything else about it is unchanged — the
 * webhook still owns the service-role client and passes it in.
 *
 * The decision is driven off `set_password_sent_at is null` on the ROW rather
 * than "did this webhook call insert it", so a Brevo failure is recoverable:
 * Stripe's retry takes the 23505 duplicate path, reads no send recorded, and
 * tries again. `provisioned_at` records that the account exists, so the second
 * attempt for that buyer resends the link instead of bouncing off "account
 * already exists".
 *
 * The stamps are read in their own query rather than off the insert: they
 * arrive in a later migration than the rest of the table, and a deploy that
 * landed before it must degrade to "no provisioning" rather than failing the
 * whole purchase record. Best-effort throughout for the same reason — a
 * provisioning failure must never fail the webhook, or Stripe would re-process
 * a pre-order that was recorded fine.
 */

export interface ProvisionBuyerArgs {
  preorderId: string;
  email: string;
  name: string | null;
  sessionId: string;
}

type PreorderAdmin = Pick<SupabaseClient, 'from'>;

export async function provisionBuyerAccount(
  supabase: PreorderAdmin,
  args: ProvisionBuyerArgs,
): Promise<void> {
  const { preorderId, sessionId } = args;

  const { data: row, error: readError } = await supabase
    .from('preorders')
    .select('status, provisioned_at, set_password_sent_at')
    .eq('id', preorderId)
    .maybeSingle();

  if (readError) {
    console.error('[stripe-webhook] provisioning state read failed — skipping', {
      sessionId,
      preorderId,
      error: readError,
    });
    return;
  }

  // Fail closed on anything that is not a live paid purchase — including a row
  // that has vanished. A refunded row reaching here is not hypothetical: the
  // first delivery can 500 out of the referral guard BEFORE provisioning runs,
  // the buyer refunds within the hour, and Stripe's retry of that same event
  // (or a manual replay from the dashboard) arrives against a row that is now
  // `refunded`. Without this it mints an account and mails a set-password link
  // to someone who no longer has a purchase.
  if (row?.status !== 'paid') return;
  if (row.set_password_sent_at) return; // already emailed; nothing owed

  const now = new Date().toISOString();

  try {
    // No launch-date gate here any more. It existed for the pre-order window,
    // when someone could pay three weeks before the course opened and be told
    // to "set a password and start practising" with nowhere to go. Access is
    // open, so every paid row is owed its link the moment it lands, and the
    // gate had become nothing but a wall between a tester and a working
    // purchase flow. `provisioned_at` still carries the pre-launch shape: rows
    // provisioned then have it set with the send stamp null, and those take the
    // resend branch below.
    if (row.provisioned_at) {
      await resendOwedLink(supabase, args, now);
      return;
    }
    await createAccountAndSend(supabase, args, now);
  } catch (error: unknown) {
    console.error('[stripe-webhook] account provisioning threw', { sessionId, preorderId, error });
  }
}

/**
 * The account exists from an earlier attempt; only the email is owed.
 *
 * The stamp is CLAIMED BEFORE the send, not written after it. Two Stripe
 * deliveries can sit in this branch at once and — unlike the create branch,
 * where `admin.createUser` dedupes them — nothing downstream separates them:
 * both would email a link, and the second `generateLink` would invalidate the
 * first. The buyer opens whichever mail arrived first and is told it expired.
 * The guarded update is the lock, and whoever wins it owns the send.
 *
 * If the send then fails the stamp is handed straight back, so the next retry
 * picks the buyer up again. A link recorded as sent but never sent is precisely
 * the stranded buyer this whole mechanism exists to prevent.
 */
async function resendOwedLink(
  supabase: PreorderAdmin,
  args: ProvisionBuyerArgs,
  now: string,
): Promise<void> {
  const { preorderId, email, name, sessionId } = args;

  const claimed = await claimSendStamp(supabase, preorderId, now, sessionId);
  if (!claimed) return;

  const result = await sendSetPasswordLink({ email, fullName: name });
  if (result.sent) return;

  console.error('[stripe-webhook] set-password resend failed', { sessionId, preorderId, result });
  await releaseSendStamp(supabase, preorderId, sessionId);
}

/** Compare-and-swap on the send stamp. True = this call now owns the send. */
async function claimSendStamp(
  supabase: PreorderAdmin,
  preorderId: string,
  now: string,
  sessionId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('preorders')
    .update({ set_password_sent_at: now })
    .eq('id', preorderId)
    .is('set_password_sent_at', null)
    .select('id');

  if (error) {
    console.error('[stripe-webhook] send claim failed — skipping', { sessionId, preorderId, error });
    return false;
  }
  // Zero rows means another delivery claimed it between our read and this write.
  return (data?.length ?? 0) > 0;
}

async function releaseSendStamp(
  supabase: PreorderAdmin,
  preorderId: string,
  sessionId: string,
): Promise<void> {
  const { error } = await supabase
    .from('preorders')
    .update({ set_password_sent_at: null })
    .eq('id', preorderId);

  if (error) {
    console.error('[stripe-webhook] could not release the send stamp — buyer needs a manual resend', {
      sessionId,
      preorderId,
      error,
    });
  }
}

/** First attempt for this buyer: create the auth user, then record the outcome. */
async function createAccountAndSend(
  supabase: PreorderAdmin,
  args: ProvisionBuyerArgs,
  now: string,
): Promise<void> {
  const { preorderId, email, name, sessionId } = args;

  const result = await provisionAccountForPurchase({ email, fullName: name });

  if (result.alreadyExisted) {
    console.warn('[stripe-webhook] buyer already had an account — no set-password email sent', {
      sessionId,
      preorderId,
    });
  } else if (result.error) {
    console.error('[stripe-webhook] account provisioning failed', { sessionId, preorderId, result });
  }

  // The moment an account exists is the only moment we can be sure the buyer's
  // free mock and their new account are the same person: the purchase, the
  // verified trial lead and the auth user all key off the same address. Run on
  // BOTH paths — a repeat buyer (`alreadyExisted`) is exactly the person most
  // likely to have sat the free station first.
  //
  // Deliberately after the send and deliberately swallowed: a buyer's account
  // and their set-password email are what this function owes them, and neither
  // may be put at risk by a nice-to-have that reattaches an old consultation.
  if (result.userId) {
    try {
      const claimed = await claimTrialSessionsForUser(supabase, result.userId, email);
      if (claimed > 0) {
        console.info('[stripe-webhook] claimed guest trial sessions for new account', {
          sessionId,
          preorderId,
          claimed,
        });
      }
    } catch (error: unknown) {
      console.error('[stripe-webhook] trial claim threw', { sessionId, preorderId, error });
    }
  }

  const stamps: { provisioned_at?: string; set_password_sent_at?: string } = {};
  // `alreadyExisted` stamps as provisioned too — the column is documented as
  // "created (OR FOUND TO ALREADY EXIST)", and a repeat buyer has to reach a
  // terminal state. Left unstamped they were indistinguishable from a Brevo
  // casualty forever: every Stripe retry for three days re-attempted createUser,
  // and the "who is still owed an email" query could never drain.
  if (result.created || result.alreadyExisted) stamps.provisioned_at = now;
  // And the send obligation is closed with it. An account that already exists
  // keeps its password and is owed no link, so leaving this NULL would send the
  // next retry down the resend branch above and mail them one they never asked
  // for. Null must mean "still owes an email" and nothing else.
  if (result.emailSent || result.alreadyExisted) stamps.set_password_sent_at = now;

  if (Object.keys(stamps).length === 0) return;

  const { error } = await supabase
    .from('preorders')
    .update(stamps)
    .eq('id', preorderId)
    .is('set_password_sent_at', null)
    .select('id');

  if (error) {
    // The email went out; failing to stamp risks one duplicate on the next
    // retry, which is far less harmful than never provisioning at all.
    console.error('[stripe-webhook] provisioning stamp failed', { sessionId, preorderId, error });
  }
}
