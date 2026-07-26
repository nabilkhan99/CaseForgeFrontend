import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin/guard';
import { qualificationCutoff, referralUrl } from '@/lib/commerce/referrals';
import { validateNewCode } from '@/lib/commerce/advocates';
import {
  computeDashboardStats,
  type CodeRow,
  type ReferralRow,
} from '@/lib/commerce/referralStats';

/**
 * Build the request origin the same way /thanks does: prefer the forwarded
 * proto/host headers (Vercel sits behind a proxy), falling back to the prod
 * host. Used to hand each advocate a fully-qualified shareable link.
 */
function getOrigin(request: Request): string {
  const host = request.headers.get('host') ?? 'www.fourteenfisherman.com';
  const proto = request.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export interface AdminReferral {
  id: string;
  referral_code: string;
  referrer_email: string;
  referee_email: string;
  plan: string;
  amount: number;
  reward_amount: number;
  status: 'pending' | 'qualified' | 'paid' | 'void';
  void_reason: string | null;
  created_at: string;
  qualified_at: string | null;
  paid_at: string | null;
}

/**
 * Admin referrals API. Guarded (fail-closed) by the ADMIN_EMAILS allowlist —
 * the check runs before any data access. Returns 403 JSON when not authorized.
 *
 * GET  — lazily qualifies eligible pending referrals, then returns the full list.
 * POST — discriminated on `action`:
 *   - `mark_paid`   { id }                          — mark a qualified referral paid.
 *   - `create_code` { ownerName, ownerEmail, code?, rewardOverridePence? }
 *                                                    — issue an affiliate code.
 *   - `set_active`  { code, active }                — activate/deactivate a code.
 */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // ── Lazy qualification (no cron) ──
  // Flip pending -> qualified for rows past the qualification window (5 days,
  // floored at the 1 Sept 2026 launch — see PAYOUT_FLOOR_DATE) whose preorder is
  // still paid. Two-step: select eligible ids (guarded by preorder status), then
  // update just those ids so a refunded/canceled preorder can never qualify.
  try {
    // .lte against qualificationCutoff == the inclusive isPastQualificationWindow boundary.
    const cutoff = qualificationCutoff(new Date()).toISOString();
    const { data: eligible, error: selectError } = await supabase
      .from('referrals')
      .select('id, preorders(status)')
      .eq('status', 'pending')
      .lte('created_at', cutoff);

    if (selectError) {
      console.error('[admin-referrals] qualification select failed', selectError);
    } else if (eligible && eligible.length > 0) {
      const ids = eligible
        .filter((r) => {
          const preorder = r.preorders as { status?: string } | { status?: string }[] | null;
          const status = Array.isArray(preorder) ? preorder[0]?.status : preorder?.status;
          return status === 'paid';
        })
        .map((r) => r.id);

      if (ids.length > 0) {
        const { error: updateError } = await supabase
          .from('referrals')
          .update({ status: 'qualified', qualified_at: new Date().toISOString() })
          .in('id', ids)
          .eq('status', 'pending');
        if (updateError) {
          console.error('[admin-referrals] qualification update failed', updateError);
        }
      }
    }
  } catch (error: unknown) {
    console.error('[admin-referrals] lazy qualification error', error);
  }

  const { data, error } = await supabase
    .from('referrals')
    .select(
      'id, referral_code, referrer_email, referee_email, plan, amount, reward_amount, status, void_reason, created_at, qualified_at, paid_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin-referrals] list query failed', error);
    return NextResponse.json({ error: 'Failed to load referrals' }, { status: 500 });
  }

  const referrals = (data ?? []) as AdminReferral[];

  // ── Dashboard aggregates ──
  // Fetch the advocate codes (including zero-referral ones — their clicks still
  // count) and roll everything up with the pure computeDashboardStats. A codes
  // query failure degrades gracefully: the payout queue still renders from
  // `referrals`, only the stats strip falls back to an empty aggregate.
  const { data: codeData, error: codesError } = await supabase
    .from('referral_codes')
    .select('code, owner_email, owner_name, active, click_count, created_at, code_type, reward_override_pence');

  if (codesError) {
    console.error('[admin-referrals] codes query failed', codesError);
  }

  const stats = computeDashboardStats(
    (codeData ?? []) as CodeRow[],
    referrals as ReferralRow[],
  );

  // Attach a fully-qualified shareable link to each advocate so the admin can
  // copy it straight from the dashboard (the pure stats lib has no origin).
  const origin = getOrigin(request);
  const advocates = stats.advocates.map((a) => ({ ...a, link: referralUrl(origin, a.code) }));

  return NextResponse.json({ referrals, stats: { ...stats, advocates } });
}

