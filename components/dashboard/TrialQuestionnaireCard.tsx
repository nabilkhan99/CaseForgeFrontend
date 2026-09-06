'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { trackEvent } from '@/lib/analytics';
import { saveExamDate } from '@/lib/supabase/queries/profile';
import { SCA_TARGETS, TRAINING_STAGES } from '@/lib/trial/leadFields';

/**
 * The two questions door (a) did not ask, asked once the product has earned
 * them.
 *
 * The sign-up box collects an address and a first name — nothing else — because
 * a form in front of a free offer is how the free offer stops working. These
 * two are still needed: the exam sitting decides which two plans the wall
 * shows when the five run out, and the training stage is the one segmentation
 * every email uses. So they are asked HERE, on a dashboard that already has a
 * mark on it, where the trainee has something to weigh the question against.
 *
 * ## Why exactly two questions
 *
 * `lib/trial/questionnaire.ts` has a nine-step branching questionnaire and this
 * card renders two of its steps' option sets — `stage` and `scaSitting`, from
 * the same `TRAINING_STAGES` / `SCA_TARGETS` allowlists the gate and the server
 * validate against, so the values cannot drift. The other seven steps (AKT
 * status, GP training start, the not-in-training branch) are the guest funnel's
 * lead-qualification questions and have no consumer on this page. Asking them
 * here would be a form again, one screen later.
 *
 * ## Two writes, deliberately
 *
 * The route writes `trial_leads` (RLS deny-all, service role) and hands back
 * the exam date it derived; the browser writes `profiles.exam_date` through
 * `saveExamDate`, which is the ONE place in this codebase that column is
 * written from and the authority the countdown and the wall both read. Neither
 * write is duplicated in the other place.
 *
 * Dismissible, and never blocking: it sits among the dashboard's banners and
 * the page behind it works whether or not it is ever answered.
 */

interface TrialQuestionnaireCardProps {
  userId: string;
  /** Called with the `YYYY-MM-DD` date once it is saved, so the page can update. */
  onSaved?: (examDate: string | null) => void;
}

export default function TrialQuestionnaireCard({ userId, onSaved }: TrialQuestionnaireCardProps) {
  const [stage, setStage] = useState('');
  const [sitting, setSitting] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [saved, setSaved] = useState(false);

  const ready = Boolean(stage && sitting);

  async function save() {
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/trial/questionnaire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainingStage: stage, scaSitting: sitting }),
      });
      const data = (await res.json()) as { ok?: true; examDate?: string | null; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not save that — please try again');
        return;
      }

      // The leads row is written; the countdown's authority is not. An exam
      // date we could not map (a period rather than a sitting, or "not sure")
      // leaves profiles alone rather than writing a guess.
      if (data.examDate) await saveExamDate(userId, data.examDate);

      void trackEvent('trial_questionnaire_answered', {
        training_stage: stage,
        sca_sitting: sitting,
      });
      setSaved(true);
      onSaved?.(data.examDate ?? null);
    } catch {
      setError('Could not save that — please try again');
    } finally {
      setSaving(false);
    }
  }

  if (dismissed || saved) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mb-6 tall:mb-8 rounded-[10px] border border-hairline bg-surface-raised px-4 py-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-primary">
            Two questions
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-body">
            So your board counts down to the right date, and we stop showing you plans that finish
            after your exam.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="-m-2 shrink-0 rounded-full p-2 text-[13px] text-muted transition-colors hover:text-heading"
        >
          Later
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="trial-stage"
            className="mb-1 block text-[12px] font-medium text-muted"
          >
            Where are you in training?
          </label>
          <select
            id="trial-stage"
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            className="w-full rounded-lg border border-defined bg-white px-3 py-2.5 text-[14px] text-heading outline-none transition focus:border-primary"
          >
            <option value="">Choose one</option>
            {TRAINING_STAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="trial-sitting"
            className="mb-1 block text-[12px] font-medium text-muted"
          >
            When are you sitting the SCA?
          </label>
          <select
            id="trial-sitting"
            value={sitting}
            onChange={(event) => setSitting(event.target.value)}
            className="w-full rounded-lg border border-defined bg-white px-3 py-2.5 text-[14px] text-heading outline-none transition focus:border-primary"
          >
            <option value="">Choose one</option>
            {SCA_TARGETS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="mt-3 text-[13px] font-medium text-danger">{error}</p>}

      <button
        type="button"
        onClick={() => void save()}
        disabled={!ready || saving}
        className="mt-4 rounded-full bg-heading px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </motion.div>
  );
}
