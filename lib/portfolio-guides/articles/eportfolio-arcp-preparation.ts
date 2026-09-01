import type { PortfolioArticle } from '@/lib/portfolio-guides/articleTypes';
import { PORTFOLIO_TOOL_PATH } from '@/lib/portfolio-guides/articleTypes';

export const eportfolioArcpPreparation: PortfolioArticle = {
    slug: 'eportfolio-arcp-preparation',
    heading: 'How to prepare your ePortfolio for ARCP',
    kicker: 'ARCP',
    metaTitle: 'How to prepare your ePortfolio for ARCP | Fourteen Fisherman',
    metaDescription:
        'What panels look for, how to audit your evidence for gaps, and how to salvage things if you\'ve left it late.',
    intro: [
        'There are two ways to arrive at ARCP. One is with a portfolio that\'s been building steadily and needs a tidy. The other is with a fortnight and a deficit.',
        'Most trainees have experienced both. This covers the audit either way, and then what to do if you\'re in the second situation.',
    ],
    sections: [
        {
            id: 'what-a-panel-is-actually-doing',
            title: 'What a panel is actually doing',
            blocks: [
                {
                    type: 'text',
                    text: 'A panel isn\'t reading your portfolio for pleasure. They\'re checking whether the evidence supports progression, and they\'re doing it under time pressure across a lot of trainees.',
                },
                {
                    type: 'text',
                    text: 'That has practical consequences. Evidence that\'s easy to find gets read. Evidence buried in a wall of unstructured text may not. Volume without spread doesn\'t help you, because a gap is a gap regardless of how much sits either side of it. And a small number of clearly reflective entries reads better than a large number of thin ones, because the thin ones actively suggest you\'ve been generating evidence rather than learning from practice.',
                },
            ],
        },
        {
            id: 'the-audit',
            title: 'The audit',
            blocks: [
                {
                    type: 'text',
                    text: 'Do this well before the deadline, because everything it surfaces takes time to fix.',
                },
                {
                    type: 'text',
                    text: '**Spread across capabilities.** Go through your entries and count which capabilities they actually evidence, not which ones they\'re tagged against. Those are different numbers. Making decisions, community orientation, and organisation, management and leadership are the usual gaps.',
                },
                {
                    type: 'text',
                    text: '**Spread across settings and case types.** A portfolio that\'s entirely acute presentations from one post shows a narrow slice of practice. Panels notice.',
                },
                {
                    type: 'text',
                    text: '**Quality of reflection.** Read a handful of your own entries cold. If you can\'t tell what you were thinking at the time, neither can a panel.',
                },
                {
                    type: 'text',
                    text: '**Everything else on the list.** Supervisor reports, assessments, mandatory requirements, learning needs from previous reviews. These vary by training stage and by deanery, and they change. Get the current requirements from the RCGP and confirm local expectations with your supervisor rather than relying on what someone in the year above tells you.',
                },
                {
                    type: 'text',
                    text: '**Previous ARCP outcomes.** If you were given specific things to address, evidence of having addressed them needs to be findable. This is the most common avoidable problem, and it isn\'t a documentation issue: panels take it as a signal about whether you engage with feedback.',
                },
            ],
        },
        {
            id: 'fixing-gaps-honestly',
            title: 'Fixing gaps honestly',
            blocks: [
                {
                    type: 'text',
                    text: 'The uncomfortable part. If you\'re short of evidence in a capability, the answer isn\'t to write entries about cases that didn\'t happen or retrospectively tag old entries against capabilities they don\'t demonstrate. Both are visible and both are worse than the gap.',
                },
                {
                    type: 'text',
                    text: 'The answer is that the evidence probably exists and hasn\'t been written up. Most trainees have far more relevant material in their memory and their clinic lists than in their portfolio.',
                },
                {
                    type: 'text',
                    text: 'For a gap in **making decisions**, look for consultations where you chose not to act. For **community orientation**, look for anything where local service availability shaped your management. For **organisation, management and leadership**, look at anything you changed or improved, however small, including things you\'d think of as administrative. For **working with colleagues**, look at referrals, handovers and anything involving another professional\'s judgement.',
                },
                {
                    type: 'text',
                    text: 'Then go and consult with the gap in mind. If you know you\'re short on complexity, you\'ll notice the complex patients, and you\'ll write better entries about them because you were paying attention at the time.',
                },
            ],
        },
        {
            id: 'if-youve-left-it-late',
            title: 'If you\'ve left it late',
            blocks: [
                {
                    type: 'text',
                    text: 'Be realistic about what\'s achievable and prioritise.',
                },
                {
                    type: 'text',
                    text: 'Fix anything mandatory first, because a missing requirement is a different kind of problem from thin evidence.',
                },
                {
                    type: 'text',
                    text: 'Then target your gaps specifically rather than writing more of what you already have plenty of. Ten more entries in a well-covered capability move you nowhere.',
                },
                {
                    type: 'text',
                    text: 'Then improve a small number of existing entries rather than adding many new ones. Going back to three or four real cases and writing proper reflection into them is worth more than ten fresh entries written at speed, and it\'s honest, because the cases are yours and the thinking is available to you.',
                },
                {
                    type: 'text',
                    text: 'Talk to your supervisor early rather than presenting a problem at the last review. Supervisors are generally willing to help a trainee who flags a gap in advance and considerably less so when they discover it themselves.',
                },
            ],
        },
        {
            id: 'the-thing-that-actually-prevents-this',
            title: 'The thing that actually prevents this',
            blocks: [
                {
                    type: 'text',
                    text: 'The trainees who don\'t have an ARCP crisis are not the ones with more time. They\'re the ones who write entries close to the encounter, while the reasoning is still available.',
                },
                {
                    type: 'text',
                    text: 'A case written up the same week contains what you were actually thinking. The same case written up months later contains what you can reconstruct, which is a summary of events with reflection bolted on. Panels can tell the difference, and so can you when you read it back.',
                },
                {
                    type: 'text',
                    text: 'Three lines in your phone during a surgery is enough to preserve it. The write up can wait. The thinking can\'t.',
                },
            ],
        },
    ],
    cta: {
        paragraphs: [
            'Our [link: free GP portfolio tool] takes a short description of an encounter and returns a structured clinical case review, so writing one up close to the event takes minutes rather than an evening.',
        ],
        actions: [{ label: 'Try it here', href: PORTFOLIO_TOOL_PATH }],
    },
};
