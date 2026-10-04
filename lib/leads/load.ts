import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CallRow,
  FollowupRow,
  GrantRow,
  LeadSources,
  OrderRow,
  OverrideRow,
  ProfileRow,
  TrialLeadRow,
  UserRow,
} from './assemble'
import { loadBrowsing } from './posthog'
import type { ResultRow, SessionRow } from './stats'

/**
 * Every table the lead list needs, read with the service-role client. PostgREST
 * returns at most 1000 rows per request, and clinical_sessions is already past
 * that, so every read pages until a short page comes back.
 */

const PAGE = 1000

/** Pages over a unique, stable key: without an order, PostgREST pages can skip or repeat rows. */
async function selectAll<T>(supabase: SupabaseClient, table: string, columns: string, key = 'id'): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(columns).order(key).range(from, from + PAGE - 1)
    if (error) throw new Error(`[admin-leads] ${table}: ${error.message}`)
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < PAGE) return rows
  }
}

async function listUsers(supabase: SupabaseClient): Promise<UserRow[]> {
  const users: UserRow[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE })
    if (error) throw new Error(`[admin-leads] auth users: ${error.message}`)
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email ?? null })))
    if (data.users.length < PAGE) return users
  }
}

export async function loadLeadSources(supabase: SupabaseClient, now: Date, options: { freshBrowsing?: boolean } = {}): Promise<LeadSources> {
  const [trialLeads, grants, orders, users, profiles, sessions, results, calls, followups, overrides, browsing] = await Promise.all([
    selectAll<TrialLeadRow>(supabase, 'trial_leads', 'email,first_name,phone,training_stage,sca_sitting,created_at,session_id'),
    selectAll<GrantRow>(supabase, 'trial_grants', 'user_id,email,started_at,expires_at'),
    selectAll<OrderRow>(supabase, 'preorders', 'email,status'),
    listUsers(supabase),
    selectAll<ProfileRow>(supabase, 'profiles', 'id,exam_date,full_name'),
    selectAll<SessionRow>(supabase, 'clinical_sessions', 'id,user_id,station_id,status,started_at'),
    selectAll<ResultRow>(supabase, 'session_results', 'session_id,verdict,weighted_score'),
    selectAll<CallRow>(supabase, 'lead_calls', '*'),
    selectAll<FollowupRow>(supabase, 'lead_followups', '*', 'lead_email'),
    selectAll<OverrideRow>(supabase, 'lead_overrides', 'email,kind,merge_into,display_name', 'email'),
    loadBrowsing(now, options.freshBrowsing),
  ])
  return { now, trialLeads, grants, orders, users, profiles, sessions, results, calls, followups, overrides, browsing }
}
