import type { Metadata } from 'next';
import Link from 'next/link';
import PrintButton from './PrintButton';

// Approver-facing course specification. The study budget checker's
// pre-approval emails link to fourteenfisherman.com/course-spec verbatim, so
// this route must stay stable. Deliberately unlinked from the main
// navigation: its job is to receive TPDs and study leave teams, not to sell.

export const metadata: Metadata = {
  title: 'Complete SCA Course — Course Specification | Fourteen Fisherman',
  description:
    'Course specification for the Complete SCA Course: a structured MRCGP SCA preparation course with 3 months of access. For Training Programme Directors, Educational Supervisors and study leave teams assessing a study budget application.',
};

const APPROVER_EMAIL = 'education@fourteenfisherman.com';

const SUMMARY_ROWS: ReadonlyArray<readonly [string, string]> = [
  ['Course title', 'Complete SCA Course'],
  ['Provider', 'Fourteen Fisherman, operated by Phenolabs Limited (UK)'],
  [
    'Course type',
    'Structured exam preparation course for the MRCGP Simulated Consultation Assessment (SCA)',
  ],
  [
    'Format',
    'Fully remote. On-demand lectures and one full-day live small-group coaching session, with structured consultation practice throughout',
  ],
  [
    'Duration',
    "3 months' access from the date of purchase. Purchases made before the course opens on 1 September 2026 begin on 1 September 2026",
  ],
  [
    'Coaching day',
    'One full day, 9am to 6pm, live and remote, on a published Saturday or Sunday date chosen by the trainee at booking',
  ],
  [
    'Taught content',
    '21 hours: 12 hours of recorded lectures available on demand, and 9 hours of live coaching in a single full-day session (maximum class size of 6)',
  ],
  ['Fee', '£599, one-off. No subscription, no renewal, no additional costs'],
  [
    'Certificate',
    'Certificate of completion issued to every trainee at the end of the course',
  ],
];

const DOMAINS: ReadonlyArray<readonly [string, string]> = [
  [
    'Data gathering, technical and assessment skills',
    'focused history taking, targeted questioning and structured information gathering, practised across the case library and coached in mock stations.',
  ],
  [
    'Clinical management skills',
    'safe, evidence-based management planning, safety netting and follow-up, taught in the lectures and assessed in every practice case.',
  ],
  [
    'Relating to others',
    'patient-centred communication, shared decision making and handling challenging dynamics, developed through repeated consultation practice with structured feedback.',
  ],
];

const FAQS: ReadonlyArray<readonly [string, string]> = [
  [
    'Who delivers the lectures and coaching?',
    'The lectures and coaching are delivered by an experienced GP educator involved in building the course and its case library. Coaching runs in classes of no more than 6 to keep feedback individual.',
  ],
  [
    'What happens if a trainee misses their coaching day?',
    'The lectures are on demand, so there is nothing to miss there. The coaching day runs live; where a trainee cannot attend their chosen date, we try to place them on another published coaching day where space allows.',
  ],
  [
    'Is any real exam content used?',
    'No. All content is built from the published RCGP curriculum and the publicly documented SCA assessment framework.',
  ],
  [
    "Can you verify a trainee's enrolment or completion?",
    'Yes. We confirm enrolment, attendance and completion in writing on request from a deanery, programme office or supervisor.',
  ],
  [
    'Who is the provider?',
    'Fourteen Fisherman is a UK medical education platform operated by Phenolabs Limited. Our portfolio tools are already used by a significant proportion of GP trainees across the UK.',
  ],
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-10 text-lg font-semibold text-heading first:mt-0 sm:text-xl">
      {children}
    </h2>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-sm leading-relaxed text-body sm:text-[15px]">
      {children}
    </p>
  );
}

function ApproverEmailLink() {
  return (
    <a href={`mailto:${APPROVER_EMAIL}`} className="text-[#854F0B] underline">
      {APPROVER_EMAIL}
    </a>
  );
}

