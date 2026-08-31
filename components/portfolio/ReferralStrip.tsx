'use client';

import { motion } from 'framer-motion';
import { useReferralModal } from './ReferralModalProvider';
import { COMPLETE_SHARER_REWARD, SPLIT_POT } from './referralCopy';

/**
 * The slim refer-a-friend strip. Rendered twice on the portfolio tool page: once
 * above the H1, once at the top of a generated review.
 *
 * CONTAINS NO HEADING TAGS, deliberately and load-bearingly. It sits above the
 * page's only <h1>, and a heading here would take that position in the DOM and
 * dilute the page's topic signal — which is the entire point of adding the H1.
 * Body text and one button, nothing else.
 *
 * Not dismissible by design (no close control): it persists for the session, so
 * someone who scrolls past it on arrival still meets it on their output.
 */
export default function ReferralStrip({ className = '' }: { className?: string }) {
    const { open } = useReferralModal();

    return (
        // Slide, not fade. A fade would put `style="opacity:0"` on this element
        // in the server-rendered HTML, which means text sitting directly above
        // the page's H1 is invisible to anything that does not run the script.
        // A transform leaves the copy plainly visible in the source.
        <motion.div
            initial={{ y: -4 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className={`flex min-h-[52px] flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl bg-[#FDF6EA] px-4 py-3 text-center text-[13px] leading-snug text-body sm:text-sm ${className}`}
        >
            <p className="min-w-0">
                <span className="text-muted">Limited time only</span>
                <span aria-hidden="true" className="mx-1.5 text-muted">
                    ·
                </span>
                <span className="font-semibold text-heading">
                    Split {SPLIT_POT} with your mates.
                </span>{' '}
                Refer a GP trainee and you both get {COMPLETE_SHARER_REWARD}.
            </p>
            <button
                type="button"
                onClick={open}
                className="flex-shrink-0 font-semibold text-primary underline decoration-primary/30 underline-offset-4 transition hover:decoration-primary"
            >
                How it works
            </button>
        </motion.div>
    );
}
