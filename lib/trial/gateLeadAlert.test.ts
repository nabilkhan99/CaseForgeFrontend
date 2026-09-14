import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The founders' lead alert: what it carries and that it can never hurt the
 * person who triggered it. The email sender is mocked; nothing is sent.
 */

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  stationTitle: 'Headache in a teacher' as string | null,
  stationLookups: [] as unknown[],
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/email/leadAlertEmail', () => ({
  sendLeadAlertEmail: (...args: unknown[]) => mocks.send(...args),
}))

const { scheduleGateLeadAlert, sendGateLeadAlert } = await import('./gateLeadAlert')

const supabase = {
  from: () => ({
    select: () => ({
      eq: (_column: string, value: unknown) => ({
        maybeSingle: async () => {
          mocks.stationLookups.push(value)
          return { data: mocks.stationTitle ? { title: mocks.stationTitle } : null, error: null }
        },
      }),
    }),
  }),
} as never

const SESSION_ID = '11111111-1111-4111-8111-111111111111'

const LEAD = {
  email: 'sarah@nhs.net',
  first_name: 'Sarah',
  phone: '+447700900123',
  training_stage: 'st3',
  sca_sitting: null,
  sca_sit_date: null,
  station_id: 'station-9',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.send.mockResolvedValue(undefined)
  mocks.stationTitle = 'Headache in a teacher'
  mocks.stationLookups = []
})

describe('sendGateLeadAlert', () => {
  it('sends the lead’s details with readable labels and the station title', async () => {
    await sendGateLeadAlert(supabase, SESSION_ID, LEAD, 'guest_signup')

    expect(mocks.stationLookups).toEqual(['station-9'])
    expect(mocks.send).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      email: 'sarah@nhs.net',
      firstName: 'Sarah',
      phone: '+447700900123',
      trainingStage: expect.any(String),
      scaSitting: null,
      stationTitle: 'Headache in a teacher',
      door: 'guest_signup',
    })
    // The option's label, not the stored value.
    expect(mocks.send.mock.calls[0][0].trainingStage).not.toBe('st3')
  })

  it('sends what it has when the lead gave nothing but an address', async () => {
    await sendGateLeadAlert(
      supabase,
      SESSION_ID,
      { ...LEAD, first_name: null, phone: null, training_stage: null, station_id: null },
      'report_link',
    )

    expect(mocks.stationLookups).toHaveLength(0)
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'sarah@nhs.net', firstName: null, phone: null, door: 'report_link' }),
    )
  })

  it('never throws, whatever the sender does', async () => {
    mocks.send.mockRejectedValue(new Error('Brevo is down'))

    await expect(sendGateLeadAlert(supabase, SESSION_ID, LEAD, 'guest_signup')).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })
})

describe('scheduleGateLeadAlert', () => {
  it('hands the send to the scheduler rather than running it in the request', async () => {
    const tasks: Array<() => Promise<void>> = []

    scheduleGateLeadAlert(supabase, SESSION_ID, LEAD, 'report_link', (task) => tasks.push(task))

    expect(mocks.send).not.toHaveBeenCalled()
    expect(tasks).toHaveLength(1)
    await tasks[0]()
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ door: 'report_link' }))
  })

  it('still sends outside a request scope, where after() is unavailable', async () => {
    scheduleGateLeadAlert(supabase, SESSION_ID, LEAD, 'guest_signup')

    await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledOnce())
  })
})
