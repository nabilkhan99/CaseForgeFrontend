import { describe, expect, it } from 'vitest'
import { buildCaseSeoIndex } from './cases'
import type { PublicCase } from '@/lib/cases/publicCases'

/**
 * Hand-set case URLs, pinned.
 *
 * A case's public address is derived from its title, so renaming a station in
 * the database silently moves its page. The overrides hold the address still,
 * and next.config.js carries the permanent redirect from the old one. Both
 * halves are asserted here so a later title edit cannot quietly 404 an indexed
 * page.
 */

const DIABETES_RISK_ID = '16c48616-d334-4d20-8af1-f17388f702b8'

function caseWith(id: string, title: string): PublicCase {
  return { id, title } as PublicCase
}

describe('the pre-diabetes risk case', () => {
  it.each([
    ['its old title', 'Cardiovascular Risk and Impaired Fasting Glycaemia in a South Asian Male'],
    ['its new title', 'South Asian man with pre-diabetes and cardiovascular risk after a health check'],
  ])('keeps one address and heading under %s', (_label, title) => {
    const [entry] = buildCaseSeoIndex([caseWith(DIABETES_RISK_ID, title)])
    expect(entry.slug).toBe('pre-diabetes-and-cardiovascular-risk-after-a-health-check')
    expect(entry.path).toBe('/sca-cases/pre-diabetes-and-cardiovascular-risk-after-a-health-check')
    expect(entry.condition).toBe('Pre-diabetes and Cardiovascular Risk After a Health Check')
  })

  it('no longer calls an HbA1c result impaired fasting glycaemia', () => {
    const [entry] = buildCaseSeoIndex([
      caseWith(DIABETES_RISK_ID, 'Cardiovascular Risk and Impaired Fasting Glycaemia in a South Asian Male'),
    ])
    expect(entry.condition.toLowerCase()).not.toContain('fasting')
    expect(entry.slug).not.toContain('fasting')
  })
})

describe('cases without an override', () => {
  it('still take their address from the title', () => {
    const [entry] = buildCaseSeoIndex([
      caseWith('00000000-0000-0000-0000-000000000000', 'Teacher with a blocked nose for months asking for something stronger'),
    ])
    expect(entry.slug).toBe('blocked-nose-for-months-asking-for-something-stronger')
  })
})
