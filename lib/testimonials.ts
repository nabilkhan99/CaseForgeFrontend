/**
 * The three real, attributable testimonials — one source, used by the landing
 * page and by the free-mock reveal.
 *
 * These are the only quotes the product is allowed to show. They were given by
 * named registrars who agreed to be quoted; anything invented, or any pass
 * claim bolted onto them, is a claim we cannot support. **None of these people
 * has told us they sat or passed the SCA**, so no surface may caption them as
 * having done so — see the `meta` line, which says what we actually know.
 */

export interface Testimonial {
  name: string;
  /** What we can honestly say about them — grade and region, nothing more. */
  meta: string;
  /** The quote as given, in full. Used where there is room for it. */
  quote: string;
  /**
   * The strongest passage, for tight surfaces. Always a verbatim substring of
   * {@link quote} — never a paraphrase — and rendered with a leading ellipsis
   * so it is visibly a trim rather than the whole thing. `lib/testimonials.test.ts`
   * enforces the substring rule, so an edit that quietly rewords one fails CI.
   */
  short: string;
  image: string;
  /** Extra classes where the crop needs help. */
  imageClass?: string;
}

/** Landing-page order, unchanged from before this data was extracted. */
export const TESTIMONIALS: readonly Testimonial[] = [
  {
    name: 'Dr Amir Hussain',
    meta: 'GP Registrar, Wessex',
    image: '/images/reviews/amir-hussain.jpeg',
    quote:
      'I’d sat through plenty of exam technique teaching before and mostly found it generic. These were genuinely different: each lecture took one part of the exam and showed exactly where the marks are and where most people lose them. Being able to rewatch the difficult consultations one in the run up to the exam took a lot of the fear out of those cases.',
    short:
      'each lecture took one part of the exam and showed exactly where the marks are and where most people lose them',
  },
  {
    name: 'Dr Harmeet Makan',
    meta: 'GP Registrar, East Midlands',
    image: '/images/reviews/harmeet-makan.jpeg',
    quote:
      'I’d tried other AI tools before and wasn’t impressed, so I went in sceptical. But with Fourteen Fisherman, the AI patients felt like those in my own clinics, and the feedback felt specific enough to be like having my ES sit in on the consultation. It also made practising super flexible: no hassle arranging study partners, and it was ready whenever I had time.',
    short:
      'the AI patients felt like those in my own clinics, and the feedback felt specific enough to be like having my ES sit in on the consultation',
  },
  {
    name: 'Dr Zain Chowdhary',
    meta: 'GP Registrar, London',
    image: '/images/reviews/zain-chowdhary.jpeg',
    imageClass: 'object-top',
    quote:
      'The one to one coaching was the part that made the biggest difference. Six stations back to back, then a review of my dashboard where my coach showed me the same mistake turning up across completely different cases, something I had never once spotted in months of practice. Fixing that one habit changed more than any individual station feedback did.',
    short:
      'my coach showed me the same mistake turning up across completely different cases, something I had never once spotted in months of practice',
  },
] as const;

/** The one quote that is about the thing a trial reader has just done. */
const TRIAL_LEAD_NAME = 'Dr Harmeet Makan';

/**
 * Same three, led by Harmeet: on the reveal page the reader has just finished
 * an AI consultation and read its feedback, and hers is the quote about exactly
 * that. The other two speak to the lectures and the one to one coaching
 * session, which matter to the same person a moment later, when they are
 * reading the plans.
 */
export const TESTIMONIALS_FOR_TRIAL: readonly Testimonial[] = [
  ...TESTIMONIALS.filter((t) => t.name === TRIAL_LEAD_NAME),
  ...TESTIMONIALS.filter((t) => t.name !== TRIAL_LEAD_NAME),
];
