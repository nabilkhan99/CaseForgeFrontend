import { describe, expect, it } from 'vitest'
import {
  buildTrialDay3Email,
  buildTrialDay5Email,
  describeVerdicts,
  dominantDomain,
  firstNameFrom,
  greetingFor,
  trialPatternLine,
  trialResultsParagraph,
  type TrialMark,
} from './trialEmails'

const DASHBOARD = 'https://www.fourteenfisherman.com/dashboard'
const ENDS_AT = new Date('2026-09-11T09:00:00Z')

const nearMissOnManagement: TrialMark = {
  verdict: 'Bare Fail',
  focusDomains: ['clinical_management', 'data_gathering'],
}
const passOnGathering: TrialMark = {
  verdict: 'Pass',
  focusDomains: ['data_gathering'],
}

describe('firstNameFrom / greetingFor', () => {
  it('takes the first name and strips a title', () => {
    expect(firstNameFrom('Dr Jane Smith')).toBe('Jane')
    expect(firstNameFrom('Doctor Amina Patel')).toBe('Amina')
    expect(firstNameFrom('Mrs. Chen')).toBe('Chen')
  })

  it('normalises a name typed in one case, and leaves a real one alone', () => {
    expect(firstNameFrom('JANE')).toBe('Jane')
    expect(firstNameFrom('jane')).toBe('Jane')
    expect(firstNameFrom('McDonald')).toBe('McDonald')
    expect(firstNameFrom("O'Neill")).toBe("O'Neill")
  })

  it('falls back to "Hi there," when there is no usable name', () => {
    expect(greetingFor(null)).toBe('Hi there,')
    expect(greetingFor(undefined)).toBe('Hi there,')
    expect(greetingFor('   ')).toBe('Hi there,')
    // A title on its own leaves nothing to greet.
    expect(greetingFor('Dr')).toBe('Hi there,')
  })

  it('greets by first name when there is one', () => {
    expect(greetingFor('Dr Jane Smith')).toBe('Hi Jane,')
  })
})

describe('describeVerdicts', () => {
  it('counts each band and reads them best band first', () => {
    expect(describeVerdicts([nearMissOnManagement, passOnGathering, nearMissOnManagement])).toBe(
      'one pass and two near misses',
    )
  })

  it('uses the singular for one', () => {
    expect(describeVerdicts([nearMissOnManagement])).toBe('one near miss')
    expect(describeVerdicts([{ verdict: 'Bare Pass' }])).toBe('one bare pass')
  })

  it('still reports a band it does not recognise, so the numbers add up', () => {
    expect(describeVerdicts([{ verdict: 'Ungradeable' }, passOnGathering])).toBe(
      'one pass and one ungradeable',
    )
  })

  it('is empty for no marks', () => {
    expect(describeVerdicts([])).toBe('')
  })
})

describe('dominantDomain', () => {
  it('needs two marks pointing the same way before it calls it a pattern', () => {
    expect(dominantDomain([nearMissOnManagement])).toBeNull()
    expect(dominantDomain([nearMissOnManagement, nearMissOnManagement])).toMatchObject({
      domain: 'clinical_management',
      label: 'clinical management',
      count: 2,
      total: 2,
    })
  })

  it('falls back to the weakest FAILED domain when a row has no focus areas', () => {
    const graded: TrialMark = {
      verdict: 'Fail',
      domains: [
        { domain: 'data_gathering', grade: 'P' },
        { domain: 'clinical_management', grade: 'CF' },
        { domain: 'relating_to_others', grade: 'F' },
      ],
    }
    expect(dominantDomain([graded, graded])?.domain).toBe('clinical_management')
  })

  it('invents nothing when every domain passed', () => {
    const allPassed: TrialMark = {
      verdict: 'Pass',
      domains: [
        { domain: 'data_gathering', grade: 'CP' },
        { domain: 'clinical_management', grade: 'P' },
      ],
    }
    expect(dominantDomain([allPassed, allPassed])).toBeNull()
  })

  it('maps the engine\'s older name for the third domain', () => {
    const older: TrialMark = { verdict: 'Bare Fail', focusDomains: ['interpersonal_skills'] }
    expect(dominantDomain([older, older])?.label).toBe('relating to others')
  })
})

