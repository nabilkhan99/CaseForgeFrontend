import type { PortfolioArticle } from '@/lib/portfolio-guides/articleTypes';
import { SCA_CASES_PATH } from '@/lib/portfolio-guides/articleTypes';

// PRE-PUBLISH: check this article's CTA against the current guarantee and
// pricing copy before publishing (build spec section 10). It is the only
// article in the cluster that links to /pricing.
export const eportfolioToSca: PortfolioArticle = {
    slug: 'eportfolio-to-sca',
    heading: 'From ePortfolio to SCA: what changes in ST3',
    kicker: 'ePortfolio to SCA',
    metaTitle: 'From ePortfolio to SCA: what changes in ST3 | Fourteen Fisherman',
    metaDescription:
        'The ePortfolio rewards reflection after the event. The SCA assesses performance during it. What transfers between them, and what doesn\'t.',
    intro: [
        'For most of training the ePortfolio is the main thing you\'re assessed on, and it has a particular character: it happens afterwards. You consult, you go home, you think about it, you write it up. Reflection is the product.',
        'The SCA has the opposite character. It assesses what you do inside the consultation, in real time, with a clock running. There\'s no afterwards.',
        'Trainees who\'ve been strong on portfolio evidence sometimes find this a harder transition than they expected, because the skill that was being rewarded and the skill now being assessed aren\'t the same skill.',
    ],
    sections: [
        {
            id: 'what-transfers',
            title: 'What transfers',
            blocks: [
                {
                    type: 'text',
                    text: 'More than people assume.',
                },
                {
                    type: 'text',
                    text: '**Hypothesis-driven data gathering.** If your case reviews show questioning directed by what you\'re trying to exclude rather than a fixed checklist, that\'s the same skill the SCA assesses under data gathering. It just has to happen faster.',
                },
                {
                    type: 'text',
                    text: '**Reasoning you can articulate.** Writing out why you rejected the options you rejected builds the habit of having reasons available rather than acting on pattern recognition you can\'t explain. That\'s directly useful when you have to justify a management plan out loud.',
                },
                {
                    type: 'text',
                    text: '**Attention to the patient\'s agenda.** Every case review where you noticed you\'d missed what someone was actually worried about is practice in the thing that separates a competent consultation from a good one.',
                },
            ],
        },
        {
            id: 'what-doesnt',
            title: 'What doesn\'t',
            blocks: [
                {
                    type: 'text',
                    text: '**Time.** The portfolio gives you unlimited time to work out what you thought. The SCA gives you the length of a consultation to do everything. Trainees who reason well but slowly find this out uncomfortably.',
                },
                {
                    type: 'text',
                    text: '**Retrospective repair.** In an entry you can write "in hindsight I should have asked about X", and that\'s good reflection. In the SCA, if you didn\'t ask about X, you didn\'t ask about X. Nothing recovers it afterwards.',
                },
                {
                    type: 'text',
                    text: '**Selection.** You choose which cases to write up, and most people choose ones where something interesting happened. You don\'t choose your stations.',
                },
                {
                    type: 'text',
                    text: '**Written fluency.** Your portfolio is written. The SCA is spoken. Some trainees who write beautifully structured reflection consult in a way that\'s much less organised, and nothing in the portfolio would ever have revealed that.',
                },
            ],
        },
        {
            id: 'the-shift-in-whats-being-measured',
            title: 'The shift in what\'s being measured',
            blocks: [
                {
                    type: 'text',
                    text: 'The portfolio measures whether you can learn from practice. The SCA measures whether you can practise.',
                },
                {
                    type: 'text',
                    text: 'That\'s why the preparation is different in kind rather than degree. You can\'t prepare for the SCA by writing more, or by reading more. The only preparation that transfers is doing consultations under time pressure and getting them assessed, repeatedly, until the reasoning happens at the speed the exam requires.',
                },
                {
                    type: 'text',
                    text: 'Most trainees know this and still under-do it, because practising consultations is harder to arrange than reading, and considerably less comfortable.',
                },
            ],
        },
        {
            id: 'whats-worth-doing-early',
            title: 'What\'s worth doing early',
            blocks: [
                {
                    type: 'text',
                    text: 'Two things, both of which cost nothing.',
                },
                {
                    type: 'text',
                    text: 'Start noticing your consultation timing during normal surgeries. Not formally, just an awareness of where you are at the halfway point. Most people are surprised by how much of the time goes on data gathering.',
                },
                {
                    type: 'text',
                    text: 'And when you write up a case review, spend a moment on what you\'d have done with less time. That\'s a bridge between the two assessments, and it\'s the question the SCA is effectively asking.',
                },
            ],
        },
    ],
    cta: {
        paragraphs: [
            'We run a free library of SCA practice stations built from the RCGP curriculum, alongside a [link: full SCA preparation course].',
            'And if you\'re still working on your ePortfolio, our [link: free portfolio tool] is here.',
        ],
        actions: [{ label: 'See the free stations', href: SCA_CASES_PATH }],
    },
};
