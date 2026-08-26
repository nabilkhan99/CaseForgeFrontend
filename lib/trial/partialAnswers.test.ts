import { describe, expect, it } from 'vitest'
import { validatePartialAnswers } from './questionnaire'

/**
 * The partial save exists so that a lead who stops halfway is still reachable.
 * These pin the two things that would quietly defeat that: refusing a half-set
 * because it is half, and accepting values outside the published options.
 */
describe('validatePartialAnswers', () => {
  it('accepts an email on its own — that is the whole point of saving early', () => {
    const result = validatePartialAnswers({ email: 'S.Raza@nhs.net' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual({ email: 's.raza@nhs.net' })
  })

  it('refuses only when there is no usable address to save', () => {
    for (const email of ['', 'not-an-email', 'a@b', undefined]) {
      expect(validatePartialAnswers({ email }).ok).toBe(false)
    }
  })

  it('keeps the answers given and omits the ones not given', () => {
    const result = validatePartialAnswers({
      email: 'a@nhs.net',
      firstName: 'Sana',
      trainingStage: 'st3',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ firstName: 'Sana', trainingStage: 'st3' })
    // Not "" — absent, so the write cannot erase a later answer.
    expect(result.value.scaStatus).toBeUndefined()
    expect(result.value.aktStatus).toBeUndefined()
  })

  it('drops values outside the published options rather than writing them', () => {
    const result = validatePartialAnswers({
      email: 'a@nhs.net',
      trainingStage: 'st9',
      scaStatus: 'made_up_status',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.trainingStage).toBeUndefined()
    expect(result.value.scaStatus).toBeUndefined()
  })

  it('validates a sitting against the follow-up its own status implies', () => {
    const booked = validatePartialAnswers({
      email: 'a@nhs.net',
      scaStatus: 'booked_resit',
      scaSitting: 'nov_2026',
    })
    expect(booked.ok && booked.value.scaSitting).toBe('nov_2026')

    // "I've passed it" has no sitting follow-up, so a sitting is not a fact
    // about this person and must not be recorded as one.
    const passed = validatePartialAnswers({
      email: 'a@nhs.net',
      scaStatus: 'passed',
      scaSitting: 'nov_2026',
    })
    expect(passed.ok && passed.value.scaSitting).toBeUndefined()
  })

  it('lower-cases the address, so the unique email index sees one person', () => {
    const result = validatePartialAnswers({ email: '  MiXeD@NHS.net  ' })
    expect(result.ok && result.value.email).toBe('mixed@nhs.net')
  })

  it('ignores a phone that is not a phone, but keeps a real one', () => {
    expect(validatePartialAnswers({ email: 'a@nhs.net', phone: 'call me' }).ok).toBe(true)
    const junk = validatePartialAnswers({ email: 'a@nhs.net', phone: 'call me' })
    expect(junk.ok && junk.value.phone).toBeUndefined()

    const real = validatePartialAnswers({ email: 'a@nhs.net', phone: '07700 900123' })
    expect(real.ok && real.value.phone).toBeTruthy()
  })

  it('survives non-string junk without throwing', () => {
    const result = validatePartialAnswers({
      email: 'a@nhs.net',
      firstName: 42,
      trainingStage: null,
      scaStatus: { nope: true },
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual({ email: 'a@nhs.net' })
  })
})
