import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createFakeSupabase, type FakeSupabase } from '@/lib/testing/fakeSupabase'

/**
 * /api/admin/coaching: the list, saving joining details, and sending the
 * confirmation. Pinned beyond the admin guard: a save links the coach to the
 * student, a failed link keeps the details, and "Sent" is only ever recorded
 * for an email Brevo accepted.
 */

const mocks = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  send: vi.fn(),
}))

vi.mock('@/lib/admin/guard', () => ({ isAdmin: () => mocks.isAdmin() }))
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => mocks.getSupabaseAdmin() }))
vi.mock('@/lib/email/coachingSessionEmail', () => ({
  sendCoachingSessionEmail: (...args: unknown[]) => mocks.send(...args),
}))

const { GET } = await import('./route')
const { PUT } = await import('./[orderId]/route')
const { POST } = await import('./[orderId]/send/route')

const ORDER_ID = '4b082b91-3db7-4a79-99c3-c7ed5c507e45'
const COACH = 'hassankhan4@doctors.org.uk'

function order(over: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    email: 'Student@Example.com',
    full_name: 'Emily',
    plan: 'complete',
    status: 'paid',
    coaching_day: '2099-10-04',
    coaching_slot: 'morning',
    coaching_meeting_url: null,
    coaching_coach_name: null,
    coaching_coach_email: null,
    coaching_details_sent_at: null,
    ...over,
  }
}

let fake: FakeSupabase

function seed(orders: Record<string, unknown>[] = [order()]) {
  fake = createFakeSupabase({
    preorders: orders,
    profiles: [
      { id: 'student-id', email: 'student@example.com' },
      { id: 'coach-id', email: COACH },
    ],
    cohorts: [],
    cohort_members: [],
  })
  mocks.getSupabaseAdmin.mockReturnValue(fake)
}

const params = (orderId: string) => ({ params: Promise.resolve({ orderId }) })

