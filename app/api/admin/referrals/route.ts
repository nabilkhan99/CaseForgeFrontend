import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin/guard';
import { qualificationCutoff } from '@/lib/commerce/referrals';
import {
  computeDashboardStats,
  type CodeRow,
  type ReferralRow,
} from '@/lib/commerce/referralStats';

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
 * POST — { id, action: 'mark_paid' } marks a qualified referral as paid out.
 */
export async function GET() {
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
    .select('code, owner_email, owner_name, active, click_count, created_at');

  if (codesError) {
    console.error('[admin-referrals] codes query failed', codesError);
  }

  const stats = computeDashboardStats(
    (codeData ?? []) as CodeRow[],
    referrals as ReferralRow[],
  );

  return NextResponse.json({ referrals, stats });
}

interface PostBody {
  id?: string;
  action?: string;
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

  if (!body.id || body.action !== 'mark_paid') {
    return NextResponse.json({ error: 'Expected { id, action: "mark_paid" }' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
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
