export const GUIDE_INDEX_PATH = '/guides';
// The complete guide is the /guides landing page itself.
export const SCA_PILLAR_PATH = '/guides';
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
            'The SCA is an assessment of 12 simulated consultations, each lasting 12 minutes, taken in a single session. It is delivered remotely: you sit the exam from a local GP surgery, usually your own training practice, on an online examination platform, and trained role players join each consultation by video or, for some cases, by audio only, replicating telephone consulting. The exam is invigilated and closed book. You cannot use notes or electronic references, and your room must be set up to the RCGP specification.',
            'Before each case you are shown candidate instructions giving background on the consultation, much like screening your notes before calling a patient in. Most cases involve the role player as the patient, but some involve carers, relatives or other members of the healthcare team,.',
            "The 12 cases are mapped to the RCGP's 12 clinical experience groups, the blueprint that guarantees the exam samples the breadth of general practice rather than a narrow band of presentations, and the College is explicit that the selection is not a ranking of importance and that candidates should prepare equally across all 12 groups. The cases themselves are designed to reflect everyday UK general practice: the common presentations, long term conditions and undifferentiated problems a newly qualified GP handles routinely, drawn from a bank of hundreds of cases based on real patient consultations. You cannot predict which groups will appear in your sitting, so preparation has to cover the breadth.",
            'The full mechanics, including eligibility, booking, fees and dates, are covered in [link: What Is the SCA: Format, Cost and Eligibility].',
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
            "Every one of your 12 cases is marked independently, and each case is marked by a different examiner who marks that same case all day. Across the exam you are therefore assessed by at least 12 examiners, which protects you from any single examiner's bad day and rewards consistency across the whole sitting.",
            'Marks are awarded in 3 domains, and these 3 domains should shape everything about how you practise:',
            'Each domain earns a grade of Clear Pass, Pass, Fail or Clear Fail, judged against one consistent reference point: the standard of a newly qualified GP working independently. There is no fixed pass mark and no set number of cases you must pass. Your grades are combined across all 12 cases, and the pass threshold for each diet is set statistically so that it reflects the difficulty of that particular sitting. The practical consequence is that steady, safe performance across all 12 cases beats brilliance in a few and weakness in others.',
            'The domains are unpacked in full, including what examiners reward in each, in [link: The 3 SCA Marking Domains Explained]. And because the exam feeds back to candidates using a fixed set of standardised statements, we have decoded every one of them into plain English and a concrete action in [link: Decoding the RCGP SCA Feedback Statements]. Reading that piece before you sit is one of the highest yield things you can do, because it is effectively a list of every way the exam allows you to fall short.',
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
            "The candidates who pass treat each case as a real consultation. They open with the patient's agenda and actually listen to the answer. They let the patient's ideas, concerns and expectations shape the consultation rather than ticking them off as a ritual. They reason out loud so their thinking is visible. They share decisions instead of announcing them. And when a case goes sideways, they recover rather than freeze, because in real general practice consultations go sideways all the time.",
            "This is not a stylistic preference. The RCGP marks every case against the standard of a newly qualified, independent GP, and its published feedback shows that candidates who fall short most often do so on consultation process, that is, on data gathering, management and relating to the patient, rather than on missing clinical knowledge.",
        ],
        pullQuote:
            'You are not revising for an exam, you are rehearsing the job. Everything that makes you a better consulter makes you a better SCA candidate.',
    },
    {
        id: 's4',
        number: '04',
        title: 'Structuring the 12 minutes',
        paragraphs: [
            '12 minutes is enough time for every case, because the cases are written to fit it. Candidates run out of time for one dominant reason: they overspend on history and get squeezed out of management, which is disastrous because management is an entire marking domain, and the RCGP weights it more heavily than the other 2.',
            "The template that works is consistent. Open with the patient's agenda and listen without interrupting, because the opening minutes surface the real concern and save time later. Move into focused, hypothesis driven data gathering, asking the questions your differential needs rather than conducting an exhaustive systems review. Then make a deliberate switch into management: explain your thinking in plain language, build the plan with the patient, and close with specific safety netting and follow up. Signpost as you move between phases and use brief summaries to stay on track and show the examiner you are processing what you hear.",
            "The full phase by phase structure, including how to use the RCGP's own Consultation Toolkit to self assess your consultations against it, is in [link: The 12 Minute Consultation Framework].",
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
            'Relating to Others is the domain where otherwise strong candidates quietly lose marks, because it cannot be crammed and it punishes anything mechanical. The skills it rewards are concrete: responding to cues instead of ploughing past them, exploring what the patient thinks is going on and what they are worried about, adapting your explanation to the person in front of you, and sharing the decision with the patient genuinely rather than simply telling them what will happen.',
            'Under exam pressure, the gap is rarely understanding these principles. It is having the actual words available in the moment. For ready to use phrasings across every part of the consultation, from eliciting concerns to safety netting to breaking bad news, see [link: The SCA Phrase Bank].',
            '2 further guides cover the consultations candidates fear most. The emotionally and ethically loaded cases, including angry patients, bad news, ethical dilemmas and safeguarding, are covered in [link: Challenging SCA Consultations]. The structurally awkward formats, including multiple problems in one case, consultations with a relative or carer rather than the patient, and results based consultations, are covered in [link: Complex Consultation Structures].',
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
            'Most candidates give themselves roughly 8 to 12 weeks of focused preparation alongside clinical work. The shape matters more than the total: orient first, then build a regular timed practice habit, then increase realism and intensity as the exam approaches, then taper in the final week rather than cramming.',
            'Two principles do most of the work. Start timed practice early, because the 12 minute rhythm only becomes automatic through repetition, and reading about consulting builds almost none of it. And let feedback steer you: track which domain you score lowest across practice cases, and bias your remaining preparation toward it.',
            'A week by week plan you can adapt to your own date is in [link: How to Build Your SCA Revision Timeline].',
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
            'The highest yield preparation available is timed consultation practice with honest feedback against the 3 domains, and the most accessible version of it costs nothing: two trainees, a structured case, and a marking scheme. One of you consults from the candidate brief, the other plays the patient from a script, you keep strictly to 12 minutes, then you grade each other domain by domain and say specifically what moved each grade. Then you swap.',
            'For this to work the cases need 3 components: a candidate brief, a patient script the role player can answer from consistently, and a marking scheme that maps to how the exam actually judges you. Every case in our free library includes all 3, plus learning points, and the library is built directly from the case examples the RCGP lists in its own curriculum. The full method, including how to give feedback that actually changes behaviour and how to cover your blind spots, is in [link: How to Practise SCA Cases With a Study Partner].',
            'When a partner is not available, AI consultation practice can fill the repetition gap with timed cases and instant domain mapped feedback, and it is worth understanding what the platforms in that space offer before paying for one.',
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
            'The market for SCA preparation is busy: one and two day courses, subscription case banks, AI practice platforms, books, and free study partner practice. None of them is essential on its own, and the expensive options are not automatically the effective ones. The test to apply to any resource is simple: does it get you consulting under time pressure with feedback, or does it just give you more to read?',
            'An honest comparison of the resource types, including where paid options genuinely add value and where free practice does the same job, is in [link: The Best SCA Revision Resources]. A separate head to head of the AI practice platforms specifically is in [link: Which SCA AI Platform Should You Use].',
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
            'Pass rates across recent diets have generally sat in the high sixties to low seventies percent overall, and first time candidates pass at a higher rate than the headline figure, because the overall number includes re-sitting candidates. The pass threshold moves slightly between diets by design, because it is calibrated to each sitting\'s difficulty, so the fluctuation does not mean one diet was easier than another, and you are never competing against a quota. You are being judged against a fixed standard: a safe, newly qualified GP.',
            'What the figures mean, why they move, and why the headline number matters less than your preparation is covered in [link: SCA Pass Rates Explained].',
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
            'Because the exam is remote, your environment is part of your preparation. You need a quiet, private room set up to the RCGP specification, reliable equipment, and a completed technical check before the day. Treat the day itself like a clinical session rather than an academic exam: arrive rested, because consultation performance degrades sharply with fatigue, and reset completely between cases, because each one is marked independently and carrying a bad station into the next one is the avoidable way to lose 2 cases instead of one.',
            'The full logistics, from room setup to what is allowed on your desk, are in [link: What to Expect on SCA Day].',
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
            'Some capable doctors fail a sitting of the SCA, and a fail is a setback, not a verdict on your future as a GP. The exam gives you standardised feedback mapped to the domains, and read properly, that feedback is a precise diagnosis of what to fix. The way back is to identify the pattern in your feedback, rebuild your practice around the weak domain in proportion, and return with the specific gap closed. The full approach is in [link: Failed the MRCGP SCA: How to Pass Your Re-sit], and our guide to reading the feedback itself is in [link: Decoding the RCGP SCA Feedback Statements].',
            'Exam anxiety also deserves to be taken seriously rather than dismissed with platitudes, because performance anxiety measurably affects consulting. Evidence based ways to manage it are in [link: Managing SCA Anxiety].',
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
            'Passing the SCA comes down to a short list of things done consistently. Understand the format so nothing on the day is a surprise. Internalise the 3 domains, because they are the entire basis of your mark. Build the 12 minute consultation shape until it is automatic. Practise under real timing, with honest feedback, early and often. Target your weakest domain rather than rehearsing your strengths. And walk into the exam treating each case as a real patient, because that, more than anything else, is what the examiners are looking for.',
            'If you want somewhere to start practising today, our case library has 79 SCA practice cases built directly from the RCGP curriculum, each with a candidate brief, patient script, marking scheme and learning points. It is free, with no paywall, and you are welcome to use it whenever it helps.',
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