function put(body: unknown, orderId = ORDER_ID) {
  return PUT(
    new NextRequest(`http://localhost/api/admin/coaching/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params(orderId),
  )
}

const send = (orderId = ORDER_ID) =>
  POST(new Request(`http://localhost/api/admin/coaching/${orderId}/send`, { method: 'POST' }), params(orderId))

const DETAILS = {
  coachName: 'Dr Hassan Khan',
  coachEmail: 'HassanKhan4@doctors.org.uk',
  meetingUrl: 'https://meet.google.com/abc-defg-hij',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isAdmin.mockResolvedValue(true)
  mocks.send.mockResolvedValue({ sent: true, brevoMessageId: 'm1' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  seed()
})

describe('the admin guard', () => {
  it('refuses a non-admin on every route before touching the database', async () => {
    mocks.isAdmin.mockResolvedValue(false)
    expect((await GET()).status).toBe(403)
    expect((await put(DETAILS)).status).toBe(403)
    expect((await send()).status).toBe(403)
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
    expect(mocks.send).not.toHaveBeenCalled()
  })
})

describe('GET /api/admin/coaching', () => {
  it('lists upcoming bookings soonest first, morning before afternoon', async () => {
    seed([
      order({ id: 'b', coaching_day: '2099-11-07', coaching_slot: 'morning', email: 'x@example.com' }),
      order({ id: 'c', coaching_day: '2099-10-04', coaching_slot: 'afternoon', email: 'y@example.com' }),
      order({ id: 'a', coaching_day: '2099-10-04', coaching_slot: 'morning' }),
      order({ id: 'old', coaching_day: '2020-01-01' }),
      order({ id: 'refunded', status: 'refunded' }),
      order({ id: 'selfstudy', plan: 'self_study' }),
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    const { bookings } = await res.json()
    expect(bookings.map((b: { orderId: string }) => b.orderId)).toEqual(['a', 'c', 'b'])
  })

  it('matches the student account case-insensitively and reports coach visibility', async () => {
    fake.tables.cohorts.push({ id: 'cohort-1', trainer_email: COACH, created_at: '2026-09-01' })
    fake.tables.cohort_members.push({ cohort_id: 'cohort-1', user_id: 'student-id' })
    fake.tables.preorders[0].coaching_coach_email = COACH
    const { bookings } = await (await GET()).json()
    expect(bookings[0]).toMatchObject({
      orderId: ORDER_ID,
      email: 'Student@Example.com',
      studentHasAccount: true,
      coachSeesStudent: true,
    })
  })

  it('says a student has no account when no profile matches', async () => {
    fake.tables.profiles = []
    const { bookings } = await (await GET()).json()
    expect(bookings[0]).toMatchObject({ studentHasAccount: false, coachSeesStudent: false })
  })
})

describe('PUT /api/admin/coaching/[orderId]', () => {
  it('rejects a bad body with the parser’s message', async () => {
    const res = await put({ ...DETAILS, meetingUrl: 'http://meet.google.com/x' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/https/)
  })

  it('404s a malformed id and a row that is not a coaching booking', async () => {
    expect((await put(DETAILS, 'not-a-uuid')).status).toBe(404)
    seed([order({ plan: 'self_study' })])
    expect((await put(DETAILS)).status).toBe(404)
  })

  it('saves the details and links the coach to the student', async () => {
    const res = await put(DETAILS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(fake.tables.preorders[0]).toMatchObject({
      coaching_coach_name: 'Dr Hassan Khan',
      coaching_coach_email: COACH,
      coaching_meeting_url: 'https://meet.google.com/abc-defg-hij',
      coaching_details_sent_at: null,
    })
    expect(fake.tables.cohorts).toHaveLength(1)
    expect(fake.tables.cohorts[0].trainer_email).toBe(COACH)
    expect(body.warnings).toEqual([])
    expect(body.booking).toMatchObject({ coachSeesStudent: true, coachName: 'Dr Hassan Khan' })
  })

  it('keeps the details when the cohort link fails, and says so', async () => {
    fake.failOn.cohorts = { message: 'down' }
    const res = await put(DETAILS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.warnings).toEqual([
      'Saved, but the coach could not be linked to this student. Try saving again.',
    ])
    expect(fake.tables.preorders[0].coaching_meeting_url).toBe('https://meet.google.com/abc-defg-hij')
  })
})

describe('POST /api/admin/coaching/[orderId]/send', () => {
  const saved = {
    coaching_coach_name: 'Dr Hassan Khan',
    coaching_coach_email: COACH,
    coaching_meeting_url: 'https://meet.google.com/abc-defg-hij',
  }

  it('refuses a booking with no slot', async () => {
    seed([order({ ...saved, coaching_slot: null })])
    const res = await send()
    expect(res.status).toBe(409)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('refuses until the coach and link are saved', async () => {
    const res = await send()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Save the coach and meeting link first.')
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('sends with exactly the booking’s details and stamps the time', async () => {
    seed([order(saved)])
    const res = await send()
    expect(res.status).toBe(200)
    const { sentAt } = await res.json()
    expect(mocks.send).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      toEmail: 'Student@Example.com',
      toName: 'Emily',
      day: '2099-10-04',
      slot: 'morning',
      coachName: 'Dr Hassan Khan',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    })
    expect(fake.tables.preorders[0].coaching_details_sent_at).toBe(sentAt)
  })

  it('records nothing when the email does not go', async () => {
    seed([order(saved)])
    mocks.send.mockResolvedValue({ sent: false, error: 'brevo_error' })
    const res = await send()
    expect(res.status).toBe(502)
    expect((await res.json()).error).toMatch(/did not send \(brevo_error\)/)
    expect(fake.tables.preorders[0].coaching_details_sent_at).toBeNull()
  })

  it('404s a malformed id', async () => {
    expect((await send('nope')).status).toBe(404)
  })
})
