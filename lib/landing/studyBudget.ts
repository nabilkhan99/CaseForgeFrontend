/**
 * Study budget checker data: per-deanery funding positions for the
 * Complete SCA Course, checked July 2026 against each deanery's
 * most current published study leave policy.
 *
 * The email templates reference fourteenfisherman.com/course-spec —
 * keep that URL stable (see app/course-spec/page.tsx).
 */

export type Verdict = 'strong' | 'reasonable' | 'longshot' | 'local';

export interface VerdictTheme {
  bg: string;
  border: string;
  title: string;
  accent: string;
  pill: string;
}

export const VERDICT_THEMES: Record<Verdict, VerdictTheme> = {
  strong: {
    bg: '#EAF3DE',
    border: '#97C459',
    title: '#27500A',
    accent: '#3B6D11',
    pill: 'Strong case',
  },
  reasonable: {
    bg: '#E8F1FB',
    border: '#86B3E8',
    title: '#17385E',
    accent: '#2E5F96',
    pill: 'Reasonable chance, definitely worth asking',
  },
  longshot: {
    bg: '#F1EFE8',
    border: '#B4B2A9',
    title: '#2C2C2A',
    accent: '#5F5E5A',
    pill: 'Try your luck',
  },
  local: {
    bg: '#F1EFE8',
    border: '#B4B2A9',
    title: '#2C2C2A',
    accent: '#5F5E5A',
    pill: 'Deaneries decide locally',
  },
};

export interface ResitPosition {
  verdict: Verdict;
  title: string;
  body: string;
  /** Overrides {@link DeaneryPolicy.youPay} on the resit path. See that field. */
  youPay?: number;
}

export interface DeaneryPolicy {
  id: string;
  label: string;
  group: 'England' | 'Devolved nations' | 'Other';
  verdict: Verdict;
  title: string;
  body: string;
  /** Claim goes in under NHSE code GP0001 */
  usesGpCode: boolean;
  /** Real email address, or a "[bracketed]" instruction when none is published */
  contact: string | null;
  /** Shown instead of a To: line when applications go via a portal */
  portalUrl?: string;
  portalLabel?: string;
  quote: string;
  quote2?: string;
  doc: string;
  policyUrl: string;
  resit?: ResitPosition;
  /**
   * What a trainee is left paying on a £599 Complete course once their
   * deanery's funding is applied, in whole pounds. Omitted means £0.
   *
   * Only set where the region's own published cap cannot reach £599: the
   * North West caps at £500, and the North East expects 50% self funding on
   * its discretionary route. Everywhere else the cap covers the fee.
   *
   * This is the arithmetic of the published cap against our price, NOT a
   * prediction that the claim will be approved. Approval is the deanery's,
   * which is why the figure sits next to the verdict rather than replacing it.
   */
  youPay?: number;
  /**
   * The cap in one line, as the design canvas states it, e.g.
   * "Up to £600 · code GP0001" or "Capped at £500". Set in mono beside the
   * out-of-pocket figure so the number has its policy basis next to it.
   */
  cap?: string;
  /**
   * Status chip beside the figure: "Very likely approved", "Part-funded",
   * "Approval needed" and so on. Describes how the money arrives, where the
   * verdict pill describes how strong the case is. Both come from the canvas.
   */
  chip?: string;
  /**
   * The position in one line, as the canvas writes it. This is the card body:
   * the canvas card is figure, cap, chip and this, and nothing else. `body`,
   * `quote` and `doc` are the long form, and they belong to the /study-budget
   * article surface rather than the homepage card.
   */
  detail?: string;
}

/** Out-of-pocket figure for a deanery, honouring the resit branch. */
export function outOfPocketFor(deanery: DeaneryPolicy, hasResat: boolean): number {
  if (hasResat && deanery.resit?.youPay !== undefined) return deanery.resit.youPay;
  return deanery.youPay ?? 0;
}

