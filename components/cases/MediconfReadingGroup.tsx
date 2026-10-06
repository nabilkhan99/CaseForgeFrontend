'use client';

import Image from 'next/image';
import { trackEvent } from '@/lib/analytics';
import {
    MEDICONF_INTRO,
    MEDICONF_LOGO,
    MEDICONF_REGISTER_URL,
    type MediconfResource,
} from '@/lib/partners/mediconf';
import type { FurtherReadingSurface } from './FurtherReading';
import { OutboundArrow } from './PccsReadingGroup';

/**
 * The MediConf group inside "Further reading" (FurtherReading.tsx): the
 * learning resources MediConf chose for this case, under MediConf's own intro
 * line, with their logo.
 *
 * Which case gets which resources is lib/partners/mediconf.ts; this only draws
 * the resources it is handed.
 *
 * The small print is what we promised MediConf, and it is not decoration: the
 * resources sit behind a MediConf account (free for primary care
 * professionals), and without saying so a trainee meets a login wall and
 * concludes the link is broken.
 *
 * `rel="noopener"` and deliberately NOT `noreferrer`, as with PCCS: MediConf
 * should be able to see that these visitors came from us.
 */
export default function MediconfReadingGroup({
    resources,
    stationId,
    surface,
}: {
    resources: readonly MediconfResource[];
    stationId: string | null | undefined;
    surface: FurtherReadingSurface;
}) {
    return (
        <div>
            {/* Logo on the right from sm up; above the line on a phone, where beside it would squeeze the text. */}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
                <p className="text-sm leading-relaxed text-body">{MEDICONF_INTRO}</p>
                <Image
                    src={MEDICONF_LOGO.src}
                    width={MEDICONF_LOGO.width}
                    height={MEDICONF_LOGO.height}
                    alt="MediConf"
                    sizes="(min-width: 640px) 168px, 134px"
                    className="h-8 w-auto shrink-0 self-start sm:h-10 sm:self-auto"
                />
            </div>

            <ul className="mt-3 divide-y divide-hairline border-y border-hairline">
                {resources.map((resource) => (
                    <li key={resource.key}>
                        <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener"
                            onClick={() => {
                                trackEvent('mediconf_resource_clicked', {
                                    resource: resource.key,
                                    station_id: stationId ?? '',
                                    surface,
                                });
                            }}
                            className="group flex min-h-[44px] items-center justify-between gap-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                        >
                            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                                <span className="text-sm font-semibold text-heading transition-colors group-hover:text-primary">
                                    {resource.title}
                                </span>
                                <span className="text-xs text-muted">MediConf learning resource</span>
                            </span>
                            <OutboundArrow />
                        </a>
                    </li>
                ))}
            </ul>

            <p className="mt-3 text-xs leading-relaxed text-muted">
                Free for primary care professionals. You need a MediConf account to access these.{' '}
                <a
                    href={MEDICONF_REGISTER_URL}
                    target="_blank"
                    rel="noopener"
                    className="font-semibold text-primary underline underline-offset-2 hover:text-heading"
                >
                    Register with MediConf
                </a>
            </p>
        </div>
    );
}