describe('trialPatternLine', () => {
  it('says nothing after a single mark', () => {
    expect(trialPatternLine([nearMissOnManagement])).toBeNull()
    expect(trialPatternLine([])).toBeNull()
  })

  it('names the repeated domain with an exact count, never "most"', () => {
    expect(trialPatternLine([nearMissOnManagement, nearMissOnManagement])).toBe(
      'Two near misses so far, and clinical management came up both times.',
    )
    expect(
      trialPatternLine([nearMissOnManagement, nearMissOnManagement, passOnGathering]),
    ).toBe('One pass and two near misses so far, and clinical management came up in two of them.')
  })

  it('drops the domain clause when there is no pattern to report', () => {
    expect(trialPatternLine([passOnGathering, nearMissOnManagement])).toBe(
      'One pass and one near miss so far.',
    )
  })
})

describe('trialResultsParagraph', () => {
  it('counts consultations and cases separately', () => {
    // The sentence the rewrite exists to make possible. Three marks across two
    // cases is not "three of your five" — under unlimited attempts that phrase
    // cannot be written at all without guessing which number it means.
    expect(
      trialResultsParagraph([nearMissOnManagement, nearMissOnManagement, passOnGathering], 2, 5),
    ).toBe(
      'You ran three consultations across two of the five cases: one pass and two near misses. Clinical management came up as the thing to change in two of them.',
    )
  })

  it('reads correctly when somebody ran one case several times', () => {
    // The behaviour the offer is designed to encourage, and the one the old
    // copy could not describe: four goes at a single case.
    expect(
      trialResultsParagraph(
        [nearMissOnManagement, nearMissOnManagement, nearMissOnManagement, nearMissOnManagement],
        1,
        5,
      ),
    ).toContain('You ran four consultations across one of the five cases')
  })

  it('handles a window that ended with nothing marked', () => {
    expect(trialResultsParagraph([], 0, 5)).toContain('did not get to a marked consultation')
  })
})

describe('buildTrialDay3Email', () => {
  it('counts DAYS in the subject, never stations', () => {
    const email = buildTrialDay3Email({
      firstName: 'Dr Jane Smith',
      daysLeft: 2,
      casesTried: 2,
      endsAt: ENDS_AT,
      marks: [nearMissOnManagement, nearMissOnManagement],
      dashboardUrl: DASHBOARD,
    })
    expect(email.subject).toBe('Two days left of your five cases')
    expect(email.subject).not.toMatch(/station/i)
  })

  it('says the number of days out loud, singular on the last one', () => {
    const one = buildTrialDay3Email({
      firstName: 'Jane',
      daysLeft: 1,
      endsAt: ENDS_AT,
      dashboardUrl: DASHBOARD,
    })
    expect(one.subject).toBe('One day left of your five cases')
  })

  it('with one mark: states the days, the end date, and claims no pattern', () => {
    const email = buildTrialDay3Email({
      firstName: 'Jane',
      daysLeft: 2,
      casesTried: 1,
      endsAt: ENDS_AT,
      marks: [nearMissOnManagement],
      dashboardUrl: DASHBOARD,
    })
    expect(email.greeting).toBe('Hi Jane,')
    expect(email.text).toContain('Hi Jane,')
    expect(email.text).toContain(
      'You have two days left — your five cases stay open until Friday 11 September.',
    )
    expect(email.text).not.toContain('so far')
    expect(email.html).toContain('Open your dashboard')
    expect(email.html).toContain(DASHBOARD)
  })

  it('says attempts are unlimited, in as many words', () => {
    // The single most important thing this email can say to somebody who is
    // rationing five goes across five cases.
    const email = buildTrialDay3Email({
      firstName: 'Jane',
      daysLeft: 2,
      casesTried: 2,
      endsAt: ENDS_AT,
      dashboardUrl: DASHBOARD,
    })
    expect(email.text).toContain(
      'You have tried two of the five. Run any of them again — there is no limit on attempts.',
    )
  })

  it('invites them in when they have not started a case yet', () => {
    const email = buildTrialDay3Email({
      daysLeft: 2,
      casesTried: 0,
      endsAt: ENDS_AT,
      dashboardUrl: DASHBOARD,
    })
    expect(email.text).toContain('as many times as you like')
    expect(email.text).not.toContain('You have tried')
  })

  it('with three marks: adds one line about the pattern', () => {
    const email = buildTrialDay3Email({
      firstName: null,
      daysLeft: 2,
      casesTried: 1,
      endsAt: ENDS_AT,
      marks: [nearMissOnManagement, nearMissOnManagement, nearMissOnManagement],
      dashboardUrl: DASHBOARD,
    })
    expect(email.greeting).toBe('Hi there,')
    expect(email.text).toContain(
      'Three near misses so far, and clinical management came up all three times.',
    )
  })

  it('renders a full HTML document long enough for the send guard', () => {
    const email = buildTrialDay3Email({
      daysLeft: 2,
      endsAt: ENDS_AT,
      dashboardUrl: DASHBOARD,
    })
    expect(email.html.toLowerCase().startsWith('<!doctype html')).toBe(true)
    expect(email.html.length).toBeGreaterThan(2000)
    expect(email.html).toContain(email.greeting)
  })

  it('escapes a name that came out of a form', () => {
    const email = buildTrialDay3Email({
      firstName: '<script>alert(1)</script>',
      daysLeft: 2,
      endsAt: ENDS_AT,
      dashboardUrl: DASHBOARD,
    })
    expect(email.html).not.toContain('<script>alert(1)</script>')
    expect(email.html).toContain('&lt;script&gt;')
  })
})