export const DEANERIES: readonly DeaneryPolicy[] = [
  {
    id: 'london',
    detail: "One SCA preparation course per trainee under GP0001, with prospective approval.",
    cap: 'Up to £600 · code GP0001',
    chip: 'Very likely approved',
    label: 'London',
    group: 'England',
    verdict: 'strong',
    title: 'Strong case: £600 per SCA course, one per sitting',
    usesGpCode: true,
    contact: null,
    portalUrl: 'https://lasepgmdesupport.hee.nhs.uk',
    portalLabel: 'LaSE support portal',
    body: "Your deanery's approved course list funds one exam preparation course per sitting, up to £600 per SCA course under code GP0001, with no restriction on provider. Complete is £599, so it fits inside that cap.",
    quote:
      'Exam preparation course... max 1 per sitting; max £600 per SCA preparation course (GP0001)',
    doc: 'NHSE London approved study courses list, September 2025',
    policyUrl:
      'https://lasepgmdesupport.hee.nhs.uk/support/solutions/articles/7000069786',
  },
  {
    id: 'kss',
    detail: "One SCA preparation course per sitting, so a resit attracts its own funding.",
    cap: 'Up to £600 per sitting · GP0001',
    chip: 'Very likely approved',
    label: 'Kent, Surrey and Sussex',
    group: 'England',
    verdict: 'strong',
    title: 'Strong case: £600 per SCA course, one per sitting',
    usesGpCode: true,
    contact: '[your patch Faculty Administrator]',
    body: "KSS's own approved list (code S-GP0001) funds one exam preparation course per sitting, up to £600 per SCA course, provider agnostic. Complete is £599, so it fits inside that cap.",
    quote:
      'Exam preparation course... max 1 per sitting; Max £600 per SCA preparation course',
    doc: 'KSS General Practice approved list, revised March 2026',
    policyUrl: 'https://lasepgmdesupport.hee.nhs.uk',
  },
  {
    id: 'eoe',
    detail: "Exam preparation is approved as an aspirational activity with TPD sign-off: one SCA course per programme.",
    cap: 'No fixed cap · TPD sign-off',
    chip: 'Covered with approval',
    label: 'East of England',
    group: 'England',
    verdict: 'strong',
    title: 'Strong case, with a process to follow',
    usesGpCode: false,
    contact: 'england.primarycare.eoe@nhs.net',
    body: 'Your deanery reimburses one SCA preparation course or resource claim across training. Exam preparation sits in the aspirational category, approved by your TPD with a PDP objective on your e-portfolio.',
    quote:
      'a maximum of 1... preparation course/resource claim throughout the course of their training',
    doc: 'NHSE East of England GP study leave FAQs (current)',
    policyUrl: 'https://heeoe.hee.nhs.uk/general_practice/gp-study-leave',
  },
  {
    id: 'tv',
    detail: "Regional and RCGP-accredited courses are prioritised first, so say which ones you tried and why the dates did not fit.",
    cap: 'One SCA course in ST3',
    chip: 'Covered with approval',
    label: 'Thames Valley',
    group: 'England',
    verdict: 'strong',
    title: 'Strong case: your school funds one SCA course in ST3',
    usesGpCode: false,
    contact: 'england.gpadmin.tv@nhs.net',
    body: "Your school's current policy funds an SCA course in ST3 on its automatic green list, one per resident doctor, ideally RCGP accredited. It also accepts a course whose cost includes a year's platform access, which is exactly how Complete is structured.",
    quote: 'SCA course ST3 *Ideally RCGP accredited. 1 per GP resident doctor',
    doc: 'Study leave for GP resident doctors, Thames Valley and Wessex GP School, v2, March 2026',
    policyUrl:
      'https://wessex.hee.nhs.uk/wp-content/uploads/sites/6/2026/03/Study-Leave-TVWX-March-2026-Final-final-version.pdf',
  },
  {
    id: 'wessex',
    detail: "Regional and RCGP-accredited courses are considered first. Name the one whose dates did not work for your sitting.",
    cap: 'One SCA course in ST3',
    chip: 'Covered with approval',
    label: 'Wessex',
    group: 'England',
    verdict: 'strong',
    title: 'Strong case: your school funds one SCA course in ST3',
    usesGpCode: false,
    contact: 'england.gp.wx@nhs.net',
    body: "Your school's current policy funds an SCA course in ST3 on its automatic green list, one per resident doctor, ideally RCGP accredited. It also accepts a course whose cost includes a year's platform access, which is exactly how Complete is structured. Wessex administers exam course funding through your patch office.",
    quote: 'SCA course ST3 *Ideally RCGP accredited. 1 per GP resident doctor',
    doc: 'Study leave for GP resident doctors, Thames Valley and Wessex GP School, v2, March 2026',
    policyUrl:
      'https://wessex.hee.nhs.uk/wp-content/uploads/sites/6/2026/03/Study-Leave-TVWX-March-2026-Final-final-version.pdf',
  },
  {
    id: 'em',
    detail: "Two SCA courses across the whole of training, with no published per-course cap.",
    cap: 'Up to 2 courses · no per-course cap',
    chip: 'Very likely approved',
    label: 'East Midlands',
    group: 'England',
    verdict: 'strong',
    title: 'Strong case: up to two SCA courses across training',
    usesGpCode: false,
    contact: 'hee.eastmidlands@nhs.net',
    body: 'The current Midlands GP Schools guidance puts SCA courses in Category I (curriculum based): guidance of two courses over the whole of training, RCGP accredited courses preferred but not required, and no cost cap. Online courses are considered on the same basis as in-person.',
    quote:
      'SCA Courses: guidance of two courses over whole of training & RCGP accredited courses are preferred',
    doc: 'Midlands GP Schools study leave guidance, May 2026',
    policyUrl:
      'https://www.eastmidlandsdeanery.nhs.uk/policies/Study_Leave/Mainpage',
  },
  {
    id: 'wm',
    detail: "Two SCA courses across the whole of training, with no published per-course cap.",
    cap: 'Up to 2 courses · no per-course cap',
    chip: 'Very likely approved',
    label: 'West Midlands',
    group: 'England',
    verdict: 'strong',
    title: 'Strong case: up to two SCA courses across training',
    usesGpCode: false,
    contact: '[via westmidlandsdeanery.nhs.uk contacts page]',
    body: 'The current Midlands GP Schools guidance covers the West Midlands too: SCA courses sit in Category I (curriculum based), guidance of two courses over training, RCGP accredited preferred but not required, no cost cap. Online courses are considered on the same basis as in-person.',
    quote:
      'SCA Courses: guidance of two courses over whole of training & RCGP accredited courses are preferred',
    doc: 'Midlands GP Schools study leave guidance, May 2026',
    policyUrl: 'https://www.westmidlandsdeanery.nhs.uk/gp/study-leave',
  },
  {
    id: 'nw',
    detail: "Non-accredited courses are considered up to £500 with prior approval, leaving £99 to you.",
    cap: 'Capped at £500',
    chip: '£500 of £599 covered',
    label: 'North West',
    group: 'England',
    verdict: 'strong',
    title: 'Strong case: the majority of the fee is fundable',
    usesGpCode: false,
    contact: 'england.gpstudyleave@nhs.net',
    body: 'Your school funds one SCA course per exam, up to £500. Complete is £599, so up to £500 of the fee can be covered, with a small remainder (£99) self funded. The email below asks for full funding first, with funding up to £500 plus self funding the rest as the alternative.',
    youPay: 99,
    quote: 'one course attendance per RD to a maximum of £500',
    doc: 'NW GP School study leave guidelines, March 2026',
    policyUrl: 'https://www.nwpgmd.nhs.uk/gpst-study-leave',
  },
  {
    id: 'ne',
    detail: "Non-accredited courses are discretionary with 50% self-funding expected, around £300 each way.",
    cap: 'Discretionary · 50% self-funding',
    chip: 'Part-funded',
    label: 'North East and North Cumbria',
    group: 'England',
    verdict: 'strong',
    title: 'Strong case: two routes to funding in your region',
    usesGpCode: false,
    contact: '[your programme office, via madeinheene.hee.nhs.uk]',
    youPay: 300,
    body: 'Your deanery runs two funding routes and this course could fall under either. Route one is the automatic approved course list, which covers accredited SCA courses and educational packages. Route two is the discretionary route for other courses, decided by the Primary Care Dean or an Associate Director. The email below asks your programme office to confirm which applies and the funding available.',
    quote:
      'RCGP provided or accredited AKT and SCA courses including AKT and SCA educational packages: one course attendance during training for... the SCA',
    quote2:
      'All other courses are discretionary and need the approval of the Primary Care Dean or an Associate Director',
    doc: 'NHSE Education NE automatic approved course list, September 2025, and study leave policy v11',
    policyUrl:
      'https://madeinheene.hee.nhs.uk/general_practice/Trainees/Study-Leave',
  },
  {
    id: 'yh',
    detail: "One SCA course per exam attempt from a named approved list. Ask your TPD about an off-list course before booking.",
    cap: 'Named list · one per attempt',
    chip: 'Approval needed',
    label: 'Yorkshire and the Humber',
    group: 'England',
    verdict: 'reasonable',
    title: 'Reasonable chance: approved case by case, one per exam attempt',
    usesGpCode: false,
    contact: '[your scheme office]',
    body: "Your deanery's green list names its automatically funded SCA courses (including commercial providers), one per exam attempt. Courses off the list are considered case by case with your clinical supervisor and TPD, documented as a PDP entry. The email below makes that ask with the full course specification attached.",
    quote: 'SCA courses ST3- one per exam attempt',
    doc: 'Study leave for GP registrars, Yorkshire and Humber, February 2025',
    policyUrl:
      'https://www.yorksandhumberdeanery.nhs.uk/professional-support/policies/study-leave',
  },
  {
    id: 'severn',
    detail: "Detailed guidance is pending publication, so get prospective approval in writing before you pay.",
    cap: 'Guidance pending · approval essential',
    chip: 'Approval needed',
    label: 'Severn',
    group: 'England',
    verdict: 'longshot',
    title: 'A long shot in your region, but asking is free',
    usesGpCode: false,
    contact: 'england.gprecruitment.sw@nhs.net',
    body: "Your region block buys a place on the RCGP's SCA preparation course for every South West trainee, so other courses are rarely funded for a first sitting. That said, a second funded place can be approved in exceptional circumstances via your TPD, and funding decisions are ultimately discretionary, so it costs nothing to ask.",
    quote:
      "NHS England pays for one place on the RCGP's... SCA preparation course for each south west Doctor in Training",
    doc: 'NHSE South West GP study leave guidance',
    policyUrl:
      'https://southwest.pgmdeducation.nhs.uk/primary-care/gp-training-programme/gp-training/study-leave-guidance/',
    resit: {
      verdict: 'reasonable',
      title: 'Resitting changes things: extra support opens up',
      body: 'After an unsuccessful attempt you are entitled to further support through SPEX, and an exceptional second funded course place can be approved via your TPD with your circumstances set out. The email below makes that ask with the course specification attached.',
    },
  },
  {
    id: 'peninsula',
    detail: "Detailed guidance is pending publication, so get prospective approval in writing before you pay.",
    cap: 'Guidance pending · approval essential',
    chip: 'Approval needed',
    label: 'Peninsula',
    group: 'England',
    verdict: 'longshot',
    title: 'A long shot in your region, but asking is free',
    usesGpCode: false,
    contact: 'PenGPHelpdesk.SW@hee.nhs.uk',
    body: "Your region block buys a place on the RCGP's SCA preparation course for every South West trainee, so other courses are rarely funded for a first sitting. That said, a second funded place can be approved in exceptional circumstances via your TPD, and funding decisions are ultimately discretionary, so it costs nothing to ask.",
    quote:
      "NHS England pays for one place on the RCGP's... SCA preparation course for each south west Doctor in Training",
    doc: 'NHSE South West GP study leave guidance',
    policyUrl:
      'https://southwest.pgmdeducation.nhs.uk/primary-care/gp-training-programme/gp-training/study-leave-guidance/',
    resit: {
      verdict: 'reasonable',
      title: 'Resitting changes things: extra support opens up',
      body: 'After an unsuccessful attempt you are entitled to further support through SPEX, and an exceptional second funded course place can be approved via your TPD with your circumstances set out. The email below makes that ask with the course specification attached.',
    },
  },
  {
    id: 'wales',
    detail: "£600 per training year, and unused budget rolls over once to a maximum of £1,200.",
    cap: '£600/yr · rolls over to £1,200',
    chip: 'Very likely approved',
    label: 'Wales (HEIW)',
    group: 'Devolved nations',
    verdict: 'strong',
    title: 'Strong case: £600 a year, and unused budget rolls over',
    usesGpCode: false,
    contact: 'HEIW.GPTraining@wales.nhs.uk',
    body: "HEIW's current policy gives every GP trainee £600 of study leave funding per training year, with unused budget rolling over one year (up to £1,200 available). Online training is explicitly supported, and the exclusions are exam fees, registrations, portfolio fees, books and equipment, not courses.",
    quote: 'Trainees are allocated a budget of £600 per training year',
    doc: 'HEIW GP Trainee Study Leave Policy, v4, March 2024',
    policyUrl:
      'https://heiw.nhs.wales/education-and-training/trainee-doctor-information/study-leave/',
  },
  {
    id: 'scotland',
    detail: "A nominal £600 per registrar per training year, with individual course fees fundable.",
    cap: '£600 per training year',
    chip: 'Very likely approved',
    label: 'Scotland (NES)',
    group: 'Devolved nations',
    verdict: 'strong',
    title: "Fundable at your TPD's discretion",
    usesGpCode: false,
    contact: '[your regional NES GP team]',
    body: 'NES funding sits with your TPD, judged on educational need and curricular relevance against a £600 budget per training stage. Course fees are fundable for individual courses; annual subscriptions are not. Expensive courses may be part funded, so the email below asks for full funding with part funding as the fallback.',
    quote:
      'NES will fund course fees for individual GP Continuing Professional Development courses',
    doc: 'NES study leave FAQs for GP registrars, July 2025',
    policyUrl:
      'https://www.scotlanddeanery.nhs.scot/trainee-information/gp-specialty-training/',
  },
  {
    id: 'ni',
    detail: "Funded through the SUCCESS programme after an unsuccessful attempt, at up to £750 per course.",
    cap: 'After an unsuccessful attempt · up to £750',
    chip: 'Conditional',
    label: 'Northern Ireland (NIMDTA)',
    group: 'Devolved nations',
    verdict: 'longshot',
    title: 'A long shot for first sitters, but resitters have a real route',
    usesGpCode: false,
    contact: 'gpspecialtytraining.nimdta@hscni.net',
    body: 'NIMDTA does not usually fund exam courses before a first attempt, though decisions are made individually, so it costs nothing to ask. If you have had an unsuccessful attempt, the SUCCESS programme funds one approved preparation course per exam at up to £750, online or in person, and its named example providers include a commercial course company.',
    quote: 'Up to £750 funding per course... Online or in-person courses',
    doc: 'NIMDTA GP specialty training study leave guidance, October 2025',
    policyUrl:
      'https://www.nimdta.gov.uk/general-practice-training/study-leave-support-and-guidance/',
    resit: {
      verdict: 'strong',
      title: 'Resitting: Complete fits inside the £750 SUCCESS funding',
      body: 'Through the SUCCESS programme you can have one approved SCA preparation course funded at up to £750, online courses included, with up to 3 days of study leave to take it. Complete at £599 fits whole. The email below asks NIMDTA to confirm approval, with the full course specification attached.',
    },
  },
  {
    id: 'unsure',
    detail: "Most English deaneries fund one SCA preparation course, typically up to £600 under GP0001. Rules differ by region, so check yours.",
    cap: 'Up to £600 · code GP0001',
    chip: 'Varies by deanery',
    label: 'Not sure yet',
    group: 'Other',
    verdict: 'local',
    title: 'Deaneries decide locally',
    usesGpCode: false,
    contact: '[your patch or scheme office]',
    body: 'Most English deaneries fund one SCA preparation course (typically up to £600, code GP0001), but each applies its own rules: some fund two, some cap at £500, some run named lists, and the devolved nations differ again. Select your deanery above for the specific position, with the policy evidence quoted.',
    quote:
      'National default: one preparation course per exam, up to £600 (GP0001)',
    doc: 'NHSE study leave policy, national overview',
    policyUrl:
      'https://www.hee.nhs.uk/our-work/doctors-training/study-budget-reforms',
  },
];

