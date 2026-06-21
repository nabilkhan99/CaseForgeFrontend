export const GUIDE_INDEX_PATH = '/guides';
export const SCA_PILLAR_PATH = '/guides/how-to-pass-the-mrcgp-sca';
export const CASE_LIBRARY_PATH = '/sca-cases';

export interface GuideLink {
    label: string;
    href: string;
    subtitle: string;
}

export interface PillarDomain {
    title: string;
    body: string;
}

export interface PillarSection {
    id: string;
    number: string;
    title: string;
    paragraphs: string[];
    links?: GuideLink[];
    domains?: PillarDomain[];
    pullQuote?: string;
}

export interface GuideSeriesGroup {
    label: string;
    cards: Array<GuideLink & { number: string }>;
}

export const pillarMeta = {
    title: 'How to Pass the MRCGP SCA: The Complete Guide',
    description:
        'The complete guide to passing the MRCGP SCA: what the exam is, how it is marked, how to structure 12 minutes, and how to prepare to pass first time.',
    readTime: '9 min read',
    updated: 'Updated June 2026',
    tags: ['MRCGP', 'Exam strategy', 'GP registrars'],
};

export const pillarSections: PillarSection[] = [
    {
        id: 's1',
        number: '01',
        title: 'What the SCA is',
        paragraphs: [
            'The SCA is an assessment of 12 simulated consultations, each lasting 12 minutes, taken in a single session. It is delivered remotely: you sit from a local GP surgery on an online platform, and trained role players join each consultation by video or, for some cases, by audio only, replicating telephone consulting. The exam is invigilated and closed book.',
            "The 12 cases are mapped to the RCGP's 12 clinical experience groups, the blueprint that guarantees the exam samples the breadth of general practice rather than a narrow band of presentations. You cannot predict which groups will appear in your sitting, so preparation has to cover the breadth.",
        ],
        links: [
            {
                label: 'What Is the SCA',
                href: '/guides/what-is-the-mrcgp-sca',
                subtitle: 'Format, cost and eligibility',
            },
        ],
    },
    {
        id: 's2',
        number: '02',
        title: 'How you are marked',
        paragraphs: [
            'Every one of your 12 cases is marked independently, each by a different examiner who marks that same case all day. Across the exam you are assessed by at least 12 examiners, which protects you from any single examiner having an outsized effect and rewards consistency. Marks are awarded in 3 domains, and these 3 should shape everything about how you practise.',
            'Each domain earns a grade of Clear Pass, Pass, Fail or Clear Fail against one reference point: the standard of a newly qualified GP working independently. There is no fixed pass mark. Steady, safe performance across all 12 cases beats brilliance in a few and weakness in others.',
        ],
        domains: [
            {
                title: 'Data Gathering and Diagnosis',
                body: 'Whether you gather the right information efficiently and turn it into sound clinical reasoning.',
            },
            {
                title: 'Clinical Management and Medical Complexity',
                body: 'Whether your plans are safe, current, proportionate and shared with the patient. The RCGP weights this domain more heavily than the other two.',
            },
            {
                title: 'Relating to Others',
                body: "Whether you communicate with genuine empathy, explore the patient's perspective, and work in partnership rather than delivering a monologue.",
            },
        ],
        links: [
            {
                label: 'The Three Marking Domains Explained',
                href: '/guides/sca-marking-domains-explained',
                subtitle: 'What examiners reward in each',
            },
            {
                label: 'Decoding the RCGP Feedback Statements',
                href: '/guides/sca-feedback-statements',
                subtitle: 'Every statement in plain English',
            },
        ],
    },
    {
        id: 's3',
        number: '03',
        title: 'The mindset that passes',
        paragraphs: [
            'The single most common preparation error is treating the SCA as a performance of knowledge. Candidates who do this talk too much, deliver textbook explanations the patient did not ask for, and run the clock down demonstrating what they know. Examiners are not assessing what you know. They are assessing what you do with a patient in 12 minutes.',
            "The candidates who pass treat each case as a real consultation. They open with the patient's agenda and actually listen. They let ideas, concerns and expectations shape the consultation rather than ticking them off as a ritual. They reason out loud, share decisions instead of announcing them, and when a case goes sideways they recover rather than freeze.",
        ],
        pullQuote:
            'You are not revising for an exam, you are rehearsing the job. Everything that makes you a better consulter makes you a better SCA candidate.',
    },
    {
        id: 's4',
        number: '04',
        title: 'Structuring the 12 minutes',
        paragraphs: [
            '12 minutes is enough time for every case, because the cases are written to fit it. Candidates run out of time for one dominant reason: they overspend on history and get squeezed out of management, which is disastrous, because management is an entire marking domain and the RCGP weights it more heavily than the other two.',
            "The template that works is consistent: open with the patient's agenda and listen without interrupting; move into focused, hypothesis driven data gathering; then make a deliberate switch into management, explaining your thinking in plain language, building the plan with the patient, and closing with specific safety netting and follow up. Signpost as you move between phases.",
        ],
        links: [
            {
                label: 'The Twelve Minute Consultation Framework',
                href: '/guides/sca-twelve-minute-consultation-framework',
                subtitle: 'A repeatable consultation template',
            },
        ],
    },
    {
        id: 's5',
        number: '05',
        title: 'The communication that scores',
        paragraphs: [
            'Relating to Others is the domain where otherwise strong candidates quietly lose marks, because it cannot be crammed and it punishes anything mechanical. The skills it rewards are concrete: responding to cues instead of ploughing past them, exploring what the patient thinks is going on, adapting your explanation to the person in front of you, and sharing the decision genuinely.',
            'Under exam pressure, the gap is rarely understanding these principles. It is having the actual words available in the moment.',
        ],
        links: [
            {
                label: 'The SCA Phrase Bank',
                href: '/guides/sca-phrase-bank',
                subtitle: 'Ready to use phrasings for every part of the consultation',
            },
            {
                label: 'Challenging SCA Consultations',
                href: '/guides/challenging-sca-consultations',
                subtitle: 'Anger, bad news, ethics, safeguarding',
            },
            {
                label: 'Complex Consultation Structures',
                href: '/guides/complex-sca-consultation-structures',
                subtitle: 'Multiple problems, carers, results',
            },
        ],
    },
    {
        id: 's6',
        number: '06',
        title: 'Planning your preparation',
        paragraphs: [
            'Most candidates give themselves roughly 8 to 12 weeks of focused preparation alongside clinical work. The shape matters more than the total: orient first, build a regular timed practice habit, increase realism as the exam approaches, then taper in the final week rather than cramming.',
            'Two principles do most of the work. Start timed practice early, because the 12 minute rhythm only becomes automatic through repetition. And let feedback steer you: track which domain you score lowest, and bias your remaining preparation toward it.',
        ],
        links: [
            {
                label: 'How to Build Your SCA Revision Timeline',
                href: '/guides/sca-revision-timeline',
                subtitle: 'A week by week plan',
            },
        ],
    },
    {
        id: 's7',
        number: '07',
        title: 'How to practise',
        paragraphs: [
            'The highest yield preparation available is timed consultation practice with honest feedback against the 3 domains, and the most accessible version costs nothing: two trainees, a structured case, and a marking scheme. One consults from the candidate brief, the other plays the patient from a script, you keep strictly to 12 minutes, then grade each other domain by domain. Then swap.',
            'For this to work, cases need three components: a candidate brief, a patient script, and a marking scheme that maps to how the exam judges you. When a partner is not available, AI consultation practice can fill the repetition gap.',
        ],
        links: [
            {
                label: 'How to Practise With a Study Partner',
                href: '/guides/how-to-practise-sca-cases-study-partner',
                subtitle: 'The highest yield free method',
            },
        ],
    },
    {
        id: 's8',
        number: '08',
        title: 'Resources worth your money',
        paragraphs: [
            'The market for SCA preparation is busy: courses, subscription case banks, AI practice platforms, books, and free study partner practice. None is essential on its own, and the expensive options are not automatically the effective ones. The test to apply to any resource is simple: does it get you consulting under time pressure with feedback, or does it just give you more to read?',
        ],
        links: [
            {
                label: 'The Best SCA Revision Resources',
                href: '/guides/best-sca-revision-resources',
                subtitle: 'What is worth your money',
            },
            {
                label: 'Which SCA AI Platform Should You Use',
                href: '/guides/which-sca-ai-platform',
                subtitle: 'An honest head to head',
            },
        ],
    },
    {
        id: 's9',
        number: '09',
        title: 'How hard is it really',
        paragraphs: [
            'Pass rates across recent diets have generally sat in the high sixties to low seventies percent overall, and first time candidates pass at a higher rate than the headline figure, because the overall number includes re-sitting candidates. The pass threshold moves slightly between diets by design, so the fluctuation does not mean one diet was easier. You are never competing against a quota; you are judged against a fixed standard.',
        ],
        links: [
            {
                label: 'SCA Pass Rates Explained',
                href: '/guides/sca-pass-rates-explained',
                subtitle: 'What the numbers really mean',
            },
        ],
    },
    {
        id: 's10',
        number: '10',
        title: 'On the day',
        paragraphs: [
            'Because the exam is remote, your environment is part of your preparation. You need a quiet, private room set up to the RCGP specification, reliable equipment, and a completed technical check before the day. Treat the day like a clinical session rather than an academic exam: arrive rested, and reset completely between cases, because each one is marked independently and carrying a bad station into the next is the avoidable way to lose 2 cases instead of one.',
        ],
        links: [
            {
                label: 'What to Expect on SCA Day',
                href: '/guides/sca-exam-day',
                subtitle: 'Room setup and logistics',
            },
        ],
    },
    {
        id: 's11',
        number: '11',
        title: 'If it does not go to plan',
        paragraphs: [
            'Some capable doctors fail a sitting, and a fail is a setback, not a verdict on your future as a GP. The exam gives you standardised feedback mapped to the domains, and read properly, that feedback is a precise diagnosis of what to fix. The way back is to identify the pattern, rebuild your practice around the weak domain in proportion, and return with the specific gap closed.',
        ],
        links: [
            {
                label: 'Failed the SCA: How to Pass Your Re-sit',
                href: '/guides/failed-mrcgp-sca-resit-guide',
                subtitle: 'How to come back and pass',
            },
            {
                label: 'Managing SCA Anxiety',
                href: '/guides/managing-sca-anxiety',
                subtitle: 'Evidence based ways to cope',
            },
        ],
    },
    {
        id: 's12',
        number: '12',
        title: 'Putting it together',
        paragraphs: [
            'Passing comes down to a short list of things done consistently. Understand the format so nothing on the day is a surprise. Internalise the 3 domains. Build the 12 minute template until it is automatic. Practise under real timing, with honest feedback, early and often. Target your weakest domain rather than rehearsing your strengths. And walk in treating each case as a real patient, because that, more than anything, is what the examiners are looking for.',
        ],
    },
];

