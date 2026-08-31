/**
 * Render one sample receipt per plan, plus the two edge cases the spec asks to
 * be checked by eye (section 7: "a name of around 30 characters, and a name
 * containing an apostrophe").
 *
 * These are for looking at. Nothing in the app runs this — it exists so a
 * change to the template can be diffed against a printed page before it reaches
 * a customer, because a receipt that looks wrong reaches a deanery finance team
 * before it reaches us.
 *
 *   npx vite-node --config vitest.config.ts scripts/generate-sample-receipts.mts [outDir]
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { renderReceipt } from '@/lib/receipts/renderReceipt'
import type { ReceiptFacts } from '@/lib/receipts/receiptContent'

const outDir = resolve(process.argv[2] ?? 'sample-receipts')
mkdirSync(outDir, { recursive: true })

const PAID_AT = new Date('2026-08-27T10:30:00Z')

const samples: ReadonlyArray<{ label: string; facts: ReceiptFacts }> = [
  {
    label: 'Complete SCA Course — £599 one-off',
    facts: {
      planKey: 'complete',
      receiptNumber: 'FF-26-4478',
      paidAt: PAID_AT,
      customerName: 'Jane Okonkwo',
      paymentMethod: 'Card',
      amountPence: 59900,
      coachingDayLabel: 'Saturday 12 September 2026',
    },
  },
  {
    label: 'Self-Study, 3 month — £299 one-off',
    facts: {
      planKey: 'self_study',
      receiptNumber: 'FF-26-4479',
      paidAt: PAID_AT,
      customerName: 'Arun Patel',
      paymentMethod: 'Card',
      amountPence: 29900,
    },
  },
  {
    label: 'Self-Study, monthly — £129 recurring',
    facts: {
      planKey: 'self_study_monthly',
      receiptNumber: 'FF-26-4480',
      paidAt: PAID_AT,
      customerName: 'Sarah Whitfield',
      paymentMethod: 'Card',
      amountPence: 12900,
      periodStart: new Date('2026-08-27T10:30:00Z'),
      periodEnd: new Date('2026-09-27T10:30:00Z'),
    },
  },
  {
    // 30 characters. The long-name case: it has to fit the "Issued to" line
    // without wrapping into the rule beneath it.
    label: 'EDGE — 30-character name',
    facts: {
      planKey: 'complete',
      receiptNumber: 'FF-26-4481',
      paidAt: PAID_AT,
      customerName: 'Christopher Wainwright-Bailey',
      paymentMethod: 'Bank transfer',
      amountPence: 59900,
      coachingDayLabel: 'Saturday 12 September 2026',
    },
  },
  {
    // The apostrophe case. A straight quote in a template that HTML-escapes
    // shows up as &#39; on the page; this is the check that it does not.
    label: "EDGE — apostrophe in the name",
    facts: {
      planKey: 'self_study_monthly',
      receiptNumber: 'FF-26-4482',
      paidAt: PAID_AT,
      customerName: "Niamh O'Sullivan-D'Arcy",
      paymentMethod: 'Card',
      amountPence: 12900,
      periodStart: new Date('2026-08-27T10:30:00Z'),
      periodEnd: new Date('2026-09-27T10:30:00Z'),
    },
  },
]

for (const { label, facts } of samples) {
  const started = Date.now()
  const { pdf, fileName } = await renderReceipt(facts)
  writeFileSync(join(outDir, fileName), pdf)
  console.log(
    `${fileName.padEnd(42)} ${String(pdf.length).padStart(7)} bytes  ` +
      `${String(Date.now() - started).padStart(5)}ms  ${label}`,
  )
}

console.log(`\n${samples.length} receipts written to ${outDir}`)
