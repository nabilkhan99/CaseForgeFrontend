import type { PortfolioArticle } from '@/lib/portfolio-guides/articleTypes';
import { PORTFOLIO_TOOL_PATH } from '@/lib/portfolio-guides/articleTypes';

// PRE-PUBLISH: this article and how-to-write-a-clinical-case-review are the only
// two in the cluster making clinical claims. Both need a clinical read before
// they go live (build spec section 10).
export const clinicalCaseReviewExamples: PortfolioArticle = {
    slug: 'clinical-case-review-examples',
    heading: 'Clinical case review examples for GP trainees',
    kicker: 'Worked examples',
    metaTitle: 'Clinical case review examples for GP trainees | Fourteen Fisherman',
    metaDescription:
        'Worked examples of GP ePortfolio clinical case reviews across different settings, with the reasoning made explicit and the capabilities they evidence.',
    intro: [
        'Examples are more useful than advice for this, because the gap between a weak entry and a strong one is visible immediately when you see them side by side and quite hard to describe in the abstract.',
        'Below are worked examples across different settings. Clinical detail is kept to presentation and reasoning. They\'re written the way an entry should be written, which is more thinking than narration.',
    ],
    sections: [
        {
            id: 'first-the-difference-in-one-case',
            title: 'First, the difference in one case',
            blocks: [
                {
                    type: 'text',
                    text: '**Weak version.** A 4 year old attended with fever and a rash. On examination she was alert, well perfused, chest clear, throat inflamed, with a widespread blanching rash. Observations were within normal limits. I diagnosed a viral illness, advised symptomatic management and safety netted. This case highlighted the importance of thorough assessment in the febrile child.',
                },
                {
                    type: 'text',
                    text: 'Everything in that is accurate. It evidences nothing. A reader learns that a consultation happened and that the writer knows the phrase "safety netting".',
                },
                {
                    type: 'text',
                    text: '**Strong version.** A 4 year old attended with fever and a rash. What I was doing throughout the assessment was trying to work out whether this was one of the small number of children who look like this and are seriously unwell. The rash blanched, which reassured me, but I was aware that\'s a feature I\'ve seen used as a single reassuring finding more confidently than it deserves.',
                },
                {
                    type: 'text',
                    text: 'What actually reassured me was how she behaved: she was interested in the room, she objected appropriately to being examined, and she took a drink when offered. I\'ve come to weight that more heavily than the numbers, having seen a child with unremarkable observations who looked wrong and was.',
                },
                {
                    type: 'text',
                    text: 'The decision that took the longest was safety netting rather than diagnosis. I was aware her mother had been in twice recently and had picked up that she felt she wasn\'t being taken seriously. If I\'d given generic advice she\'d probably have attended out of hours, not because the child needed it but because she didn\'t feel heard. So I was specific about what would worry me and what wouldn\'t, and I said explicitly that coming back was the right thing to do if any of it changed.',
                },
                {
                    type: 'text',
                    text: 'What I\'d do differently: I\'d have asked directly why she\'d come today rather than inferring it from the record. I got there, but late.',
                },
                {
                    type: 'capabilities',
                    items: [
                        'data gathering and interpretation',
                        'communication and consultation skills',
                        'clinical management',
                    ],
                },
                {
                    type: 'text',
                    text: 'The events are identical. The second one shows a doctor.',
                },
            ],
        },
        {
            id: 'example-a-telephone-consultation',
            title: 'Example: a telephone consultation',
            blocks: [
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Context',
                            paragraphs: [
                                'Call about several days of lower back pain in a man in his forties, no injury, no red flag symptoms elicited on questioning.',
                            ],
                        },
                        {
                            term: 'Reasoning',
                            paragraphs: [
                                'Straightforward on the surface, and the risk with telephone work is that straightforward is exactly when you stop being careful. I worked through red flags deliberately rather than relying on his account of it being "just my back", because the whole point of the systematic approach is that it doesn\'t depend on the patient knowing what\'s significant.',
                                'What I couldn\'t do was see him. I was making a decision about whether that mattered, and my honest assessment was that the history was consistent enough that it didn\'t. But I was aware that\'s a judgement I\'d have made differently if he\'d been older, or if anything had been neurological.',
                            ],
                        },
                        {
                            term: 'Difficulty',
                            paragraphs: [
                                'He wanted a sick note for longer than I thought was appropriate. I\'ve noticed I find that harder over the phone, because I can\'t read how it\'s landing, and I suspect I conceded slightly more ground than I would have face to face.',
                            ],
                        },
                        {
                            term: 'What I\'d do differently',
                            paragraphs: [
                                'Say plainly at the start of the call that I\'d bring him in if anything didn\'t fit, so that the possibility was already on the table rather than something I\'d have to introduce as a change of plan.',
                            ],
                        },
                    ],
                },
                {
                    type: 'capabilities',
                    items: [
                        'data gathering and interpretation',
                        'making decisions',
                        'communication and consultation skills',
                    ],
                },
            ],
        },
        {
            id: 'example-a-consultation-with-an-interpreter',
            title: 'Example: a consultation with an interpreter',
            blocks: [
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Context',
                            paragraphs: [
                                'Woman in her sixties, recently arrived in the UK, presenting with fatigue. Consultation conducted through a telephone interpreter.',
                            ],
                        },
                        {
                            term: 'Reasoning',
                            paragraphs: [
                                'Everything took longer, which is obvious in advance and still catches you out. What I noticed is that I simplified my questions to make interpretation easier and lost precision as a result. "Are you tired?" is not the question I wanted to ask.',
                                'The specific difficulty was ideas, concerns and expectations. What came back was a translation of her words, and I couldn\'t read tone, hesitation or the things people say sideways. I was working with less information than I\'d normally have and had to be conscious of not filling the gap with assumption.',
                            ],
                        },
                        {
                            term: 'What I did',
                            paragraphs: [
                                'Slowed down, asked fewer questions with more room in them, and checked understanding in both directions rather than assuming the message had gone through intact. I addressed her rather than the phone, which sounds trivial and changed the consultation.',
                            ],
                        },
                        {
                            term: 'What I\'d do differently',
                            paragraphs: [
                                'Book a double appointment. I knew an interpreter was needed and booked a standard slot anyway, which meant the consultation was rushed at exactly the point where rushing costs most.',
                            ],
                        },
                    ],
                },
                {
                    type: 'capabilities',
                    items: [
                        'communication and consultation skills',
                        'practising holistically and promoting health',
                        'community orientation',
                    ],
                },
            ],
        },
        {
            id: 'example-a-home-visit',
            title: 'Example: a home visit',
            blocks: [
                {
                    type: 'defs',
                    items: [
                        {
                            term: 'Context',
                            paragraphs: [
                                'Housebound elderly man, called about reduced mobility over a fortnight.',
                            ],
                        },
                        {
                            term: 'Reasoning',
                            paragraphs: [
                                'The clinical question was why he\'d deteriorated. The answer was partly clinical and mostly not. The house was cold, there was very little food in, and his usual support had lapsed.',
                                'Managing the clinical problem alone would have achieved nothing, and I\'d have documented an appropriate plan for a patient who\'d have deteriorated again within a fortnight.',
                            ],
                        },
                        {
                            term: 'What I did',
                            paragraphs: [
                                'Addressed the clinical issue and referred for social assessment, which took longer than the medical part of the visit. I was also aware I was only seeing this because he can\'t attend the surgery, and that patients who do attend have the same circumstances I never find out about.',
                            ],
                        },
                        {
                            term: 'What I\'d do differently',
                            paragraphs: [
                                'Nothing about this visit. But it changed how I ask about home circumstances in surgery, which is the actual learning.',
                            ],
                        },
                    ],
                },
                {
                    type: 'capabilities',
                    items: [
                        'practising holistically and promoting health',
                        'community orientation',
                        'working with colleagues and in teams',
                    ],
                },
            ],
        },
        {
            id: 'what-to-take-from-these',
            title: 'What to take from these',
            blocks: [
                {
                    type: 'text',
                    text: 'None of them is a rare presentation. A febrile child, back pain, fatigue, reduced mobility. All routine.',
                },
                {
                    type: 'text',
                    text: 'What makes them worth writing is that in each one there\'s a moment where the thinking is visible: a reassuring feature weighted carefully, a judgement made about what couldn\'t be assessed remotely, an assumption noticed before it was acted on.',
                },
                {
                    type: 'text',
                    text: 'That moment exists in most consultations you do. Writing it down is the whole skill.',
                },
            ],
        },
    ],
    cta: {
        paragraphs: [
            'Our [link: free GP portfolio tool] turns a short description of an encounter into a structured clinical case review like these, mapped to the RCGP capability framework.',
        ],
        actions: [{ label: 'Try it here', href: PORTFOLIO_TOOL_PATH }],
    },
};
