'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import ArcGauge from '@/components/ui/ArcGauge';
import {
  TONE_COLOUR,
  fmtMark,
  passMarkFor,
  passMarkSentence,
  verdictTone,
} from '@/lib/clinical-master/scoring';
import type { TrialVerdictSummary } from '@/lib/trial/verdictSummary';
import type { Verdict } from '@/lib/clinical-master/types';

/**
 * The trainee's own result, shown above the email gate.
 *
 * Roughly a quarter of people who finish the free consultation abandon at the
 * gate, and until now they left having seen nothing whatsoever of the thing
 * they had just spent twelve minutes on. They now see the verdict, the score
 * and the one sentence that says what happened — enough to know the mark is
 * real, and not nearly enough to stand in for the report.
 *
 * Everything else stays behind the gate: the domain breakdown, the evidence
 * quotes, the focus areas and the "one change". The server enforces that, not
 * this component — `/api/try/gate-status` only ever sends these four fields.
 *
 * ## This must never delay the gate
 *
 * The gate renders immediately whatever happens here. While the mark is still
 * running this is a quiet line of text; if it never lands, or the request
 * fails, this renders nothing at all and the page is exactly what it was
 * before. A reveal that could block the funnel would be worse than no reveal.
 */

/** Matches the report's own poll: 3s apart, five minutes of budget. */
const POLL_INTERVAL_MS = 3000;
const MAX_RETRIES = 100;

type RevealState =
  | { kind: 'waiting' }
  | { kind: 'ready'; summary: TrialVerdictSummary }
  /** The Azure guard refused the run as too short to grade fairly. */
  | { kind: 'unmarkable'; seconds: number }
  /** Nothing to show, and nothing more to wait for. Renders nothing. */
  | { kind: 'silent' };

interface GateStatusPayload {
  verified?: boolean;
  status?: string;
  summary?: TrialVerdictSummary | null;
  candidateSeconds?: number;
}

interface VerdictRevealProps {
  sessionId: string;
  /**
   * Where "run it properly" sends someone whose consultation was too short.
   * Null when the station behind the session isn't known to this page.
   */
  retryHref?: string | null;
}

export default function VerdictReveal({ sessionId, retryHref = '/try/talk' }: VerdictRevealProps) {
  const [state, setState] = useState<RevealState>({ kind: 'waiting' });
  const retries = useRef(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    retries.current = 0;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/try/gate-status?sessionId=${encodeURIComponent(sessionId)}`
        );
        if (cancelled) return;
        const data: GateStatusPayload = res.ok ? await res.json() : {};

        if (data.summary) {
          setState({ kind: 'ready', summary: data.summary });
          return;
        }

        if (data.status === 'unmarkable') {
          setState({ kind: 'unmarkable', seconds: data.candidateSeconds ?? 0 });
          return;
        }

        // Nothing was captured, so no mark is coming. Say nothing here and let
        // the report explain it properly once they are through the gate.
        if (data.status === 'no_transcript' || data.status === 'error') {
          setState({ kind: 'silent' });
          return;
        }

        retries.current += 1;
        if (retries.current >= MAX_RETRIES) {
          setState({ kind: 'silent' });
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (cancelled) return;
        retries.current += 1;
        if (retries.current >= MAX_RETRIES) {
          setState({ kind: 'silent' });
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (state.kind === 'silent') return null;

  return (
    <div className="mx-auto w-full max-w-[560px] px-5 pt-10 sm:px-7">
      <AnimatePresence mode="wait">
        {state.kind === 'waiting' && (
          <motion.p
            key="waiting"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0 }}
            className="text-center text-[13px] leading-[1.6] text-muted"
          >
            Marking your consultation — your result appears here in a minute or two.
          </motion.p>
        )}

        {state.kind === 'unmarkable' && (
          <motion.div
            key="unmarkable"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[14px] border border-hairline bg-surface-raised px-5 py-5 text-center"
          >
            <p className="text-[15px] font-semibold text-heading">
              {state.seconds > 0
                ? `That was ${state.seconds} second${state.seconds === 1 ? '' : 's'}, not enough to mark fairly.`
                : 'That was too short to mark fairly.'}
            </p>
            <p className="mt-2 text-[13px] leading-[1.65] text-muted">
              A real station runs to about twelve minutes. Nothing has been marked, and
              this hasn&apos;t used up your free go.
            </p>
            {retryHref && (
              <Link
                href={retryHref}
                className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Run it properly
              </Link>
            )}
          </motion.div>
        )}

        {state.kind === 'ready' && (
          <VerdictBand key="ready" summary={state.summary} reduced={Boolean(shouldReduceMotion)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * The same dial and verdict the report opens with, at the size the gate can
 * carry. Lifted from `VerdictPanel` rather than shared with it: that panel also
 * renders the duration chip, the tier-3 override notice and the pass
 * celebration, none of which belong in front of someone who has not yet seen a
 * single mark.
 */
function VerdictBand({
  summary,
  reduced,
}: {
  summary: TrialVerdictSummary;
  reduced: boolean;
}) {
  const maxScore = summary.maxScore || 10.5;
  const passMark = passMarkFor(maxScore);
  const tone = verdictTone(summary.verdict as Verdict);
  const verdictColour =
    tone === 'pass' ? 'text-green-700' : tone === 'borderline' ? 'text-primary' : 'text-red-700';

  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[16px] border border-hairline bg-surface-raised px-5 py-6 text-center shadow-elevation-2 sm:px-7"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        Your result
      </p>

      <div className="mt-4 flex justify-center">
        <ArcGauge
          value={summary.weightedScore}
          max={maxScore}
          threshold={passMark}
          size={168}
          thickness={10}
          colour={TONE_COLOUR[tone]}
          label={`${fmtMark(summary.weightedScore)} out of ${fmtMark(maxScore)}, a ${summary.verdict}. The pass mark is ${fmtMark(passMark)}.`}
        >
          <span className="font-mono text-[30px] font-bold leading-none tabular-nums text-heading">
            {summary.weightedScore.toFixed(1)}
          </span>
          <span className="mt-1.5 font-mono text-[13px] text-stone-400">
            / {maxScore.toFixed(1)}
          </span>
        </ArcGauge>
      </div>

      <div className={`mt-2 font-serif text-[26px] leading-none ${verdictColour}`}>
        {summary.verdict}
      </div>
      <p className="mt-3 text-[13px] leading-[1.55] text-stone-600">
        {passMarkSentence(summary.weightedScore, maxScore)}
      </p>

      {summary.oneLineSummary && (
        <p className="mx-auto mt-4 max-w-[46ch] border-t border-hairline pt-4 text-[15px] leading-[1.7] text-stone-700">
          {summary.oneLineSummary}
        </p>
      )}
    </motion.section>
  );
}
