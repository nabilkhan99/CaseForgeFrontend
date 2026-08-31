'use client';

import { ArrowRight } from 'lucide-react';
import { useReferralModal } from './ReferralModalProvider';
import { COMPLETE_SHARER_REWARD, SPLIT_POT } from './referralCopy';

/**
 * The refer-a-friend banner above the portfolio tool — the one place a large,
 * already engaged audience meets the offer.
 *
 * It took this slot from the £500 guarantee banner, and inherits its shell:
 * same cream card, same radii, same four-step responsive sizing, so the page
 * keeps its rhythm and this is one responsive banner rather than four
 * components. What changed is the ask. The guarantee argued the product to
 * someone who came for a free tool and has no SCA context yet; this asks for
 * something they can act on without buying anything, which is a fairer thing to
 * put in front of that audience.
 *
 * CONTAINS NO HEADING TAGS, deliberately and load-bearingly — inherited from
 * the strip this replaces. It renders above the page's only <h1>, and a heading
 * here would take that position in the DOM and dilute the topic signal the H1
 * exists to give. Body text and one button, nothing else.
 *
 * The seal and its divider did not come across: the medallion says "£500
 * GUARANTEE" in fixed type, and a promise this banner is not making has no
 * business being the first thing in it.
 *
 * Not dismissible by design. It sits in the page shell rather than inside the
 * tool, so it stays put when a review replaces the form — which is what the
 * strip's second instance used to be for.
 */
export default function ReferralBanner() {
  const { open } = useReferralModal();

  return (
    <div className="rounded-[1.75rem] bg-[#FDF9F1] px-4 py-3.5 shadow-[0_1px_2px_rgba(31,26,20,0.04)] sm:rounded-[2rem] sm:px-6 sm:py-4 lg:px-9 lg:py-6">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 sm:flex-nowrap sm:gap-x-5 lg:gap-x-8">
        <div className="min-w-0 text-center sm:flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted sm:text-[11px]">
            Limited time only
          </p>
          <p className="mt-1 text-[15px] leading-snug text-heading sm:text-xl lg:mt-1.5 lg:text-[28px]">
            <span className="font-semibold">Split {SPLIT_POT} with your mates</span>{' '}
            <span className="[font-family:var(--font-serif)] italic text-primary">
              &mdash; you both get {COMPLETE_SHARER_REWARD}.
            </span>
          </p>
        </div>

        {/* Rounded rectangle, not a pill — the same button the guarantee banner
            carried, so the slot reads as the same slot. A button rather than a
            link: the details live in the modal this page already holds. */}
        <button
          type="button"
          onClick={open}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 sm:px-5 sm:text-sm lg:gap-2.5 lg:rounded-2xl lg:px-8 lg:py-4 lg:text-xl"
        >
          How it works
          <ArrowRight className="h-4 w-4 lg:h-5 lg:w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
