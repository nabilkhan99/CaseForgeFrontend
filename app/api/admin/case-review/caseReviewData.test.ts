import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { countChecklist } from '@/components/admin/case-review/checklist'
import { DRAFT_LIST_COLUMNS, countKeepers, listDrafts, loadDraftReview, setApproval } from './caseReviewData'

/**
 * The case review queries against a recording fake of the Supabase client.
 * Each `from()` call is one query; the fake answers it from a handler that
 * sees the table and every chained call, and the tests assert on the recorded
 * chains (what was filtered, what was written).
 */

type Call = [method: string, ...args: unknown[]]
interface Query {
  table: string
  calls: Call[]
}
type Result = { data: unknown; error: { message: string } | null }
type Handler = (q: Query) => Result

function fakeClient(handler: Handler) {
  const queries: Query[] = []
  const client = {
    from(table: string) {
      const query: Query = { table, calls: [] }
      queries.push(query)
      const chain: Record<string, unknown> = {}
      const record =
        (method: string) =>
        (...args: unknown[]) => {
          query.calls.push([method, ...args])
          return chain
        }
      for (const m of ['select', 'eq', 'in', 'order', 'range', 'update', 'limit']) chain[m] = record(m)
      chain.maybeSingle = () => {
        query.calls.push(['maybeSingle'])
        return Promise.resolve(handler(query))
      }
      chain.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(handler(query)).then(resolve, reject)
      return chain
    },
  }
  return { client: client as unknown as SupabaseClient, queries }
}

const has = (q: Query, method: string, ...args: unknown[]) =>
  q.calls.some(([m, ...a]) => m === method && JSON.stringify(a) === JSON.stringify(args))

const NEW_ID = '11111111-1111-4111-8111-111111111111'
const OLD_ID = '22222222-2222-4222-8222-222222222222'
const NEW_2 = '33333333-3333-4333-8333-333333333333'

describe('listDrafts', () => {
  it('reads only drafts, newest first, with the replaced case and its keeper count', async () => {
    const { client, queries } = fakeClient((q) => {
      if (q.table === 'stations' && has(q, 'eq', 'lifecycle', 'draft')) {
        return {
          data: [
            { id: NEW_ID, title: 'New asthma', consultation_type: 'Telephone', patient_name: 'Ann', patient_age: 40, created_at: '2026-10-05T10:00:00Z', approved_at: null, approved_by: null, replaces_station_id: OLD_ID, domains: { name: 'Long-term conditions' } },
            { id: NEW_2, title: 'Brand new', consultation_type: null, patient_name: null, patient_age: null, created_at: '2026-10-04T10:00:00Z', approved_at: '2026-10-05T11:00:00Z', approved_by: 'ishaq@example.org', replaces_station_id: null, domains: [{ name: 'Prescribing' }] },
          ],
          error: null,
        }
      }
      if (q.table === 'stations') return { data: [{ id: OLD_ID, title: 'Old asthma', lifecycle: 'live' }], error: null }
      if (q.table === 'case_keepers') return { data: [{ station_id: OLD_ID }, { station_id: OLD_ID }], error: null }
      throw new Error(`unexpected ${q.table}`)
    })

    const drafts = await listDrafts(client)

    const list = queries[0]
    expect(list.table).toBe('stations')
    expect(has(list, 'select', DRAFT_LIST_COLUMNS)).toBe(true)
    expect(has(list, 'eq', 'lifecycle', 'draft')).toBe(true)
    expect(has(list, 'order', 'created_at', { ascending: false })).toBe(true)
    for (const col of ['title', 'consultation_type', 'patient_name', 'patient_age', 'approved_at', 'replaces_station_id', 'domains(name)']) {
      expect(DRAFT_LIST_COLUMNS).toContain(col)
    }

    expect(drafts).toEqual([
      expect.objectContaining({
        id: NEW_ID,
        domain: 'Long-term conditions',
        approvedAt: null,
        replaces: { id: OLD_ID, title: 'Old asthma', lifecycle: 'live', keeperCount: 2 },
      }),
      expect.objectContaining({ id: NEW_2, domain: 'Prescribing', approvedBy: 'ishaq@example.org', replaces: null }),
    ])
  })

  it('returns an empty list today, without looking up old cases', async () => {
    const { client, queries } = fakeClient(() => ({ data: [], error: null }))
    expect(await listDrafts(client)).toEqual([])
    expect(queries).toHaveLength(1)
  })

  it('throws when the list read fails, so the route can say so', async () => {
    const { client } = fakeClient(() => ({ data: null, error: { message: 'boom' } }))
    await expect(listDrafts(client)).rejects.toThrow('draft list failed')
  })
})

describe('countKeepers', () => {
  it('pages past the 1000-row response cap', async () => {
    const { client, queries } = fakeClient((q) => {
      const from = q.calls.find(([m]) => m === 'range')?.[1] as number
      const rows = from === 0 ? 1000 : 7
      return { data: Array.from({ length: rows }, () => ({ station_id: OLD_ID })), error: null }
    })
    const counts = await countKeepers(client, [OLD_ID])
    expect(counts.get(OLD_ID)).toBe(1007)
    expect(queries).toHaveLength(2)
  })
})

