import type { Metadata } from 'next';
import { normalizeCode, referralUrl, REWARD_BY_PLAN } from '@/lib/commerce/referrals';
import { verifyShareToken } from '@/lib/commerce/shareToken';
import { buildAdvocateProgress, type AdvocateReferralRow } from '@/lib/commerce/advocateProgress';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import ShareCard from '@/components/referrals/ShareCard';
import ProgressPanel from '@/components/referrals/ProgressPanel';

export const metadata: Metadata = {
  title: 'Share your referral link — Fourteen Fisherman',
  // The page exists to be opened from an email and used immediately; it should
  // never be indexed, and a shared screenshot of it means nothing to anyone else.
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string }>;
}

/**
 * Fetch a code's click count and its referrals, for the tracker. Returns null on
 * any failure so the share half of the page still renders: an advocate who came
 * here to send their link must never be blocked by a stats query.
 */
async function loadProgress(code: string) {
  try {
    const supabase = getSupabaseAdmin();
    const [{ data: codeRow, error: codeError }, { data: referrals, error: refError }] = await Promise.all([
      supabase.from('referral_codes').select('click_count').eq('code', code).maybeSingle(),
      supabase
        .from('referrals')
        .select('referee_email, plan, reward_amount, status, created_at, paid_at')
        .eq('referral_code', code),
    ]);
    if (codeError || refError) {
      console.error('[share-page] progress lookup failed', { code, codeError, refError });
      return null;
    }
    if (!codeRow) return null;
    return buildAdvocateProgress(codeRow.click_count ?? 0, (referrals ?? []) as AdvocateReferralRow[]);
  } catch (error: unknown) {
    console.error('[share-page] progress unexpected error', { code, error });
    return null;
  }
}

const ORIGIN = 'https://www.fourteenfisherman.com';

/**
 * The five steps between sharing and being paid (Ishaq, 2026-08-21). Spelling
 * out step 4 in particular is the point: an unexplained "£100" from a company
 * someone has barely used reads as a gimmick until they can see how the money
 * is actually supposed to reach them.
 */
const HOW_IT_WORKS = [
  'Share your link with your friends.',
  'They sign up through your link.',
  'We verify which course they joined.',
  'We email you both to arrange payment.',
  'You both get paid.',
] as const;
const REWARD = `£${REWARD_BY_PLAN.complete / 100}`;

/**
 * /share/CODE — the landing spot for the campaign email's share button.
 *
 * Deliberately does no lookup on the code: a dead or mistyped code still lands
 * somewhere sensible, because the link it hands out is /r/CODE, which already
 * degrades to a plain redirect when the code isn't live. Adding a database
 * round-trip here would buy nothing and could fail the page for a working link.
 */
export default async function SharePage({ params, searchParams }: PageProps) {
  const { code: rawCode } = await params;
  const { t } = await searchParams;
  const code = normalizeCode(rawCode ?? '');
  // The tracker is for the code's owner only. Everyone else — including anyone
  // who received /r/CODE and guessed their way here — gets the share half alone.
  const progress = verifyShareToken(code, t) ? await loadProgress(code) : null;
  const url = referralUrl(ORIGIN, code);
  const message = `If you're prepping for the SCA, join through my link and you get ${REWARD} back on the Complete course: ${url}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-5 py-16">
      <div className="w-full max-w-md rounded-3xl border border-heading/[0.06] bg-surface-raised p-7 shadow-elevation-2 sm:p-9">
        <h1 className="text-2xl font-semibold tracking-tight text-heading sm:text-3xl">
          Split {`£${(REWARD_BY_PLAN.complete / 100) * 2}`} with your mates.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-body">
          Send your link to another GP trainee sitting the SCA. When they join the Complete SCA
          Course, you get {REWARD} and so do they. Self-Study pays £50 each.
        </p>

        <div className="mt-8 border-t border-heading/[0.08] pt-7">
          <ShareCard url={url} message={message} />
        </div>

        {progress && (
          <div className="mt-9 border-t border-heading/[0.08] pt-7">
            <ProgressPanel progress={progress} />
          </div>
        )}

        <div className="mt-9 border-t border-heading/[0.08] pt-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">How it works</p>
          <ol className="mt-4 space-y-3">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step} className="flex gap-3 text-[14px] leading-relaxed text-body">
                <span
                  aria-hidden="true"
                  className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-warm font-mono text-[10px] font-semibold text-primary"
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </main>
  );
}
