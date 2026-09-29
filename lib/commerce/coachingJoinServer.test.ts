import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The student's own read of their joining details: scoped to their email and
 * the booked day, re-validated on the way out, and degrading to "not set" on
 * any failure (including the columns not existing before the migration).
 */

const mocks = vi.hoisted(() => ({
  answer: { data: null as unknown, error: null as unknown },
  filters: [] as Array<[string, ...unknown[]]>,
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      mocks.filters.push(['from', table])
      const builder: Record<string, unknown> = {}
      for (const method of ['select', 'ilike', 'eq', 'order', 'limit']) {
        builder[method] = (...args: unknown[]) => {
          mocks.filters.push([method, ...args])
          return builder
        }
      }
      builder.maybeSingle = async () => mocks.answer
      return builder
    },
  }),
}))

const { loadCoachingJoinDetails } = await import('./coachingJoinServer')

beforeEach(() => {
  mocks.filters = []
  mocks.answer = { data: null, error: null }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('loadCoachingJoinDetails', () => {
  it('reads the paid order for this email and day', async () => {
    mocks.answer = {
      data: {
        coaching_meeting_url: 'https://meet.google.com/abc-defg-hij',
        coaching_coach_name: 'Dr Hassan Khan',
      },
      error: null,
    }
    await expect(loadCoachingJoinDetails('Student_1@Example.com', '2026-10-04')).resolves.toEqual({
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      coachName: 'Dr Hassan Khan',
    })
    expect(mocks.filters).toContainEqual(['from', 'preorders'])
    expect(mocks.filters).toContainEqual(['select', 'coaching_meeting_url, coaching_coach_name'])
    // exactEmailPattern escapes the underscore so ilike cannot wildcard it.
    expect(mocks.filters).toContainEqual(['ilike', 'email', 'Student\\_1@Example.com'])
    expect(mocks.filters).toContainEqual(['eq', 'coaching_day', '2026-10-04'])
    expect(mocks.filters).toContainEqual(['eq', 'status', 'paid'])
  })

  it('never returns a stored link that is not plain https', async () => {
    mocks.answer = {
      data: { coaching_meeting_url: 'javascript:alert(1)', coaching_coach_name: 'Dr Hassan Khan' },
      error: null,
    }
    await expect(loadCoachingJoinDetails('s@example.com', '2026-10-04')).resolves.toEqual({
      meetingUrl: null,
      coachName: 'Dr Hassan Khan',
    })
  })

  it('answers not set when there is no row', async () => {
    await expect(loadCoachingJoinDetails('s@example.com', '2026-10-04')).resolves.toEqual({
      meetingUrl: null,
      coachName: null,
    })
  })

  it('answers not set when the read fails, e.g. before the migration', async () => {
    mocks.answer = { data: null, error: { message: 'column preorders.coaching_meeting_url does not exist' } }
    await expect(loadCoachingJoinDetails('s@example.com', '2026-10-04')).resolves.toEqual({
      meetingUrl: null,
      coachName: null,
    })
    expect(console.error).toHaveBeenCalled()
  })
})