describe('loadDraftReview', () => {
  it('refuses anything that is not a draft', async () => {
    const { client, queries } = fakeClient(() => ({ data: null, error: null }))
    expect(await loadDraftReview(client, OLD_ID)).toBeNull()
    expect(has(queries[0], 'eq', 'lifecycle', 'draft')).toBe(true)
  })

  it('returns the draft with checklist counts next to the old case', async () => {
    const content = { consultation_type: null, patient_name: 'Ann', patient_age: 40, candidate_instructions: 'brief', station_script: 'script', data_gathering: '|a|b|', clinical_management: null, relating_to_others: null, clinical_learning_points: 'lp', domains: null }
    const { client } = fakeClient((q) => {
      if (q.table === 'case_keepers') return { data: [{ station_id: OLD_ID }], error: null }
      if (has(q, 'eq', 'id', NEW_ID)) {
        return {
          data: { ...content, id: NEW_ID, title: 'New', lifecycle: 'draft', seo_description: 'One line.', approved_at: null, approved_by: null, replaces_station_id: OLD_ID, mark_scheme_structured: { domains: [{ domain: 'data_gathering', indicators: [1, 2] }, { domain: 'relating_to_others', indicators: [1] }] } },
          error: null,
        }
      }
      return { data: { ...content, id: OLD_ID, title: 'Old', lifecycle: 'live' }, error: null }
    })
    const review = await loadDraftReview(client, NEW_ID)
    expect(review?.draft).toMatchObject({ id: NEW_ID, seoDescription: 'One line.', candidateInstructions: 'brief', checklist: { data_gathering: 2, clinical_management: 0, relating_to_others: 1 } })
    expect(review?.old).toMatchObject({ id: OLD_ID, title: 'Old', lifecycle: 'live', keeperCount: 1 })
  })
})

describe('setApproval', () => {
  const NOW = new Date('2026-10-05T12:00:00Z')

  it('approves a draft: writes approved_at and approved_by only, conditioned on lifecycle = draft', async () => {
    const { client, queries } = fakeClient(() => ({ data: { id: NEW_ID, approved_at: NOW.toISOString(), approved_by: 'ishaq@example.org' }, error: null }))
    const result = await setApproval(client, NEW_ID, 'approve', 'ishaq@example.org', NOW)

    expect(result).toEqual({ ok: true, approval: { id: NEW_ID, approvedAt: NOW.toISOString(), approvedBy: 'ishaq@example.org' } })
    const update = queries[0].calls.find(([m]) => m === 'update')
    expect(update?.[1]).toEqual({ approved_at: NOW.toISOString(), approved_by: 'ishaq@example.org' })
    expect(has(queries[0], 'eq', 'id', NEW_ID)).toBe(true)
    expect(has(queries[0], 'eq', 'lifecycle', 'draft')).toBe(true)
  })

  it('withdraws: nulls both and nothing else', async () => {
    const { client, queries } = fakeClient(() => ({ data: { id: NEW_ID, approved_at: null, approved_by: null }, error: null }))
    await setApproval(client, NEW_ID, 'withdraw', 'ishaq@example.org', NOW)
    const update = queries[0].calls.find(([m]) => m === 'update')
    expect(update?.[1]).toEqual({ approved_at: null, approved_by: null })
    expect(has(queries[0], 'eq', 'lifecycle', 'draft')).toBe(true)
  })

  it('never writes lifecycle or is_active', async () => {
    for (const action of ['approve', 'withdraw'] as const) {
      const { client, queries } = fakeClient(() => ({ data: { id: NEW_ID, approved_at: null, approved_by: null }, error: null }))
      await setApproval(client, NEW_ID, action, 'a@b.c', NOW)
      const patch = queries[0].calls.find(([m]) => m === 'update')?.[1] as Record<string, unknown>
      expect(Object.keys(patch).sort()).toEqual(['approved_at', 'approved_by'])
    }
  })

  it('refuses a live or archived case with 409, and a missing one with 404', async () => {
    for (const lifecycle of ['live', 'archived']) {
      const { client } = fakeClient((q) => (q.calls.some(([m]) => m === 'update') ? { data: null, error: null } : { data: { id: OLD_ID, lifecycle }, error: null }))
      const result = await setApproval(client, OLD_ID, 'approve', 'a@b.c', NOW)
      expect(result).toMatchObject({ ok: false, status: 409 })
    }
    const { client } = fakeClient(() => ({ data: null, error: null }))
    expect(await setApproval(client, OLD_ID, 'withdraw', 'a@b.c', NOW)).toMatchObject({ ok: false, status: 404 })
  })
})

describe('countChecklist', () => {
  it('counts indicators per domain', () => {
    expect(countChecklist({ domains: [{ domain: 'clinical_management', indicators: [1, 2, 3] }] })).toEqual({ data_gathering: 0, clinical_management: 3, relating_to_others: 0 })
  })

  it('says "no checklist" rather than zeros for anything unreadable', () => {
    for (const bad of [null, undefined, 'x', {}, { domains: 'x' }, { domains: [{ domain: 'other', indicators: [] }] }]) {
      expect(countChecklist(bad)).toBeNull()
    }
  })
})
