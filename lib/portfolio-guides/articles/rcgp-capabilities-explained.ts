import type { PortfolioArticle } from '@/lib/portfolio-guides/articleTypes';
import { PORTFOLIO_TOOL_PATH } from '@/lib/portfolio-guides/articleTypes';

export const rcgpCapabilitiesExplained: PortfolioArticle = {
    slug: 'rcgp-capabilities-explained',
    heading: 'The 13 RCGP capabilities explained, and what evidence each one needs',
    kicker: 'The capability framework',
    metaTitle: 'The 13 RCGP capabilities explained | Fourteen Fisherman',
    metaDescription:
        'What each of the 13 RCGP capabilities is actually about, and the kind of evidence that demonstrates it well in an ePortfolio entry.',
    intro: [
        'The 13 capabilities are the framework your ePortfolio evidence is assessed against. Most trainees can list them and far fewer can say what distinguishes one from another, which is why so many entries end up tagged against whichever ones sound vaguely relevant.',
        'The distinctions matter, because a capability evidenced well is worth more than four evidenced loosely. What follows is what each one is actually about and the kind of entry that demonstrates it.',
        'For the formal definitions and current word descriptors, go to the RCGP curriculum itself. This is a practical guide to using them, not a substitute for the source.',
    ],
    sections: [
        {
            id: 'fitness-to-practise',
            title: 'Fitness to practise',
            blocks: [
                {
                    type: 'text',
                    text: 'About your awareness of yourself as a professional: recognising when your own health, workload or state of mind is affecting your practice, and doing something about it.',
                },
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Evidences well',
                            paragraphs: [
                                'An entry where you noticed you were tired, rushed or emotionally affected and adjusted, escalated or asked for help. Also anything involving raising a concern about practice, yours or someone else\'s.',
                            ],
                        },
                        {
                            term: 'Commonly mistagged',
                            paragraphs: [
                                'General reflections on being busy. Recognising you had a hard day isn\'t the capability. Acting on the recognition is.',
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: 'maintaining-an-ethical-approach',
            title: 'Maintaining an ethical approach',
            blocks: [
                {
                    type: 'text',
                    text: 'About values in practice: confidentiality, capacity, consent, respecting difference, managing your own beliefs where they intersect with a patient\'s.',
                },
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Evidences well',
                            paragraphs: [
                                'A consultation where the right course of action wasn\'t obvious and you had to weigh competing principles. Disclosure decisions. Situations where a patient\'s choice differed from what you\'d have chosen.',
                            ],
                        },
                        {
                            term: 'Commonly mistagged',
                            paragraphs: [
                                'Any consultation involving a sensitive topic. The topic being sensitive isn\'t the capability. The ethical reasoning is.',
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: 'communication-and-consultation-skills',
            title: 'Communication and consultation skills',
            blocks: [
                {
                    type: 'text',
                    text: 'About how you conduct a consultation: eliciting the agenda, exploring ideas, concerns and expectations, explaining, negotiating, adapting to the person in front of you.',
                },
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Evidences well',
                            paragraphs: [
                                'Consultations that were difficult to conduct rather than difficult to diagnose. Breaking bad news, disagreement, an interpreter, a patient who wouldn\'t engage. Consultations that went badly are often the strongest evidence here, provided you say why.',
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: 'data-gathering-and-interpretation',
            title: 'Data gathering and interpretation',
            blocks: [
                {
                    type: 'text',
                    text: 'About history, examination findings, records and results, and what you do with them. Not the volume of information gathered, but whether you gathered the right information and interpreted it correctly.',
                },
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Evidences well',
                            paragraphs: [
                                'An entry showing how your questioning was directed by your hypotheses, and what changed when something unexpected came back. A missed cue you caught late is good evidence, because it shows you know what should have happened.',
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: 'clinical-examination-and-procedural-skills',
            title: 'Clinical examination and procedural skills',
            blocks: [
                {
                    type: 'text',
                    text: 'About physical examination and practical procedures: performing them competently, appropriately, and with proper regard for consent and dignity.',
                },
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Evidences well',
                            paragraphs: [
                                'An entry where the examination changed your thinking, or where you had to adapt your usual approach. Procedures with a complication or an unexpected finding.',
                            ],
                        },
                        {
                            term: 'Commonly mistagged',
                            paragraphs: [
                                'Entries where you examined someone and it was normal. That\'s a description, not evidence.',
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: 'making-decisions',
            title: 'Making decisions',
            blocks: [
                {
                    type: 'text',
                    text: 'About the decision itself: how you reached it, what alternatives you weighed, how you handled uncertainty and risk.',
                },
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Evidences well',
                            paragraphs: [
                                'An entry where you can articulate the options you rejected and why. Watchful waiting is a decision, and often a harder one to justify than acting.',
                            ],
                        },
                    ],
                },
                {
                    type: 'text',
                    text: 'This is the capability most under-evidenced by trainees, because it lives entirely in reasoning that never makes it onto the page.',
                },
            ],
        },
        {
            id: 'clinical-management',
            title: 'Clinical management',
            blocks: [
                {
                    type: 'text',
                    text: 'About what happens after the decision: the plan, prescribing, follow up, safety netting, coordination of care.',
                },
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Evidences well',
                            paragraphs: [
                                'Entries showing how the plan was constructed, why safety netting was set where it was, and what would trigger review.',
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: 'managing-medical-complexity',
            title: 'Managing medical complexity',
            blocks: [
                {
                    type: 'text',
                    text: 'About patients with more than one thing going on: co-morbidity, polypharmacy, competing priorities, uncertainty over time.',
                },
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Evidences well',
                            paragraphs: [
                                'An entry where treating one problem risked worsening another, or where guideline-based management for each condition separately would have produced a poor plan overall.',
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: 'working-with-colleagues-and-in-teams',
            title: 'Working with colleagues and in teams',
            blocks: [
                {
                    type: 'text',
                    text: 'About functioning within a practice and across the wider system: handover, delegation, referral, working with nursing, pharmacy, secretarial and social care colleagues.',
                },
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Evidences well',
                            paragraphs: [
                                'A handover that went wrong. A referral that needed negotiating. A situation where you had to rely on someone else\'s judgement, or where they relied on yours.',
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: 'maintaining-performance-learning-and-teaching',
            title: 'Maintaining performance, learning and teaching',
            blocks: [
                {
                    type: 'text',
                    text: 'About your own development and your contribution to others\': identifying gaps, addressing them, teaching, supervising, using evidence.',
                },
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Evidences well',
                            paragraphs: [
                                'An entry that starts with something you didn\'t know, shows what you did about it, and shows the change in practice that followed. Teaching sessions you delivered, with reflection on how they landed.',
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: 'organisation-management-and-leadership',
            title: 'Organisation, management and leadership',
            blocks: [
                {
                    type: 'text',
                    text: 'About the running of things: appointment systems, records, prioritisation, quality improvement, taking responsibility for a change.',
                },
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Evidences well',
                            paragraphs: [
                                'Quality improvement work. Identifying a systems problem, not just a clinical one, and doing something about it. Managing your own workload under pressure.',
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: 'practising-holistically-and-promoting-health',
            title: 'Practising holistically and promoting health',
            blocks: [
                {
                    type: 'text',
                    text: 'About the person rather than the presentation: psychological, social and cultural context, and health promotion within it.',
                },
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Evidences well',
                            paragraphs: [
                                'Entries where the social context changed the management. Where the presenting complaint wasn\'t the actual problem. Where a clinically correct plan wouldn\'t have worked in that person\'s life.',
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: 'community-orientation',
            title: 'Community orientation',
            blocks: [
                {
                    type: 'text',
                    text: 'About the population and the system: local demography, health inequality, resource constraint, services available in your area.',
                },
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Evidences well',
                            paragraphs: [
                                'Entries where local resource shaped what was possible. Where you had to work around what wasn\'t available. Where you noticed a pattern across patients rather than in one.',
                            ],
                        },
                    ],
                },
                {
                    type: 'text',
                    text: 'This is the least-evidenced capability of the 13, largely because it requires you to think about the denominator rather than the patient. Entries here stand out for that reason.',
                },
            ],
        },
        {
            id: 'choosing-capabilities-for-an-entry',
            title: 'Choosing capabilities for an entry',
            blocks: [
                {
                    type: 'text',
                    text: 'Pick two or three the encounter genuinely demonstrates. Ask what a reader would learn about you from this entry, and tag the capabilities that answer is actually about.',
                },
                {
                    type: 'text',
                    text: 'If you find yourself justifying why a capability might apply, it doesn\'t.',
                },
            ],
        },
    ],
    cta: {
        paragraphs: [
            'Our [link: free GP portfolio tool] can select capabilities for you, reading what you\'ve written and picking the ones the encounter actually evidences. Useful early in training, when the framework is still unfamiliar.',
        ],
        actions: [{ label: 'Try it here', href: PORTFOLIO_TOOL_PATH }],
    },
};
