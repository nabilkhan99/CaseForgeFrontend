import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FEATURE_ROWS } from './pricingFeatures'
import { FREE_TIER, PLANS } from './plans'

/**
 * The free column on the pricing table.
 *
 * The cells are POSITIONAL — index 0 is Free, index 3 is Intensive — and
 * nothing in the markup says so. The table renders twice off these rows (a
 * desktop grid and a stack of mobile cards), so an off-by-one does not throw:
 * it silently offers Complete's coaching session in the Free column. That is what
 * this file exists to catch.
 *
 * The other invariant here is the one that matters for money: `FREE_TIER` must
 * never become a member of `PLANS`.
 */

const FREE = 0
const SELF_STUDY = 1
const COMPLETE = 2
const INTENSIVE = 3

function rowFor(label: string) {
  const row = FEATURE_ROWS.find((item) => item.label === label)
  expect(row, `no "${label}" row`).toBeDefined()
  return row!
}

describe('the shape the table renders against', () => {
  it('gives every row exactly four cells', () => {
    for (const row of FEATURE_ROWS) {
      expect(row.cells, row.label).toHaveLength(4)
    }
  })

  it('agrees with the desktop grid’s column count', () => {
    // The one silent breakage: adding a column to the data and not to the
    // grid template leaves the table looking right and the cells one column
    // out. `repeat(N)` is the label column's four siblings.
    const source = readFileSync(
      fileURLToPath(new URL('../../components/landing/v5/PricingTable.tsx', import.meta.url)),
      'utf8',
    )
    const columns = FEATURE_ROWS[0].cells.length
    expect(source).toContain(`repeat(${columns},minmax(0,1fr))`)
  })
})

describe('what the free column offers', () => {
  it('is five cases with unlimited attempts', () => {
    const cell = rowFor('AI consultations').cells[FREE]
    expect(cell.text).toBe('Five cases')
    expect(cell.sub).toBe('unlimited attempts')
    expect(cell.cross).toBeFalsy()
  })

  it.each(['On-demand Lectures', '1:1 Coaching Session', 'Ongoing 1:1 coaching'])(
    'crosses %s',
    (label) => {
      expect(rowFor(label).cells[FREE].cross).toBe(true)
    },
  )
})

describe('the paid columns are unchanged', () => {
  it('still sells unlimited consultations on all three', () => {
    const cells = rowFor('AI consultations').cells
    expect(cells[SELF_STUDY].text).toBe('Unlimited')
    expect(cells[COMPLETE].text).toBe('Unlimited')
    expect(cells[INTENSIVE].text).toBe('Unlimited')
  })

  it('still puts the coaching session on Complete and Intensive only', () => {
    const cells = rowFor('1:1 Coaching Session').cells
    expect(cells[FREE].cross).toBe(true)
    expect(cells[SELF_STUDY].cross).toBe(true)
    expect(cells[COMPLETE].text).toBe('3 hours, 6 stations')
    expect(cells[COMPLETE].sub).toBe('Just you and your coach · £749 value')
    expect(cells[INTENSIVE].text).toBe('3 hours, 6 stations')
  })

  it('still keeps 1:1 coaching to Intensive', () => {
    const cells = rowFor('Ongoing 1:1 coaching').cells
    expect(cells[INTENSIVE].text).toBe('12 x 1hr sessions')
    expect(cells[COMPLETE].cross).toBe(true)
  })
})

describe('FREE_TIER is display copy, not a plan', () => {
  it('is not a member of PLANS', () => {
    // PLANS is what entitlements builds KNOWN_PLANS from, so a `free` member
    // would let a £0 preorders row grant access THROUGH THE PURCHASE FOLD —
    // the precise failure the grant's peer-table shape exists to prevent. It
    // would also need a Stripe Price that does not exist.
    const names = PLANS.map((plan) => plan.name)
    expect(names).not.toContain(FREE_TIER.name)
    expect(PLANS.map((plan) => plan.key)).not.toContain('free')
  })

  it('sends people to the picker rather than to checkout', () => {
    // One door: the same destination as every other free call to action.
    expect(FREE_TIER.ctaHref).toBe('/free')
    expect(FREE_TIER.displayPrice).toBe('£0')
  })

  it('says on the button what pressing it does', () => {
    expect(FREE_TIER.ctaLabel).toBe('Try 5 free cases')
    expect(FREE_TIER.tagline).toBe('Five cases · unlimited attempts · five days')
  })

  it('counts CASES to the reader, and stations only to the bank', () => {
    // "Station" is the product's own word — the brief, the report, the
    // library, and the 200 on the receipt. Somebody who has never sat one
    // knows it from an exam blueprint, if at all, so the free offer is
    // counted in cases wherever it is sold.
    const freeColumn = [
      FREE_TIER.tagline,
      FREE_TIER.ctaLabel,
      ...FEATURE_ROWS.map((row) => `${row.cells[FREE].text} ${row.cells[FREE].sub ?? ''}`),
    ]
      .join(' ')
      .toLowerCase()
    expect(freeColumn).not.toContain('station')

    // The whole bank keeps the word: it is the thing being priced.
    expect(rowFor('AI consultations').labelSub).toBe('200 stations')
  })

  it('names an outcome on the button, and no mechanism anywhere', () => {
    const copy = [
      FREE_TIER.ctaLabel,
      FREE_TIER.tagline,
      ...FEATURE_ROWS.map((row) => `${row.cells[FREE].text} ${row.cells[FREE].sub ?? ''}`),
    ]
      .join(' ')
      .toLowerCase()

    expect(copy).not.toMatch(/sign[ -]up/)
    expect(copy).not.toContain('code')
  })

  it('never says "trial" on the button', () => {
    // A product rule, not a preference: "trial" reads as a countdown to being
    // sold something, and the offer is five stations with no card.
    expect(FREE_TIER.ctaLabel.toLowerCase()).not.toContain('trial')
    expect(FREE_TIER.tagline.toLowerCase()).not.toContain('trial')
    for (const plan of PLANS) {
      expect(plan.ctaLabel.toLowerCase()).not.toContain('trial')
    }
  })
})
