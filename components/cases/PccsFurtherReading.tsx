'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { trackEvent } from '@/lib/analytics';
import { PCCS_JOIN_URL, pccsFurtherReadingFor } from '@/lib/partners/pccsAcademy';

/**
 * "Further reading" from the PCCS Academy, shown under a case's learning points.
 *
 * Rendered on both surfaces that show those learning points: the public case
 * page and the post-consultation feedback report. Which case gets which module
 * is lib/partners/pccsAcademy.ts; a case with no pairing renders nothing, so
 * this can sit under every case without a guard at the call site.
 *
 * The small print is not decoration. Every PCCS module is behind a member
 * login, and membership is free for practising healthcare professionals. Left
 * unsaid, a trainee clicks through, meets a login wall, and concludes the link
 * is broken.
 *
 * `rel="noopener"` and deliberately NOT `noreferrer`: PCCS should be able to
 * see in their own analytics that these visitors came from us.
 */

export type PccsFurtherReadingSurface = 'case_page' | 'feedback_report';

export default function PccsFurtherReading({
    stationId,
    surface,
}: {
    stationId: string | null | undefined;
    surface: PccsFurtherReadingSurface;
}) {
    const shouldReduceMotion = useReducedMotion();
    const modules = pccsFurtherReadingFor(stationId);
    if (modules.length === 0) return null;

    return (
        <motion.section
            aria-labelledby="pccs-further-reading"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="mt-8 border-t border-hairline pt-6"
        >
            <h4 id="pccs-further-reading" className="text-xs font-black uppercase tracking-widest text-muted">
                Further reading
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-body">
                From the PCCS Academy, the Primary Care Cardiovascular Society&rsquo;s learning modules for
                primary care.
            </p>

            <ul className="mt-3 divide-y divide-hairline border-y border-hairline">
                {modules.map((module) => (
                    <li key={module.key}>
                        <a
                            href={module.url}
                            target="_blank"
                            rel="noopener"
                            onClick={() => {
                                trackEvent('pccs_module_clicked', {
                                    module: module.key,
                                    station_id: stationId ?? '',
                                    surface,
                                });
                            }}
                            className="group flex min-h-[44px] items-center justify-between gap-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                        >
                            <span className="text-sm font-semibold text-heading transition-colors group-hover:text-primary">
                                {module.title}
                            </span>
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                                className="shrink-0 text-muted transition-all group-hover:translate-x-0.5 group-hover:text-primary"
                            >
                                <path d="M7 17 17 7" />
                                <path d="M8 7h9v9" />
                            </svg>
                        </a>
                    </li>
                ))}
            </ul>

            <p className="mt-3 text-xs leading-relaxed text-muted">
                Free for practising healthcare professionals. You need a PCCS account to open these.{' '}
                <a
                    href={PCCS_JOIN_URL}
                    target="_blank"
                    rel="noopener"
                    className="font-semibold text-primary underline underline-offset-2 hover:text-heading"
                >
                    Join the PCCS
                </a>
            </p>
        </motion.section>
    );
}
