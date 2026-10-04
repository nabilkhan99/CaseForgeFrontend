'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { pccsFurtherReadingFor } from '@/lib/partners/pccsAcademy';
import { mediconfWebinarFor } from '@/lib/partners/mediconf';
import MediconfReadingGroup from './MediconfReadingGroup';
import PccsReadingGroup from './PccsReadingGroup';

export type FurtherReadingSurface = 'case_page' | 'feedback_report';

/**
 * "Further reading" under a case's learning points: every partner's links for
 * this case, under one heading.
 *
 * Rendered on both surfaces that show those learning points: the public case
 * page and the post-consultation feedback report. A case no partner links
 * renders nothing, so this can sit under every case without a guard at the
 * call site.
 *
 * One section rather than one per partner because a case can carry both: the
 * pre-diabetes risk case points at a MediConf webinar and a PCCS module, and
 * two identical headings on one page would read as a mistake. The webinar goes
 * first: it was matched to this exact case, where a PCCS module covers a topic.
 */
export default function FurtherReading({
    stationId,
    surface,
}: {
    stationId: string | null | undefined;
    surface: FurtherReadingSurface;
}) {
    const shouldReduceMotion = useReducedMotion();
    const modules = pccsFurtherReadingFor(stationId);
    const webinar = mediconfWebinarFor(stationId);
    if (modules.length === 0 && !webinar) return null;

    return (
        <motion.section
            aria-labelledby="further-reading"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="mt-8 border-t border-hairline pt-6"
        >
            <h4 id="further-reading" className="text-xs font-black uppercase tracking-widest text-muted">
                Further reading
            </h4>
            <div className="mt-3 flex flex-col gap-6">
                {webinar && <MediconfReadingGroup webinar={webinar} stationId={stationId} surface={surface} />}
                {modules.length > 0 && <PccsReadingGroup modules={modules} stationId={stationId} surface={surface} />}
            </div>
        </motion.section>
    );
}
