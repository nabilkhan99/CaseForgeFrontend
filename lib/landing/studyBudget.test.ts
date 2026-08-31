import { describe, expect, it } from 'vitest'
import { buildEmailBody, DEANERIES } from './studyBudget'

/**
 * The pre-approval email is sent by the trainee, under their own name, to the
 * office that funds them. So it may say what the course IS, and it may ask for
 * a decision — but it must never assert something about the sender that they
 * may not have done. A template that quietly claims an ES conversation or a PDP
 * entry on their behalf is a probity problem, not a copy preference, which is
 * why it is pinned here rather than left to review.
 */
describe('the deanery pre-approval email', () => {
  it('never claims the sender has done something on their behalf', () => {
    for (const deanery of DEANERIES) {
      for (const hasResat of [false, true]) {
        const body = buildEmailBody(deanery, hasResat)
        const where = `${deanery.slug} resat=${hasResat}`
        expect(body, where).not.toContain('added SCA preparation to my PDP')
        expect(body, where).not.toContain('I have discussed this with my Educational Supervisor')
      }
    }
  })

  it('still asks the question the email exists to ask', () => {
    for (const deanery of DEANERIES) {
      for (const hasResat of [false, true]) {
        expect(buildEmailBody(deanery, hasResat), `${deanery.slug} resat=${hasResat}`).toContain(
          'Could you confirm whether this would be approved',
        )
      }
    }
  })

  it('joins its paragraphs without leaving a gap where one was removed', () => {
    for (const deanery of DEANERIES) {
      for (const hasResat of [false, true]) {
        expect(buildEmailBody(deanery, hasResat), `${deanery.slug} resat=${hasResat}`).not.toContain(
          '\n\n\n',
        )
      }
    }
  })
})
