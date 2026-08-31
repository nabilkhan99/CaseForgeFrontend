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

  // ONE claim, taken before anything is created, minted or sent.
  //
  // It sits above the branch rather than inside the send, and that placement is
  // load-bearing. Two concurrent Stripe deliveries of a NEW purchase both find
  // `provisioned_at` null and both call `admin.createUser`; exactly one gets
  // `created`, the other gets `alreadyExisted`. Which of them then won the send
  // was an unrelated race — and if the `alreadyExisted` one won, it sent "you
  // already have an account, just sign in" to a buyer whose account had just
  // been created with no password, and the stamp was set for good. Claiming
  // first means only one delivery ever reaches createUser, so `alreadyExisted`
  // means what it says: the account genuinely predates this purchase.
  const claimed = await claimSendStamp(supabase, preorderId, now, sessionId);
  if (!claimed) return;

  // From here we own the send, so EVERY exit that is not a successful send has
  // to hand the claim back — including a thrown one. A stamp written for a mail
  // that never went is the stranded buyer this whole mechanism exists to
  // prevent, and no later retry would revisit them.
  let result: { sent: boolean; error?: string };
  try {
    result = row.provisioned_at
      ? // The account exists from an earlier attempt; only the mail is owed.
        await mintAndDeliver(args, { mintLink: true })
      : await createAccountThenDeliver(supabase, args, now);
  } catch (error: unknown) {
    console.error('[stripe-webhook] account provisioning threw', { sessionId, preorderId, error });
    result = { sent: false, error: error instanceof Error ? error.message : String(error) };
  }

  if (result.sent) return;

  console.error('[stripe-webhook] receipt email not sent — handing the claim back', {
    sessionId,
    preorderId,
    result,
  });
  await releaseSendStamp(supabase, preorderId, sessionId);
}

/** First attempt for this buyer: create the auth user, then send. */
async function createAccountThenDeliver(
  supabase: PreorderAdmin,
  args: ProvisionBuyerArgs,
  now: string,
): Promise<{ sent: boolean; error?: string }> {
  const { preorderId, email, name, sessionId } = args;

  const result = await provisionAccountForPurchase({ email, fullName: name });

  if (!result.created && !result.alreadyExisted) {
    // No account, so no send: Stripe's retry has to come back and try again,
    // and it can only do that if the claim goes back. Our caller does that.
    console.error('[stripe-webhook] account provisioning failed — nothing sent, awaiting retry', {
      sessionId,
      preorderId,
      result,
    });
    return { sent: false, error: result.error };
  }

  if (result.alreadyExisted) {
    console.warn('[stripe-webhook] buyer already had an account — receipt only, no set-password link', {
      sessionId,
      preorderId,
    });
  }

  // Record that the account exists BEFORE sending, so a send that fails takes
  // the next retry down the resend branch rather than re-attempting createUser.
  // `alreadyExisted` stamps too — the column is documented as "created (OR
  // FOUND TO ALREADY EXIST)", and a repeat buyer has to reach a terminal state.
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
  return mintAndDeliver(args, { mintLink: !result.alreadyExisted });
}

/**
 * Mint the link (when one is owed) and send the mail.
 *
 * Only ever reached by the delivery holding the claim. That matters for the
 * mint specifically: minting INVALIDATES the previous link, so a delivery that
 * is not going to send must never mint, or it would kill the link the winner
 * just emailed and the buyer would be told theirs had expired.
 */
async function mintAndDeliver(
  args: ProvisionBuyerArgs,
  options: { mintLink: boolean },
): Promise<{ sent: boolean; error?: string }> {
  const { preorderId, email, sessionId, deliver } = args;

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

  return deliver({ setupUrl });
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

/**
 * Hand the claim back. Retried once, because this is the write that decides
 * whether a buyer is recoverable.
 *
 * It is the compensating write for a claim we took and could not honour, and
 * if it never lands the buyer is stranded for good: `set_password_sent_at`
 * stays stamped, `provisionBuyerAccount`'s early return blocks every future
 * Stripe retry, and when the thing that failed was `createUser` there is not
 * even an auth user for the self-serve resend to mint a link against — so that
 * escape hatch is closed too.
 *
 * One retry is not a guarantee and is not meant to be. The realistic cause is a
 * transient blip on a connection that worked moments earlier for the claim, and
 * a second attempt costs one round trip against that. A genuine outage still
 * ends in the CRITICAL log below, which is the ops signal to resend by hand.
 */
async function releaseSendStamp(
  supabase: PreorderAdmin,
  preorderId: string,
  sessionId: string,
): Promise<void> {
  for (const attempt of [1, 2]) {
    const { error } = await supabase
      .from('preorders')
      .update({ set_password_sent_at: null })
      .eq('id', preorderId);

    if (!error) return;

    console.error('[stripe-webhook] send stamp release failed', {
      sessionId,
      preorderId,
      attempt,
      error,
    });
  }

  console.error(
    '[stripe-webhook] CRITICAL: could not release the send stamp — this buyer is stranded and needs a manual resend',
    { sessionId, preorderId },
  );
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