describe('buildTrialDay5Email', () => {
  it('is about the days running out, not stations being spent', () => {
    const email = buildTrialDay5Email({
      firstName: 'Dr Amina Patel',
      marks: [nearMissOnManagement, nearMissOnManagement, passOnGathering],
      casesTried: 2,
      casesTotal: 5,
      dashboardUrl: DASHBOARD,
    })
    expect(email.subject).toBe('Your five days are up')
    expect(email.greeting).toBe('Hi Amina,')
    expect(email.text).toContain(
      'You ran three consultations across two of the five cases: one pass and two near misses.',
    )
    expect(email.text).toContain('Clinical management came up as the thing to change in two of them.')
    expect(email.text).toContain('your reports, your board and your development picture')
    expect(email.html).toContain('Open your dashboard')
    expect(email.html).toContain(DASHBOARD)
    expect(email.html.toLowerCase().startsWith('<!doctype html')).toBe(true)
    expect(email.html.length).toBeGreaterThan(2000)
  })

  it('still sends something honest when nothing was marked', () => {
    const email = buildTrialDay5Email({ marks: [], dashboardUrl: DASHBOARD })
    expect(email.text).toContain('did not get to a marked consultation')
    expect(email.greeting).toBe('Hi there,')
  })
})

/**
 * The copy rules, asserted rather than reviewed. Two of these are promises the
 * business has NOT made to a free account (the £500 guarantee is for plan
 * holders) and one is a word the product has decided never to say to a reader
 * ("trial"). All three are the kind of thing a well-meaning edit re-introduces.
 */
describe('copy rules', () => {
  const emails = [
    buildTrialDay3Email({
      firstName: 'Jane',
      daysLeft: 2,
      casesTried: 2,
      endsAt: ENDS_AT,
      marks: [nearMissOnManagement, passOnGathering],
      dashboardUrl: DASHBOARD,
    }),
    buildTrialDay5Email({
      firstName: 'Jane',
      marks: [nearMissOnManagement, nearMissOnManagement],
      dashboardUrl: DASHBOARD,
    }),
  ]

  for (const email of emails) {
    const body = `${email.subject}\n${email.html}\n${email.text}`

    it(`never says "guarantee" — ${email.subject}`, () => {
      expect(body).not.toMatch(/guarantee/i)
      expect(body).not.toMatch(/£500/)
      expect(body).not.toMatch(/refund/i)
    })

    it(`never says "trial" at the reader — ${email.subject}`, () => {
      expect(body).not.toMatch(/\btrials?\b/i)
    })

    it(`never counts stations left — ${email.subject}`, () => {
      // The old offer was five consultations and the copy counted them down.
      // Nothing but the calendar runs out now, so a "stations left" sentence
      // would be describing a product we do not sell.
      expect(body).not.toMatch(/stations? (?:left|remaining)/i)
      expect(body).not.toMatch(/\d+ of (?:your )?\d+ stations/i)
    })

    it(`invents no scarcity and quotes nobody — ${email.subject}`, () => {
      expect(body).not.toMatch(/hurry|last chance|don't miss|act now|only \d+ (?:places|spots)/i)
      // Testimonials, checked against the plain-text body: the HTML is full of
      // quoted style attributes, so a long quoted run only means something here.
      expect(email.text).not.toMatch(/"[^"]{40,}"/)
    })
  }
})
