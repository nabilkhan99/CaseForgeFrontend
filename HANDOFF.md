# HANDOFF — feat/provisioning-hardening

Audit findings from the 2026-08-20 adversarial review of `9a1d75d` that this
branch **could not** fix, because they live in files owned by the concurrent
`feat/tier-gating-expiry` work (`lib/supabase/middleware.ts`,
`lib/stations/visibility.ts`, `app/api/realtime-token/*`,
`app/api/clinical-master/create-session/*`).

Line numbers are against `origin/develop` @ `928a161`; none of these files are
touched by this branch, so they should still be accurate.

---

## [1, belt-and-braces] `lib/supabase/middleware.ts:103-105` — the preorders read has no WHERE

The select trusts RLS alone to scope it. This branch asserts RLS in the
migration (`20260820200000_preorders_read_own_by_email.sql`), so the leak is
closed at the DB — but the query should not depend on that being true.

```diff
-            const { data: purchases } = await supabase
+            const { data: purchases } = await supabase
                 .from('preorders')
-                .select('plan, status, created_at, coaching_day');
+                .select('plan, status, created_at, coaching_day')
+                .eq('email', (user.email ?? '').toLowerCase());
```

Related, from finding 9: add `.order('created_at')` for a stable read. The
entitlement fold is now order-independent (fixed on this branch), so this is
belt-and-braces too, not a correctness requirement.

## [3, HIGH] The paid APIs don't check entitlement at all

`lib/supabase/middleware.ts:95-96` gates `pathname.startsWith('/clinical-master')`,
which never matches `/api/clinical-master/*` or `/api/realtime-token`. Both
routes check only `getUser()`:

- `app/api/realtime-token/route.ts:20-22`
- `app/api/clinical-master/create-session/route.ts:8-10`

So any signed-in account — expired, `read_only`, refunded, an old invite-tester,
a `/try` conversion that never paid — can POST `{sessionId: crypto.randomUUID(),
stationId}` and get a live Azure `gpt-realtime` ephemeral key. Unlimited
consultations at real per-minute cost, zero payment.

Suggested shape (a server helper, since both routes need it, and it must apply
the same staged/admin bypass the middleware does):

```ts
// lib/commerce/requireEntitlement.ts
export async function hasActiveEntitlement(supabase, user): Promise<boolean> {
  const { data } = await supabase
    .from('preorders')
    .select('plan, status, created_at, coaching_day')
    .eq('email', (user.email ?? '').toLowerCase());
  if (computeEntitlement(data ?? []).state === 'active') return true;
  return isStagedDeployment() || parseAdminEmails(process.env.ADMIN_EMAILS).has((user.email ?? '').toLowerCase());
}
```

then in each route, right after the `if (!user)` guard:

```diff
+  if (!(await hasActiveEntitlement(supabase, user))) {
+    return NextResponse.json({ error: 'No active plan' }, { status: 402 });
+  }
```

Note `create-session` uses the user-scoped client (RLS applies); `realtime-token`
has both a user client and `getSupabaseAdmin()` — do the check on the user
client so the same RLS path is exercised.

## [5, HIGH] `lib/supabase/middleware.ts:103-106` fails CLOSED on the failure that actually happens

The comment at `:115-117` says "Fail open — don't block paid users on transient
DB errors", but supabase-js doesn't throw on a query error: it returns
`{data: null, error}`. `error` is dropped, so a transient PostgREST/RLS/network
error yields `data: null` → `computeEntitlement([])` → `'none'` → a paying
customer is redirected to `/pricing?upgrade=true`, which reads as "your purchase
doesn't exist".

```diff
-            const { data: purchases } = await supabase
+            const { data: purchases, error: purchasesError } = await supabase
                 .from('preorders')
                 .select('plan, status, created_at, coaching_day');
+            if (purchasesError) return supabaseResponse; // fail open, for real this time
```

## [6, HIGH] `lib/supabase/middleware.ts:121-126` bounces a re-clicked set-password link to /dashboard

`verifyOtp` on the `@supabase/ssr` browser client writes the session to cookies,
so the second visit to `/auth/set-password` is an authenticated request under
`/auth/*` and gets redirected before the page renders. The user never sets a
password; when the session expires they cannot sign in. The in-page
`getSession()` short-circuit written for exactly this case is unreachable in
production because middleware runs first.

