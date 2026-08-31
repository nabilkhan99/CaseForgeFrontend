import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { claimTrialSessionsForUser } from './claimTrialSessions';
import { mintSetPasswordLink, provisionAccountForPurchase } from './provisioning';

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
 * ONE EMAIL. Since the receipt work, the mail this sends IS the receipt — the
 * setup link is its button and the PDF is attached. It used to be a separate
 * "your account is ready" mail arriving seconds after a purchase confirmation,
 * which between them buried the only thing the buyer had to do. What is sent is
 * injected as {@link DeliverReceipt}: this module owns WHEN and WHETHER, the
 * webhook owns WHAT.
 *
 * The stamps are read in their own query rather than off the insert: they
 * arrive in a later migration than the rest of the table, and a deploy that
 * landed before it must degrade to "no provisioning" rather than failing the
 * whole purchase record. Best-effort throughout for the same reason — a
 * provisioning failure must never fail the webhook, or Stripe would re-process
 * a pre-order that was recorded fine.
 */

/**
 * Sends the buyer's receipt email.
 *
 * `setupUrl` is the single-use set-password link, or null when there is none to
 * send — the buyer already had an account, or the link could not be minted. A
 * null link changes the mail's button, never whether it goes: somebody who has
 * just been charged is owed their receipt either way.
 */
export type DeliverReceipt = (args: {
  setupUrl: string | null;
}) => Promise<{ sent: boolean; error?: string }>;

export interface ProvisionBuyerArgs {
  preorderId: string;
  email: string;
  name: string | null;
  sessionId: string;
  /** Sends the receipt. See {@link DeliverReceipt}. */
  deliver: DeliverReceipt;
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
  // Already emailed; nothing owed. This is also what stops the deploy of this
  // change re-mailing every buyer who was provisioned under the old two-email
  // flow — their stamp is already set.
  if (row.set_password_sent_at) return;

  const now = new Date().toISOString();

  try {
    if (row.provisioned_at) {
      // The account exists from an earlier attempt; only the mail is owed.
      await deliverUnderClaim(supabase, args, now, { mintLink: true });
      return;
    }
    await createAccountAndSend(supabase, args, now);
  } catch (error: unknown) {
    console.error('[stripe-webhook] account provisioning threw', { sessionId, preorderId, error });
  }
}

/**
 * Claim the send, then make it. The lock for the whole delivery.
 *
 * The stamp is CLAIMED BEFORE the send, not written after it. Two Stripe
 * deliveries can sit here at once and nothing downstream separates them: both
 * would email, and — worse — the second `generateLink` would invalidate the
 * first, so the buyer opens whichever mail arrived first and is told it
 * expired. The guarded update is the lock, and whoever wins it owns the send.
 *
 * Minting happens INSIDE the claim for exactly that reason: a delivery that is
 * not going to send must never mint, because minting is what invalidates the
 * link the winner just sent.
 *
 * If the send then fails the stamp is handed straight back, so the next retry
 * picks the buyer up again. A link recorded as sent but never sent is precisely
 * the stranded buyer this whole mechanism exists to prevent.
 */
async function deliverUnderClaim(
  supabase: PreorderAdmin,
  args: ProvisionBuyerArgs,
  now: string,
  options: { mintLink: boolean },
): Promise<void> {
  const { preorderId, email, sessionId, deliver } = args;

  const claimed = await claimSendStamp(supabase, preorderId, now, sessionId);
  if (!claimed) return;

  let setupUrl: string | null = null;
  if (options.mintLink) {
    const minted = await mintSetPasswordLink({ email });
    setupUrl = minted.url;
    if (!minted.url) {
      // Not fatal. The receipt still goes — it is proof of a payment that has
      // already happened — and the buyer can ask for a fresh link themselves.
      console.error('[stripe-webhook] no set-password link to send; sending the receipt anyway', {
        sessionId,
        preorderId,
        error: minted.error,
      });
    }
  }

  // The send is wrapped, not just checked. We are holding the claim, so ANY
  // exit from here that is not a successful send has to hand it back — and a
  // THROWN error would otherwise skip the release below and leave the row
  // reading "already emailed" for a mail that never went. That is exactly the
  // stranded buyer the whole compare-and-swap exists to prevent.
  let result: { sent: boolean; error?: string }
  try {
    result = await deliver({ setupUrl });
  } catch (error: unknown) {
    result = { sent: false, error: error instanceof Error ? error.message : String(error) };
  }
  if (result.sent) return;

  console.error('[stripe-webhook] receipt email failed', { sessionId, preorderId, result });
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
    console.warn('[stripe-webhook] buyer already had an account — receipt only, no set-password link', {
      sessionId,
      preorderId,
    });
  } else if (result.error) {
    // No account, so no send and no stamps: Stripe's retry has to come back and
    // try again, and it can only do that if the row still reads "owed".
    console.error('[stripe-webhook] account provisioning failed — nothing sent, awaiting retry', {
      sessionId,
      preorderId,
      result,
    });
    return;
  }

  // The account exists. Record that before the send, so a send that fails takes
  // the next retry down the resend branch rather than re-attempting createUser
  // for three days. `alreadyExisted` stamps too — the column is documented as
  // "created (OR FOUND TO ALREADY EXIST)", and a repeat buyer has to reach a
  // terminal state.
  await stampProvisioned(supabase, preorderId, now, sessionId);

  // The moment an account exists is the only moment we can be sure the buyer's
  // free mock and their new account are the same person: the purchase, the
  // verified trial lead and the auth user all key off the same address. Run on
  // BOTH paths — a repeat buyer (`alreadyExisted`) is exactly the person most
  // likely to have sat the free station first.
  //
  // Deliberately swallowed: a buyer's account and their receipt are what this
  // function owes them, and neither may be put at risk by a nice-to-have that
  // reattaches an old consultation.
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

  // A buyer who already had an account keeps their password and is owed no
  // link — only the receipt.
  await deliverUnderClaim(supabase, args, now, { mintLink: !result.alreadyExisted });
}

async function stampProvisioned(
  supabase: PreorderAdmin,
  preorderId: string,
  now: string,
  sessionId: string,
): Promise<void> {
  const { error } = await supabase
    .from('preorders')
    .update({ provisioned_at: now })
    .eq('id', preorderId)
    .is('provisioned_at', null);

  if (error) {
    // Not fatal: the worst case is that a retry re-attempts an idempotent
    // createUser. Losing the SEND stamp would matter; losing this one does not.
    console.error('[stripe-webhook] provisioning stamp failed', { sessionId, preorderId, error });
  }
}
