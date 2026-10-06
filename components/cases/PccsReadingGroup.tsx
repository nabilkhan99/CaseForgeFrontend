'use client';

import { trackEvent } from '@/lib/analytics';
import { PCCS_JOIN_URL, type PccsModule } from '@/lib/partners/pccsAcademy';
import type { FurtherReadingSurface } from './FurtherReading';

/**
 * The PCCS Academy group inside "Further reading" (FurtherReading.tsx).
 *
 * Which case gets which module is lib/partners/pccsAcademy.ts; this only draws
 * the modules it is handed.
 *
 * The small print is not decoration. Every PCCS module is behind a member
 * login, and membership is free for practising healthcare professionals. Left
 * unsaid, a trainee clicks through, meets a login wall, and concludes the link
 * is broken.
 *
 * `rel="noopener"` and deliberately NOT `noreferrer`: PCCS should be able to
 * see in their own analytics that these visitors came from us.
 */
export default function PccsReadingGroup({
    modules,
    stationId,
    surface,
}: {
    modules: readonly PccsModule[];
    stationId: string | null | undefined;
    surface: FurtherReadingSurface;
}) {
    return (
        <div>
            <p className="text-sm leading-relaxed text-body">
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
                            <OutboundArrow />
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
        </div>
    );
}

export function OutboundArrow() {
    return (
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
    );
}