export default function CourseSpecPage() {
  return (
    <div className="min-h-[100dvh] bg-[#F7F2E7] font-sans print:bg-white">
      <header className="border-b border-[#d9cdb3]/60 px-5 py-4 print:hidden sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-heading">
            Fourteen Fisherman
          </Link>
          <a
            href={`mailto:${APPROVER_EMAIL}`}
            className="text-[13px] text-stone-500 transition-colors hover:text-heading"
          >
            {APPROVER_EMAIL}
          </a>
        </div>
      </header>

      <main className="px-5 py-8 sm:px-8 sm:py-12 print:p-0">
        <article className="mx-auto max-w-3xl rounded-2xl border border-[#E4DDC9] bg-white p-6 shadow-elevation-1 sm:p-12 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <h1 className="text-xl font-semibold leading-snug text-heading sm:text-3xl">
            Complete SCA Course: course specification
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-body sm:text-[15px]">
            For Training Programme Directors, Educational Supervisors and study
            leave teams. This page contains everything needed to assess a study
            budget application for this course. Questions are welcome at{' '}
            <ApproverEmailLink />.
          </p>
          <div className="mt-5">
            <PrintButton />
          </div>

          <SectionHeading>Course summary</SectionHeading>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm sm:text-[15px]">
              <tbody>
                {SUMMARY_ROWS.map(([label, value]) => (
                  <tr key={label} className="border-t border-[#E4DDC9]">
                    <th
                      scope="row"
                      className="w-40 py-2.5 pr-4 text-left align-top font-medium text-heading sm:w-48"
                    >
                      {label}
                    </th>
                    <td className="py-2.5 align-top leading-relaxed text-body">
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SectionHeading>What the fee includes</SectionHeading>
          <Paragraph>
            The £599 fee covers the full course: all 12 hours of on-demand
            lectures, the full-day small-group coaching session, unlimited
            consultation practice across the full case library for the 3-month
            access period, personalised feedback, and the completion
            certificate. Access to the practice platform is included as part of
            the course cost for the course period. There are no further charges
            of any kind.
          </Paragraph>

          <SectionHeading>Course structure</SectionHeading>
          <Paragraph>
            <strong className="font-semibold text-heading">
              On-demand lectures: 12 hours.
            </strong>{' '}
            A structured lecture series delivered by an experienced GP
            educator, available on demand throughout the trainee&apos;s access
            period and watchable as often as needed. The lectures cover
            consultation frameworks, time management, how each SCA marking
            domain is assessed, common reasons candidates fail and how to avoid
            them, and difficult consultation types including breaking bad news,
            negotiation and third-party consultations.
          </Paragraph>
          <Paragraph>
            <strong className="font-semibold text-heading">
              Small-group coaching: one full day, 9 hours.
            </strong>{' '}
            A single full-day live session, 9am to 6pm, in a class of no more
            than 6 trainees, on a published weekend date chosen at booking. The
            day runs 12 full timed mock stations — each trainee consults 2
            themselves, live with the tutor — with structured feedback on how
            each consultation would be assessed against the three marking
            domains and what to improve, alongside focused teaching blocks on
            exam technique. Trainees also learn from observing and debriefing
            their peers&apos; stations.
          </Paragraph>
          <Paragraph>
            <strong className="font-semibold text-heading">
              Structured consultation practice: throughout.
            </strong>{' '}
            Unlimited voice consultation practice across 200 cases built
            directly from the RCGP curriculum, available for the full access
            period. Every case is scored across the three official SCA marking
            domains, with personalised feedback mapped to each domain after
            every attempt.
          </Paragraph>

          <SectionHeading>Alignment with the RCGP curriculum</SectionHeading>
          <Paragraph>
            All 200 cases are built from the published RCGP curriculum, and
            every element of the course is organised around the three official
            SCA marking domains:
          </Paragraph>
          <ul className="mb-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-body sm:text-[15px]">
            {DOMAINS.map(([domain, detail]) => (
              <li key={domain}>
                <strong className="font-semibold text-heading">
                  {domain}
                </strong>
                : {detail}
              </li>
            ))}
          </ul>
          <Paragraph>
            The course contains no real or past examination material. It is an
            independent preparation course built from the publicly available
            RCGP curriculum and assessment framework.
          </Paragraph>

          <SectionHeading>Why this is a course, not a subscription</SectionHeading>
          <Paragraph>
            Several deanery policies distinguish courses from subscriptions, so
            for clarity: the Complete SCA Course has a defined syllabus, 21
            hours of structured taught content, a scheduled live coaching day
            with a maximum class size, a fixed 3-month access period, and a
            certificate of completion. The fee is a one-off course fee, not a
            recurring payment, and there is no auto-renewal. Practice platform
            access is included as part of the course cost for the duration of
            the course, in the same way course materials are included in a
            taught course fee.
          </Paragraph>

          <SectionHeading>Study leave impact</SectionHeading>
          <Paragraph>
            The lectures are on demand and the coaching day runs at a weekend,
            so the course typically requires no time away from clinical duties
            and no rota adjustment. For most trainees this is a funding-only
            application rather than a request for study leave time. Where a
            trainee wishes to apply for study leave time for online learning,
            we provide the indicative course hours above and can confirm the
            trainee&apos;s coaching day date in writing.
          </Paragraph>

          <SectionHeading>Documentation provided</SectionHeading>
          <Paragraph>Every enrolled trainee receives, as standard:</Paragraph>
          <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-body sm:text-[15px]">
            <li>
              An itemised invoice in the trainee&apos;s own name, stating the
              course title, coaching day date and the one-off fee, issued by
              Phenolabs Limited.
            </li>
            <li>
              This course specification, for attachment to funding and PDP
              documentation.
            </li>
            <li>
              A certificate of completion at the end of the course, confirming
              participation across the lectures, coaching and consultation
              practice components.
            </li>
          </ol>

          <SectionHeading>Fee and funding</SectionHeading>
          <Paragraph>
            The course fee is £599, one-off. This sits within the £600 exam
            preparation course allowances operated by several NHS England
            regions, and within typical study leave budgets elsewhere in the
            UK. We are happy to confirm any detail of this specification
            directly to a study leave team, TPD or patch office:{' '}
            <ApproverEmailLink />.
          </Paragraph>

          <SectionHeading>Frequently asked questions from approvers</SectionHeading>
          <dl className="space-y-4">
            {FAQS.map(([question, answer]) => (
              <div key={question}>
                <dt className="mb-1 text-sm font-semibold text-heading sm:text-[15px]">
                  {question}
                </dt>
                <dd className="text-sm leading-relaxed text-body sm:text-[15px]">
                  {answer}
                </dd>
              </div>
            ))}
          </dl>

          <footer className="mt-10 border-t border-[#E4DDC9] pt-5 text-xs leading-relaxed text-muted">
            Complete SCA Course, Fourteen Fisherman, operated by Phenolabs
            Limited. This specification is current as of July 2026. For
            approver enquiries: <ApproverEmailLink />.
          </footer>
        </article>
      </main>
    </div>
  );
}