export function getDeanery(id: string): DeaneryPolicy | undefined {
  return DEANERIES.find((d) => d.id === id);
}

const EMAIL_SUBJECT = 'Study budget pre-approval: SCA preparation course';

function extraParagraph(deanery: DeaneryPolicy, hasResat: boolean): string {
  if (deanery.resit && hasResat) {
    if (deanery.id === 'ni') {
      return 'I have had a previous unsuccessful attempt at the SCA and I am engaging with the SUCCESS programme. I understand one approved preparation course per exam can be funded at up to £750, and I would like to ask whether this course can be approved for that purpose. I have discussed my exam feedback with my Educational Supervisor and this course directly addresses the areas identified.\n\n';
    }
    return 'I have had a previous unsuccessful attempt at the SCA, and I understand additional exam preparation support can be considered in this situation. I have discussed my exam feedback with my Educational Supervisor and this course directly addresses the areas identified.\n\n';
  }
  switch (deanery.id) {
    case 'nw':
      return 'Ideally I would like to confirm full funding for the course. If that is not possible, I would like to request funding up to £500, with the remainder self funded.\n\n';
    case 'ne':
      return 'I understand this could fall under the automatic approved course route or the discretionary route, and I would be grateful for confirmation of which applies and the funding available.\n\n';
    case 'scotland':
      return 'I would be grateful to confirm whether full funding is available against my training stage allocation, or alternatively part funding with the remainder self funded.\n\n';
    default:
      if (deanery.verdict === 'longshot') {
        return 'I understand exam preparation funding in this region is limited, so I am asking whether this could be considered given my circumstances, and what evidence you would need from me.\n\n';
      }
      return '';
  }
}

