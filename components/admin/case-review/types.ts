/**
 * Shapes shared by the case review API (app/api/admin/case-review) and the
 * admin pages that render it. Kept free of server imports so client
 * components can use them.
 *
 * "Draft" here always means a stations row with lifecycle = 'draft': a new
 * case written for the case bank rewrite, not yet in anyone's catalogue.
 * Approving it only records Ishaq's sign-off (approved_at / approved_by);
 * switching it on is a separate, deliberate step that this page never takes.
 */

export type ApprovalAction = 'approve' | 'withdraw'

/** The old case a draft takes the place of, as the list shows it. */
export interface ReplacedCaseSummary {
  id: string
  title: string
  lifecycle: string
  /** People who keep the old case (rows in case_keepers). 0 until switch-on. */
  keeperCount: number
}

export interface DraftSummary {
  id: string
  title: string
  domain: string | null
  consultationType: string | null
  patientName: string | null
  patientAge: number | null
  createdAt: string
  approvedAt: string | null
  approvedBy: string | null
  replacesStationId: string | null
  /** Null when the draft replaces nothing, or the old row could not be found. */
  replaces: ReplacedCaseSummary | null
}

export interface CaseReviewListResponse {
  drafts: DraftSummary[]
}

/** Per marking domain, how many indicators mark_scheme_structured holds. */
export interface ChecklistCounts {
  data_gathering: number
  clinical_management: number
  relating_to_others: number
}

/** Everything a reviewer reads about one case, new or old. */
export interface CaseContent {
  id: string
  title: string
  lifecycle: string
  domain: string | null
  consultationType: string | null
  patientName: string | null
  patientAge: number | null
  candidateInstructions: string | null
  stationScript: string | null
  dataGathering: string | null
  clinicalManagement: string | null
  relatingToOthers: string | null
  learningPoints: string | null
}

export interface DraftCase extends CaseContent {
  seoDescription: string | null
  approvedAt: string | null
  approvedBy: string | null
  replacesStationId: string | null
  /** Null when the draft has no structured mark scheme, or it is unreadable. */
  checklist: ChecklistCounts | null
}

export interface OldCase extends CaseContent {
  keeperCount: number
}

export interface CaseReviewDetailResponse {
  draft: DraftCase
  old: OldCase | null
}

export interface CaseApprovalResponse {
  id: string
  approvedAt: string | null
  approvedBy: string | null
}
