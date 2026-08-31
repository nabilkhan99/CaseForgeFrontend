import type { PortfolioArticle } from '@/lib/portfolio-guides/articleTypes';
import { PORTFOLIO_TOOL_PATH } from '@/lib/portfolio-guides/articleTypes';

// PRE-PUBLISH: this article and clinical-case-review-examples are the only two
// in the cluster making clinical claims. Both need a clinical read before they
// go live (build spec section 10).
export const howToWriteAClinicalCaseReview: PortfolioArticle = {
    slug: 'how-to-write-a-clinical-case-review',
    heading: 'How to write a GP clinical case review, with worked examples',
    kicker: 'Writing entries',
    metaTitle: 'How to write a GP clinical case review, with examples | Fourteen Fisherman',
    metaDescription:
        'What a good clinical case review actually contains, why most entries are marked as thin, and three worked examples showing the difference.',
    intro: [
        'Most clinical case reviews fail in the same way. They describe a consultation accurately, in reasonable detail, and say almost nothing about the person who conducted it.',
        'That\'s the whole problem in one sentence, and once you see it you can\'t unsee it. An entry that narrates events is a clinical summary. An entry that shows reasoning is a case review. Only the second one is evidence of anything.',
    ],
    sections: [
        {
            id: 'whats-actually-being-assessed',
            title: 'What\'s actually being assessed',
            blocks: [
                {
                    type: 'text',
                    text: 'Nobody reading your ePortfolio is checking whether you can recount a consultation. They\'re looking for signs that you think like a GP: that you generate hypotheses, weigh probability against risk, tolerate uncertainty, and know what you don\'t know.',
                },
                {
                    type: 'text',
                    text: 'None of that is visible in a description of what happened. It\'s only visible when you say what was going on in your head.',
                },
                {
                    type: 'text',
                    text: 'So the useful structure isn\'t chronological. It\'s this:',
                },
                {
                    type: 'text',
                    text: '**What happened.** Brief. The presentation, the relevant findings, what you did, the outcome. This is context, not content, and it should be the shortest section.',
                },
                {
                    type: 'text',
                    text: '**What you were thinking.** What you thought it might be and why. What you were trying to exclude. What made you more or less worried as it went on. Where you were uncertain.',
                },
                {
                    type: 'text',
                    text: '**Why you did what you did.** The reasoning behind the decision, including the options you didn\'t take. A referral you considered and rejected is often better evidence than the referral you made.',
                },
                {
                    type: 'text',
                    text: '**What you\'d do differently.** Specific, not general. "I\'d take a better history" is not a reflection. "I\'d have asked about the family history earlier, because it changed my threshold once I had it" is.',
                },
            ],
        },
        {
            id: 'the-commonest-failures',
            title: 'The commonest failures',
            blocks: [
                {
                    type: 'text',
                    text: '**Narration without reasoning.** Everything that happened, nothing about why. The most common failure by a distance.',
                },
                {
                    type: 'text',
                    text: '**Reflection that could apply to any case.** "This case highlighted the importance of good communication." True of every consultation ever conducted. It tells a reader nothing.',
                },
                {
                    type: 'text',
                    text: '**Only writing up successes.** An entry where you got it right, felt confident throughout and the patient improved is the least useful thing you can submit. Cases where you were unsure, or where you\'d change your approach, are worth several of them.',
                },
                {
                    type: 'text',
                    text: '**Capability inflation.** Tagging an entry against everything you can loosely justify. A focused entry evidencing three capabilities well is stronger than one spread thin across ten.',
                },
            ],
        },
        {
            id: 'worked-example-one-the-presentation-that-changed',
            title: 'Worked example one: the presentation that changed',
            blocks: [
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Context',
                            paragraphs: [
                                'A man in his fifties presented with several weeks of intermittent upper abdominal discomfort, worse after eating, no red flag symptoms on direct questioning. He\'d tried over the counter antacids with partial effect.',
                            ],
                        },
                        {
                            term: 'What I was thinking',
                            paragraphs: [
                                'My working hypothesis was reflux or functional dyspepsia, which is where the probability sat. What I was actively trying to exclude was anything suggesting malignancy or cardiac origin, given his age and the fact that the discomfort was episodic. I asked specifically about weight, swallowing, vomiting and whether exertion made any difference. All negative, which moved me further towards a benign explanation.',
                                'The thing that shifted my thinking was late in the consultation, almost in passing: he mentioned the discomfort had once come on while walking uphill. He\'d dismissed it because it settled with a burp. I hadn\'t asked the right question, he\'d volunteered it, and it changed the consultation.',
                            ],
                        },
                        {
                            term: 'Why I did what I did',
                            paragraphs: [
                                'I widened the assessment to include cardiac risk rather than closing on the gastrointestinal hypothesis I\'d already settled on. That meant examining, taking a proper cardiovascular history and arranging investigation on that basis as well. I could have reasonably attributed the exertional episode to coincidence, and part of me wanted to, because I\'d already formed a view. I didn\'t, because the consequence of being wrong in one direction was much worse than in the other.',
                            ],
                        },
                        {
                            term: 'What I\'d do differently',
                            paragraphs: [
                                'I\'d ask about exertional relationship in any upper abdominal presentation in a middle aged patient as standard, rather than only when the history points that way. My questioning had been shaped by the hypothesis I\'d formed in the first two minutes, and I nearly closed the consultation before he told me the thing that mattered.',
                            ],
                        },
                    ],
                },
                {
                    type: 'capabilities',
                    items: [
                        'data gathering and interpretation',
                        'making decisions',
                        'managing medical complexity',
                    ],
                },
            ],
        },
        {
            id: 'worked-example-two-the-consultation-that-went-badly',
            title: 'Worked example two: the consultation that went badly',
            blocks: [
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Context',
                            paragraphs: [
                                'A woman in her thirties attended requesting antibiotics for a cough of a few days\' duration, no fever, chest clear, nothing to suggest bacterial infection. I explained why antibiotics weren\'t indicated. She left visibly unhappy and complained to reception on the way out.',
                            ],
                        },
                        {
                            term: 'What I was thinking',
                            paragraphs: [
                                'Clinically I was comfortable. The examination was reassuring and there was no case for prescribing. What I was thinking about far too late was why she\'d come, which I never actually established.',
                                'She\'d told me early on that she had something important the following week. I registered it as background rather than as the reason she was sitting in front of me. My whole consultation was structured around justifying a decision I\'d already made, rather than finding out what she was worried about.',
                            ],
                        },
                        {
                            term: 'Why I did what I did',
                            paragraphs: [
                                'Not prescribing was right and I\'d do it again. But the way I got there was a lecture rather than a conversation, and by the time I\'d finished explaining antimicrobial resistance she\'d stopped listening, which is fair enough.',
                            ],
                        },
                        {
                            term: 'What I\'d do differently',
                            paragraphs: [
                                'Ask what she was hoping for before explaining anything. If I\'d known what the following week was and why it mattered, I could have addressed the actual concern, and the same clinical decision would probably have landed completely differently. The failure was that I treated her agenda as an obstacle to my decision instead of information I needed.',
                            ],
                        },
                    ],
                },
                {
                    type: 'capabilities',
                    items: [
                        'communication and consultation skills',
                        'practising holistically and promoting health',
                    ],
                },
            ],
        },
        {
            id: 'worked-example-three-the-decision-im-still-not-sure-about',
            title: 'Worked example three: the decision I\'m still not sure about',
            blocks: [
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Context',
                            paragraphs: [
                                'An elderly woman with multiple long term conditions, on a substantial number of medicines, was referred to me for review after a fall. No injury, no clear single cause.',
                            ],
                        },
                        {
                            term: 'What I was thinking',
                            paragraphs: [
                                'The obvious contributor was her medication burden, particularly agents affecting blood pressure and anything sedating. Reducing them would lower her falls risk. It would also destabilise conditions that were currently well controlled, and she was clear that she felt well and didn\'t want things changed.',
                            ],
                        },
                        {
                            term: 'Why I did what I did',
                            paragraphs: [
                                'I made one change rather than several, chose the agent with the clearest link to falls, and arranged review. The argument for going further was that her falls risk was significant and the next one might not be uneventful. The argument against was that she has capacity, understood the trade off when I explained it, and told me plainly what she wanted.',
                            ],
                        },
                        {
                            term: 'What I\'d do differently',
                            paragraphs: [
                                'I\'m genuinely unsure this was right, and that\'s why I\'ve written it up. I may have under-treated the falls risk out of deference to her preference. Or I may have correctly weighted what she told me mattered to her over what the guidance would default to. I discussed it in tutorial afterwards and my supervisor didn\'t think there was a clean answer either. What I\'ve taken from it is that "the patient declined" is too easy a note to write, and that I want to be able to distinguish between genuinely shared decision making and avoiding a difficult conversation.',
                            ],
                        },
                    ],
                },
                {
                    type: 'capabilities',
                    items: [
                        'clinical management',
                        'managing medical complexity',
                        'maintaining an ethical approach',
                    ],
                },
            ],
        },
        {
            id: 'what-those-three-have-in-common',
            title: 'What those three have in common',
            blocks: [
                {
                    type: 'text',
                    text: 'None of them is a rare presentation. Reflux, a cough, polypharmacy in an older patient. All completely ordinary.',
                },
                {
                    type: 'text',
                    text: 'What makes them worth writing is that something happened in the thinking: a hypothesis that nearly closed too early, an agenda that was missed, a decision that\'s still unresolved. That\'s available in almost every surgery you do. You just have to notice it at the time.',
                },
            ],
        },
    ],
    cta: {
        paragraphs: [
            'Our [link: free GP portfolio tool] turns a short description of an encounter into a structured clinical case review, mapped to the RCGP capability framework. Give it the detail and it\'ll give you the structure.',
        ],
        actions: [{ label: 'Try it here', href: PORTFOLIO_TOOL_PATH }],
    },
};
