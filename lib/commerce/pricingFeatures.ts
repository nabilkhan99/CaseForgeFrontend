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
      // The offer as it is stated everywhere else: five fixed cases, each one
      // as many times as the trainee likes.
      { text: 'Five cases', sub: 'unlimited attempts' },
      { text: 'Unlimited' },
      { text: 'Unlimited', sub: '£299 value' },
      { text: 'Unlimited' },
    ],
  },
  {
    label: 'On-demand Lectures',
    cells: [
      { text: '', cross: true },
      { text: '', cross: true },
      { text: '8.5 hours', sub: '£599 value' },
      { text: '8.5 hours' },
    ],
  },
  {
    label: '1:1 Coaching Session',
    cells: [
      { text: '', cross: true },
      { text: '', cross: true },
      { text: '3 hours, 6 stations', sub: 'Just you and your coach · £749 value' },
      { text: '3 hours, 6 stations' },
    ],
  },
  {
    label: 'Ongoing 1:1 coaching',
    cells: [
      { text: '', cross: true },
      { text: '', cross: true },
      { text: '', cross: true },
      { text: '12 x 1hr sessions' },
    ],
  },
]
