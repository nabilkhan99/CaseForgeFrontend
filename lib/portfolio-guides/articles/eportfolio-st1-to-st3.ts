import type { PortfolioArticle } from '@/lib/portfolio-guides/articleTypes';
import { PORTFOLIO_TOOL_PATH } from '@/lib/portfolio-guides/articleTypes';

export const eportfolioSt1ToSt3: PortfolioArticle = {
    slug: 'eportfolio-st1-to-st3',
    heading: 'How your ePortfolio changes from ST1 to ST3',
    kicker: 'Training stages',
    metaTitle: 'How your ePortfolio changes from ST1 to ST3 | Fourteen Fisherman',
    metaDescription:
        'What shifts in expectation across GP training, why the same entry that passed in ST1 reads as thin in ST3, and how to write for where you are.',
    intro: [
        'The format of a clinical case review doesn\'t change across training. What\'s expected of it changes completely.',
        'An entry that was perfectly adequate in ST1 will read as underpowered in ST3, and trainees are rarely told this directly. They just notice at some point that feedback has got sharper without the requirements having changed.',
        'Requirements themselves vary by training programme and get revised periodically, so check the current position with the RCGP and your supervisor. This is about the shift in expectation, which is more stable.',
    ],
    sections: [
        {
            id: 'st1-showing-that-you-notice',
            title: 'ST1: showing that you notice',
            blocks: [
                {
                    type: 'text',
                    text: 'Early on, a lot of what you\'re evidencing is that you can recognise what matters in a consultation. Much of your time may be in hospital posts, where the presentations differ from general practice and your role is more constrained.',
                },
                {
                    type: 'text',
                    text: 'The expectation is roughly that you can identify the significant features of an encounter, recognise the limits of your competence, and act appropriately within them.',
                },
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'What a strong ST1 entry looks like',
                            paragraphs: [
                                'Clear identification of what was clinically important, honest acknowledgement of what you didn\'t know, and evidence that you escalated or sought help appropriately. Recognising you were out of your depth and doing something about it is genuinely good evidence at this stage.',
                            ],
                        },
                        {
                            term: 'The characteristic ST1 weakness',
                            paragraphs: [
                                'Description without interpretation. A full and accurate account of a patient with nothing about what you made of it.',
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: 'st2-showing-that-you-reason',
            title: 'ST2: showing that you reason',
            blocks: [
                {
                    type: 'text',
                    text: 'The middle of training is where the expectation shifts from noticing to thinking. You\'ve seen enough presentations to have priors. You should be generating differentials, weighing them, and being able to explain why you landed where you did.',
                },
                {
                    type: 'text',
                    text: 'The expectation is that your entries show reasoning under uncertainty, not just correct answers.',
                },
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'What a strong ST2 entry looks like',
                            paragraphs: [
                                'Explicit hypotheses, an account of what you were trying to exclude and why, and reasoning about the options you rejected. Increasingly, entries where there wasn\'t a clean answer.',
                            ],
                        },
                        {
                            term: 'The characteristic ST2 weakness',
                            paragraphs: [
                                'Reasoning that only appears when the case was unusual. Common presentations get written up as if they required no thought, which is exactly where the reasoning is most worth demonstrating.',
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: 'st3-showing-that-you-can-practise-independently',
            title: 'ST3: showing that you can practise independently',
            blocks: [
                {
                    type: 'text',
                    text: 'By ST3 you\'re being assessed against the standard of a doctor about to be licensed to practise unsupervised. That\'s the shift, and it\'s a large one.',
                },
                {
                    type: 'text',
                    text: 'The expectation isn\'t just that you reasoned well. It\'s that you can carry risk, hold uncertainty over time, manage complexity that has no guideline-based answer, and know the difference between a decision that needs escalating and one that\'s yours to make.',
                },
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'What a strong ST3 entry looks like',
                            paragraphs: [
                                'Multimorbidity, competing priorities, risk held deliberately rather than resolved by referral, decisions where you\'re still not certain you were right. Entries where you took responsibility rather than deferring it.',
                            ],
                        },
                        {
                            term: 'The characteristic ST3 weakness',
                            paragraphs: [
                                'Entries that would have been strong in ST2. Clean cases, clear reasoning, correct answer. They\'re not wrong, they\'re just no longer at the level being assessed.',
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: 'the-pattern-underneath',
            title: 'The pattern underneath',
            blocks: [
                {
                    type: 'text',
                    text: 'Across all three years the direction is the same: away from what happened and towards what you did with it.',
                },
                {
                    type: 'text',
                    text: 'ST1 evidences that you can see the case. ST2 evidences that you can think about it. ST3 evidences that you can be responsible for it.',
                },
                {
                    type: 'text',
                    text: 'If your entries look the same in ST3 as they did in ST1, that\'s worth noticing, and it\'s usually a writing problem rather than a practice problem. Your thinking has developed. The entries just haven\'t caught up.',
                },
            ],
        },
        {
            id: 'practical-implication',
            title: 'Practical implication',
            blocks: [
                {
                    type: 'text',
                    text: 'Write for where you are. In ST1, be explicit about the limits of your competence, because recognising them is the evidence. In ST3, stop being reassured by cases that went smoothly and write up the ones that didn\'t resolve, because that\'s the standard you\'re now being measured against.',
                },
                {
                    type: 'text',
                    text: 'And in every year, write close to the encounter. That advice doesn\'t change, and it matters more as the reasoning being evidenced gets more sophisticated. What you thought at ST3 level is more valuable and more perishable than what you thought at ST1.',
                },
            ],
        },
    ],
    cta: {
        paragraphs: [
            'Our [link: free GP portfolio tool] works for any training stage. Give it the encounter and your reasoning, and it returns a structured clinical case review mapped to the RCGP capability framework.',
        ],
        actions: [{ label: 'Try it here', href: PORTFOLIO_TOOL_PATH }],
    },
};
