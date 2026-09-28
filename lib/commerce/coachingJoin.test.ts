import { describe, expect, it } from 'vitest'
import {
  joinDetailsFromRow,
  parseCoachEmail,
  parseCoachName,
  parseJoiningDetailsInput,
  parseMeetingUrl,
} from './coachingJoin'

describe('parseMeetingUrl', () => {
  it('accepts the common meeting links exactly as typed', () => {
    for (const url of [
      'https://meet.google.com/abc-defg-hij',
      'https://us05web.zoom.us/j/81234567890?pwd=AbC123',
      'https://teams.microsoft.com/l/meetup-join/19%3ameeting_x%40thread.v2/0?context=%7b%7d',
    ]) {
      expect(parseMeetingUrl(url)).toBe(url)
    }
  })

  it('trims but does not rewrite a bare host', () => {
    expect(parseMeetingUrl('  https://meet.google.com  ')).toBe('https://meet.google.com')
  })

  it('refuses anything that is not a plain https link', () => {
    for (const bad of [
      'http://meet.google.com/abc',
      'javascript:alert(1)',
      'meet.google.com/abc',
      'https://meet.google.com/abc def',
      'https://meet.google.com/"onmouseover="x',
      'https://user:pass@meet.google.com/abc',
      'https://',
      '',
      '   ',
      null,
      42,
      `https://meet.google.com/${'a'.repeat(600)}`,
    ]) {
      expect(parseMeetingUrl(bad)).toBeNull()
    }
  })
})

describe('parseCoachName', () => {
  it('trims and collapses spaces', () => {
    expect(parseCoachName('  Dr   Hassan  Khan ')).toBe('Dr Hassan Khan')
  })

  it('refuses empty, one-letter, overlong and markup names', () => {
    expect(parseCoachName('')).toBeNull()
    expect(parseCoachName('H')).toBeNull()
    expect(parseCoachName('x'.repeat(81))).toBeNull()
    expect(parseCoachName('<b>Hassan</b>')).toBeNull()
    expect(parseCoachName(undefined)).toBeNull()
  })
})

describe('parseCoachEmail', () => {
  it('lower-cases, because cohorts.trainer_email requires it', () => {
    expect(parseCoachEmail(' HassanKhan4@Doctors.org.uk ')).toBe('hassankhan4@doctors.org.uk')
  })

  it('refuses things that are not addresses', () => {
    expect(parseCoachEmail('hassan')).toBeNull()
    expect(parseCoachEmail('hassan@doctors')).toBeNull()
    expect(parseCoachEmail('has san@doctors.org.uk')).toBeNull()
    expect(parseCoachEmail(null)).toBeNull()
  })
})

describe('parseJoiningDetailsInput', () => {
  const good = {
    coachName: 'Dr Hassan Khan',
    coachEmail: 'HassanKhan4@doctors.org.uk',
    meetingUrl: 'https://meet.google.com/abc-defg-hij',
  }

  it('returns normalised values when every field is valid', () => {
    expect(parseJoiningDetailsInput(good)).toEqual({
      ok: true,
      value: {
        coachName: 'Dr Hassan Khan',
        coachEmail: 'hassankhan4@doctors.org.uk',
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
      },
    })
  })

  it('names the first bad field', () => {
    expect(parseJoiningDetailsInput({ ...good, coachName: '' })).toMatchObject({ ok: false })
    const badLink = parseJoiningDetailsInput({ ...good, meetingUrl: 'http://x.com' })
    expect(badLink.ok).toBe(false)
    if (!badLink.ok) expect(badLink.error).toMatch(/https/)
    expect(parseJoiningDetailsInput(null)).toMatchObject({ ok: false })
  })
})

describe('joinDetailsFromRow', () => {
  it('passes valid stored details through', () => {
    expect(
      joinDetailsFromRow({
        coaching_meeting_url: 'https://meet.google.com/abc-defg-hij',
        coaching_coach_name: 'Dr Hassan Khan',
      }),
    ).toEqual({ meetingUrl: 'https://meet.google.com/abc-defg-hij', coachName: 'Dr Hassan Khan' })
  })

  it('degrades a hand-edited unsafe link to not set', () => {
    expect(
      joinDetailsFromRow({ coaching_meeting_url: 'javascript:alert(1)', coaching_coach_name: null }),
    ).toEqual({ meetingUrl: null, coachName: null })
    expect(joinDetailsFromRow(null)).toEqual({ meetingUrl: null, coachName: null })
  })
})
