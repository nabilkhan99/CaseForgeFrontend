/**
 * TypeScript interfaces for Clinical Master.
 *
 * Feedback types mirror the SCA engine output (FF SCA Feedback Engine Build
 * Package, Section 12). The legacy 0 to 100 / 3-score shape has been replaced by
 * the verdict-band, grade-based schema.
 */

export interface TranscriptItem {
  id?: string;
  // Spec transcript shape (Build Package Section 3.1)
  speaker?: 'candidate' | 'patient';
  start_ms?: number;
  end_ms?: number;
  text?: string;
  asr_confidence?: number;
  // Legacy shape kept during the transcript-capture migration (Phase 6)
  role?: 'user' | 'assistant';
  content?: string;
  timestamp?: string;
}

export type Grade = 'CP' | 'P' | 'F' | 'CF';
export type Verdict = 'Pass' | 'Bare Pass' | 'Bare Fail' | 'Fail';
export type DomainKey = 'data_gathering' | 'clinical_management' | 'relating_to_others';
export type FeedbackSource =
  | 'learning_points'
  | 'rcgp_educator_notes'
  | 'nice'
  | 'sign'
  | 'curriculum';
export type EvidenceKind = 'supporting_quote' | 'patient_cue' | 'not_asked' | 'no_direct_quote';

export interface Evidence {
  evidence_kind?: EvidenceKind;
  quote?: string | null;
  timestamp_ms?: number | null;
  speaker?: 'candidate' | 'patient' | null;
}

export interface AnchoredStatement {
  title: string;
}

export interface DidWell {
  indicator_id?: string | null;
  label: string;
  narrative: string;
  evidence?: Evidence | null;
}

export interface Missed {
  indicator_id?: string | null;
  label: string;
  status: 'partial' | 'not_met';
  consequence_tier: number;
  narrative: string;
  evidence?: Evidence | null;
}

export interface CueHandling {
  cue: string;
  status: 'explored' | 'missed';
  narrative: string;
  evidence?: Evidence | null;
}

export interface GradeMover {
  narrative: string;
}

export interface ModelMoment {
  narrative: string;
  source: FeedbackSource;
}

export interface HowToImprove {
  narrative: string;
  source: FeedbackSource;
}

export interface DomainFeedback {
  domain: DomainKey;
  display_name: string;
  grade: Grade;
  grade_points: number;
  max_points?: number;
  weighted_points?: number;
  is_weighted?: boolean;
  anchored_statements: AnchoredStatement[];
  what_you_did_well: DidWell[];
  what_you_missed: Missed[];
  cue_handling: CueHandling[];
  grade_mover?: GradeMover | null;
  model_moment?: ModelMoment | null;
  how_to_improve: HowToImprove[];
}

export interface Overall {
  verdict: Verdict;
  weighted_score: number;
  max_score: number;
  one_line_summary: string;
  tier3_override_applied: boolean;
}

export interface TimingInfo {
  total_duration_ms?: number | null;
  data_gathering_end_ms?: number | null;
  flags: string[];
}

export interface FocusArea {
  priority: number;
  label: string;
  narrative: string;
  domain: string;
}

export interface ConfidenceInfo {
  transcript_quality: 'high' | 'medium' | 'low';
  notes: string;
}

export interface ConsultationFeedback {
  session_id?: string;
  candidate_id?: string | null;
  case_id?: string | null;
  completed_at?: string | null;
  overall: Overall;
  domains: DomainFeedback[];
  timing?: TimingInfo | null;
  focus_areas: FocusArea[];
  capability_links: string[];
  confidence: ConfidenceInfo;
  // Display helpers populated by the API route
  station_title?: string;
  station_id?: string;
}

/** Verdict band helpers shared by the feedback UI. */
export const PASSING_VERDICTS: Verdict[] = ['Pass', 'Bare Pass'];
export const GRADE_LABELS: Record<Grade, string> = {
  CP: 'Clear Pass',
  P: 'Pass',
  F: 'Fail',
  CF: 'Clear Fail',
};
