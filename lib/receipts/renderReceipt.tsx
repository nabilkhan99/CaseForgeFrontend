import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { ReceiptDocument } from './ReceiptDocument'
import { registerReceiptFonts } from './fonts'
import { buildReceiptContent, type ReceiptContent, type ReceiptFacts } from './receiptContent'

/**
 * Render one receipt to PDF bytes, in-process.
 *
 * Fonts are registered here rather than at module load: @react-pdf/font's store
 * is global and lazy, and registering on first render keeps the cost off the
 * cold start of every other route that happens to pull this module in.
 *
 * JSX rather than `React.createElement` on purpose — `createElement` narrows the
 * element type to this component's own props, which no longer matches the
 * `ReactElement<DocumentProps>` renderToBuffer is typed against.
 */
export interface RenderedReceipt {
  pdf: Buffer
  /** `Fourteen-Fisherman-receipt-FF-26-4478.pdf` */
  fileName: string
  content: ReceiptContent
}

export async function renderReceipt(facts: ReceiptFacts): Promise<RenderedReceipt> {
  registerReceiptFonts()
  const content = buildReceiptContent(facts)
  const pdf = await renderToBuffer(<ReceiptDocument content={content} />)
  return { pdf, fileName: content.fileName, content }
}
