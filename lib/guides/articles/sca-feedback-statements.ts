import type { GuideArticle } from '@/lib/guides/articleTypes';

export const scaFeedbackStatements: GuideArticle = {
    slug: 'sca-feedback-statements',
    group: 'How you are marked',
    number: '05',
    heading: 'Decoding the RCGP SCA Feedback Statements',
    cardLabel: 'Decoding the Feedback Statements',
    cardSubtitle: 'Every statement in plain English',
    metaTitle: 'Decoding the RCGP SCA Feedback Statements | Fourteen Fisherman',
    metaDescription:
        'Every standardised RCGP SCA feedback statement explained in plain English, with the concrete fix behind each one, organised by marking domain.',
    kicker: 'How you are marked',
    intro: [
        'When your SCA result arrives, it comes with feedback: a set of standardised statements your examiner selected for each case, mapped to the 3 marking domains. The problem is that the statements are broad by design, each one covering a family of related shortfalls rather than your specific case, so many candidates read them, feel vaguely criticised, and have no clear idea what to change. This guide takes every statement the RCGP uses, shows you exactly what it says, and decodes it into plain English and a concrete next step.',
        '2 things to hold in mind first. The feedback is not a line-by-line explanation of your score. Examiners award the domain grades first and then select the statements that best describe what they saw, so the statements tell you where you fell short, not how each mark was calculated, and even passing candidates receive them. And a single statement on one case matters far less than the same statement appearing repeatedly, or several statements clustering in one domain. Look for the pattern, because the pattern is your revision plan.',
        'A word of caution that the RCGP itself stresses: if you are re-sitting, do not over-correct a single piece of feedback. If you were flagged for thin safety netting, the answer is not to bolt heavy safety netting onto every consultation until it becomes formulaic and eats your time. Fix the weakness in proportion.',
    ],
    readTime: '9 min read',
    updated: 'Updated June 2026',
    sections: [
        {
            id: 'domain-1-data-gathering-and-diagnosis',
            title: 'Domain 1: Data Gathering and Diagnosis',
            blocks: [
                {
                    type: 'text',
                    text: 'This domain is about gathering the right information efficiently and turning it into sound clinical reasoning. The passing standard is systematic, targeted information gathering and a structured approach to forming a diagnosis or differential.',
                },
                {
                    type: 'statement',
                    label: 'Data gathering was insufficient to enable safe assessment of the condition/situation.',
                    text: 'This means your history did not go broad or deep enough to judge what was happening and how serious it was. The fix is not to ask everything. It is to ask enough to actively consider and exclude the serious possibilities, check the relevant red flags, and establish how the problem is affecting the patient.',
                },
                {
                    type: 'statement',
                    label: 'Existing information about the case was insufficiently utilised.',
                    text: 'This means you did not use the information already in the notes. Good data gathering includes the record, not just the conversation. Read the case notes first and weave them in: reference a recent consultation, confirm the listed medications, notice an overdue screening test or an abnormal result, and let those shape your questions.',
                },
                {
                    type: 'statement',
                    label: 'Relevant psychological or social information insufficiently recognised or responded to.',
                    text: 'This means you treated the symptom rather than the person. The same diagnosis can need very different management depending on the patient\'s work, home situation and worries. Be genuinely curious about the impact of the problem on their life, because context is what makes a plan acceptable to that individual.',
                },
                {
                    type: 'statement',
                    label: 'Data gathering was unsystematic and/or disorganised.',
                    text: 'This means the consultation lacked a logical thread and felt scattered, which signals a doctor who might miss something. Aim for a stepwise shape: open questions first, then focused closed questions, signposting when you change direction, and summarising to show you are processing what you hear.',
                },
                {
                    type: 'statement',
                    label: 'Ineffective approach or prioritisation in data gathering, when presented with multiple or complex problems.',
                    text: 'This means you did not triage well when several issues were in play. Negotiate with the patient about what to focus on today and defer the rest, or step back and ask whether several symptoms might share one unifying explanation rather than chasing each in turn.',
                },
                {
                    type: 'statement',
                    label: 'The implications of relevant findings identified during the data gathering were insufficiently recognised or understood.',
                    text: 'This means a significant finding emerged that you did not recognise as important, or noticed but did not act on. Practise spotting the detail that changes everything, the feature that turns a routine presentation into a red flag, and responding to it.',
                },
                {
                    type: 'statement',
                    label: 'Differential diagnoses or hypotheses were inadequately generated or tested.',
                    text: 'This means your differential was too narrow, or you settled on a diagnosis without testing the alternatives. Build the habit of asking what else this could be, voice your reasoning aloud so it is visible to the examiner, and watch for confirmation bias, where you favour the information that fits your first guess.',
                },
                {
                    type: 'statement',
                    label: 'Decision-making or diagnosis was illogical, incorrect or incomplete.',
                    text: 'This means you reached the wrong conclusion, the reasoning did not make clinical sense, or you avoided committing to a diagnosis for fear of being wrong. Practise reaching a clear decision and check whether your reasoning matches how experienced colleagues would think it through.',
                },
            ],
        },
        {
            id: 'domain-2-clinical-management-and-medical-complexity',
            title: 'Domain 2: Clinical Management and Medical Complexity',
            blocks: [
                {
                    type: 'text',
                    text: 'This domain, which carries slightly more weight than the others, is about safe, current, appropriately prioritised management that is shared with the patient. The passing standard is the ability to formulate safe and appropriate plans and to commit to good care over the short and long term.',
                },
                {
                    type: 'statement',
                    label: 'The management plan relating to referral was inappropriate or not reflective of current practice.',
                    text: 'This means you referred when you did not need to, did not refer when you should have, or sent the patient to the wrong place. Know your referral pathways and thresholds, value the wider team including community services and self-referral, and be clear when a referral is genuinely not warranted.',
                },
                {
                    type: 'statement',
                    label: 'The management plan relating to prescribing of medication was inappropriate or not reflective of current practice.',
                    text: 'This means a prescribing decision was unsafe, wrongly dosed, missed, or unnecessary. Keep your prescribing anchored to current guidance and the BNF, consider interactions and side effects, counsel the patient where it matters, and stay alert to polypharmacy and the need to deprescribe.',
                },
                {
                    type: 'statement',
                    label: 'The management plan relating to investigations was inappropriate or not reflective of current practice.',
                    text: 'This means you over-investigated, under-investigated, or ordered tests with no clear purpose. Every investigation should answer a specific clinical question. Ordering a battery of tests to be safe reads as indiscriminate rather than thorough.',
                },
                {
                    type: 'statement',
                    label: 'The management plan relating to prevention, health promotion or rehabilitation was inadequate or inappropriate.',
                    text: 'This means you focused narrowly on the immediate fix and missed the wider opportunity, such as lifestyle advice, self-care, rehabilitation, a fit note, screening, or appropriate signposting. Consider what would genuinely help this person stay well alongside treating the presenting issue.',
                },
                {
                    type: 'statement',
                    label: 'The plan relating to the medical management of risk was inadequate or inappropriate.',
                    text: 'This means you either did not identify the risk or did not respond to it proportionately, or you were so risk-averse that you over-managed a safe situation. Risk management is about proportionate responses that protect patient safety. Where a case calls for it, that can include knowing how the wider system responds to risk, for example recognising when an incident should be reviewed through a significant event analysis, the structured meeting a practice holds to learn from something that went wrong.',
                },
                {
                    type: 'statement',
                    label: 'The implications of co-morbidity were insufficiently considered.',
                    text: 'This means you managed one condition in isolation when the patient\'s other problems should have changed your approach. Guidelines for a single disease can conflict in a patient with several, particularly in frail older adults and where there is polypharmacy. Practise consulting with genuinely complex patients.',
                },
                {
                    type: 'statement',
                    label: 'Uncertainty, including that experienced by the patient, was managed ineffectively.',
                    text: 'This means you could not comfortably hold uncertainty, did not use time as a diagnostic tool, or did not support the patient through their own uncertainty. Sometimes the safe and correct plan is to watch, wait and review rather than to investigate or prescribe straight away.',
                },
                {
                    type: 'statement',
                    label: 'Inappropriate or inadequate arrangements for follow-up, continuity and/or safety netting.',
                    text: 'This means your arrangements for what happens next were missing, unrealistic, or applied without care. Safety netting should be specific and proportionate, telling the patient what to expect, over what timescale, and what to do if things change, without either neglecting it or alarming the patient unnecessarily.',
                },
                {
                    type: 'statement',
                    label: 'Time management in the consultation was ineffective.',
                    text: 'This means you overspent on one part of the consultation, usually the history, and got squeezed on management, explanation or follow-up. The cases are designed to be completed in 12 minutes. Pace yourself across the phases and keep your data gathering selective rather than exhaustive.',
                },
            ],
        },
        {
            id: 'domain-3-relating-to-others',
            title: 'Domain 3: Relating to Others',
            blocks: [
                {
                    type: 'text',
                    text: 'This domain is about communication, ethics and genuine partnership with the patient. The passing standard is ethical awareness, person-centred communication, and the flexibility to overcome barriers and reach a shared understanding.',
                },
                {
                    type: 'statement',
                    label: 'Communication skills, including the non-verbal, responding to cues and/or active listening were insufficiently demonstrated.',
                    text: 'This means you may have asked questions without truly listening to the answers, missed verbal or non-verbal cues, or consulted in a rigid, scripted way. Respond to what the patient actually says and does, and remember that a stock phrase repeated too often loses all meaning. When a patient drops a cue, follow it.',
                },
                {
                    type: 'statement',
                    label: 'The person\'s agenda, health beliefs and/or preferences were insufficiently explored.',
                    text: 'This means the consultation was not person-centred enough. Explore the patient\'s ideas, concerns and expectations, and the impact the problem is having on them, and treat that as central rather than as a box to tick.',
                },
                {
                    type: 'statement',
                    label: 'The circumstances, relevant cultural differences and/or preferences of those involved were insufficiently responded to.',
                    text: 'This means you gathered the patient\'s context but did not carry it into a genuinely shared plan. Being person-centred does not mean being patient-led on everything, but their situation and preferences should visibly shape what you decide together.',
                },
                {
                    type: 'statement',
                    label: 'Explanations were inadequately shared or adapted for the person\'s needs.',
                    text: 'This means you used jargon or pitched the explanation wrongly for the person in front of you. Explain in accessible language, adapt for the patient\'s needs including disability and age, and check that they have understood.',
                },
                {
                    type: 'statement',
                    label: 'A judgemental approach was shown to the person.',
                    text: 'This means you conveyed judgement about the patient or their choices, even implicitly. We all carry unconscious bias; the work is recognising the consultations that trigger it and responding instead with empathy and partnership, particularly with vulnerable or marginalised patients.',
                },
                {
                    type: 'statement',
                    label: 'Respect and/or sensitivity shown to the person was inadequate or inappropriate.',
                    text: 'This covers introductions, consent, privacy, and noticing distress, as well as avoiding over-familiarity, dismissiveness or anything patronising. Approach difficult or intimate areas carefully and seek permission before going there. With children or cognitively impaired patients, engage the patient, not only their carer.',
                },
                {
                    type: 'statement',
                    label: 'Ownership or responsibility for decision-making was inadequate or inappropriate.',
                    text: 'This means you were over-cautious, deferring, referring or seeking extra input on something you could and should have handled yourself. Sharing decisions is good practice, but a simple decision can be robust and defensible on its own, and unnecessary referrals can raise patient anxiety and add load to the system.',
                },
                {
                    type: 'statement',
                    label: 'Teamwork and/or understanding of others\' roles was insufficiently recognised or responded to.',
                    text: 'This means you did not involve or understand the wider primary care team appropriately. Show that you know who does what, from physiotherapists to health visitors to palliative and mental health teams, and when and how to involve them in the patient\'s interest.',
                },
                {
                    type: 'statement',
                    label: 'Safeguarding concerns were inadequately recognised or responded to.',
                    text: 'This means you missed a safeguarding concern or did not act on it, and it is one of the most serious things to get wrong. Recognise the risks of abuse, harm or neglect in both children and adults, ask sensitively, know your thresholds and escalation routes, and act by sharing information and referring where needed.',
                },
            ],
        },
        {
            id: 'how-to-use-your-feedback',
            title: 'How to use your feedback',
            blocks: [
                {
                    type: 'text',
                    text: 'Read your statements across all your cases and look for what repeats. A statement that appears once, on one case, may simply reflect that case. A statement that appears several times, or a cluster within one domain, is a genuine pattern and your priority for practice. Discuss the feedback with your trainer or educational supervisor, who can help you turn it into specific actions and may recognise themes from your workplace assessments.',
                },
                {
                    type: 'text',
                    text: 'Then work on the specific weakness you have identified, in proportion. If your pattern was in data gathering, practise structured, hypothesis-led histories. If it was clinical management, rehearse safe, specific, shared plans with proportionate safety netting. If it was relating to others, practise genuinely exploring and responding to the patient\'s perspective. Across all 3, the method that builds the skill is timed consultation practice with honest feedback against the domains.',
                },
                {
                    type: 'text',
                    text: 'If you want to work on a particular domain, our free case library has practice cases built from the RCGP curriculum, each with a candidate brief, patient script and marking scheme, so you and a study partner can focus on the area your feedback highlighted. It is free to use whenever you find it helpful.',
                },
            ],
        },
    ],
};
