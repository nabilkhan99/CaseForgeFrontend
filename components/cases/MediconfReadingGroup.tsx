'use client';

import Image from 'next/image';
import { trackEvent } from '@/lib/analytics';
import { MEDICONF_LOGO, MEDICONF_STRAPLINE, webinarWhen, type MediconfWebinar } from '@/lib/partners/mediconf';
import type { FurtherReadingSurface } from './FurtherReading';
import { OutboundArrow } from './PccsReadingGroup';

/**
 * The MediConf group inside "Further reading" (FurtherReading.tsx): the one
 * webinar a free case was matched to, with MediConf's own strapline.
 *
 * Which case gets which webinar is lib/partners/mediconf.ts. The logo shows
 * once its file is in /public (MEDICONF_LOGO); until then the name stands in.
 *
 * `rel="noopener"` and deliberately NOT `noreferrer`, as with PCCS: MediConf
 * should be able to see that these visitors came from us.
 */
export default function MediconfReadingGroup({
    webinar,
    stationId,
    surface,
}: {
    webinar: MediconfWebinar;
    stationId: string | null | undefined;
    surface: FurtherReadingSurface;
}) {
    return (
        <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {MEDICONF_LOGO ? (
                    <Image
                        src={MEDICONF_LOGO.src}
                        width={MEDICONF_LOGO.width}
                        height={MEDICONF_LOGO.height}
                        alt="MediConf"
                        className="h-6 w-auto"
                    />
                ) : (
                    <span className="text-sm font-bold tracking-tight text-heading">MediConf</span>
                )}
                <span className="text-sm leading-relaxed text-body">{MEDICONF_STRAPLINE}</span>
            </div>

            <a
                href={webinar.url}
                target="_blank"
                rel="noopener"
                onClick={() => {
                    trackEvent('mediconf_webinar_clicked', {
                        webinar: webinar.key,
                        station_id: stationId ?? '',
                        surface,
                    });
                }}
                className="group mt-3 flex min-h-[44px] items-center justify-between gap-4 border-y border-hairline py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
                <span className="flex flex-col">
                    <span className="text-sm font-semibold text-heading transition-colors group-hover:text-primary">
                        {webinar.title}
                    </span>
                    <span className="mt-0.5 text-xs text-muted">{webinarWhen(webinar)}</span>
                </span>
                <OutboundArrow />
            </a>
        </div>
    );
}
