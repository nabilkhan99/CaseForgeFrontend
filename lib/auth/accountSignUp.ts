import 'server-only';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { exactEmailPattern } from '@/lib/commerce/emailFilter';
import type { ProvisionResult } from '@/lib/auth/provisioning';

/**
 * Account-first sign-up: the four GoTrue calls the free door needs and
 * `lib/auth/provisioning` does not have.
 *
 * Provisioning was written for a PURCHASE, where Stripe knows the address and
 * nobody has chosen a password yet — so it creates a passwordless account
 * stamped `password_pending: true` and mails a link. From 7 September 2026 the
 * free door works the other way round: the trainee types an email, a mobile and
 * a password, proves the address with a 6-digit code, and is signed in on the
 * same request. There is no link, no second email and no set-password page.
 *
 * A separate module rather than more surface on `provisioning.ts` for two
 * reasons: that file is the purchase path's and its `password_pending` stamp is
 * exactly what must NOT happen here, and keeping the two apart means the
 * middleware's password gate cannot be turned off by a change made for the
 * trial.
 *
 * ⚠️ Nothing here ever changes a password that already exists. Verifying an
 * emailed code proves the mailbox, which is the same proof a reset gives — but
 * a paying customer who types their address into the free form must not have
 * their password silently rotated, so an account that has finished its setup is
 * signed in and left alone. See {@link setPasswordIfUnset}.
 *
 * SILENTLY was the bug. The rule is right; not saying so was not. The result
 * now carries `passwordKept`, and the forms tell the person their existing
 * password still applies rather than letting them find out on the next
 * sign-in — see {@link PasswordProvisionResult}.
 */

function adminAuth() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** What we can learn about an address before mailing it anything. */
export interface ExistingAccount {
  userId: string;
  /**
   * The account was provisioned for a purchase or a guest reveal and its owner
   * has never chosen a password. It is theirs, but they cannot sign in with one
   * yet — so the sign-up form finishes the job rather than turning them away.
   */
  passwordPending: boolean;
}

/**
 * The account behind an address, or null.
 *
 * `public.profiles` is the map from address to id (a trigger on `auth.users`
 * keeps it complete — see the note in lib/auth/provisioning), and the admin API
 * then says whether setup was ever finished. Best-effort: any failure returns
 * null, which the callers read as "carry on", never as "no account".
 */
export async function findAccountByEmail(emailRaw: string): Promise<ExistingAccount | null> {
  const email = emailRaw.trim().toLowerCase();
  if (!email) return null;

  const supabase = adminAuth();
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', exactEmailPattern(email))
      .maybeSingle();
    if (error) throw error;

    const userId = (data as { id?: string } | null)?.id;
    if (!userId) return null;

    const { data: found, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError) throw userError;

    return {
      userId,
      passwordPending: found?.user?.user_metadata?.password_pending === true,
    };
  } catch (error: unknown) {
    console.error('[account-signup] account lookup failed', { error });
    return null;
  }
}

/**
 * A provisioning result that also says what happened to the password.
 *
 * `provisionAccountWithPassword` is given a password the person has just typed
 * and is sometimes obliged to ignore it (see {@link setPasswordIfUnset}). That
 * used to be invisible: the form said "Create my free account", the account was
 * somebody's existing one, the password went nowhere and nothing said so — and
 * the next time they came back, the password they believed they had set did not
 * work. `passwordKept` is what lets the caller tell them.
 */
export interface PasswordProvisionResult extends ProvisionResult {
  /**
   * The account already existed WITH a password, so the one typed on this form
   * was deliberately not applied and the old one still signs them in.
   *
   * False on every other path, including a half-provisioned account that has
   * just been given the password it never had.
   */
  passwordKept: boolean;
}

export interface SignUpAccountInput {
  email: string;
  /** Already length-checked by the caller. Never logged. */
  password: string;
  fullName?: string | null;
  /** E.164 where we could parse it. Goes on the auth user for the founder's call. */
  phone?: string | null;
}

/**
 * Create the account WITH its password, or finish one that never got a password.
 *
 * Deliberately shaped like {@link import('./provisioning').provisionAccountForPurchase}
 * so `ensureTrialAccount` can swap one for the other, and deliberately
 * different in the one way that matters: no `password_pending` stamp, because
 * the person has just chosen a password and must not meet the middleware's
 * set-password gate on the way to the station they clicked.
 */
