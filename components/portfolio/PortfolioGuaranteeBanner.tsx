'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import GuaranteeSeal from '@/components/landing/v5/GuaranteeSeal';

/**
 * Guarantee banner above the portfolio tool — the one place a large, already
 * engaged audience meets the paid product.
 *
 * The CTA points at the homepage, per the 16/7 meeting note ("the cta from the
 * banner should take you to the homepage"), rather than straight to pricing:
 * these users arrived for a free tool and have no SCA context yet.
 *
 * Sizing follows the four-step design sheet — the small end on phones, the
 * large end from `lg` up — so it is one responsive banner rather than four
 * separate components.
 */
export default function PortfolioGuaranteeBanner() {
  return (
    <div className="rounded-[1.75rem] bg-[#FDF9F1] px-4 py-3.5 shadow-[0_1px_2px_rgba(31,26,20,0.04)] sm:rounded-[2rem] sm:px-6 sm:py-4 lg:px-8 lg:py-5">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 sm:flex-nowrap sm:gap-x-5 lg:gap-x-7">
        <GuaranteeSeal className="h-12 w-12 flex-shrink-0 sm:h-14 sm:w-14 lg:h-16 lg:w-16" />

        {/* Hairline divider, as in the design sheet. Hidden once the banner
            wraps on the narrowest phones, where it reads as clutter. */}
        <span
          className="hidden h-8 w-px flex-shrink-0 bg-[#E4DDC9] sm:block lg:h-10"
          aria-hidden="true"
        />

        <p className="min-w-0 text-center text-[15px] leading-snug text-heading sm:flex-1 sm:text-left sm:text-lg lg:text-[22px]">
          <span className="font-semibold">Pass the SCA</span>{' '}
          <span className="[font-family:var(--font-serif)] italic text-primary">
            or we pay you £500.
          </span>
        </p>

        <Link
          href="/"
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 sm:px-5 sm:text-sm lg:px-6 lg:py-3 lg:text-base"
        >
          See how it works
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
