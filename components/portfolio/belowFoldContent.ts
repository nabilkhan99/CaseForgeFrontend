/**
 * Copy for the below-fold region of /gp-portfolio-tool.
 *
 * Kept as data rather than inline JSX for two reasons: the component stays small
 * enough to read in one screen, and prose full of apostrophes goes through React
 * as text rather than as markup that has to be escaped by hand.
 *
 * Every string below is the spec's wording. Two answers are flagged
 * {@link AWAITING_SIGN_OFF} and must be checked by the owner before this ships.
 */

/** Paragraphs of the collapsed "About the GP portfolio tool" block (§6a). */
export const ABOUT_PARAGRAPHS = [
    "Writing up clinical case reviews for the RCGP ePortfolio takes time most GP trainees don't have. This free tool turns a short description of a patient encounter into a structured, submission-ready draft mapped to the RCGP capability framework. Describe the case, choose your capabilities, and get a full write-up in seconds.",
    'Around one in four UK GP trainees use it. Over 15,000 case reviews were written with it in 30 days.',
    'The tool drafts, you verify. Check everything it produces against your own recollection of the encounter before submitting it as your reflection.',
] as const;

export interface CommonQuestion {
    question: string;
    /** One or more paragraphs of answer. */
    answer: readonly string[];
    /**
     * True where the spec marked the answer [CONFIRM BEFORE PUBLISHING]. Carried
     * in the data rather than a comment so the flag cannot drift away from the
     * text it applies to, and so it is greppable at publish time.
     */
    awaitingSignOff?: true;
}

/**
 * The two answers the spec flagged for the owner to confirm before publishing:
 * the data-retention position, and whether generation really is uncapped.
 * Exported so a pre-publish check can assert on it rather than eyeball it.
 */
export const AWAITING_SIGN_OFF = [
    'Does it store my patient data?',
    'Can I generate more than one?',
] as const;

/** Common questions (§6b), in the spec's order. */
export const COMMON_QUESTIONS: readonly CommonQuestion[] = [
    {
        question: 'How do I use this tool?',
        answer: [
            'Describe the case in a few sentences: what the patient presented with, what you did, what happened. Then choose the RCGP capabilities the encounter demonstrates, or let the tool pick them for you. It returns a structured clinical case review across the relevant domains, which you edit and paste into your ePortfolio.',
        ],
    },
    {
        question: 'How much detail should I put in?',
        answer: [
            'More than you think. Three or four sentences covering the presentation, your reasoning, what you did and what happened next will produce a far better draft than a one-line description. The tool can only reflect back what you give it, so a thin input gets you a generic entry that reads like every other generic entry.',
        ],
    },
    {
        question: 'Which capabilities should I choose?',
        answer: [
            "You can select them yourself, or leave it to the tool. Our capability selector reads what you've written and picks the ones the encounter actually evidences, which is usually more accurate than guessing, particularly early in training when the framework is still unfamiliar.",
            "If you'd rather choose your own, pick two or three the encounter genuinely demonstrates rather than tagging every capability you can loosely justify. A focused entry across three capabilities is stronger evidence than a thin entry spread across ten.",
        ],
    },
    {
        question: 'What makes a good clinical case review?',
        answer: [
            "A good entry shows your reasoning, not just what happened. Panels are looking for what you were thinking, what you considered and ruled out, where you were uncertain, and what you'd do differently. A polished entry with no reflection scores worse than a rougher one that shows genuine learning. Use the draft for structure and put your own thinking into the reflective sections.",
        ],
    },
    {
        question: 'Can I use AI to write my ePortfolio entries?',
        answer: [
            "Yes, as a drafting aid, and many trainees do. What you submit has to be an accurate account of an encounter you were part of, and reflection that's genuinely yours. Generating an entry for a case that didn't happen, or submitting reflection you don't recognise as your own, is a probity issue. Use the draft as a structure and rewrite the reflective sections in your own words.",
        ],
    },
    {
        question: 'Will my supervisor be able to tell it was AI-drafted?',
        answer: [
            "Our tool is built to avoid the usual tells. The output doesn't have the flat, even rhythm most generated text has, and it won't reach for the vocabulary that gives it away.",
            "The bigger risk isn't the writing, it's the content. Any draft written from three sentences of input can only be generic, because generic is all you gave it. What marks an entry as yours is the specific detail: the thing that surprised you, the decision you're still not sure about, what you'd do differently. Put those in and it reads like you, because it is you.",
            'So give it more to work with, then edit what comes back.',
        ],
    },
    {
        question: 'Does it store my patient data?',
        awaitingSignOff: true,
        answer: [
            "Don't enter patient-identifiable information. Names, dates of birth, NHS numbers and addresses should never go into the box. Write the case the way you'd write it for the ePortfolio itself, describing the patient by age, sex and presentation only.",
        ],
    },
    {
        question: 'Can I edit the review before I submit it?',
        answer: [
            "You should. Every draft is a starting point. Check it against what actually happened, correct anything that doesn't match, and rewrite the reflection in your own words. The tool saves you the blank page, not the thinking.",
        ],
    },
    {
        question: 'Can I generate more than one?',
        awaitingSignOff: true,
        answer: ["Yes, as many as you like. There's no credit system and no cap."],
    },
    {
        question: 'Does it work for other entry types?',
        answer: [
            "It's built for clinical case reviews, but plenty of people use it for learning logs, significant events and leadership entries, and it holds up well. If there's an entry type you'd want a dedicated tool for, email us at hello@fourteenfisherman.com. We build what people ask for.",
        ],
    },
    {
        question: 'Is it free?',
        answer: [
            "Yes. It's how most GP trainees first find us, and around one in four use it. Some of them later use our SCA preparation, and that's the part we charge for.",
        ],
    },
    {
        question: 'Do I have to write up every patient I see?',
        answer: [
            "No, and trying to is how people burn out on the ePortfolio. Pick encounters where something happened: a diagnosis you nearly missed, a consultation that went badly, a decision you're still unsure about. One entry on a case that genuinely taught you something is worth five on straightforward presentations.",
        ],
    },
    {
        question: "What's the difference between a log entry and a clinical case review?",
        answer: [
            'Log entries are the broad record of your learning across training, covering courses, tutorials, significant events and clinical encounters. A clinical case review is one type of log entry, focused on a single patient encounter and your reasoning through it. This tool drafts clinical case reviews.',
        ],
    },
    {
        question: 'How long should an entry be?',
        answer: [
            "Long enough to show your reasoning, short enough that someone actually reads it. Most good entries run a few hundred words. Length isn't what's assessed, depth of reflection is, and a short entry that admits genuine uncertainty beats a long one that narrates a consultation without ever saying what you were thinking.",
        ],
    },
    {
        question: 'Can I write up a case from a few weeks ago?',
        answer: [
            "Yes, though the detail fades fast. If you can still remember what you were thinking at the time and why you made the decisions you made, it's worth writing. If all you can recall is the outcome, the reflection tends to come out hollow. Jotting three or four lines on your phone at the time and writing it up properly later works better than either extreme.",
        ],
    },
    {
        question: "I'm an ST1. Is this useful yet?",
        answer: [
            "Yes. ST1s and ST2s make up a large share of the people using it. The requirements differ by training year but the format of a clinical case review doesn't, and getting into the habit early means you aren't writing twenty entries the fortnight before ARCP.",
        ],
    },
];