interface PostBody {
  action?: string;
  id?: string;
  ownerName?: string;
  ownerEmail?: string;
  code?: string;
  rewardOverridePence?: number | null;
  active?: boolean;
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  switch (body.action) {
    case 'mark_paid':
      return markPaid(supabase, body);
    case 'create_code':
      return createCode(supabase, request, body);
    case 'set_active':
      return setActive(supabase, body);
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

/** Mark a qualified referral as paid out. Unchanged from the original handler. */
async function markPaid(supabase: SupabaseAdmin, body: PostBody) {
  if (!body.id) {
    return NextResponse.json({ error: 'Expected { id, action: "mark_paid" }' }, { status: 400 });
  }

  // Only a qualified referral can be marked paid (prevents paying pending/void rows).
  const { data, error } = await supabase
    .from('referrals')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', body.id)
    .eq('status', 'qualified')
    .select('id, status, paid_at')
    .maybeSingle();

  if (error) {
    console.error('[admin-referrals] mark_paid failed', { id: body.id, error });
    return NextResponse.json({ error: 'Failed to mark paid' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Referral not found or not in qualified state' }, { status: 409 });
  }

  return NextResponse.json({ success: true, referral: data });
}

/**
 * Issue a deliberate affiliate code (cofounder / influencer / partner) for
 * someone who hasn't bought. Validated by the pure `validateNewCode`; stamped
 * `code_type: 'affiliate'` with `invited_at: now()` because the admin hands the
 * link over directly — there is no auto invite email. A unique-violation (23505)
 * means the code is already taken.
 */
async function createCode(supabase: SupabaseAdmin, request: Request, body: PostBody) {
  const result = validateNewCode({
    ownerName: body.ownerName,
    ownerEmail: body.ownerEmail,
    code: body.code,
    rewardOverridePence: body.rewardOverridePence,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const { code, ownerName, ownerEmail, rewardOverridePence } = result.value;
  const { data, error } = await supabase
    .from('referral_codes')
    .insert({
      code,
      owner_email: ownerEmail,
      owner_name: ownerName,
      code_type: 'affiliate',
      reward_override_pence: rewardOverridePence,
      active: true,
      invited_at: new Date().toISOString(),
    })
    .select('code, owner_email, owner_name, active, click_count, created_at, code_type, reward_override_pence')
    .single();

  if (error) {
    if (error.code === '23505') {
      // Either the code PK or the owner_email unique constraint clashed.
      return NextResponse.json({ error: 'That code already exists — pick another' }, { status: 409 });
    }
    console.error('[admin-referrals] create_code failed', { code, error });
    return NextResponse.json({ error: 'Failed to create code' }, { status: 500 });
  }

  const link = referralUrl(getOrigin(request), data.code);
  return NextResponse.json({ code: { ...data, link } });
}

/** Activate or deactivate an existing code without deleting its history. */
async function setActive(supabase: SupabaseAdmin, body: PostBody) {
  if (typeof body.code !== 'string' || !body.code || typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'Expected { code, active: boolean }' }, { status: 400 });
  }

  const { error } = await supabase
    .from('referral_codes')
    .update({ active: body.active })
    .eq('code', body.code);

  if (error) {
    console.error('[admin-referrals] set_active failed', { code: body.code, error });
    return NextResponse.json({ error: 'Failed to update code' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
