import type { Metadata } from 'next';
import { normalizeCode, referralUrl, REWARD_BY_PLAN } from '@/lib/commerce/referrals';
import ShareCard from '@/components/referrals/ShareCard';

export const metadata: Metadata = {
  title: 'Share your referral link — Fourteen Fisherman',
  // The page exists to be opened from an email and used immediately; it should
  // never be indexed, and a shared screenshot of it means nothing to anyone else.
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ code: string }>;
}

const ORIGIN = 'https://www.fourteenfisherman.com';
const REWARD = `£${REWARD_BY_PLAN.complete / 100}`;

/**
 * /share/CODE — the landing spot for the campaign email's share button.
 *
 * Deliberately does no lookup on the code: a dead or mistyped code still lands
 * somewhere sensible, because the link it hands out is /r/CODE, which already
 * degrades to a plain redirect when the code isn't live. Adding a database
 * round-trip here would buy nothing and could fail the page for a working link.
 */
export default async function SharePage({ params }: PageProps) {
  const { code: rawCode } = await params;
  const code = normalizeCode(rawCode ?? '');
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
      </div>
    </main>
  );
}
