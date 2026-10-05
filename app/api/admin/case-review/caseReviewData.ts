import type { SupabaseClient } from '@supabase/supabase-js'
import { countChecklist } from '@/components/admin/case-review/checklist'
import type {
  ApprovalAction,
  CaseApprovalResponse,
  CaseContent,
  CaseReviewDetailResponse,
  DraftSummary,
  ReplacedCaseSummary,
} from '@/components/admin/case-review/types'

/**
 * The queries behind /admin/case-review, where Ishaq reads each new case next
 * to the old case it replaces and signs it off.
 *
 * Every function here takes the SERVICE ROLE client: drafts are invisible to
 * everyone else under RLS (migration 20261005_case_versions.sql). The routes
 * that call these check ADMIN_EMAILS first.
 *
 * The one write is the sign-off, and it is deliberately narrow:
 *  - it only ever sets approved_at / approved_by, never lifecycle or is_active
 *    (switching a case on is a separate step, done on purpose, elsewhere);
 *  - it only ever touches a lifecycle = 'draft' row, and that condition sits in
 *    the UPDATE itself, so a case switched on between page load and click is
 *    refused rather than quietly re-stamped.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const DRAFT_LIST_COLUMNS =
  'id, title, consultation_type, patient_name, patient_age, created_at, approved_at, approved_by, replaces_station_id, domains(name)'

const CONTENT_COLUMNS =
  'id, title, lifecycle, consultation_type, patient_name, patient_age, candidate_instructions, station_script, data_gathering, clinical_management, relating_to_others, clinical_learning_points, domains(name)'

export const DRAFT_DETAIL_COLUMNS = `${CONTENT_COLUMNS}, seo_description, approved_at, approved_by, replaces_station_id, mark_scheme_structured`

/** PostgREST caps a response at 1000 rows by default; page keeper rows under it. */
const KEEPER_PAGE = 1000

type DomainJoin = { name: string | null } | { name: string | null }[] | null

interface DraftListRow {
  id: string
  title: string
  consultation_type: string | null
  patient_name: string | null
  patient_age: number | null
  created_at: string
  approved_at: string | null
  approved_by: string | null
  replaces_station_id: string | null
  domains: DomainJoin
}

interface ContentRow {
  id: string
  title: string
  lifecycle: string
  consultation_type: string | null
  patient_name: string | null
  patient_age: number | null
  candidate_instructions: string | null
  station_script: string | null
  data_gathering: string | null
  clinical_management: string | null
  relating_to_others: string | null
  clinical_learning_points: string | null
  domains: DomainJoin
}

interface DraftDetailRow extends ContentRow {
  seo_description: string | null
  approved_at: string | null
  approved_by: string | null
  replaces_station_id: string | null
  mark_scheme_structured: unknown
}

/** A to-one embed can come back as an object or a one-element array. */
function domainName(join: DomainJoin): string | null {
  if (!join) return null
  const first = Array.isArray(join) ? join[0] : join
  return first?.name ?? null
}

function toContent(row: ContentRow): CaseContent {
  return {
    id: row.id,
    title: row.title,
    lifecycle: row.lifecycle,
    domain: domainName(row.domains),
    consultationType: row.consultation_type,
    patientName: row.patient_name,
    patientAge: row.patient_age,
    candidateInstructions: row.candidate_instructions,
    stationScript: row.station_script,
    dataGathering: row.data_gathering,
    clinicalManagement: row.clinical_management,
    relatingToOthers: row.relating_to_others,
    learningPoints: row.clinical_learning_points,
  }
}

/** How many keepers each of these old cases has. Throws on a failed read. */
export async function countKeepers(supabase: SupabaseClient, stationIds: readonly string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>(stationIds.map((id) => [id, 0]))
  if (stationIds.length === 0) return counts

  for (let from = 0; ; from += KEEPER_PAGE) {
    const { data, error } = await supabase
      .from('case_keepers')
      .select('station_id')
      .in('station_id', [...stationIds])
      .order('station_id')
      .range(from, from + KEEPER_PAGE - 1)
    if (error) throw new Error(`case_keepers read failed: ${error.message}`)
    const rows = (data ?? []) as { station_id: string }[]
    for (const row of rows) counts.set(row.station_id, (counts.get(row.station_id) ?? 0) + 1)
    if (rows.length < KEEPER_PAGE) return counts
  }
}

/**
 * Every draft, newest first, with the old case each replaces. Grouping into
 * waiting / approved is the page's job; the order here holds inside each group.
 */
