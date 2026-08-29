import { describe, expect, it } from 'vitest'
import { buildPurchaseEmailCopy } from './purchaseEmail'

describe('buildPurchaseEmailCopy', () => {
  it('puts the plan display name in the subject', () => {
    expect(buildPurchaseEmailCopy({ planKey: 'complete', firstName: 'Jane' }).subject).toBe(
      "You're in — Complete confirmed",
    )
    expect(buildPurchaseEmailCopy({ planKey: 'self_study', firstName: 'Jane' }).subject).toBe(
      "You're in — Self-Study confirmed",
    )
  })

  it('falls back to a generic subject for an unknown plan key', () => {
    expect(buildPurchaseEmailCopy({ planKey: 'mystery_tier', firstName: 'Jane' }).subject).toBe(
      "You're in — your plan confirmed",
    )
  })

  it('greets with the first name only', () => {
    expect(buildPurchaseEmailCopy({ planKey: 'complete', firstName: 'Jane Doe' }).greeting).toBe('Hi Jane,')
  })

  it('falls back to "there" when the name is missing or blank', () => {
    expect(buildPurchaseEmailCopy({ planKey: 'complete', firstName: null }).greeting).toBe('Hi there,')
    expect(buildPurchaseEmailCopy({ planKey: 'complete', firstName: '' }).greeting).toBe('Hi there,')
    expect(buildPurchaseEmailCopy({ planKey: 'complete', firstName: '   ' }).greeting).toBe('Hi there,')
  })

  it('returns three body paragraphs, the first naming the plan', () => {
    const copy = buildPurchaseEmailCopy({ planKey: 'complete', firstName: 'Jane' })
    expect(copy.lines).toHaveLength(3)
    expect(copy.lines[0]).toContain('Complete')
  })

  it('omits the coaching line when there is no coaching day', () => {
    expect(buildPurchaseEmailCopy({ planKey: 'self_study', firstName: 'Jane' }).coachingLine).toBeNull()
    expect(
      buildPurchaseEmailCopy({ planKey: 'self_study', firstName: 'Jane', coachingDayLabel: null }).coachingLine,
    ).toBeNull()
  })

  it('includes the coaching day label and class size when a day is booked', () => {
    const copy = buildPurchaseEmailCopy({
      planKey: 'complete',
      firstName: 'Jane',
      coachingDayLabel: 'Saturday 12 September 2026',
    })
    expect(copy.coachingLine).toContain('Saturday 12 September 2026')
    expect(copy.coachingLine).toContain('maximum class of 6')
  })

  it('treats an empty or whitespace-only coaching label as no coaching day', () => {
    expect(
      buildPurchaseEmailCopy({ planKey: 'complete', firstName: 'Jane', coachingDayLabel: '' }).coachingLine,
    ).toBeNull()
    expect(
      buildPurchaseEmailCopy({ planKey: 'complete', firstName: 'Jane', coachingDayLabel: '   ' }).coachingLine,
    ).toBeNull()
  })
})
