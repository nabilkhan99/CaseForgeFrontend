import trackerData from './tracker-data.json';

/** RAG banding per the build package §4. */
export type TrackerVerdict =
  | 'likely_approved'
  | 'conditional'
  | 'after_fail_only'
  | 'check_local';

export interface TrackerDeanery {
  /** Matches the /study-budget/<slug>/ route segment exactly. */
  slug: string;
  name: string;
  verdict: TrackerVerdict;
  cap: string;
  approvalLikelihood: string;
  brief: string;
  sourceDoc: string;
  sourceUrl: string;
  email: { subject: string; body: string };
}

export const TRACKER_DEANERIES = trackerData.deaneries as TrackerDeanery[];

export function getTrackerDeanery(slug: string): TrackerDeanery | undefined {
  return TRACKER_DEANERIES.find((d) => d.slug === slug);
}

/**
 * RAG colours: likely_approved = green, conditional / check_local = amber,
 * after_fail_only = amber-red.
 */
export const VERDICT_THEME: Record<
  TrackerVerdict,
  { label: string; text: string; bg: string; border: string; dot: string }
> = {
  likely_approved: {
    label: 'Likely approved',
    text: 'text-[#27500A]',
    bg: 'bg-[#EAF3DE]',
    border: 'border-[#27500A]/25',
    dot: 'bg-[#27500A]',
  },
  conditional: {
    label: 'Conditional',
    text: 'text-[#854F0B]',
    bg: 'bg-[#FAEEDA]',
    border: 'border-[#854F0B]/25',
    dot: 'bg-[#B45309]',
  },
  check_local: {
    label: 'Check locally',
    text: 'text-[#854F0B]',
    bg: 'bg-[#FAEEDA]',
    border: 'border-[#854F0B]/25',
    dot: 'bg-[#B45309]',
  },
  after_fail_only: {
    label: 'After a failed attempt only',
    text: 'text-[#8A2B1F]',
    bg: 'bg-[#FBE6E2]',
    border: 'border-[#8A2B1F]/25',
    dot: 'bg-[#C0392B]',
  },
};
