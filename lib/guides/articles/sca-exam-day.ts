import type { GuideArticle } from '@/lib/guides/articleTypes';

export const scaExamDay: GuideArticle = {
    slug: 'sca-exam-day',
    group: 'Understand the exam',
    number: '03',
    heading: 'What to Expect on SCA Day',
    cardLabel: 'What to Expect on SCA Day',
    cardSubtitle: 'Room setup and logistics',
    metaTitle: 'What to Expect on SCA Day | Fourteen Fisherman',
    metaDescription:
        'A walkthrough of SCA exam day from the weeks before to results day, covering room setup, the device check, the day itself and what happens afterwards.',
    kicker: 'Understand the exam',
    intro: [
        'Exam day nerves feed on the unknown, and the SCA’s remote format means much of the unknown is removable in advance: the room, the kit, the schedule and the rhythm of the day can all be familiar before the morning arrives. This guide walks the day from the week before to the results, so the only novel thing on the day is the cases themselves. For the exam’s wider mechanics, see [link: What Is the MRCGP SCA]; for the preparation that precedes all of this, the [link: complete guide to passing the SCA].',
    ],
    readTime: '6 min read',
    updated: 'Updated June 2026',
    sections: [
        {
            id: 'the-shape-of-the-day',
            title: 'The shape of the day',
            blocks: [
                {
                    type: 'text',
                    text: 'You sit the SCA remotely from a local GP surgery, usually your own training practice, allocated to either a morning or an afternoon session. The session is 12 simulated consultations of 12 minutes each, with role players joining most cases by video and some by audio only, and a few cases may put a carer, a relative or a colleague on the line rather than the patient. Before each case you get reading time with the candidate instructions, the case’s background information, and then the consultation runs. There is no physical examination component, and the exam is invigilated and closed book throughout: no notes, no references, no devices beyond the exam setup, in a room arranged to the RCGP’s specification so the invigilation process can confirm you are working alone.',
                },
                {
                    type: 'text',
                    text: 'One structural fact is worth internalising for its psychology as much as its logistics: every case is marked independently by a different examiner, so across the day you are assessed by at least 12 separate people, and no examiner who watched a rough consultation will see your next one. Each case is genuinely a fresh start.',
                },
            ],
        },
        {
            id: 'the-weeks-before',
            title: 'The weeks before: remove every unknown you can',
            blocks: [
                {
                    type: 'text',
                    text: '3 pieces of preparation make the day boring in the best sense.',
                },
                {
                    type: 'text',
                    text: 'Book and set up your room early, using the RCGP’s Candidate Surgery Guide, the College’s own page covering room booking, setup, what you may and may not have with you, and the IT and internet requirements. Those specifics can change, so work from the live RCGP page rather than any third party summary, including this one, and treat its requirements as hard rules, because the invigilation process does.',
                },
                {
                    type: 'text',
                    text: 'Complete the RCGP’s device check and platform walkthrough when invited. This is required before sitting, and it is also your rehearsal: it is the difference between meeting the exam software on the day and merely revisiting it. If anything in the check behaves oddly, chase it then, with weeks in hand, rather than discovering it at 8 in the morning.',
                },
                {
                    type: 'text',
                    text: 'And sort the personal layer: if you are relying on a reasonable adjustment it should have been applied for well in advance through the College’s process, and if you want a permitted comfort item with you, the RCGP publishes a comfort aid list specifying what is allowed, both covered in [link: What Is the MRCGP SCA].',
                },
            ],
        },
        {
            id: 'the-day-before',
            title: 'The day before',
            blocks: [
                {
                    type: 'text',
                    text: 'Keep it light, deliberately. Walk the full setup once: the room, the sign on the door, the kit, the login, the water within reach. Confirm the practice knows the room is yours and that you are not to be disturbed, because a colleague’s head around the door mid consultation is both a disruption and an invigilation problem. Then close the books. A handful of light timed cases earlier in the final week is sensible, per the taper in [link: How to Build Your SCA Revision Timeline], but the last day belongs to sleep, because the exam measures live performance and 12 consultations of sustained attention punish fatigue more reliably than they punish any gap in knowledge.',
                },
            ],
        },
        {
            id: 'during-the-session',
            title: 'During the session',
            blocks: [
                {
                    type: 'text',
                    text: 'Treat it as a clinical session, because that is what it is shaped like, and your thousands of real consultations are the deepest preparation you have. Use the reading time fully on each candidate brief, exactly as practised. Hold your trained structure, the 12 minute shape with its halfway checkpoint from [link: The 12 Minute Consultation Framework], and let the global skills carry you when a case surprises you, which one probably will, since the RCGP itself notes a case’s purpose may not be obvious from the instructions.',
                },
                {
                    type: 'text',
                    text: 'Between cases, run a reset ritual you have practised: a slow breath or 2, a sip of water, and a deliberate closing of the last case, because it now belongs to an examiner you will never meet again and carrying it forward is the one reliable way to lose 2 cases to one bad one. If a consultation goes badly, that is one twelfth of a whole assessment judged across the entire day, with no fixed number of cases you must pass.',
                },
                {
                    type: 'text',
                    text: 'If something technical fails mid exam, do not troubleshoot heroically and do not panic about the mark: flag it to the invigilation team immediately and follow their instructions, because the RCGP operates a rerun process for consultations disrupted by technical problems, and the candidates it exists for are exactly those who report the failure promptly. Practical anxiety management for the day itself, including what to do when your heart rate spikes at case one, is covered in [link: Managing SCA Anxiety].',
                },
            ],
        },
        {
            id: 'afterwards',
            title: 'Afterwards',
            blocks: [
                {
                    type: 'text',
                    text: 'The RCGP releases results through your College account a number of weeks after the sitting, on a published date, together with feedback mapped to the 3 marking domains. Whatever the outcome, the feedback repays proper reading: a pass that still flagged a weaker domain is a development note worth acting on early in your career, and every statement the College uses is translated in [link: Decoding the RCGP SCA Feedback Statements]. If the result is a fail, the way back is structured and well trodden, and it is laid out in [link: Failed the MRCGP SCA: How to Pass Your Re-sit].',
                },
                {
                    type: 'text',
                    text: 'The deepest exam day comfort is not on this page at all: it is having run so many timed consultations that the day feels like a format you know. If your practice rota needs material to get there, our free library of 79 SCA practice cases built from the RCGP curriculum, with reading time briefs, patient scripts and a built in 12 minute timer, is open whenever it helps.',
                },
            ],
        },
    ],
};
