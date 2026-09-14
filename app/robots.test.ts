import { describe, expect, it } from 'vitest'
import robots from './robots'

describe('robots.txt', () => {
  it('keeps crawlers out of the guest consultation lane', () => {
    // /try/talk opens a paid-for consultation on a GET, and the report links
    // under /try/feedback belong to the people who sat them.
    const { rules } = robots()
    const rule = Array.isArray(rules) ? rules[0] : rules
    expect(rule.disallow).toContain('/try/')
  })

  it('still lets them index the pages that are meant to be found', () => {
    const { rules } = robots()
    const rule = Array.isArray(rules) ? rules[0] : rules
    expect(rule.allow).toEqual(expect.arrayContaining(['/', '/sca-cases/', '/gp-portfolio-tool']))
    expect(rule.disallow).toEqual(expect.arrayContaining(['/admin/', '/dashboard/']))
  })
})
