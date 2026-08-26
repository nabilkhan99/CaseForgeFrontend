import { MousePointerClick, Users, Wallet } from 'lucide-react';
import type { AdvocateProgress, ProgressStage } from '@/lib/commerce/advocateProgress';

function gbp(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const STAGE_LABEL: Record<ProgressStage, string> = {
  confirming: 'Confirming',
  ready: 'Ready to pay',
  paid: 'Paid',
  void: 'Didn\u2019t qualify', // overridden per-row by voidLabel
};

const STAGE_CLASS: Record<ProgressStage, string> = {
  confirming: 'bg-surface-warm text-muted',
  ready: 'bg-[#FAEEDA] text-[#854F0B]',
  paid: 'bg-[#EAF3DE] text-[#27500A]',
  void: 'bg-surface-warm text-muted',
};

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-muted">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-medium tracking-tight text-heading tabular-nums">{value}</p>
    </div>
  );
}

/**
 * The advocate's own tracker: what their link has done, and where each referral
 * has got to on the way to being paid.
 *
 * Rendered even when everything is zero, deliberately. An advocate who has just
 * shared a link has nothing to see for days, and an empty tracker that plainly
 * works is what makes "£100" read as a mechanism rather than a slogan — the
 * whole reason the tracker ships before the campaign rather than after it.
 */
export default function ProgressPanel({ progress }: { progress: AdvocateProgress }) {
  const { clicks, signups, outstandingPence, paidPence, items } = progress;
  const nothingYet = clicks === 0 && signups === 0;

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Your referrals</p>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Stat icon={<MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" />} value={String(clicks)} label="Clicks" />
        <Stat icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />} value={String(signups)} label="Joined" />
        <Stat icon={<Wallet className="h-3.5 w-3.5" aria-hidden="true" />} value={gbp(outstandingPence + paidPence)} label="Earned" />
      </div>

      {nothingYet ? (
        <p className="mt-5 text-[14px] leading-relaxed text-muted">
          No clicks yet. Share your link and this page will show you every click, every friend who
          joins, and what you&rsquo;re owed.
        </p>
      ) : items.length === 0 ? (
        <p className="mt-5 text-[14px] leading-relaxed text-muted">
          {clicks === 1 ? 'One person has' : `${clicks} people have`} opened your link. You&rsquo;ll see
          them here the moment anyone joins.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-heading/[0.06]">
          {items.map((item) => (
            <li key={`${item.who}-${item.joinedAt}`} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p
                  className={`truncate text-[14px] font-medium ${item.stage === 'void' ? 'text-muted' : 'text-heading'}`}
                >
                  {item.who}
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  {item.what} &middot; {fmtDate(item.joinedAt)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {/* A void referral's reward is struck through rather than hidden:
                    the advocate can see what it would have been worth, which is
                    the honest version of "this one fell through". */}
                <p
                  className={`font-mono text-[14px] font-semibold tabular-nums ${
                    item.stage === 'void' ? 'text-muted line-through' : 'text-heading'
                  }`}
                >
                  {gbp(item.amount)}
                </p>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${STAGE_CLASS[item.stage]}`}
                >
                  {item.voidLabel ?? STAGE_LABEL[item.stage]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.some((i) => i.stage === 'confirming') && (
        <p className="mt-4 text-[12px] leading-relaxed text-muted">
          Confirming means we&rsquo;re past the refund window on{' '}
          {fmtDate(items.find((i) => i.stage === 'confirming')!.payableFrom!)}, then we email you to
          arrange payment.
        </p>
      )}


    </div>
  );
}