export function buildEmailBody(
  deanery: DeaneryPolicy,
  hasResat: boolean
): string {
  const gpCode = deanery.usesGpCode ? ', under code GP0001' : '';
  const extra = extraParagraph(deanery, hasResat);
  return (
    `Subject: ${EMAIL_SUBJECT}\n\n` +
    'Dear [name],\n\n' +
    'I am an ST3 on the [scheme name] programme preparing for the SCA. Before booking, I would like to confirm eligibility for study budget reimbursement for the following as my SCA preparation course claim' +
    gpCode +
    ':\n\n' +
    'Complete SCA Course, £599 for a fixed 3-month course term, paid once with no renewal. A structured course with 3 months of access: 8 hours of on-demand lectures, a full-day small-group coaching session (9am to 5pm, max class size 6), and consultation practice across 200 stations built from the RCGP curriculum, mapped to the three SCA marking domains. Full course specification: fourteenfisherman.com/course-spec\n\n' +
    extra +
    // The email no longer says the sender has discussed this with their ES and
    // put it on their PDP. It is a claim about something the reader may not have
    // done, in a message they are about to send under their own name to the
    // office that funds them — and neither half of it is the deanery's to be
    // told here anyway. What is left is the ask.
    'Could you confirm whether this would be approved, or let me know what else you need?\n\n' +
    'Many thanks,\n[Your name], GPST3, [Scheme]'
  );
}

export function buildMailtoUrl(
  deanery: DeaneryPolicy,
  hasResat: boolean
): string | null {
  const isRealAddress = Boolean(deanery.contact) && !deanery.contact!.startsWith('[');
  if (!isRealAddress) return null;
  const bodyWithoutSubjectLine = buildEmailBody(deanery, hasResat)
    .split('\n')
    .slice(2)
    .join('\n');
  return `mailto:${deanery.contact}?subject=${encodeURIComponent(
    EMAIL_SUBJECT
  )}&body=${encodeURIComponent(bodyWithoutSubjectLine)}`;
}
