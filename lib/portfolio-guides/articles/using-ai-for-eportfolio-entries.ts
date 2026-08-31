import type { PortfolioArticle } from '@/lib/portfolio-guides/articleTypes';
import { PORTFOLIO_TOOL_PATH } from '@/lib/portfolio-guides/articleTypes';

export const usingAiForEportfolioEntries: PortfolioArticle = {
    slug: 'using-ai-for-eportfolio-entries',
    heading: 'Using AI for ePortfolio entries: what\'s allowed and what isn\'t',
    kicker: 'AI and probity',
    metaTitle: 'Using AI for ePortfolio entries: what\'s allowed | Fourteen Fisherman',
    metaDescription:
        'Can GP trainees use AI to write ePortfolio entries? What\'s acceptable as a drafting aid, what crosses into probity, and how to use it without getting it wrong.',
    intro: [
        'Almost every GP trainee has now asked some version of this question, usually late at night with a blank log entry open. You\'ve seen a consultation worth writing up, you know roughly what you want to say, and you also know it\'ll take forty minutes you don\'t have. So: can you get AI to write it?',
        'The short answer is yes, as a drafting aid, and a lot of trainees already do. The longer answer is that where you draw the line matters more than most people realise, and the line isn\'t where most people assume it is.',
    ],
    sections: [
        {
            id: 'the-line-isnt-about-the-writing',
            title: 'The line isn\'t about the writing',
            blocks: [
                {
                    type: 'text',
                    text: 'The instinct is to think the risk lies in the words. That a supervisor will spot the phrasing, or that using a tool to help you write is itself the problem.',
                },
                {
                    type: 'text',
                    text: 'It isn\'t. Doctors have always used templates, structures and prompts to write up their reflection. Nobody has ever suggested that a trainee who works from a framework is being dishonest. The tool that generates a structure for you is doing the same job.',
                },
                {
                    type: 'text',
                    text: 'The line is about truth. Your ePortfolio is an evidence record. Everything in it is a claim you\'re making about your own practice, and your ARCP panel reads it as such. There are two ways to cross the line, and neither has anything to do with prose style.',
                },
            ],
        },
        {
            id: 'crossing-one-the-case-didnt-happen',
            title: 'Crossing one: the case didn\'t happen',
            blocks: [
                {
                    type: 'text',
                    text: 'Generating an entry for an encounter you weren\'t part of, or inventing detail to make a real encounter look better, is falsification. It\'s the same act whether you write it yourself or a tool writes it for you, and being able to produce it quickly doesn\'t change what it is.',
                },
                {
                    type: 'text',
                    text: 'This sounds obvious written down. In practice the drift is subtle. You\'re short of entries, you half-remember a case from a busy clinic, you fill the gaps with what probably happened. A tool that produces plausible clinical narrative from a thin prompt makes that drift very easy, because the output reads convincingly whether or not it\'s true.',
                },
                {
                    type: 'text',
                    text: 'If you can\'t remember the encounter well enough to write it, don\'t write it.',
                },
            ],
        },
        {
            id: 'crossing-two-the-reflection-isnt-yours',
            title: 'Crossing two: the reflection isn\'t yours',
            blocks: [
                {
                    type: 'text',
                    text: 'This is the one people get wrong more often, because it feels less serious. The case is real, the events are accurate, but the reflective section came out of the tool and you didn\'t change it.',
                },
                {
                    type: 'text',
                    text: 'Reflection is the part of a case review that\'s actually being assessed. What you were thinking, what you considered and ruled out, what worried you, what you\'d do differently. That can only come from you, because nobody else has access to it. A tool can produce reflection-shaped text, and it will read fine, but it\'s a plausible guess at what a trainee might have thought rather than a record of what you did think.',
                },
                {
                    type: 'text',
                    text: 'Submitting that as your own reflection is the probity issue. Not the drafting. The reflection.',
                },
            ],
        },
        {
            id: 'what-this-means-practically',
            title: 'What this means practically',
            blocks: [
                {
                    type: 'text',
                    text: 'Use AI for structure, sequencing and the blank page problem. Those are the parts that take time without teaching you anything.',
                },
                {
                    type: 'text',
                    text: 'Write the reflection yourself. If a draft comes back with reflective content in it, treat that as a prompt rather than an answer: read it, notice where it\'s guessed wrong, and replace it with what actually went through your head.',
                },
                {
                    type: 'text',
                    text: 'The practical test is whether you\'d be comfortable being asked about the entry in a tutorial. If your supervisor said "tell me more about why you were unsure at that point", would you have something to say? If yes, the entry is yours. If you\'d have to go back and read what the tool wrote to remember what you supposedly thought, it isn\'t.',
                },
            ],
        },
        {
            id: 'will-anyone-be-able-to-tell',
            title: 'Will anyone be able to tell?',
            blocks: [
                {
                    type: 'text',
                    text: 'Occasionally, if you paste something unedited. Generated text tends to have a flat evenness to it, and a supervisor reading a large volume of entries develops an ear for that.',
                },
                {
                    type: 'text',
                    text: 'But detection is the wrong thing to be worried about, and organising your approach around not getting caught is how people end up somewhere they didn\'t intend to be. The better framing is that an entry which reads as generic is a weak entry regardless of how it was produced. It won\'t be flagged as suspicious. It\'ll just be marked as thin, because it is.',
                },
                {
                    type: 'text',
                    text: 'Specific detail is what makes an entry good and what makes it unmistakably yours at the same time. The thing that surprised you. The decision you\'re still not certain about. The moment the consultation went sideways. Those details can\'t be generated because nobody else knows them, and they\'re also exactly what a panel is looking for.',
                },
            ],
        },
        {
            id: 'the-honest-summary',
            title: 'The honest summary',
            blocks: [
                {
                    type: 'text',
                    text: 'Drafting: fine. Structuring: fine. Getting past a blank page on a Sunday night: fine, and better than the alternative of writing nothing.',
                },
                {
                    type: 'text',
                    text: 'Fabricating cases: not fine, and not a grey area.',
                },
                {
                    type: 'text',
                    text: 'Submitting reflection you don\'t recognise as your own: not fine, and the one most likely to happen by accident.',
                },
                {
                    type: 'text',
                    text: 'For the current formal position on evidence and professional behaviour, check the RCGP\'s own guidance, which is the authority on this and changes from time to time.',
                },
            ],
        },
    ],
    cta: {
        paragraphs: [
            'Our [link: free GP portfolio tool] drafts structured clinical case reviews from a short description of the encounter, mapped to the RCGP capability framework. It\'s built to give you a starting point, not a finished entry.',
        ],
        actions: [{ label: 'Try it here', href: PORTFOLIO_TOOL_PATH }],
    },
};
