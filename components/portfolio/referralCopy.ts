import {
  REFEREE_REWARD_BY_PLAN,
  REFERRAL_LINKS_CLOSE_LABEL,
  REWARD_BY_PLAN,
  formatPence,
} from '@/lib/commerce/referrals'

/**
 * Every money figure the referral strip and modal say out loud, derived from the
 * reward engine rather than retyped.
 *
 * The point is that a change to REWARD_BY_PLAN can never leave the marketing
 * copy quoting a number the payout code no longer honours — which is the one
 * failure mode of a referral offer you cannot apologise your way out of.
 */

/** What the sharer earns when their friend buys the Complete course. */
export const COMPLETE_SHARER_REWARD = formatPence(REWARD_BY_PLAN.complete)

/** What the friend gets back on the Complete course. */
export const COMPLETE_FRIEND_REWARD = formatPence(REFEREE_REWARD_BY_PLAN.complete)

/** Sharer's side on any Self-Study plan (3-month and monthly pay the same). */
export const SELF_STUDY_SHARER_REWARD = formatPence(REWARD_BY_PLAN.self_study)

/** Friend's side on any Self-Study plan. */
export const SELF_STUDY_FRIEND_REWARD = formatPence(REFEREE_REWARD_BY_PLAN.self_study)

/**
 * The headline "split £X" number: both sides of a Complete referral added up.
 * £100 + £100, computed rather than written, so it tracks the two halves.
 */
export const SPLIT_POT = formatPence(REWARD_BY_PLAN.complete + REFEREE_REWARD_BY_PLAN.complete)

/** Re-exported so components quote the campaign end date from one place. */
export const LINKS_CLOSE_LABEL = REFERRAL_LINKS_CLOSE_LABEL

/** The five steps between sharing a link and being paid, per the spec. */
export const HOW_IT_WORKS = [
  "Enter your email and we'll send you your own referral link.",
  'Share it with anyone preparing for the SCA. WhatsApp, group chat, wherever.',
  'They sign up through your link.',
  'We verify which plan they joined.',
  'We email you both to arrange payment, and you both get paid.',
] as const

/** The two-sided reward table. */
export const REWARD_TABLE = [
  {
    plan: 'Complete SCA Course',
    sharer: COMPLETE_SHARER_REWARD,
    friend: COMPLETE_FRIEND_REWARD,
  },
  {
    plan: 'Self-Study, monthly or 3-month',
    sharer: SELF_STUDY_SHARER_REWARD,
    friend: SELF_STUDY_FRIEND_REWARD,
  },
] as const

/**
 * The DMCCA 2024 disclosure. Kept as one visible sentence in the modal body, NOT
 * folded behind the terms link: the Digital Markets, Competition and Consumers
 * Act 2024 requires the commercial nature of an incentivised recommendation to
 * be apparent at the point the recommendation is solicited.
 */
export const DISCLOSURE = `Fourteen Fisherman pays a referral fee of ${COMPLETE_SHARER_REWARD} per person who joins the Complete SCA Course through your link, and ${SELF_STUDY_SHARER_REWARD} for Self-Study.`

/**
 * The PECR notice. A notice, deliberately not a consent checkbox: the link email
 * is a service message they asked for, and the marketing that follows goes out
 * as a Brevo campaign carrying Brevo's unsubscribe footer, so the lawful basis
 * is soft opt-in with a working opt-out rather than tick-box consent.
 */
export const MARKETING_NOTICE =
  "We'll email you your link and occasional updates on SCA preparation and course dates. Unsubscribe in any email."
