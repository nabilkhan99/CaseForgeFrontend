/**
 * What each column of the pricing table contains, as data.
 *
 * Lifted out of `components/landing/v5/PricingTable` when the free column was
 * added, for one reason: the table renders twice (a desktop grid and a stack of
 * mobile cards) off the same rows, and the cells are POSITIONAL — cell 0 is
 * Free, cell 3 is Intensive, and nothing in the markup says so. A tuple type in
 * a module that can be imported by a test is the only thing that makes "the
 * free column crosses the lectures row" a fact anyone can check without a DOM.
 *
 * The order is Free, Self-Study, Complete, Intensive, and it is load-bearing in
 * three places: this file, the desktop grid's column headers, and each mobile
 * card's `cellIndex`.
 */

export interface FeatureCell {
  text: string
  sub?: string
  /** Drawn as an em dash. `text` is ignored when set. */
  cross?: boolean
}

/** free, self_study, complete, intensive — in that order, always. */
export type FeatureCells = [FeatureCell, FeatureCell, FeatureCell, FeatureCell]

export interface FeatureRow {
  label: string
  labelSub?: string
  cells: FeatureCells
}

export const FEATURE_ROWS: readonly FeatureRow[] = [
  {
    label: 'AI consultations',
    labelSub: '200 stations',
    cells: [
      // Not "5 free" — the number that matters is how many get MARKED, and the
      // second line is the answer to the question the column raises ("and then
      // what?"), which is the same answer the wall gives.
      { text: 'Five, marked', sub: 'then your board stays, read-only' },
      { text: 'Unlimited' },
      { text: 'Unlimited', sub: '£299 value' },
      { text: 'Unlimited' },
    ],
  },
  {
    // The row that makes the free column an offer rather than a sample: what
    // you did is kept, whatever you decide afterwards. Included everywhere, so
    // it reads as a property of the product rather than a plan feature.
    label: 'Dashboard, board, development page',
    cells: [
      { text: 'Included' },
      { text: 'Included' },
      { text: 'Included' },
      { text: 'Included' },
    ],
  },
  {
    label: 'On-demand Lectures',
    cells: [
      { text: '', cross: true },
      { text: '', cross: true },
      { text: '8 hours', sub: '£599 value' },
      { text: '8 hours' },
    ],
  },
  {
    label: 'Small-Group Coaching',
    cells: [
      { text: '', cross: true },
      { text: '', cross: true },
      { text: 'One full day, 9am to 5pm', sub: 'Max class of 6 · £599 value' },
      { text: 'One full day, 9am to 5pm' },
    ],
  },
  {
    label: '1:1 weekly coaching',
    cells: [
      { text: '', cross: true },
      { text: '', cross: true },
      { text: '', cross: true },
      { text: '12 x 1hr sessions' },
    ],
  },
]
