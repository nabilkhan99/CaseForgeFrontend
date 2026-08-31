import type { PortfolioArticle } from '@/lib/portfolio-guides/articleTypes';
import { PORTFOLIO_TOOL_PATH } from '@/lib/portfolio-guides/articleTypes';

export const whatToWriteAbout: PortfolioArticle = {
    slug: 'what-to-write-about',
    heading: 'What to write about when nothing interesting happened',
    kicker: 'Finding material',
    metaTitle: 'ePortfolio ideas: what to write about | Fourteen Fisherman',
    metaDescription:
        'Stuck for ePortfolio entries? The problem usually isn\'t your cases, it\'s what you think counts. Where to find entries in an ordinary surgery.',
    intro: [
        'The commonest reason trainees fall behind on the ePortfolio isn\'t time. It\'s sitting down to write, scrolling back through a week of surgeries, and concluding that nothing happened worth writing about.',
        'Almost always, that\'s a definition problem rather than a case problem.',
    ],
    sections: [
        {
            id: 'the-mistake',
            title: 'The mistake',
            blocks: [
                {
                    type: 'text',
                    text: 'Most people are looking for interesting cases, and they mean rare ones. The unusual diagnosis, the dramatic presentation, the thing that turned out to be something.',
                },
                {
                    type: 'text',
                    text: 'Rare presentations often make poor entries. If it was rare, you probably referred it, and the interesting part of the story happened somewhere else. What you\'re left writing is that you recognised something and passed it on.',
                },
                {
                    type: 'text',
                    text: 'What makes an entry good isn\'t rarity. It\'s that something happened in your thinking. Those are completely different criteria, and the second one is available constantly.',
                },
            ],
        },
        {
            id: 'where-the-entries-actually-are',
            title: 'Where the entries actually are',
            blocks: [
                {
                    type: 'text',
                    text: '**Cases where you nearly went the wrong way.** Not misses, near misses. You formed a view early and something shifted it. That\'s the best material available to you and most people don\'t write it up because it feels like an admission.',
                },
                {
                    type: 'text',
                    text: '**Consultations that were uncomfortable.** Someone was angry, or you were rushed and it showed, or you couldn\'t work out what they wanted. The commonest single reason strong material never gets written is that it\'s unflattering.',
                },
                {
                    type: 'text',
                    text: '**Decisions you\'re still not sure about.** If you\'re still thinking about it on the drive home, that\'s the entry. Unresolved is not a weakness in a case review, it\'s the most honest form of reflection there is.',
                },
                {
                    type: 'text',
                    text: '**Times you didn\'t act.** Not investigating, not referring, not prescribing. Deciding not to do something is harder to justify than doing it, and the reasoning is more interesting.',
                },
                {
                    type: 'text',
                    text: '**Consultations where the real problem wasn\'t the presenting one.** Extremely common in general practice and consistently under-written.',
                },
                {
                    type: 'text',
                    text: '**Things that went completely fine and you can say why.** Rarer than you\'d think, and worth writing. If a consultation went well and you can identify what you did that made it go well, that\'s transferable, which is more than can be said for most entries.',
                },
                {
                    type: 'text',
                    text: '**Anything involving someone else.** Handovers, referrals, conversations with a pharmacist or district nurse. Whole capabilities go under-evidenced because trainees only write about themselves alone with a patient.',
                },
                {
                    type: 'text',
                    text: '**Things you had to look up.** Every one of those is an entry: gap identified, gap addressed, practice changed.',
                },
                {
                    type: 'text',
                    text: '**Non-clinical friction.** A results system that nearly let something through, a recall that didn\'t work, a process you changed. This is where organisation, management and leadership evidence lives, and almost nobody writes it because it doesn\'t feel like medicine.',
                },
            ],
        },
        {
            id: 'the-test',
            title: 'The test',
            blocks: [
                {
                    type: 'text',
                    text: 'Not "was this case unusual". Ask: **is there anything I could tell someone about my thinking here that they wouldn\'t be able to guess from the notes?**',
                },
                {
                    type: 'text',
                    text: 'If yes, that\'s the entry, and the thing you\'d tell them is the reflection.',
                },
                {
                    type: 'text',
                    text: 'Almost every surgery has two or three of these. The reason they don\'t get written is that they\'re invisible by the evening, when they were obvious at the time.',
                },
            ],
        },
        {
            id: 'the-habit-that-fixes-this-permanently',
            title: 'The habit that fixes this permanently',
            blocks: [
                {
                    type: 'text',
                    text: 'Three lines in your phone during the surgery. Not the write up. Just enough to preserve what you were thinking.',
                },
                {
                    type: 'statement',
                    label: '"Chest pain, 40s, low risk but something off, brought forward review, still not sure why."',
                    text: 'That\'s enough to rebuild the entry a week later with the reasoning intact. Without it you have a diagnosis and a date, and you\'ll write reflection you\'ve reconstructed rather than reflection you had.',
                },
                {
                    type: 'text',
                    text: 'The trainees who never have an ePortfolio crisis aren\'t better at writing. They just capture the thinking while they still have it.',
                },
            ],
        },
    ],
    cta: {
        paragraphs: [
            'Got three lines and no time? Our [link: free GP portfolio tool] turns a short description of an encounter into a structured clinical case review, mapped to the RCGP capability framework.',
        ],
        actions: [{ label: 'Try it here', href: PORTFOLIO_TOOL_PATH }],
    },
};
