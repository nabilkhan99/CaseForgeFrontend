import type { GuideArticle } from '@/lib/guides/articleTypes';

export const whichScaAiPlatform: GuideArticle = {
    slug: 'which-sca-ai-platform',
    group: 'Plan and practise',
    number: '13',
    heading: 'Which SCA AI Platform Should You Use? An Honest Comparison',
    cardLabel: 'Which SCA AI Platform',
    cardSubtitle: 'An honest head to head',
    metaTitle: 'Which SCA AI Platform Should You Use? | Fourteen Fisherman',
    metaDescription:
        'An honest, declared-interest comparison of AI patient simulation platforms for SCA preparation, and the criteria to judge any of them by.',
    kicker: 'Plan and practise',
    intro: [
        'AI patient simulation has become a genuine category in SCA preparation: platforms where you consult with an artificial patient under exam timing and receive automated feedback against the marking domains. The category solves a real problem, the platforms within it differ more than their marketing suggests, and one of the names in the space is ours, so this comparison declares its interest openly and gives you the criteria to judge every option, including us. For how AI practice fits alongside other resource types, see [link: The Best SCA Revision Resources].',
        "A note on method before anything else. Prices, case counts and features in this market change frequently, so rather than fill this page with numbers that may be stale by the time you read them, this guide compares the models and tells you exactly what to verify on each provider's own site. Treat any specific figure you read anywhere, including in comparisons like this one, as something to check rather than trust.",
    ],
    readTime: '7 min read',
    updated: 'Updated July 2026',
    sections: [
        {
            id: 'what-ai-practice-is-actually-for',
            title: 'What AI practice is actually for',
            blocks: [
                {
                    type: 'text',
                    text: 'Be clear about the job before choosing a tool. The skill the SCA examines is built by repetition: timed consultations, performed out loud, with feedback against the 3 domains, until the 12 minute shape is automatic. The best source of that practice is a human study partner working from structured cases, because a human role player brings nuance no current AI fully matches, and the method for that is in [link: How to Practise SCA Cases With a Study Partner].',
                },
                {
                    type: 'text',
                    text: 'AI practice earns its place by solving the availability problem. Partners have rotas, families and their own revision; an AI patient is available at 10 at night, on your lunch break, and for the fourth repetition of the case type you keep fumbling. Used this way, as a repetition engine alongside human practice rather than a replacement for it, AI practice is genuinely valuable. Used as a substitute for all human feedback, it will leave gaps.',
                },
            ],
        },
        {
            id: 'the-models-on-the-market',
            title: 'The models on the market',
            blocks: [
                {
                    type: 'text',
                    text: 'The platforms cluster into a few approaches, and the differences matter more than brand names.',
                },
                {
                    type: 'text',
                    text: 'Some offer AI patients as a feature within a broader subscription case bank, so you pay a monthly fee for a large case library and the AI consultations come bundled with videos, study tools and mock exam features. The strength is breadth in one place; the question to ask is how good the AI consultations themselves are, since they are one feature among many rather than the product.',
                },
                {
                    type: 'text',
                    text: 'Some are built around the AI consultation as the core product, with timed exam length consultations and feedback mapped to the domains, priced either by subscription or per attempt. Pay per attempt pricing is worth understanding properly: it can be cheap to try and expensive at the volume real preparation requires, so do the arithmetic for the number of consultations you actually intend to run.',
                },
                {
                    type: 'text',
                    text: 'Some lead with voice, so you speak your consultation aloud to an AI patient rather than typing, which matters because the exam is spoken and the skills of verbal consulting, including pace, tone and thinking aloud, do not fully transfer from text. Several platforms in this group offer a first consultation free, which is the easiest way to judge quality before paying anything.',
                },
                {
                    type: 'text',
                    text: 'And some course providers bundle AI case banks alongside their teaching, where the AI is an add on to a different core offer.',
                },
                {
                    type: 'text',
                    text: "The table below compares some of the most established options. Figures are correct at the time of writing, 13 June 2026, and are taken from each provider's own website; prices, case counts and features change often, so confirm them at source before deciding. We do not rank these or tell you which to buy. We lay out the facts so you can choose.",
                },
                {
                    type: 'table',
                    columns: [
                        'Platform',
                        'What it is',
                        'Voice or text',
                        'Approx cases or sims',
                        'Pricing model',
                        'Notes',
                    ],
                    rows: [
                        [
                            '**Fourteen Fisherman**',
                            '**Voice AI consultation practice built on our free RCGP curriculum case library, with domain mapped feedback**',
                            '**Voice**',
                            '**200 cases (unlimited practice, not limited by station credits)**',
                            '**£199 for 3 month access; £599 bundle with AI practice, small group coaching and live lectures (eligible for the NHSE study budget)**',
                            '**The only SCA programme that combines AI practice, small group coaching and live lectures, and the only one with a pass guarantee.**',
                        ],
                        [
                            'SCA Revision (SCARevision.ai)',
                            'AI patients on top of a large case bank',
                            'Voice',
                            '350+ cases and AI patients',
                            'Subscription £11.99 to £15.99 per month plus AI from £1.20 per attempt, first attempt free',
                            'Domain by domain feedback; the largest established platform',
                        ],
                        [
                            'Geeky Medics SCA',
                            'AI virtual patients within a case bank',
                            'Voice and text',
                            '200+ cases',
                            '£10.99 per month, AI included',
                            'AI marking and feedback; part of a wider platform',
                        ],
                        [
                            'MedTutor',
                            'Voice AI simulations scored on the 3 domains with GP trainer feedback',
                            'Voice',
                            '100 sims foundation, 200 accelerator',
                            'One off bundles, around £195 and £380; first simulation free',
                            'Combines AI practice with human GP feedback',
                        ],
                        [
                            'SCAPrep',
                            'AI tutor and case generator',
                            'Voice and text',
                            'Generated cases',
                            'From £14.95 per month',
                            'Newer entrant; AI tutor and hot topics',
                        ],
                    ],
                },
            ],
        },
        {
            id: 'the-criteria-that-actually-separate-them',
            title: 'The criteria that actually separate them',
            blocks: [
                {
                    type: 'text',
                    text: 'Whichever model you consider, evaluate it against the things that determine whether the practice transfers to the exam.',
                },
                {
                    type: 'text',
                    text: "Timing fidelity first: the consultations should run to the real 12 minutes, because pacing is half the skill and untimed practice trains the wrong habits. Voice next: a spoken consultation trains the exam skill, a typed one trains something adjacent. Then feedback quality, which is the heart of the purchase: feedback should map to the 3 domains, be specific about what moved each judgement, and go beyond a score, because a number without a reason changes nothing about your next consultation. Then case quality and alignment: cases should reflect the current exam and the RCGP curriculum breadth rather than recycled material from the exam's predecessors. Then the patient behaviour itself: a good simulated patient volunteers when prompted, holds back when not, and pushes back when you are vague, because a patient who hands you everything trains complacency. And finally honest cost per consultation at your intended volume, including what the free trial actually lets you judge.",
                },
                {
                    type: 'text',
                    text: 'A practical buying rule that follows from all of this: never subscribe to any platform in this category without using its free consultation or trial first, performing it exactly as you would an exam case, and reading the feedback critically. 10 minutes of trial tells you more than any comparison page, including this one.',
                },
            ],
        },
        {
            id: 'the-honest-bottom-line',
            title: 'The honest bottom line',
            blocks: [
                {
                    type: 'text',
                    text: 'If you have a reliable study partner and structured cases, you can prepare to a high standard without paying for AI practice at all. If partner availability is your bottleneck, or you want feedback on every single run, AI practice is the right supplement, and the platform to choose is the one that survives your own trial against the criteria above: real timing, spoken consultation, domain mapped feedback that explains itself, current curriculum aligned cases, a patient that behaves like a role player, and genuine value for money once you work out the total cost for the number of consultations you actually intend to do.',
                },
                {
                    type: 'text',
                    text: 'Whatever you choose, anchor the routine in [link: How to Build Your SCA Revision Timeline], keep a human in the feedback loop somewhere, and start from material you can inspect for free. Our case library is open whenever it would help.',
                },
            ],
        },
    ],
};
