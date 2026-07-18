import type { GuideArticle } from '@/lib/guides/articleTypes';

export const scaPassRatesExplained: GuideArticle = {
    slug: 'sca-pass-rates-explained',
    group: 'Understand the exam',
    number: '02',
    heading: 'MRCGP SCA Pass Rates Explained',
    cardLabel: 'SCA Pass Rates Explained',
    cardSubtitle: 'What the numbers really mean',
    metaTitle: 'SCA Pass Rates Explained | Fourteen Fisherman',
    metaDescription:
        'The current MRCGP SCA pass rates, why they move between sittings, and what the figures actually mean for how you should prepare.',
    kicker: 'Understand the exam',
    intro: [
        'The pass rate is usually the first number a candidate looks up and the most misread. The headline figure moves around from sitting to sitting, the reasons are mostly statistical rather than sinister, and the number that actually matters to you is probably not the one in the headlines. This guide sets out the current figures from the RCGP\'s own published results, explains why they move, and translates them into what they mean for your preparation. For the wider picture, see our [link: complete guide to passing the SCA].',
    ],
    readTime: '5 min read',
    updated: 'Updated June 2026',
    sections: [
        {
            id: 'the-current-figures',
            title: 'The current figures',
            blocks: [
                {
                    type: 'text',
                    text: 'The RCGP publishes a summary after every diet, and the recent run looks like this. The October 2025 sitting recorded the lowest pass rate in the exam\'s history at just under 60 percent. The diets since have climbed steadily: roughly 69.6 percent in November 2025, 68.9 percent in January 2026, 70.7 percent in February, 73.3 percent in March, and 74.2 percent in April 2026, the most recent published at the time of writing. Across the exam\'s life since November 2023 the overall pass rate has averaged in the high sixties, ranging from that October low to a peak approaching 78 percent in mid 2024.',
                },
                {
                    type: 'text',
                    text: 'The number that matters more to most readers is the first time pass rate, which the RCGP also publishes, and it runs consistently and meaningfully above the headline. In the February 2026 diet, first time candidates passed at 77.3 percent against the overall 70.7. In March it was 78.9 against 73.3, and in April 79.6 against 74.2. Roughly 4 in 5 candidates in each sitting are first timers, and as a group they pass at a rate several points higher than the overall figure, because the overall number folds in re-sitting candidates, who as a group find the exam harder. If you are preparing properly for a first attempt, the figure that describes your situation is the higher one.',
                },
            ],
        },
        {
            id: 'why-the-rate-moves-between-sittings',
            title: 'Why the rate moves between sittings',
            blocks: [
                {
                    type: 'text',
                    text: 'The SCA has no fixed pass mark. Examiners grade each case across the 3 domains and also record a global judgement of each candidate\'s performance, and those judgements feed a standard setting method called borderline regression, which calculates the pass threshold for that specific sitting out of a maximum score of 126. The intent is that the standard, a newly qualified independent GP, stays constant while the threshold flexes with the difficulty of the particular cases used, which is why a harder set of cases does not simply fail more people.',
                },
                {
                    type: 'text',
                    text: 'The pass rate still moves, because the candidates move too: the mix of first timers and re-sitters shifts between diets, cohorts differ in preparedness, and with several hundred candidates per sitting a few percentage points of movement is ordinary statistical weather. The full machinery is explained in [link: The 3 SCA Marking Domains Explained]. The practical conclusions are 3. You are never competing against a quota, so another candidate\'s pass costs you nothing. You cannot game the calendar, because a diet\'s difficulty and threshold are not knowable in advance, so choosing your sitting by pass rate trends is astrology; choose it by your readiness, per [link: How to Build Your SCA Revision Timeline]. And a low headline month, like October 2025, tells you about that cohort and that case set, not about your prospects.',
                },
            ],
        },
        {
            id: 'what-the-numbers-mean-for-your-preparation',
            title: 'What the numbers mean for your preparation',
            blocks: [
                {
                    type: 'text',
                    text: 'Read soberly, the figures say the exam is demanding and passable: roughly 7 in 10 candidates pass each sitting, nearly 4 in 5 first timers do, and the consistent first timer advantage is best understood as the return on full, uninterrupted preparation. They also say the exam genuinely fails people, between a fifth and a third of every cohort, which is the strongest argument against the most common preparation mistake, treating the SCA as a formality after years of consulting daily. The candidates it fails are rarely short of knowledge; the exam\'s own feedback statements show the failures live in consultation process, time, structure and responsiveness, all of which is trainable, and all of which is the subject of the rest of these guides.',
                },
                {
                    type: 'text',
                    text: 'So let the pass rate do its one useful job, calibrating respect for the exam, and then ignore it, because it is the single variable on this page you cannot influence. The variables you can influence are the 12 consultations you will give, and those are built in practice. If structured cases would help, our free library of 79 SCA practice cases, drawn directly from the RCGP curriculum with marking schemes aligned to the 3 domains, is open whenever it is useful.',
                },
            ],
        },
    ],
};