```diff
-    const isAuthRoute = request.nextUrl.pathname.startsWith('/auth');
+    // Password-setting pages are reached WITH a session (a recovery token
+    // established it), so they must not be swept up by the authed-/auth
+    // redirect — that's how a re-clicked set-password link dead-ends.
+    const isPasswordSetRoute =
+        request.nextUrl.pathname.startsWith('/auth/set-password') ||
+        request.nextUrl.pathname.startsWith('/auth/reset-password');
+    const isAuthRoute = request.nextUrl.pathname.startsWith('/auth') && !isPasswordSetRoute;
```

This branch fixed the client half (verifyOtp errors re-check `getSession()`
before declaring expiry), but that only helps within a single page load. Without
the middleware exemption, the second click still never reaches the page.

## [13, MEDIUM] `lib/stations/visibility.ts:24` is one env var away from giving the product away

`NEXT_PUBLIC_SHOW_STAGED_STATIONS === '1'` makes every signed-in user fully
entitled (`middleware.ts:108`). It is a build-time `NEXT_PUBLIC_` var whose only
guard is a comment saying "Never set in Production".

```diff
-    return process.env.NEXT_PUBLIC_SHOW_STAGED_STATIONS === '1';
+    return (
+        process.env.NEXT_PUBLIC_SHOW_STAGED_STATIONS === '1' &&
+        process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production'
+    );
```

---

## Things on this branch the middleware owner should know

1. **`computeEntitlement` can now return `state: 'none'` with a `plan` and an
   `expiresAt` set.** That is a preorder bought before 1 Sept: the purchase
   exists, access hasn't opened yet. The audit wanted a distinct `'pending'`
   state; the plan forbade adding a union member (the type is shared with your
   branch), so it is folded into `'none'`. **Today the middleware sends those
   users to `/pricing?upgrade=true`** — the wrong message for someone who has
   already paid. Distinguishing them is a one-liner where the redirect is built:
   `entitlement.plan && entitlement.state === 'none'` means "paid, not open
   yet". Worth a `?pending=true` (or a /thanks bounce) before 1 Sept.

2. **`ACCESS_WINDOW_DAYS` is gone**, replaced by `ACCESS_WINDOW_MONTHS = 3`.
   Nothing imported it outside `entitlements.ts`, but if your branch added an
   import it will need updating. `ACCESS_LAUNCH_DATE` is now derived from
   `plans.ts` `ACCESS_OPENS`.

3. **Window end moved.** It is 3 calendar months, ending 23:59:59.999 UTC, and
   `end` is now INCLUSIVE (`now > end` is lapsed, not `now >= end`). A 5 Sept
   buyer's access ends at the end of 5 Dec, not 10:00 on 4 Dec.

4. **Unknown plan strings now yield `null`** (nothing) plus a `console.error`,
   instead of a silent 90-day full grant. If any live `preorders` row carries a
   plan string outside `PLANS` (`self_study`, `self_study_monthly`, `complete`,
   `intensive`) that customer will lose access — worth a quick check of
   `select distinct plan from preorders` before this ships.

5. **`provisionAccountForPurchase` no longer takes `origin`.** Emailed auth
   links always use `SITE_URL`.

6. **New migration, NOT applied:**
   `supabase/migrations/20260821_preorders_provisioning_stamps.sql` adds
   `provisioned_at` and `set_password_sent_at` to `preorders`. The Stripe
   webhook reads and writes both. Until it is applied, provisioning degrades to
   a no-op: the stamp read is deliberately its own query (not part of the
   preorder insert) so a missing column logs
   `[stripe-webhook] provisioning state read failed — skipping` and the purchase
   still records cleanly — but **no buyer gets an account until it is applied**.
   Apply it before, or with, the deploy of this branch.

7. **`20260820200000_preorders_read_own_by_email.sql` was edited in place** (per
   the plan) and now drops/recreates the policy. Re-applying it is safe and
   idempotent.

8. **New route** `POST /api/auth/resend-set-password`. Unauthenticated by
   design (the caller has no session yet — that's the point), returns a generic
   body either way, and needs `SUPABASE_SERVICE_ROLE_KEY` + `BREVO_API_KEY`.
   There is no rate limiter in this repo to hang it off; it is
   rate-limit-*friendly* only in that it sidesteps Supabase's 60s
   resetPasswordForEmail throttle. If the orchestrator adds a limiter, this
   route should be behind it.
