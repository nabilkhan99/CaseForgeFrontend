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
  it('reads as one sentence of counts plus the domain to fix', () => {
    expect(
      trialResultsParagraph([nearMissOnManagement, nearMissOnManagement, passOnGathering], 5),
    ).toBe(
      'You ran three of your five: one pass and two near misses. Clinical management came up as the thing to change in two of them.',
    )
  })

  it('handles a window that ended with nothing marked', () => {
    expect(trialResultsParagraph([], 5)).toContain('did not get to a marked consultation')
  })
})

describe('buildTrialDay3Email', () => {
  it('puts the stations left in the subject, pluralised', () => {
    const three = buildTrialDay3Email({
      firstName: 'Dr Jane Smith',
      remaining: 3,
      endsAt: ENDS_AT,
      marks: [nearMissOnManagement, nearMissOnManagement],
      dashboardUrl: DASHBOARD,
    })
    expect(three.subject).toBe('Two days and 3 stations left')

    const one = buildTrialDay3Email({
      firstName: 'Jane',
      remaining: 1,
      endsAt: ENDS_AT,
      marks: [nearMissOnManagement],
      dashboardUrl: DASHBOARD,
    })
    expect(one.subject).toBe('Two days and 1 station left')
  })

  it('with one mark: states what is left and the end date, and claims no pattern', () => {
    const email = buildTrialDay3Email({
      firstName: 'Jane',
      remaining: 4,
      endsAt: ENDS_AT,
      marks: [nearMissOnManagement],
      dashboardUrl: DASHBOARD,
    })
    expect(email.greeting).toBe('Hi Jane,')
    expect(email.text).toContain('Hi Jane,')
    expect(email.text).toContain('You have four stations left, and your five days end on Friday 11 September.')
    expect(email.text).not.toContain('so far')
    expect(email.html).toContain('Open your dashboard')
    expect(email.html).toContain(DASHBOARD)
  })

  it('with three marks: adds one line about the pattern', () => {
    const email = buildTrialDay3Email({
      firstName: null,
      remaining: 2,
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
      remaining: 5,
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
      remaining: 2,
      endsAt: ENDS_AT,
      dashboardUrl: DASHBOARD,
    })
    expect(email.html).not.toContain('<script>alert(1)</script>')
    expect(email.html).toContain('&lt;script&gt;')
  })
})

describe('buildTrialDay5Email', () => {
  it('carries the fixed subject, the results and what stays', () => {
    const email = buildTrialDay5Email({
      firstName: 'Dr Amina Patel',
      marks: [nearMissOnManagement, nearMissOnManagement, passOnGathering],
      allowance: 5,
      dashboardUrl: DASHBOARD,
    })
    expect(email.subject).toBe('Your five stations have ended')
    expect(email.greeting).toBe('Hi Amina,')
    expect(email.text).toContain('You ran three of your five: one pass and two near misses.')
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
      remaining: 2,
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

    it(`invents no scarcity and quotes nobody — ${email.subject}`, () => {
      expect(body).not.toMatch(/hurry|last chance|don't miss|act now|only \d+ (?:places|spots)/i)
      // Testimonials, checked against the plain-text body: the HTML is full of
      // quoted style attributes, so a long quoted run only means something here.
      expect(email.text).not.toMatch(/"[^"]{40,}"/)
    })
  }
})