export async function provisionAccountWithPassword(
  input: SignUpAccountInput,
): Promise<PasswordProvisionResult> {
  const supabase = adminAuth();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim() || null;

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    // The 6-digit code already proved the mailbox, so asking them to confirm it
    // a second time from an email would be asking for the same proof twice.
    email_confirm: true,
    user_metadata: {
      ...(input.fullName ? { full_name: input.fullName } : {}),
      // NOT the auth user's `phone` column: that one is a login identity GoTrue
      // wants verified by SMS, and no SMS is ever sent on this path. Metadata is
      // a note to us, which is all this number is.
      ...(phone ? { phone } : {}),
    },
  });

  if (!createError) {
    return {
      created: true,
      alreadyExisted: false,
      userId: created?.user?.id ?? null,
      passwordKept: false,
    };
  }

  const alreadyExists =
    createError.code === 'email_exists' || /already/i.test(createError.message);
  if (!alreadyExists) {
    return {
      created: false,
      alreadyExisted: false,
      userId: null,
      error: createError.message,
      passwordKept: false,
    };
  }

  const existing = await findAccountByEmail(email);
  if (!existing) {
    return {
      created: false,
      alreadyExisted: true,
      userId: null,
      error: 'account_already_exists',
      passwordKept: false,
    };
  }

  // Read BEFORE the write: an account that has finished its setup is the one
  // whose password survives this form, and after `setPasswordIfUnset` has run
  // the two cases are indistinguishable.
  const passwordKept = !existing.passwordPending;

  await setPasswordIfUnset(existing, { password: input.password, fullName: input.fullName, phone });

  return {
    created: false,
    alreadyExisted: true,
    userId: existing.userId,
    error: 'account_already_exists',
    passwordKept,
  };
}

/**
 * Give a half-provisioned account the password it never had.
 *
 * ONLY when `passwordPending` is true. An account that has finished its setup
 * keeps its password whatever this form was told: the person in front of us has
 * proved the mailbox, so they are let in, but "signing up again" is not a
 * password reset and must not act like one. /auth/reset-password is.
 *
 * Never throws: the account and the grant are the point, and somebody who ends
 * up signed in without the password they typed can still set one from the
 * ordinary reset flow.
 */
async function setPasswordIfUnset(
  account: ExistingAccount,
  input: { password: string; fullName?: string | null; phone?: string | null },
): Promise<void> {
  if (!account.passwordPending) return;

  try {
    const { error } = await adminAuth().auth.admin.updateUserById(account.userId, {
      password: input.password,
      email_confirm: true,
      user_metadata: {
        ...(input.fullName ? { full_name: input.fullName } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
        // The middleware gates on `=== true`, and /auth/set-password clears it
        // the same way after the same kind of choice.
        password_pending: false,
      },
    });
    if (error) throw error;
  } catch (error: unknown) {
    console.error('[account-signup] could not set the password on an existing account', { error });
  }
}

/**
 * Sign the browser in, on this request, with cookies.
 *
 * A magic-link token minted server-side and immediately spent server-side. The
 * pattern is app/api/auth/start's — a ROUTE HANDLER may write cookies through
 * `next/headers`, so `verifyOtp` here leaves the response carrying a real
 * Supabase session and the client only has to navigate.
 *
 * `magiclink` rather than the `recovery` hash /auth/start redeems: recovery puts
 * the client into a password-recovery state, which is right for a link that
 * lands on a set-password page and wrong for somebody who has just chosen their
 * password on the form behind this call.
 *
 * ⚠️ The token never leaves the server. It is minted, spent and dropped inside
 * one request, and no branch of this function returns or logs it — a hashed
 * magic-link token in a JSON body is a bearer credential for the account.
 *
 * Never throws. A false return means "the account is real, the session is not",
 * and every caller has a signed-out path to offer.
 */
export async function signInWithMagicLink(emailRaw: string): Promise<boolean> {
  const email = emailRaw.trim().toLowerCase();
  if (!email) return false;

  let tokenHash = '';
  try {
    const { data: link, error } = await adminAuth().auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (error || !link?.properties?.hashed_token) {
      console.error('[account-signup] no magic-link token minted', {
        error: error?.message ?? 'no token in link',
      });
      return false;
    }
    tokenHash = link.properties.hashed_token;
  } catch (error: unknown) {
    console.error('[account-signup] generateLink threw', { error });
    return false;
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
    if (error) {
      console.error('[account-signup] verifyOtp refused a token we had just minted', {
        error: error.message,
      });
      return false;
    }
    return true;
  } catch (error: unknown) {
    console.error('[account-signup] verifyOtp threw', { error });
    return false;
  }
}
