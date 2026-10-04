import { NextResponse, type NextRequest } from 'next/server'
import { isAdmin } from '@/lib/admin/guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { assembleLeads, type LeadView } from '@/lib/leads/assemble'
import { chatConfigFromEnv } from '@/lib/leads/callNotes'
import { loadLeadSources } from '@/lib/leads/load'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export interface AdminLeadsResponse {
  leads: LeadView[]
  generatedAt: string
  /** PostHog browsing signals were available for the heat scores. */
  browsing: boolean
  /** The AI tidy is configured. Without it, notes are saved as written. */
  ai: boolean
}

/**
 * GET /api/admin/leads — every lead, with their calls and next action.
 * `?fresh=1` skips the ten-minute browsing-signal cache.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const now = new Date()
    const fresh = request.nextUrl.searchParams.get('fresh') === '1'
    const sources = await loadLeadSources(getSupabaseAdmin(), now, { freshBrowsing: fresh })
    const body: AdminLeadsResponse = {
      leads: assembleLeads(sources),
      generatedAt: now.toISOString(),
      browsing: sources.browsing !== null,
      ai: chatConfigFromEnv() !== null,
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error: unknown) {
    console.error('[admin-leads] list failed', error)
    return NextResponse.json({ error: 'Could not load leads.' }, { status: 500 })
  }
}