export const guideSeriesGroups: GuideSeriesGroup[] = [
    {
        label: 'Understand the exam',
        cards: [
            {
                number: '01',
                label: 'What Is the MRCGP SCA',
                subtitle: 'Format, cost and eligibility',
                href: '/guides/what-is-the-mrcgp-sca',
            },
            {
                number: '02',
                label: 'SCA Pass Rates Explained',
                subtitle: 'What the numbers really mean',
                href: '/guides/sca-pass-rates-explained',
            },
            {
                number: '03',
                label: 'What to Expect on SCA Day',
                subtitle: 'Room setup and logistics',
                href: '/guides/sca-exam-day',
            },
        ],
    },
    {
        label: 'How you are marked',
        cards: [
            {
                number: '04',
                label: 'The Three Marking Domains',
                subtitle: 'What examiners reward in each',
                href: '/guides/sca-marking-domains-explained',
            },
            {
                number: '05',
                label: 'Decoding the Feedback Statements',
                subtitle: 'Every statement in plain English',
                href: '/guides/sca-feedback-statements',
            },
        ],
    },
    {
        label: 'Consultation skills',
        cards: [
            {
                number: '06',
                label: 'The Twelve Minute Framework',
                subtitle: 'A repeatable consultation template',
                href: '/guides/sca-twelve-minute-consultation-framework',
            },
            {
                number: '07',
                label: 'The SCA Phrase Bank',
                subtitle: 'Ready to use phrasings',
                href: '/guides/sca-phrase-bank',
            },
            {
                number: '08',
                label: 'Challenging Consultations',
                subtitle: 'Anger, bad news, ethics, safeguarding',
                href: '/guides/challenging-sca-consultations',
            },
            {
                number: '09',
                label: 'Complex Consultation Structures',
                subtitle: 'Multiple problems, carers, results',
                href: '/guides/complex-sca-consultation-structures',
            },
        ],
    },
    {
        label: 'Plan and practise',
        cards: [
            {
                number: '10',
                label: 'Build Your Revision Timeline',
                subtitle: 'A week by week plan',
                href: '/guides/sca-revision-timeline',
            },
            {
                number: '11',
                label: 'Practise With a Study Partner',
                subtitle: 'The highest yield free method',
                href: '/guides/how-to-practise-sca-cases-study-partner',
            },
            {
                number: '12',
                label: 'The Best Revision Resources',
                subtitle: 'What is worth your money',
                href: '/guides/best-sca-revision-resources',
            },
            {
                number: '13',
                label: 'Which SCA AI Platform',
                subtitle: 'An honest head to head',
                href: '/guides/which-sca-ai-platform',
            },
        ],
    },
    {
        label: 'When it is hard',
        cards: [
            {
                number: '14',
                label: 'Failed the SCA: Re-sit Guide',
                subtitle: 'How to come back and pass',
                href: '/guides/failed-mrcgp-sca-resit-guide',
            },
            {
                number: '15',
                label: 'Managing SCA Anxiety',
                subtitle: 'Evidence based ways to cope',
                href: '/guides/managing-sca-anxiety',
            },
        ],
    },
];

export const allGuideCards = guideSeriesGroups.flatMap(group => group.cards);
