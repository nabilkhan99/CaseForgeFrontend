// GENERATED from study-budget-articles-FINAL.md — do not hand-edit.
// Regenerate with scratchpad/parse_sb.py when the master copy changes.

export interface StudyBudgetFaq {
  q: string;
  a: string;
}

export interface StudyBudgetSource {
  label: string;
  href: string;
}

export interface StudyBudgetArticle {
  /** Full path, e.g. "/study-budget/london/". */
  slug: string;
  /** <title> — includes the year suffix. */
  title: string;
  metaDescription: string;
  h1: string;
  /** "Correct as of July 2026 · Reviewed by a GP educator" */
  dateline: string;
  /** Article prose as markdown; rendered to semantic HTML at build time. */
  body: string;
  faq: StudyBudgetFaq[];
  /** Closing pricing paragraph, rendered as a distinct block. */
  cta: string;
  sources: StudyBudgetSource[];
}

export const STUDY_BUDGET_ARTICLES: StudyBudgetArticle[] = [
  {
    "slug": "/study-budget/",
    "title": "GP trainee study budget: how much you get and what it covers, by deanery (2026)",
    "metaDescription": "How much study budget GP trainees get in every UK deanery, whether it covers SCA prep courses, and how to claim. Verified against current policy documents, July 2026.",
    "h1": "GP trainee study budget: how much you get and what it covers, by deanery",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "Every GP trainee in the UK has access to study leave funding, but how much you get, and whether it will pay for an SCA preparation course, depends entirely on where you train. Some deaneries publish a clean per-course cap. Some have no cap at all. Some will only fund you after a failed attempt. This guide summarises the current position in every deanery, verified against each region's published policy, with a dedicated page for each one.\n\n## The short version\n\nMost of NHS England will fund one SCA preparation course per trainee. Policies differ in what they will fund and how they describe it, and approval sits with your deanery. Check your region's wording, and get prospective approval before you book.\n\n## Deanery by deanery\n\n**London**: up to £600 for one SCA preparation course, claimed under code GP0001. See the [London guide](/study-budget/london/).\n\n**Kent, Surrey and Sussex**: up to £600 for one SCA preparation course per sitting, code GP0001. See the [KSS guide](/study-budget/kss/).\n\n**East of England**: no fixed allocation; exam preparation courses are approved as aspirational activities with TPD sign off, one SCA course per training programme. See the [East of England guide](/study-budget/east-of-england/).\n\n**Thames Valley and Wessex**: one SCA course in ST3, ideally RCGP accredited, with regional courses prioritised first. See the [Thames Valley guide](/study-budget/thames-valley/) and [Wessex guide](/study-budget/wessex/).\n\n**Midlands (East and West)**: guidance of two SCA courses over the whole of training, RCGP accredited preferred, no stated per-course cap. See the [East Midlands guide](/study-budget/east-midlands/) and [West Midlands guide](/study-budget/west-midlands/).\n\n**North West**: one RCGP-provided or accredited SCA course up to £500; non-accredited courses considered up to £500 with prior approval. See the [North West guide](/study-budget/north-west/).\n\n**Yorkshire and Humber**: one SCA course per exam attempt from a named approved list. See the [Yorkshire and Humber guide](/study-budget/yorkshire-humber/).\n\n**North East**: one RCGP-provided or accredited SCA course or educational package, automatically approved; other courses are discretionary with 50% self-funding expected. See the [North East guide](/study-budget/north-east/).\n\n**South West (Severn and Peninsula)**: detailed funding guidance pending publication; prospective approval essential. See the [South West guide](/study-budget/south-west/).\n\n**Scotland**: a nominal £600 per registrar per training year, individual course fees fundable, subscriptions not. See the [Scotland guide](/study-budget/scotland/).\n\n**Wales**: £600 per training year with unused budget rolling over once, to a maximum of £1,200. See the [Wales guide](/study-budget/wales/).\n\n**Northern Ireland**: exam preparation courses are funded only through the SUCCESS programme after an unsuccessful attempt, up to £750 per course. See the [Northern Ireland guide](/study-budget/northern-ireland/).\n\n## Is the SCA exam fee itself covered?\n\nSeparately from the study budget: under the June 2026 resident doctor contract agreement, doctors in England are entitled to reimbursement of their first two SCA attempts for exams sat from 1 April 2026, claimed through the employing trust. The study budget covers preparation; the contract agreement covers the exam fee. Full details in [Is the SCA exam fee reimbursed?](/study-budget/sca-exam-fee-reimbursement/).\n\n## How to use this money well\n\nThree rules hold everywhere. First, get approval before you book: several deaneries automatically reject claims paid before approval. Second, check your regional free courses first: some deaneries will decline funding where an in-house equivalent exists. Third, describe clearly what you are buying and how it prepares you for the exam, so your deanery can assess it against its own policy.\n\nOne point on RCGP accreditation, since several deaneries prefer or specify it. \"Ideally RCGP accredited\" and \"RCGP provided or accredited\" are the common phrasings, and in most regions this is a preference rather than an absolute requirement, so non-accredited courses remain fundable. RCGP-accredited courses also have a limited number of places and run to a fixed timetable. Where an accredited course cannot take you before your sitting, that limited availability is a legitimate, practical basis to request a non-accredited alternative, and the North West policy names it explicitly as a ground. If you go this route, tell your TPD which accredited course you tried, note that its places or dates did not fit your exam, and frame the alternative as the same curriculum requirement.",
    "faq": [
      {
        "q": "How much study budget does a GP trainee get?",
        "a": "It varies by deanery. London, KSS, Scotland and Wales publish £600 figures; the Midlands and North East publish no individual cap; Northern Ireland funds exam preparation only after a failed attempt."
      },
      {
        "q": "Can I use my study budget for an SCA course?",
        "a": "In most of NHS England, yes, typically one SCA preparation course per trainee, subject to your deanery's approval process. Check your deanery's page for the exact rule."
      },
      {
        "q": "Does the study budget cover the SCA exam fee?",
        "a": "No. Exam fees are excluded from study budgets everywhere. In England the first two attempts are now reimbursed separately under the June 2026 contract agreement for exams sat from 1 April 2026."
      },
      {
        "q": "Do subscriptions count?",
        "a": "It depends on your deanery's policy and its approval process. Check your regional guide and ask your study leave team before booking."
      }
    ],
    "cta": "If you are weighing up SCA courses that fit inside these budgets: our Complete programme (£599) combines unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching, structured as a course. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": []
  },
  {
    "slug": "/study-budget/london/",
    "title": "London GP study budget: what it covers for the SCA (2026)",
    "metaDescription": "London GP trainees can claim up to £600 for one SCA preparation course under code GP0001. What qualifies, what does not, and how to claim. Correct as of July 2026.",
    "h1": "London GP study budget: what it covers for the SCA",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nLondon GP trainees can claim up to £600 towards one SCA preparation course, using budget code GP0001. One course per exam is allowed, with your Educational Supervisor's agreement, and the £600 cap was set deliberately to sit at the upper end of what most courses charge. Question bank resources can be funded too, but they count as your single exam preparation claim.\n\n## How much you get\n\nLondon's optional funding arrangement allows, per trainee: one AKT preparation course and one SCA preparation course, each \"up to a maximum of £600\" and each claimed \"using code GP0001\" (NHS England London and South East GP exam preparation FAQ, and the General Practice approved study leave list, September 2025). The approved course list states the same rule from the other direction: \"Max £600 per AKT or RCA/SCA preparation course\", listed as an external supporting activity available at every training stage (London approved study leave list, September 2025).\n\nNHS England in London does not maintain a list of preferred providers. The guidance is explicit that they \"do not distinguish between providers\"; the cap exists because course fees vary widely. FourteenFish packages are given as an example of a claimable SCA preparation product, which confirms that online-delivered preparation qualifies when it is framed as a course or package rather than a bare subscription.\n\n## Does it cover SCA prep courses?\n\nYes, directly and by name. This is one of the cleanest positions in the country: one SCA preparation course, up to £600, code GP0001, ES agreement. Two wrinkles worth knowing. First, question bank and resource claims count as your one course: the London and South East FAQ states \"Question bank resources can be funded but these would count as a single exam preparation course\", and that if you have already funded another preparation course you would need to apply for any additional resources through the discretionary study leave process. Subscriptions are not usually funded. Second, if you are struggling with exams, the Professional Support Unit runs free AKT and SCA workshops including 1:1 SCA preparation, and additional external courses can be funded on individual need with TPD and Head of School approval.\n\n## Is the SCA exam fee itself reimbursed?\n\nNot from the study budget. Separately, under the June 2026 resident doctor contract agreement, doctors in England are entitled to reimbursement of their first two SCA attempts for exams sat from 1 April 2026, paid upfront and claimed through your employing trust. Details: [Is the SCA exam fee reimbursed?](/study-budget/sca-exam-fee-reimbursement/).\n\n## How to claim\n\n1. Agree the course with your Educational Supervisor and record it in your PDP.\n2. Apply prospectively through the study leave process before booking, quoting code GP0001.\n3. Pay, then claim reimbursement with your receipt. Travel to exams is claimed separately under TRAC0001 (exam fees themselves are excluded).",
    "faq": [
      {
        "q": "What is code GP0001?",
        "a": "The London and KSS approved-list code for exam preparation courses, capped at £600 per AKT or SCA course. See [GP0001 explained](/study-budget/gp0001-explained/)."
      },
      {
        "q": "Can I claim a second SCA course after a failed attempt?",
        "a": "The standard allowance is one per sitting, and the PSU route plus discretionary funding exists for trainees having difficulty. Discuss with your TPD."
      },
      {
        "q": "Do online SCA courses qualify?",
        "a": "Yes. London funds online preparation packages and names FourteenFish as an example; the £600 cap is the operative constraint, not the delivery format."
      }
    ],
    "cta": "If you are looking at SCA courses inside the £600 London budget: our Complete programme (£599) combines unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching, structured as a course and priced to sit within the GP0001 cap. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": [
      {
        "label": "General Practice approved study leave list (Sept 2025)",
        "href": "/study-budget/sources/london-approved-study-leave-list-sept-2025.pdf"
      },
      {
        "label": "NHS England London & South East GP exam preparation FAQ",
        "href": "https://lasepgmdesupport.hee.nhs.uk/support/solutions/articles/7000069786-i-am-a-gp-trainee-which-exam-preparation-courses-can-i-claim-for-"
      }
    ]
  },
  {
    "slug": "/study-budget/kss/",
    "title": "KSS GP study budget: what it covers for the SCA (2026)",
    "metaDescription": "KSS GP trainees can claim up to £600 for one SCA preparation course per sitting under code GP0001. The rules, the exclusions, and how to claim. Correct as of July 2026.",
    "h1": "KSS GP study budget: what it covers for the SCA",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nGP trainees in Kent, Surrey and Sussex can claim up to £600 towards an SCA preparation course under code GP0001, with a maximum of one course per sitting. The claim is an external supporting activity, which means it needs supervisor sign off but is an expected part of the approved list rather than a discretionary ask.\n\n## How much you get\n\nThe KSS approved list allows \"Exam preparation course relevant to level of training (max 1 per sitting)\" at \"Max £600 per AKT or RCA/SCA preparation course\", code GP0001, available across ST1 to ST3 (KSS General Practice approved list, revised March 2026). The list also notes free internal AKT revision via the PSU in London (code GP0017), worth exhausting before spending your budget on AKT so the paid claim goes where you need it most.\n\nThe list explicitly states it \"is not intended to be restrictive\": activities not on it go through the discretionary approval process rather than being refused outright.\n\n## Does it cover SCA prep courses?\n\nYes, by name and with a per-sitting allowance, which is more forgiving than deaneries that allow one course across the whole of training. The South East framework classifies activities as essential, supporting or aspirational; exam preparation sits in supporting, which takes priority over aspirational requests when budgets tighten.\n\n## Is the SCA exam fee itself reimbursed?\n\nNot from the study budget: travel and accommodation to attend exams is claimable under TRAC0001, but the list is explicit that this covers \"no exam fees\". Separately, under the June 2026 resident doctor contract agreement, doctors in England can reclaim their first two SCA attempts for exams sat from 1 April 2026, through their employing trust. Details: [Is the SCA exam fee reimbursed?](/study-budget/sca-exam-fee-reimbursement/).\n\n## How to claim\n\n1. Discuss with your Educational Supervisor and add the course to your PDP.\n2. Follow the South East study leave application process for resident doctors (in force from 1 April 2026) and get approval before booking.\n3. Claim reimbursement with receipts after attending, quoting GP0001.",
    "faq": [
      {
        "q": "How many SCA courses can I claim in KSS?",
        "a": "One per sitting, up to £600 each."
      },
      {
        "q": "Does a course have to be on the approved list?",
        "a": "The list facilitates local sign off; career-enhancing activities not on it can still go through discretionary approval."
      },
      {
        "q": "Are online courses eligible?",
        "a": "The list does not restrict delivery format; the constraints are the £600 cap, the one-per-sitting rule, and prior approval."
      }
    ],
    "cta": "If you are looking at SCA courses inside the £600 KSS budget: our Complete programme (£599) combines unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching, structured as a course and priced to sit within the cap. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": [
      {
        "label": "KSS General Practice approved list (March 2026)",
        "href": "/study-budget/sources/kss-gp-approved-list-march-2026.pdf"
      }
    ]
  },
  {
    "slug": "/study-budget/east-of-england/",
    "title": "East of England GP study budget: what it covers for the SCA (2026)",
    "metaDescription": "East of England funds one SCA preparation course per trainee with TPD sign off, and prioritises its free regional courses. How the aspirational route works. Correct as of July 2026.",
    "h1": "East of England GP study budget: what it covers for the SCA",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nEast of England will reimburse one SCA preparation course per trainee across the whole of training, approved as an aspirational activity with TPD sign off. There is no fixed personal allocation: the school funds free regional exam courses first and expects you to check those before booking anything commercial, and warns that expensive commercial packages are generally not reimbursed.\n\n## How much you get\n\nThe school's FAQ is direct: \"There is no longer a nominal 'allocation' of funding per training year\" (NHSE EoE GP study leave FAQs). Requests are split by value and type: curriculum requirements under £600 need ES sign off, over £600 need TPD sign off, and \"Aspirational Activities (To include Exam Preparation Courses)\" need TPD sign off plus a PDP entry. Exam preparation always takes the TPD route regardless of price.\n\nThe allowance itself: \"a maximum of 1 AKT preparation course/resource claim and 1 CSA/RCA preparation course/resource claim throughout the course of their training\", including travel and subsistence. Audiobooks and podcasts are not usually eligible, though packages from a recognised exam preparation provider may be approved and count as the one claim. Books and exam fees are not funded.\n\n## Does it cover SCA prep courses?\n\nYes, one per training programme, but with two real constraints. First, regional courses come first: the school runs free accredited SCA preparation days and expects trainees to book those \"in the first instance\"; external courses are approved where attending the regional offer was not possible. Second, the school states that \"more expensive commercial packages\" will generally not be reimbursed \"apart from in exceptional circumstances\". In practice this rewards courses priced modestly and framed tightly around the RCGP curriculum, and punishes four-figure packages. Get written TPD approval before paying for anything.\n\nNote for the diligent: the standing EoE guidance document dates from October 2020 and still references the CSA; the website FAQs are the live articulation of the policy. If your TPD quotes different rules, ask which version they are working from.\n\n## Is the SCA exam fee itself reimbursed?\n\nNot from the study budget. Separately, under the June 2026 resident doctor contract agreement, doctors in England can reclaim their first two SCA attempts for exams sat from 1 April 2026, through their employing trust. Details: [Is the SCA exam fee reimbursed?](/study-budget/sca-exam-fee-reimbursement/).\n\n## How to claim\n\n1. Check the regional course list and the monthly newsletter first (england.primarycare.eoe@nhs.net for queries).\n2. Add the course to your PDP with ES agreement, then complete Part B of the Study Leave Application and Claim Form for TPD sign off, before booking.\n3. Overseas activity needs submission to studyleave.eoe@hee.nhs.uk at least 6 weeks ahead; domestic requests should still go in well in advance.",
    "faq": [
      {
        "q": "Is there a £600 limit in East of England?",
        "a": "£600 is the approval threshold that decides who signs off, not a hard cap; exam preparation courses need TPD sign off at any price, and value for money is assessed case by case."
      },
      {
        "q": "Can I claim if I skipped the free regional SCA day?",
        "a": "The school expects regional courses to be used first; external approval is framed around cases where attending the regional offer was not possible. Speak to your TPD before assuming."
      },
      {
        "q": "How many SCA courses in total?",
        "a": "One SCA preparation course or resource claim across your whole training programme. Additional courses only in exceptional circumstances, discussed with your TPD."
      }
    ],
    "cta": "If you are looking at SCA courses to put to your TPD: our Complete programme (£599) combines unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching, structured as a course, priced under the £600 ES-approval threshold that EoE uses to grade requests. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": [
      {
        "label": "NHSE East of England GP study leave FAQs",
        "href": "https://heeoe.hee.nhs.uk/general_practice/gp-study-leave"
      },
      {
        "label": "EoE GP TPD study leave guidance (Oct 2020)",
        "href": "/study-budget/sources/east-of-england-tpd-guidance-oct-2020.pdf"
      }
    ]
  },
  {
    "slug": "/study-budget/thames-valley/",
    "title": "Thames Valley GP study budget: what it covers for the SCA (2026)",
    "metaDescription": "Thames Valley funds one SCA course in ST3, ideally RCGP accredited, with regional courses prioritised first. What qualifies and how to claim. Correct as of July 2026.",
    "h1": "Thames Valley GP study budget: what it covers for the SCA",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nThames Valley (under the joint Thames Valley and Wessex GP School policy) treats an SCA course as a green, automatically fundable curriculum requirement: one per resident doctor, taken in ST3, ideally RCGP accredited. The school steers trainees to its regionally funded courses first and warns that expensive commercial packages are generally not reimbursed, so prospective approval matters more here than the headline entitlement suggests.\n\n## How much you get\n\nThe policy's green list of automatically funded courses includes \"SCA course ST3 *Ideally RCGP accredited. 1 per GP resident doctor for ST3 year\" (Study leave for GP resident doctors, Thames Valley and Wessex GP School, March 2026). No per-course cash cap is published. The FAQ sets the entitlement across training: \"a maximum of 1 AKT preparation course/resource claim and 1 CSA/RCA preparation course/resource claim throughout the course of their training programme\".\n\nTwo funding realities sit alongside that. The school asks trainees to \"book onto our regionally funded courses in the first instance\", approving other courses where attending the funded regional offer was not possible. And it flags that \"more expensive commercial packages\" will in general not be reimbursed \"apart from in exceptional circumstances\".\n\n## Does it cover SCA prep courses?\n\nYes, as a curriculum-level entitlement rather than a discretionary favour, which is a strong position. The accreditation wording matters: \"ideally RCGP accredited\" is a preference, not a requirement, so non-accredited courses are claimable, but an accredited course faces less friction. This preference is worth reading alongside the FAQ, which approves other courses where it was not possible to attend the funded regional offer. RCGP-accredited courses have a limited number of places and run to a fixed timetable, so if an accredited course cannot take you before your sitting, that is a legitimate, practical basis to put a non-accredited course to your TPD: name the accredited option you tried, note that its places or dates did not fit your exam date, and frame the alternative as the same curriculum requirement. On subscriptions the policy is precise: annual or monthly subscriptions are not included, however \"if as part of the course cost a subscription package for year is included, that is acceptable\". A course that bundles ongoing access qualifies; a bare subscription does not.\n\nThe policy notes national study leave guidance is expected, at which point this document will be updated: worth rechecking before a claim late in 2026.\n\n## Is the SCA exam fee itself reimbursed?\n\nNot from the study budget: leave for the exam day comes from your study leave allowance, but the fee is separate. Under the June 2026 resident doctor contract agreement, doctors in England can reclaim their first two SCA attempts for exams sat from 1 April 2026, through their employing trust. Details: [Is the SCA exam fee reimbursed?](/study-budget/sca-exam-fee-reimbursement/).\n\n## How to claim\n\n1. Check the regional TV and Wessex exam course offer first.\n2. Get the course on your PDP with ES approval, then apply through the South East study leave process (the Thames Valley resident doctor flowchart, June 2026, sets out the steps) before booking or paying.\n3. Claim with receipts after attending.",
    "faq": [
      {
        "q": "Is there a cash cap in Thames Valley?",
        "a": "No published per-course cap; the constraints are one SCA course per training programme, the regional-first expectation, and the general warning against expensive commercial packages."
      },
      {
        "q": "Does my SCA course need to be RCGP accredited?",
        "a": "Ideally, per the policy wording. Accreditation smooths approval; it is not an absolute requirement."
      },
      {
        "q": "Can I claim a subscription?",
        "a": "Not on its own. A yearly access package bundled within a course fee is explicitly acceptable."
      }
    ],
    "cta": "If you are comparing SCA courses to put through the Thames Valley process: our Complete programme (£599) combines unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching, structured and priced as a course rather than a commercial mega-package. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": [
      {
        "label": "Thames Valley & Wessex GP School study leave policy (March 2026)",
        "href": "/study-budget/sources/thames-valley-wessex-study-leave-march-2026.pdf"
      }
    ]
  },
  {
    "slug": "/study-budget/wessex/",
    "title": "Wessex GP study budget: what it covers for the SCA (2026)",
    "metaDescription": "Wessex funds one SCA course in ST3 under the joint TV and Wessex policy, ideally RCGP accredited, regional courses first. The rules and how to claim. Correct as of July 2026.",
    "h1": "Wessex GP study budget: what it covers for the SCA",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nWessex shares a single GP School study leave policy with Thames Valley. An SCA course in ST3 is a green, automatically fundable curriculum requirement, one per resident doctor, ideally RCGP accredited, with the school's own regionally funded courses taking priority and expensive commercial packages generally excluded.\n\n## How much you get\n\nThe joint policy's automatic funding list includes \"SCA course ST3 *Ideally RCGP accredited. 1 per GP resident doctor for ST3 year\" (Study leave for GP resident doctors, Thames Valley and Wessex GP School, March 2026). Across the whole of training the entitlement is one AKT and one SCA preparation course or resource claim. No cash cap is published, but the school explicitly warns that expensive commercial packages will not in general be reimbursed outside exceptional circumstances, and asks trainees to book regionally funded courses first.\n\nThe South East framework classifies activities as essential, supporting or aspirational, with essential and supporting activities taking priority as budgets are finite.\n\n## Does it cover SCA prep courses?\n\nYes, at curriculum level. The practical guidance is the same as Thames Valley: prefer an RCGP-accredited or modestly priced course, secure approval before paying, and remember subscriptions are only claimable when bundled inside a course fee. The \"ideally RCGP accredited\" wording is a preference, not a hard rule. Because accredited courses have limited places and set dates, a non-accredited course can be put forward where an accredited one cannot take you in time: cite the accredited option you tried, explain that its capacity or timing did not fit your sitting, and present the alternative as the same curriculum requirement. GP resident doctors are also reminded there is free, evidence-based deanery exam support that the school expects trainees to engage with.\n\n## Is the SCA exam fee itself reimbursed?\n\nNot from the study budget. Under the June 2026 resident doctor contract agreement, doctors in England can reclaim their first two SCA attempts for exams sat from 1 April 2026, through their employing trust. Details: [Is the SCA exam fee reimbursed?](/study-budget/sca-exam-fee-reimbursement/).\n\n## How to claim\n\n1. Check the TV and Wessex regional exam course offer first.\n2. PDP entry with ES approval, then prospective application through the South East study leave process before booking.\n3. Reimbursement with receipts after the course.",
    "faq": [
      {
        "q": "Is Wessex's policy different from Thames Valley's?",
        "a": "No: one joint Thames Valley and Wessex GP School policy covers both."
      },
      {
        "q": "How many SCA courses can I claim?",
        "a": "One SCA preparation course or resource claim across your training programme."
      },
      {
        "q": "What happens if I book before approval?",
        "a": "You risk funding it yourself. Approval first, booking second."
      }
    ],
    "cta": "If you are shortlisting SCA courses for the Wessex process: our Complete programme (£599) combines unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching, structured and priced as a course. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": [
      {
        "label": "Thames Valley & Wessex GP School study leave policy (March 2026)",
        "href": "/study-budget/sources/thames-valley-wessex-study-leave-march-2026.pdf"
      }
    ]
  },
  {
    "slug": "/study-budget/east-midlands/",
    "title": "East Midlands GP study budget: what it covers for the SCA (2026)",
    "metaDescription": "East Midlands (Midlands GP Schools policy) guides two SCA courses over training, RCGP accredited preferred, no per-course cap. How to claim. Correct as of July 2026.",
    "h1": "East Midlands GP study budget: what it covers for the SCA",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nEast Midlands trainees come under the Midlands GP Schools study leave guidance, which is one of the most generous SCA positions in the country. SCA courses sit in the mandatory, ES-approved category, with guidance of two courses across the whole of training and RCGP-accredited courses preferred. There is no published per-course cash cap; the only threshold is £1,000, above which an extra TPD sign off kicks in.\n\n## How much you get\n\nThe May 2026 Midlands guidance places SCA courses in Category I, mandatory curriculum-based activity requiring only ES approval, with the note: \"Guidance of two courses over whole of training & RCGP accredited courses are preferred\" (Midlands GP Schools Study Leave Guidance, current version May 2026). The document was revised specifically to clarify \"no limitations to funding\" in the categories section.\n\nThere is no per-course cap. The relevant number is a threshold, not a limit: \"if the total cost associated with any single claim exceeds £1,000, including all course fees, travel, and subsistence expenses, additional TPD authorisation will be required. Note this is not a limit but a threshold for further approval.\" Named Fourteen Fish SCA and AKT packages appear in the same green category list as fundable items.\n\n## Does it cover SCA prep courses?\n\nYes, and generously: two courses' worth of guidance across training, ES sign off only for a standard claim, accredited preferred but not mandatory, and no cash ceiling short of the £1,000 extra-approval threshold. \"Preferred\" is the operative word: a non-accredited course is fundable, and because RCGP-accredited courses have limited places and fixed dates, an accredited course being full or badly timed for your sitting is a reasonable basis to request an alternative. Note that reason in your PDP entry when you apply. On subscriptions the Midlands not-funded list excludes \"Subscriptions to journals (paper or online)\" and \"Software subscriptions\", so check how your claim is described and confirm the position with your TPD before booking.\n\n## Is the SCA exam fee itself reimbursed?\n\nNot from the study budget: the Midlands not-funded list names \"Examination fees\" explicitly. Separately, under the June 2026 resident doctor contract agreement, doctors in England can reclaim their first two SCA attempts for exams sat from 1 April 2026, through their employing trust. Details: [Is the SCA exam fee reimbursed?](/study-budget/sca-exam-fee-reimbursement/).\n\n## How to claim\n\n1. Add the course to your PDP with a clear rationale and ES approval (Category I needs ES sign off).\n2. Apply through the regional Accent system at least 6 weeks before the course, with a full cost breakdown.\n3. Online and virtual courses are explicitly welcomed and considered on the same basis as in-person ones. Claims cannot be retrospective, so approval must precede booking.",
    "faq": [
      {
        "q": "Is there a cap on SCA course funding in East Midlands?",
        "a": "No per-course cap. Guidance of two courses over training; only claims over £1,000 total need extra TPD authorisation."
      },
      {
        "q": "Do I need TPD approval?",
        "a": "Not for a standard SCA course claim: Category I needs only ES approval. TPD authorisation is added above the £1,000 total-cost threshold."
      },
      {
        "q": "Are online SCA courses funded?",
        "a": "Yes. The policy states online and virtual learning is considered on the same basis as in-person courses."
      }
    ],
    "cta": "If you are choosing an SCA course to put on your PDP: our Complete programme (£599) combines unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching, structured as a course and sitting well under the £1,000 threshold that would trigger extra approval. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": [
      {
        "label": "Midlands GP Schools study leave guidance (May 2026)",
        "href": "/study-budget/sources/midlands-gp-schools-study-leave-guidance-may-2026.pdf"
      }
    ]
  },
  {
    "slug": "/study-budget/west-midlands/",
    "title": "West Midlands GP study budget: what it covers for the SCA (2026)",
    "metaDescription": "West Midlands (Midlands GP Schools policy) guides two SCA courses over training, RCGP accredited preferred, no per-course cap. How to claim. Correct as of July 2026.",
    "h1": "West Midlands GP study budget: what it covers for the SCA",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nWest Midlands trainees are covered by the same Midlands GP Schools study leave guidance as East Midlands. SCA courses are mandatory, ES-approved curriculum activity, with guidance of two courses across training and RCGP-accredited courses preferred. No per-course cash cap; a £1,000 total-cost threshold triggers additional TPD sign off but is not itself a limit.\n\n## How much you get\n\nUnder the current May 2026 Midlands guidance, SCA courses are Category I (mandatory curriculum-based, ES approved), described as \"Guidance of two courses over whole of training & RCGP accredited courses are preferred\" (Midlands GP Schools Study Leave Guidance, current version May 2026). The wording was revised to clarify \"no limitations to funding\". Fourteen Fish SCA and AKT packages are named in the fundable green list.\n\nThe only cost gate is the threshold: costs above \"£1,000, including all course fees, travel, and subsistence expenses\" need additional TPD authorisation, and the policy stresses \"this is not a limit but a threshold for further approval.\"\n\n## Does it cover SCA prep courses?\n\nYes, on the same generous terms as East Midlands: two courses' guidance, ES-only sign off, accreditation preferred not required, no cash ceiling below £1,000. Because accreditation is a preference and RCGP-accredited courses have limited places and fixed dates, a non-accredited course is fundable, and an accredited one being full or badly timed for your sitting is a reasonable basis to request an alternative. Subscriptions to journals and software are on the not-funded list, so keep your claim framed as a course.\n\n## Is the SCA exam fee itself reimbursed?\n\nNot from the study budget: examination fees are on the Midlands not-funded list. Under the June 2026 resident doctor contract agreement, doctors in England can reclaim their first two SCA attempts for exams sat from 1 April 2026, through their employing trust. Details: [Is the SCA exam fee reimbursed?](/study-budget/sca-exam-fee-reimbursement/).\n\n## How to claim\n\n1. PDP entry with ES approval and a clear development rationale.\n2. Apply on the regional Accent system at least 6 weeks ahead with a full cost breakdown; retrospective claims are not considered.\n3. Online and in-person courses are treated identically.",
    "faq": [
      {
        "q": "How much can I claim for an SCA course in West Midlands?",
        "a": "There is no per-course cap; guidance is two courses over training, with extra TPD approval only above £1,000 total cost."
      },
      {
        "q": "Is the Midlands policy the same for East and West?",
        "a": "Yes: one Midlands GP Schools study leave guidance covers both schools."
      },
      {
        "q": "Are Fourteen Fish packages fundable?",
        "a": "The policy lists Fourteen Fish SCA and AKT packages in its fundable green category."
      }
    ],
    "cta": "If you are choosing an SCA course to put on your PDP: our Complete programme (£599) combines unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching, structured as a course and priced well within the £1,000 extra-approval threshold. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": [
      {
        "label": "Midlands GP Schools study leave guidance (May 2026)",
        "href": "/study-budget/sources/midlands-gp-schools-study-leave-guidance-may-2026.pdf"
      }
    ]
  },
  {
    "slug": "/study-budget/north-west/",
    "title": "North West GP study budget: what it covers for the SCA (2026)",
    "metaDescription": "North West funds one RCGP-provided or accredited SCA course up to £500; non-accredited courses considered up to £500 with prior approval. How to claim. Correct as of July 2026.",
    "h1": "North West GP study budget: what it covers for the SCA",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nNorth West GP trainees can claim one SCA course, but there is a specific £500 ceiling to know about. RCGP-provided or accredited SCA courses are automatically approved up to £500 per trainee. Non-accredited courses are also considered, again capped at £500, but only after discussion with your TPD and the study leave team before booking. Fourteen Fish AKT and SCA packages are funded as a separate named line, including annual renewal.\n\n## How much you get\n\nThe North West policy's automatically approved Level I list includes an \"RCGP-provided or accredited SCA course\" at \"One course attendance per RD to a maximum of £500\" (NW School Study Leave Guidelines, March 2026). Non-accredited courses are handled separately: \"Due to limited availability we will also consider requests for SCA and AKT courses that are not provided or accredited by the RCGP. These must be discussed with the TPD, and the Study Leave team before booking and will be limited to one course costing less than £500.\"\n\nFourteen Fish is treated as its own automatically approved line: \"Fourteen fish AKT and SCA support\" attracts \"Funding for whole package per RD, including annual renewal\", and unusually the policy confirms subscriptions are funded for the Fourteen Fish AKT and SCA Plus packages specifically.\n\n## Does it cover SCA prep courses?\n\nYes, but the £500 cap is the number that shapes everything. A course priced above £500 will not be fully funded unless something changes. That makes RCGP accreditation genuinely valuable in the North West: accredited courses clear the automatic-approval route cleanly, while non-accredited courses need pre-booking sign off from both TPD and study leave team and are held to the same £500 line. The North West is the one region whose policy states this flexibility outright, and the reason it gives is capacity: it will consider non-accredited courses \"due to limited availability\" of the RCGP option. In practice, if an RCGP-accredited course cannot take you before your sitting, that limited availability is exactly the ground the policy anticipates. Name the accredited course you tried, note that its places or dates did not fit, and put the non-accredited alternative to your TPD and study leave team before booking, within the £500 line. The general subscription rule still applies: subscriptions associated with an exam course are not funded, the Fourteen Fish packages being the specific carve-out.\n\n## Is the SCA exam fee itself reimbursed?\n\nNot from the study budget: examination fees, e-portfolio costs and RCGP membership are explicitly excluded, though travel to exams can be claimed. Under the June 2026 resident doctor contract agreement, doctors in England can reclaim their first two SCA attempts for exams sat from 1 April 2026, through their employing trust. Details: [Is the SCA exam fee reimbursed?](/study-budget/sca-exam-fee-reimbursement/).\n\n## How to claim\n\n1. For an accredited course, apply through Accent before booking; for a non-accredited course, discuss with your TPD and the study leave team before booking.\n2. Submit at least 6 weeks before the course start; approvals sought later need a justifying comment on Accent, and retrospective approval is likely to be declined.\n3. Course fees, accommodation and public transport can be claimed in advance; approved expenses must be claimed within 3 months of starting the course or signing up to a Fourteen Fish package.",
    "faq": [
      {
        "q": "What is the SCA funding cap in North West?",
        "a": "£500 per trainee for one SCA course, whether RCGP accredited (automatically approved) or not (approved case by case with prior sign off)."
      },
      {
        "q": "Does accreditation matter in the North West?",
        "a": "Yes, more than in most regions. Accredited courses are auto-approved; non-accredited ones need TPD and study leave team sign off before booking, held to the same £500 line."
      },
      {
        "q": "Are Fourteen Fish packages funded?",
        "a": "Yes, as a distinct line including annual renewal, and unusually the associated subscription is funded."
      }
    ],
    "cta": "A note on the £500 cap: our Complete programme is £599, which sits £99 above the North West non-accredited ceiling. If you are training in the North West, factor that in when planning your claim, and check whether accreditation status has changed since this page was last reviewed. Our Complete programme combines unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching, structured as a course. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": [
      {
        "label": "North West School study leave guidelines (March 2026)",
        "href": "/study-budget/sources/north-west-study-leave-guidelines-march-2026.pdf"
      }
    ]
  },
  {
    "slug": "/study-budget/yorkshire-humber/",
    "title": "Yorkshire and Humber GP study budget: what it covers for the SCA (2026)",
    "metaDescription": "Yorkshire and Humber funds one SCA course per exam attempt from a named approved list. What qualifies and how to claim. Correct as of July 2026.",
    "h1": "Yorkshire and Humber GP study budget: what it covers for the SCA",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nYorkshire and Humber funds SCA courses as green (automatically approved) activity, one per exam attempt, drawn from a named list of approved courses. This per-attempt basis is more forgiving than deaneries that allow only one course across training. Book at least 8 weeks ahead and check your funding permission before paying.\n\n## How much you get\n\nThe February 2025 Yorkshire and Humber guidance lists SCA courses among its green courses, which are \"either required by the ARCP process, mandatory HDR or automatically approved on ALM\", with the entry: \"SCA courses ST3- one per exam attempt- RCGP SCA course, SCA assured course, complete SCA course.\" (Study leave for GP Registrars, Yorkshire and Humber, February 2025). Study leave is granted and funding provided \"if no free or pre-funded course available.\"\n\nNo flat cash cap is published in the green list; the operative controls are the named-list membership, the one-per-attempt rule, and the free-course-first principle. The guidance also reminds trainees of the \"responsibility for appropriate use of the limited NHSE resources\" and to confirm reimbursement permission before booking.\n\n## Does it cover SCA prep courses?\n\nYes, and the per-exam-attempt basis is a genuine advantage: if you resit, you can claim a course for the next attempt. The named list is illustrative of the type of course expected (RCGP SCA course, SCA assured course, complete SCA course), and the guidance elsewhere notes its lists are \"not exhaustive\" with other courses considered case by case on curriculum relevance. Discretionary and specialist-interest activity sits in the amber and red tiers and faces more scrutiny; a straightforward SCA course does not.\n\n## Is the SCA exam fee itself reimbursed?\n\nNot from the study budget: a maximum of 5 days of exam-related self-directed learning per training year is claimable as time, but the fee is separate. Under the June 2026 resident doctor contract agreement, doctors in England can reclaim their first two SCA attempts for exams sat from 1 April 2026, through their employing trust. Details: [Is the SCA exam fee reimbursed?](/study-budget/sca-exam-fee-reimbursement/).\n\n## How to claim\n\n1. Check no free or pre-funded regional course covers your need first.\n2. Confirm reimbursement permission in advance and apply via ALM with at least 8 weeks' notice of booking.\n3. Update your portfolio with evidence of attendance afterwards.",
    "faq": [
      {
        "q": "How many SCA courses can I claim in Yorkshire and Humber?",
        "a": "One per exam attempt, from the approved green list."
      },
      {
        "q": "Does my course have to be on the named list?",
        "a": "The named courses illustrate what is auto-approved; the lists are not exhaustive and other courses are considered case by case for curriculum relevance."
      },
      {
        "q": "How much notice do I need?",
        "a": "At least 8 weeks before booking, and confirm reimbursement permission first."
      }
    ],
    "cta": "If you are choosing an SCA course for the Yorkshire and Humber green route: our Complete programme (£599) combines unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching, structured as a complete SCA course. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": [
      {
        "label": "Yorkshire & Humber GP study leave (Feb 2025)",
        "href": "/study-budget/sources/yorkshire-humber-study-leave-feb-2025.pdf"
      }
    ]
  },
  {
    "slug": "/study-budget/north-east/",
    "title": "North East GP study budget: what it covers for the SCA (2026)",
    "metaDescription": "North East automatically approves one RCGP-provided or accredited SCA course or package; other courses are discretionary with 50% self-funding. How to claim. Correct as of July 2026.",
    "h1": "North East GP study budget: what it covers for the SCA",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nIn the North East and North Cumbria, one RCGP-provided or accredited SCA course, including AKT and SCA educational packages, is on the automatic approval list: one per trainee during training. Anything outside that automatically approved list is discretionary, aimed at GPs, and comes with an expectation that you pay 50% of the cost yourself. So the accredited route is the one that gets you full funding.\n\n## How much you get\n\nThe NHSE Education North East automatic approved course list names, at the top: \"RCGP provided or accredited AKT and SCA courses including AKT and SCA educational packages\", with \"One course attendance during training for the AKT and one for the SCA.\" (NHSE Education NE Automatic Approved Course List, effective 05.09.2025). Occasionally a TPD may decide a further course is needed, documented in Educator Notes and checked before any additional claim is reimbursed.\n\nThe overarching NE study leave policy sets no individual cap: \"There is no 'cap' imposed to any individual; each study leave episode applied for is considered for approval on its own merit\" (NHSE NE Study Leave Policy, version 11, August 2025). But note the £500 review trigger: applications where course fees exceed £500 are reviewed by additional approvers (TPD, Head of School or Deputy Director) before a decision.\n\n## Does it cover SCA prep courses?\n\nYes, cleanly, provided the course is RCGP provided or accredited, or is a recognised AKT/SCA educational package. That is the automatically approved route with full funding. Step outside it and you are in discretionary territory: the \"approval for all other courses\" section requires the course to be aimed at GPs, agreed in advance at an ES review, and \"The DiT will be expected to pay for 50% of the course/study/conference expenses\". On subscriptions the policy is blunt: \"NHSE Education NE cannot support DiTs applying for annual subscriptions to any learning organisation.\" A course or educational package qualifies; a subscription does not.\n\n## Is the SCA exam fee itself reimbursed?\n\nNot from the study budget: exam fees will not be reimbursed, though travel and accommodation to sit UK exams is contributed to. Under the June 2026 resident doctor contract agreement, doctors in England can reclaim their first two SCA attempts for exams sat from 1 April 2026, through their employing trust. Details: [Is the SCA exam fee reimbursed?](/study-budget/sca-exam-fee-reimbursement/).\n\n## How to claim\n\n1. Apply via Accent Leave Manager (ALM) and do not pay before the application is fully approved: the list warns that paying before approval means the claim is \"automatically rejected for reimbursement.\"\n2. Regional teaching is deducted from your rotational allowance first; apply for the SCA course once you have not exceeded your allowance through regional teaching.\n3. Note the £500 additional-approver trigger and build in time.",
    "faq": [
      {
        "q": "Does my SCA course need to be RCGP accredited in the North East?",
        "a": "For automatic full funding, yes, or it must be a recognised AKT/SCA educational package. Non-accredited courses fall into the discretionary route with 50% self-funding expected."
      },
      {
        "q": "What is the £500 threshold?",
        "a": "Applications with fees over £500 get extra sign off from TPD, Head of School or Deputy Director before a final decision; it is a review trigger, not a cap."
      },
      {
        "q": "Are subscriptions funded?",
        "a": "No. The North East cannot support annual subscriptions to any learning organisation; fund a course or package instead."
      }
    ],
    "cta": "If you are choosing an SCA course for the North East automatic route: our Complete programme (£599) is a structured SCA course combining unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching. Note the £500 additional-approver trigger applies to any claim above that figure, and RCGP accreditation status is what routes a course into automatic full funding here, so check current status before claiming. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": [
      {
        "label": "NHSE Education NE automatic approved course list (Sept 2025)",
        "href": "/study-budget/sources/north-east-approved-course-list-sept-2025.pdf"
      },
      {
        "label": "NHSE NE study leave policy v11 (Aug 2025)",
        "href": "/study-budget/sources/north-east-study-leave-policy-v11-aug-2025.pdf"
      }
    ]
  },
  {
    "slug": "/study-budget/south-west/",
    "title": "South West GP study budget: what it covers for the SCA (2026)",
    "metaDescription": "South West GP study leave uses a traffic-light funding system. Whether it covers a commercial SCA course depends on category and prospective approval. Correct as of July 2026.",
    "h1": "South West GP study budget: what it covers for the SCA",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nThe South West funds study leave on a traffic-light (category) system: curriculum-required courses (Category 1) are usually fully funded, enhanced-knowledge courses 75%, career-progression courses 50%, and some courses not at all. What the published material does not spell out is where a commercial SCA preparation course sits, and the courses trainees are shown attending are mostly regional and RCGP-provided. So treat a commercial SCA course as a possibility that needs prospective approval, not a certainty. Apply on Accent at least 6 weeks ahead and before you pay.\n\n## How much you get\n\nThe South West (Health Education South West, covering the Severn and Peninsula programmes) gives 30 days of study leave a year, with around 15 days deducted for half-day release, pro rata for less than full time. Funding is set by category rather than a fixed cash cap:\n\n- \"Cat 1: Required within the curriculum ... These courses will usually be fully funded.\"\n- \"Cat 2: Enhanced knowledge ... These will be 75% funded.\"\n- \"Cat 3: Career Progression ... These will be 50% funded.\"\n- Red: courses not funded.\n\n(Bristol GP Training Scheme, Study and Professional Leave Guidance, updated April 2026, applying the HESW traffic-light framework.) All funded courses except mandatory training and half-day release must be on your PDP with ES approval; Category 3 also needs Associate Postgraduate Dean approval.\n\n## Does it cover SCA prep courses?\n\nThis is where the honest answer is: probably, but not automatically, and the detail is hard to confirm right now. The traffic-light framework fully funds Category 1 (curriculum-required) courses, but the published material does not state that a commercial SCA course falls in Category 1. The examples the region lists of courses trainees have taken are RCGP-provided and regional offerings (RCGP courses, GP update days, dermoscopy, minor surgery, wellbeing days), not commercial exam-preparation packages. That mirrors neighbouring deaneries such as Thames Valley, Wessex and East of England, which fund regional and RCGP courses first and generally do not reimburse expensive commercial packages except in exceptional circumstances.\n\nTwo further cautions. Several of the region's deanery pages and links are currently not loading, so the current detailed funding position cannot be fully verified from the outside. And the published detail is drawn from the Severn (Bristol) patch; the framework is Health Education South West-wide, but Peninsula-specific confirmation is not available. The practical takeaway: an SCA course may well be fundable if your TPD accepts it as curriculum-required, but you should treat that as something to secure in advance, in writing, rather than assume. Frame it clearly as a curriculum requirement in your PDP and confirm the current position with your TPD before booking.\n\n## Is the SCA exam fee itself reimbursed?\n\nNot from the study budget. Separately, under the June 2026 resident doctor contract agreement, doctors in England can reclaim their first two SCA attempts for exams sat from 1 April 2026, through their employing trust. Details: [Is the SCA exam fee reimbursed?](/study-budget/sca-exam-fee-reimbursement/).\n\n## How to claim\n\n1. Add the course to your PDP with ES approval, framed as a curriculum requirement, and ask your TPD to confirm how it will be categorised.\n2. Apply on Accent at least 6 weeks ahead and before you pay. Retrospective requests are not authorised.\n3. Because the regional detail is currently hard to verify, get the funding position confirmed in writing before committing.",
    "faq": [
      {
        "q": "Does the South West fund SCA courses?",
        "a": "Curriculum-required courses are usually fully funded, but the published material does not clearly place a commercial SCA course in that category, and the region's funded examples are mostly regional and RCGP-provided. Confirm with your TPD before booking."
      },
      {
        "q": "Is there a cap in the South West?",
        "a": "No cash cap is published in the traffic-light framework; funding is set by category. But whether a commercial SCA course is fully funded, part-funded or expected to be a regional course instead is not clearly stated."
      },
      {
        "q": "What happens if I pay before applying?",
        "a": "Retrospective study leave requests are not authorised, so you risk funding it yourself. Apply on Accent at least 6 weeks ahead, before paying, and confirm the funding position first."
      }
    ],
    "cta": "If you are choosing an SCA course to put to your South West TPD as a curriculum requirement: our Complete programme (£599) is a structured SCA course combining unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": [
      {
        "label": "Bristol GP Training Scheme study & professional leave guidance (HESW framework)",
        "href": "https://gp-training.hee.nhs.uk/bristol/gp-training/trainees/leave/study-and-professional-leave-guidance/"
      }
    ]
  },
  {
    "slug": "/study-budget/scotland/",
    "title": "Scotland GP study budget: what it covers for the SCA (2026)",
    "metaDescription": "Scotland (NES) gives GP registrars a nominal £600 per training year and funds individual course fees, not subscriptions. How the SCA rules work. Correct as of July 2026.",
    "h1": "Scotland GP study budget: what it covers for the SCA",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nScottish GP registrars have a nominal budget of £600 per part of training (ST1, ST2, ST3), managed by NES and approved by your TPD. NES funds individual course fees but not annual subscriptions to a set of courses, so an SCA course is claimable while a subscription bundle is not. There is a catch worth knowing: routine funded study leave for exam preparation is limited, because GP registrars in practice already have protected self-directed learning time.\n\n## How much you get\n\nThe NES GP registrar FAQs state: \"There is a nominal budget of £600 for each registrar for each part of training – ST1, ST2 and ST3. There is no automatic entitlement to this funding. You must have appropriate reasons to request it.\" All funding is paid as reimbursement of receipts (NES GP registrar study leave FAQs, July 2025). The £600 does not carry over between training years.\n\nThe crucial course-versus-subscription line: \"NES will fund course fees for individual GP Continuing Professional Development courses but will not fund an annual subscription to a set of courses.\" And expensive courses that would \"use most of your nominal budget are likely to only be part-funded\", because NES prefers you spread funding across a broader range of courses.\n\n## Does it cover SCA prep courses?\n\nThis is where Scotland differs from England, and the July 2025 FAQs matter. Your TPD \"can approve any course that is appropriate to your education and development\" that relates to the RCGP curriculum, which includes SCA preparation. But note the standalone exam-preparation position: study leave for exam preparation is framed cautiously, and a course that eats most of your £600 risks part-funding only. The FAQs also allow \"five days study leave for private study for SCA preparation\" as time, separate from course funding.\n\nSo: an SCA course is fundable from your £600 if your TPD agrees it fits the curriculum and represents value, but you should expect scrutiny on price, and a bare subscription is not claimable.\n\n## Is the SCA exam fee itself reimbursed?\n\nNo: the FAQs are explicit that \"There is no funding for any exam fees.\" The June 2026 England contract agreement on exam-fee reimbursement applies to doctors in England, not Scotland, so Scottish registrars should not assume it covers them. Details on the England position: [Is the SCA exam fee reimbursed?](/study-budget/sca-exam-fee-reimbursement/).\n\n## How to claim\n\n1. Get service-level approval from your CS or ES, then submit through TURAS with a self-declaration.\n2. Your TPD approves with funding, without funding, or not at all, judging curriculum relevance, your learning needs, cost and equity.\n3. Claim reimbursement against receipts after attending. Apply at least 6 weeks before the leave.",
    "faq": [
      {
        "q": "How much study budget do Scottish GP registrars get?",
        "a": "A nominal £600 per part of training (ST1, ST2, ST3), not automatic, requested with good reason, paid as reimbursement."
      },
      {
        "q": "Can I use it for an SCA course?",
        "a": "Yes, if your TPD agrees it fits the RCGP curriculum and represents value for money. A course using most of your £600 may be only part-funded."
      },
      {
        "q": "Are subscriptions funded in Scotland?",
        "a": "No. NES funds individual course fees but not annual subscriptions to a set of courses."
      }
    ],
    "cta": "If you are choosing an SCA course to put to your Scottish TPD: our Complete programme (£599) is a structured SCA course combining unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching. It sits within the £600 nominal budget, though note NES scrutinises courses that use most of a year's budget, so discuss value with your TPD. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": [
      {
        "label": "NES GP registrar study leave FAQs (July 2025)",
        "href": "/study-budget/sources/scotland-nes-gp-registrar-study-leave-faqs-july-2025.pdf"
      }
    ]
  },
  {
    "slug": "/study-budget/wales/",
    "title": "Wales GP study budget: what it covers for the SCA (2026)",
    "metaDescription": "Wales (HEIW) gives GP trainees £600 per training year, rolling over once to a £1,200 maximum, and funds CPD subscriptions. How the SCA rules work. Correct as of July 2026.",
    "h1": "Wales GP study budget: what it covers for the SCA",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nGP trainees in Wales get a £600 study budget per training year, managed by HEIW, and Wales has two features that make it more generous than most: unused budget rolls over for one year to a maximum of £1,200, and subscriptions to GP CPD programmes are explicitly listed as acceptable use. So if you have carried budget forward, you may have up to £1,200 to put towards SCA preparation.\n\n## How much you get\n\nThe HEIW GP trainee study leave policy states: \"Trainees are allocated a budget of £600 per training year.\" Unused personal budget rolls over: \"HEIW now implements a roll-over arrangement of any unused personal Study Leave budget for one year only (up to a maximum of £600) into the subsequent training year\", so \"The Study Leave budget available in the next training year, following the roll over, will not exceed £1200.\" (HEIW GP Trainee Study Leave Policy, V4, March 2024). Rollover applies to funding only, and only for trainees staying in a Welsh programme.\n\n## Does it cover SCA prep courses?\n\nYes, and Wales is unusually accommodating on format. The policy's list of acceptable use includes \"Courses and webinars that supplement areas of the GP Curriculum\" and, notably, \"Subscriptions to GP CPD Programmes e.g., Red Whale GP CPD\". Wales is one of the few regions to name subscriptions as acceptable, which widens what you can claim compared with England. An SCA preparation course clearly qualifies as a curriculum-supplementing course. The budget cannot be used for exam fees, professional registrations, RCGP portfolio fees, books or equipment.\n\n## Is the SCA exam fee itself reimbursed?\n\nNot from the study budget. Wales has run a separate incentive: the Welsh Government Universal Incentive Scheme allowed GP trainees recruited up to and including February 2023 to claim the first sitting of their AKT and RCA exams. Check whether a current equivalent applies to your cohort. The June 2026 England contract-agreement reimbursement applies to doctors in England, not Wales. Details on the England position: [Is the SCA exam fee reimbursed?](/study-budget/sca-exam-fee-reimbursement/).\n\n## How to claim\n\n1. Apply through Codi Leave Manager at least 6 weeks before the leave.\n2. For online training, provide evidence of the course duration and cost with your application, and confirmation of time actually taken when you claim.\n3. Claim reimbursement via the SEL e-expenses system after approval. Private study leave is capped at 5 days per training year and is unpaid.",
    "faq": [
      {
        "q": "How much study budget do Welsh GP trainees get?",
        "a": "£600 per training year, with unused budget rolling over once to a maximum of £1,200 for trainees staying in a Welsh programme."
      },
      {
        "q": "Can I use it for an SCA course or subscription?",
        "a": "Yes to a curriculum-supplementing course, and Wales unusually lists GP CPD subscriptions as acceptable use too."
      },
      {
        "q": "Does the £1,200 apply to everyone?",
        "a": "Only where you carried unused budget from the previous year; the base allocation is £600 per year."
      }
    ],
    "cta": "If you are choosing an SCA course for your HEIW budget: our Complete programme (£599) is a structured SCA course combining unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching, sitting within a single £600 training-year allocation. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": [
      {
        "label": "HEIW GP trainee study leave policy V4 (March 2024)",
        "href": "/study-budget/sources/wales-heiw-gp-study-leave-policy-v4-march-2024.pdf"
      }
    ]
  },
  {
    "slug": "/study-budget/northern-ireland/",
    "title": "Northern Ireland GP study budget: what it covers for the SCA (2026)",
    "metaDescription": "Northern Ireland (NIMDTA) funds SCA preparation courses only through the SUCCESS programme after a failed attempt, up to £750. How it works. Correct as of July 2026.",
    "h1": "Northern Ireland GP study budget: what it covers for the SCA",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nNorthern Ireland is the outlier. NIMDTA does not routinely fund SCA preparation courses for a first attempt, because it takes the view that the deanery's own teaching plus protected self-directed learning time is the preparation. Funding for an SCA course only opens up through the SUCCESS programme, after you have had at least one unsuccessful SCA attempt, and then it is generous: up to £750 for one approved course, with up to 3 days of study leave.\n\n## How much you get\n\nThe general NIMDTA position is explicit that a first-attempt SCA course is not routinely funded. Under \"what is not approved for study leave\", the guidance lists \"Courses for specialty examinations during GP Programme without a previous failed attempt\" and states \"Taking time off to prepare for an exam is not supported through study leave in General Practice\", because trainees already have protected self-directed learning time (NIMDTA GP Specialty Training Study Leave guidance, October 2025).\n\nWhere SCA course funding does exist is the SUCCESS programme, for trainees who have been unsuccessful in a previous attempt: \"One course only will be approved for each of AKT and SCA\", \"Up to £750 funding per course (up to max £1250 per training year for all courses)\", online or in person, with up to 3 days of study leave. The general nominal budget elsewhere in the policy is £600 per part of training.\n\n## Does it cover SCA prep courses?\n\nOnly through SUCCESS, and only after a failed attempt. This is the key thing for NI trainees to understand: if you are preparing for a first sitting, NIMDTA will not fund a commercial SCA course, and you would be self-funding. If you have had an unsuccessful attempt and are engaged with SUCCESS, an approved SCA course up to £750 becomes claimable. The programme names approved providers such as RCGP and Emedica as examples; check your intended course is acceptable with your Programme Director.\n\n## Is the SCA exam fee itself reimbursed?\n\nNo: the guidance lists \"Professional examination fees at any point of training\" as not approved. The June 2026 England contract-agreement reimbursement applies to doctors in England, not Northern Ireland. Details on the England position: [Is the SCA exam fee reimbursed?](/study-budget/sca-exam-fee-reimbursement/).\n\n## How to claim\n\n1. For a first attempt, expect to self-fund an SCA course; use the deanery's own teaching and your protected learning time first.\n2. If you have had an unsuccessful attempt, engage with the SUCCESS programme and apply through the usual NIMDTA study leave process, at least 4 weeks ahead.\n3. Claim reimbursement on the NIMDTA claim form within 4 weeks, with receipts and a completed course evaluation. No retrospective applications.",
    "faq": [
      {
        "q": "Does Northern Ireland fund SCA courses for a first attempt?",
        "a": "No, not routinely: SCA course funding opens through the SUCCESS programme after an unsuccessful attempt."
      },
      {
        "q": "How much is available through SUCCESS?",
        "a": "Up to £750 for one approved SCA course, within a £1,250 per-training-year cap across all courses, plus up to 3 days of study leave."
      },
      {
        "q": "Can I still use an SCA course before a first attempt?",
        "a": "Yes, but expect to fund it yourself; NIMDTA's position is that protected self-directed learning time is the intended preparation."
      }
    ],
    "cta": "If you are self-funding SCA preparation for a first attempt in Northern Ireland, or using SUCCESS funding after a resit: our Complete programme (£599) is a structured SCA course combining unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching, priced within the £750 SUCCESS per-course limit. Our Self-Study tier (£299) is a lower-cost option if you are funding a first attempt yourself. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": [
      {
        "label": "NIMDTA GP specialty training study leave guidance (Oct 2025)",
        "href": "/study-budget/sources/northern-ireland-study-leave-policy-oct-2025.pdf"
      }
    ]
  },
  {
    "slug": "/study-budget/sca-exam-fee-reimbursement/",
    "title": "Is the SCA exam fee reimbursed? What the June 2026 contract change means (2026)",
    "metaDescription": "From 1 April 2026, resident doctors in England can reclaim their first two SCA attempts under the June 2026 contract agreement. What it covers and how. Correct as of July 2026.",
    "h1": "Is the SCA exam fee reimbursed?",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nYes, for doctors in England, and this is new. Under the June 2026 resident doctor contract agreement, resident doctors in England are entitled to reimbursement of their first two SCA attempts for exams sat from 1 April 2026. You pay the fee upfront and claim it back through your employing trust. This is separate from your study budget, which covers preparation courses, not the exam itself. Implementation at trust level is still settling, so processes vary.\n\n## Why this matters\n\nUntil 2026, the SCA exam fee was a cost every English GP trainee simply absorbed: study budgets across every deanery explicitly exclude exam fees, and still do. The June 2026 contract agreement changes that for the exam fee specifically, not the study budget. It means two things are now potentially covered from two different sources: the exam fee (via the contract agreement, through your trust) and one preparation course (via your study budget, through your deanery).\n\n## What it covers\n\nThe entitlement, as it stands in July 2026, covers the first two SCA attempts for exams sat on or after 1 April 2026, for resident doctors in England. It does not cover preparation courses (those remain a study-budget matter) and it does not automatically extend to Scotland, Wales or Northern Ireland, whose funding sits under NES, HEIW and NIMDTA respectively and follows separate rules.\n\nBecause this is a recent contractual change being implemented across many trusts, the exact claim mechanism, the evidence required, and the timing of reimbursement differ between employers. Some trusts had smooth processes in place quickly; others were still settling months later.\n\n## How to claim\n\n1. Sit the exam and pay the fee upfront as usual.\n2. Retain proof of payment and your exam confirmation.\n3. Claim through your employing trust's process for the contractual reimbursement. If your trust's process is unclear, ask your medical staffing or lead employer team, and your BMA representative if you are a member.\n4. Keep your study-budget course claim entirely separate: that goes through your deanery's study leave process, not your trust.\n\n## The bigger picture\n\nFor a GP trainee in England in 2026, the combined position is better than it has been: the exam fee (first two attempts) reimbursed through your trust, and one preparation course claimable from your deanery study budget. Getting both means using two different systems correctly. Our deanery guides cover the study-budget side region by region; this page covers the exam fee.",
    "faq": [
      {
        "q": "Is the SCA exam fee reimbursed in England?",
        "a": "Yes: the first two attempts for exams sat from 1 April 2026, under the June 2026 resident doctor contract agreement, claimed through your employing trust."
      },
      {
        "q": "Does this cover my preparation course too?",
        "a": "No: preparation courses come from your deanery study budget, which is separate. The contract change covers the exam fee only."
      },
      {
        "q": "Does it apply in Scotland, Wales or Northern Ireland?",
        "a": "Not automatically: it is an England contract agreement. NES, HEIW and NIMDTA set their own positions, and none routinely funds exam fees."
      },
      {
        "q": "How do I actually claim?",
        "a": "Through your employing trust, not your deanery. Processes are still settling, so check with your medical staffing team."
      }
    ],
    "cta": "This page covers the exam fee. For the preparation side, your study budget can fund one SCA course: see your [deanery guide](/study-budget/). Our Complete programme (£599) is a structured SCA course built to sit inside that budget, combining unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": []
  },
  {
    "slug": "/study-budget/how-to-claim/",
    "title": "How to claim your GP study budget for an SCA course (2026)",
    "metaDescription": "A step-by-step guide to claiming study budget for an SCA preparation course, the mistakes that lose trainees money, and an email template. Correct as of July 2026.",
    "h1": "How to claim your GP study budget for an SCA course",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nThe process is broadly the same across every deanery: discuss the course with your Educational Supervisor, add it to your PDP, get prospective approval through your regional system, book only after approval, then claim reimbursement with receipts. The single biggest way trainees lose money is booking before approval. Almost every policy warns that paying first risks you funding the course yourself, and some reject such claims automatically.\n\n## The universal steps\n\n**1. Discuss and document.** Raise the course at an ES review and record it as a PDP entry. Several deaneries (the Midlands, East of England, Scotland) make a PDP entry a formal condition of funding, not a nicety.\n\n**2. Get prospective approval.** Apply through your regional system before you book: Accent or ALM in most of England, TURAS in Scotland, Codi in Wales, and the NIMDTA process in Northern Ireland. Apply in good time: 8 weeks in the North West and North East, 6 weeks in the Midlands and Wales, at least 4 weeks in Northern Ireland.\n\n**3. Book only after approval.** This is the rule that protects your money. The North East states plainly that if you pay before approval, the claim is automatically rejected. Others say you risk funding it yourself. Never book on the assumption of approval.\n\n**4. Claim reimbursement.** Pay, then claim back through the regional expenses system with your receipt (not a completion certificate: several deaneries specifically require proof of payment). Watch the deadlines: the North West requires claims within 3 months of starting the course or signing up to a package; Northern Ireland within 4 weeks with a course evaluation.\n\n## The mistakes that cost trainees money\n\nBooking before approval is the big one. After that: assuming something is claimable without checking your deanery's policy first; missing the regional free course your deanery expects you to use first; claiming a course above your region's cap (£500 in the North West, £600 in London, KSS, Scotland and Wales); and trying to claim the exam fee from your study budget, which no deanery allows (see [Is the SCA exam fee reimbursed?](/study-budget/sca-exam-fee-reimbursement/) for the separate England route).\n\n## An email you can adapt\n\nIf you need to open the conversation with your ES or TPD, something like this works:\n\n> Subject: SCA preparation course, study budget approval\n>\n> Hi [name],\n>\n> I'd like to put an SCA preparation course on my PDP ahead of my sitting in [month]. The course is [name], priced at £[amount], which sits within our deanery's study budget for exam preparation courses.\n>\n> Could we discuss it at our next review so I can get prospective approval before booking? I'll add it as a PDP entry beforehand. Happy to send the course details and dates across in advance.\n>\n> Thanks,\n> [name]\n\nKeep it short, name the course and price, flag that it fits the budget, and ask for prospective approval explicitly.",
    "faq": [
      {
        "q": "What is the most common reason study budget claims are rejected?",
        "a": "Booking or paying before approval. Get prospective approval every time."
      },
      {
        "q": "Do I claim the SCA course from my deanery or my trust?",
        "a": "Your deanery, through the study leave process. The exam fee (in England) is separate and goes through your trust."
      },
      {
        "q": "Do I need a receipt or a certificate?",
        "a": "A receipt or proof of payment: several deaneries specifically will not accept a completion certificate in its place."
      }
    ],
    "cta": "Once you know your deanery's rules (see your [deanery guide](/study-budget/)), our Complete programme (£599) is a structured SCA preparation programme priced to sit within the common £600 cap, combining unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching. Approval is decided by your deanery. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": []
  },
  {
    "slug": "/study-budget/gp0001-explained/",
    "title": "GP0001 explained: the study budget code for exam preparation courses (2026)",
    "metaDescription": "GP0001 is the NHS England code for GP exam preparation courses, capped at £600 per AKT or SCA course. What it means and how to use it. Correct as of July 2026.",
    "h1": "GP0001 explained: the study budget code for exam preparation courses",
    "dateline": "Correct as of July 2026 · Reviewed by a GP educator",
    "body": "## The short answer\n\nGP0001 is the budget code NHS England uses for GP trainee exam preparation courses, including SCA and AKT preparation. On the London and KSS approved lists it carries a cap of £600 per AKT or SCA course, and it is classed as an external, supporting activity available at every training stage. If your deanery uses approved-list codes, GP0001 is the one your SCA course claim goes under.\n\n## What GP0001 is\n\nOn the London and KSS General Practice approved lists, GP0001 is defined as: \"Exam preparation course relevant to level of training (max 1 per sitting)\" at \"Max £600 per AKT or RCA/SCA preparation course\", marked external and supporting, available across ST1, ST2 and ST3 (KSS General Practice Approved List, revised March 2026; London approved study leave list, September 2025). London's guidance confirms both AKT and SCA preparation courses are claimed \"using code GP0001\", each up to £600.\n\nIt sits alongside related codes you may meet: TRAC0001 for travel and accommodation to attend exams (no exam fees), and GP0017 for free internal AKT revision via the PSU. Knowing GP0001 specifically is useful because it is the line your SCA course claim maps to on these approved lists.\n\n## What GP0001 does and does not cover\n\nIt covers one exam preparation course per sitting, up to £600, for AKT or SCA. It does not cover exam fees (those are excluded from every study budget, with the separate England reimbursement route covering the fee itself), and it does not cover a second course in the same sitting without going through discretionary approval. In London, a question-bank or resource claim uses up your single GP0001 course, so choose deliberately.\n\n## Which deaneries use it\n\nGP0001 appears explicitly on the London and KSS approved lists and in London's guidance. Other deaneries fund the same thing, an SCA preparation course, but may not surface the code to trainees: the Midlands, North West, North East, Yorkshire and Humber and others each have their own approved-list mechanics. If your region does not mention GP0001, you are still claiming the same category of activity, just under a different internal reference. Your ES or study leave team can tell you the local code.",
    "faq": [
      {
        "q": "What is GP0001?",
        "a": "The NHS England approved-list code for GP exam preparation courses, capped at £600 per AKT or SCA course on the London and KSS lists."
      },
      {
        "q": "How much can I claim under GP0001?",
        "a": "Up to £600 per AKT or SCA preparation course, one per sitting."
      },
      {
        "q": "Does GP0001 cover the exam fee?",
        "a": "No: it covers the preparation course. Exam fees are excluded from study budgets; the England contract agreement covers the fee separately."
      },
      {
        "q": "Does my deanery use GP0001?",
        "a": "London and KSS use it explicitly. Other deaneries fund the same activity under their own codes; ask your study leave team."
      }
    ],
    "cta": "An SCA course claimed under GP0001 has a £600 ceiling on the London and KSS lists. Our Complete programme (£599) is a structured SCA course built to sit inside that cap, combining unlimited AI consultation practice across 200 stations built from the RCGP curriculum with on-demand lectures and small-group coaching. [See pricing.](https://www.fourteenfisherman.com/)",
    "sources": [
      {
        "label": "General Practice approved study leave list (Sept 2025)",
        "href": "/study-budget/sources/london-approved-study-leave-list-sept-2025.pdf"
      },
      {
        "label": "KSS General Practice approved list (March 2026)",
        "href": "/study-budget/sources/kss-gp-approved-list-march-2026.pdf"
      }
    ]
  }
];

/** The hub lives at /study-budget/; everything else is a spoke. */
export const STUDY_BUDGET_HUB = STUDY_BUDGET_ARTICLES[0];
export const STUDY_BUDGET_SPOKES = STUDY_BUDGET_ARTICLES.slice(1);

/** Trailing path segment used as the [slug] route param. */
export function studyBudgetSlugParam(article: StudyBudgetArticle): string {
  return article.slug.replace(/^\/study-budget\//, '').replace(/\/$/, '');
}

export function getStudyBudgetArticle(param: string): StudyBudgetArticle | undefined {
  return STUDY_BUDGET_SPOKES.find((a) => studyBudgetSlugParam(a) === param);
}