export async function listDrafts(supabase: SupabaseClient): Promise<DraftSummary[]> {
  const { data, error } = await supabase
    .from('stations')
    .select(DRAFT_LIST_COLUMNS)
    .eq('lifecycle', 'draft')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`draft list failed: ${error.message}`)

  const drafts = (data ?? []) as unknown as DraftListRow[]
  const oldIds = [...new Set(drafts.map((d) => d.replaces_station_id).filter((id): id is string => Boolean(id)))]

  const oldById = new Map<string, ReplacedCaseSummary>()
  if (oldIds.length > 0) {
    const { data: oldRows, error: oldError } = await supabase
      .from('stations')
      .select('id, title, lifecycle')
      .in('id', oldIds)
    if (oldError) throw new Error(`replaced case read failed: ${oldError.message}`)
    const keepers = await countKeepers(supabase, oldIds)
    for (const row of (oldRows ?? []) as { id: string; title: string; lifecycle: string }[]) {
      oldById.set(row.id, { id: row.id, title: row.title, lifecycle: row.lifecycle, keeperCount: keepers.get(row.id) ?? 0 })
    }
  }

  return drafts.map((d) => ({
    id: d.id,
    title: d.title,
    domain: domainName(d.domains),
    consultationType: d.consultation_type,
    patientName: d.patient_name,
    patientAge: d.patient_age,
    createdAt: d.created_at,
    approvedAt: d.approved_at,
    approvedBy: d.approved_by,
    replacesStationId: d.replaces_station_id,
    replaces: d.replaces_station_id ? (oldById.get(d.replaces_station_id) ?? null) : null,
  }))
}

/**
 * One draft and the old case it replaces, in full. Null when the id is not a
 * draft (a live or archived case is not reviewed here).
 */
export async function loadDraftReview(supabase: SupabaseClient, id: string): Promise<CaseReviewDetailResponse | null> {
  const { data, error } = await supabase
    .from('stations')
    .select(DRAFT_DETAIL_COLUMNS)
    .eq('id', id)
    .eq('lifecycle', 'draft')
    .maybeSingle()
  if (error) throw new Error(`draft read failed: ${error.message}`)
  if (!data) return null

  const row = data as unknown as DraftDetailRow
  const draft = {
    ...toContent(row),
    seoDescription: row.seo_description,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    replacesStationId: row.replaces_station_id,
    checklist: countChecklist(row.mark_scheme_structured),
  }

  if (!row.replaces_station_id) return { draft, old: null }

  const { data: oldData, error: oldError } = await supabase
    .from('stations')
    .select(CONTENT_COLUMNS)
    .eq('id', row.replaces_station_id)
    .maybeSingle()
  if (oldError) throw new Error(`replaced case read failed: ${oldError.message}`)
  if (!oldData) return { draft, old: null }

  const keepers = await countKeepers(supabase, [row.replaces_station_id])
  const old = { ...toContent(oldData as unknown as ContentRow), keeperCount: keepers.get(row.replaces_station_id) ?? 0 }
  return { draft, old }
}

export type ApprovalResult =
  | { ok: true; approval: CaseApprovalResponse }
  | { ok: false; status: 404 | 409; error: string }

/**
 * Record or withdraw the sign-off on a draft. Touches approved_at and
 * approved_by only, and only on a draft row (see the module comment).
 */
export async function setApproval(
  supabase: SupabaseClient,
  id: string,
  action: ApprovalAction,
  adminEmail: string,
  now: Date,
): Promise<ApprovalResult> {
  const patch =
    action === 'approve'
      ? { approved_at: now.toISOString(), approved_by: adminEmail }
      : { approved_at: null, approved_by: null }

  const { data, error } = await supabase
    .from('stations')
    .update(patch)
    .eq('id', id)
    .eq('lifecycle', 'draft')
    .select('id, approved_at, approved_by')
    .maybeSingle()
  if (error) throw new Error(`approval update failed: ${error.message}`)

  if (data) {
    const row = data as { id: string; approved_at: string | null; approved_by: string | null }
    return { ok: true, approval: { id: row.id, approvedAt: row.approved_at, approvedBy: row.approved_by } }
  }

  // Nothing matched: say whether the case is missing or simply not a draft.
  const { data: existing, error: readError } = await supabase
    .from('stations')
    .select('id, lifecycle')
    .eq('id', id)
    .maybeSingle()
  if (readError) throw new Error(`approval follow-up read failed: ${readError.message}`)
  if (!existing) return { ok: false, status: 404, error: 'No case with that id.' }
  return {
    ok: false,
    status: 409,
    error: `Only draft cases are signed off here. This case is ${(existing as { lifecycle: string }).lifecycle}.`,
  }
}
