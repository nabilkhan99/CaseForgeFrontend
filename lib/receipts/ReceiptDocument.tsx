import React from 'react'
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { RECEIPT_LOGO_PNG } from './assets/logo'
import { BODY_FONT, DISPLAY_FONT } from './fonts'
import type { ReceiptContent } from './receiptContent'

/**
 * The receipt sheet, as react-pdf primitives.
 *
 * This is a direct transcription of the A4 HTML/CSS template in section 5 of
 * the receipt spec. Every measurement there is in mm or pt; react-pdf works in
 * pt, so the millimetre figures are converted through {@link mm} and the point
 * figures are written as-is. Keeping the spec's own numbers visible in the call
 * — `mm(16)`, not `45.35` — is what makes this checkable against the template.
 *
 * Why react-pdf rather than the spec's suggested WeasyPrint or Puppeteer: this
 * renders inside the Stripe webhook on Vercel's Hobby plan, where the function
 * budget is 60 seconds and a Chromium binary does not fit. react-pdf is pure JS
 * and runs in-process, so a receipt costs no extra service and no cold browser.
 *
 * Two CSS constructs have no react-pdf equivalent and are expressed differently:
 *   * `.frame::after` — a second absolutely positioned View, inset by the same
 *     1.5mm the pseudo-element used.
 *   * `letter-spacing` in `em` — react-pdf takes points, so each is multiplied
 *     out against its own font size (see the comments on each value).
 */

/** Millimetres to PDF points. A4 is 210 x 297mm = 595.28 x 841.89pt. */
const mm = (value: number): number => value * 2.834645669

const COLORS = {
  cream: '#F7F2E7',
  ink: '#1C1C1A',
  brown: '#3C2210',
  amber: '#B45309',
  muted: '#7C7266',
  hair: '#D9CFBC',
} as const

/** The wordmark is 1920x224, and the template pins its height at 5.6mm. */
const LOGO_ASPECT = 1920 / 224
const LOGO_HEIGHT = mm(5.6)

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.cream,
    fontFamily: BODY_FONT,
    fontWeight: 400,
    fontSize: 9,
    color: COLORS.ink,
  },

  // .sheet — padding: 16mm 18mm 14mm 18mm
  sheet: {
    flexDirection: 'column',
    height: '100%',
    paddingTop: mm(16),
    paddingRight: mm(18),
    paddingBottom: mm(14),
    paddingLeft: mm(18),
  },

  // .frame — inset 8mm from the page edge, 0.5pt hairline
  frame: {
    position: 'absolute',
    top: mm(8),
    left: mm(8),
    right: mm(8),
    bottom: mm(8),
    borderWidth: 0.5,
    borderStyle: 'solid',
    borderColor: COLORS.hair,
  },
  // .frame::after — a second rule 1.5mm inside the first, 0.4pt
  frameInner: {
    position: 'absolute',
    top: mm(8) + mm(1.5),
    left: mm(8) + mm(1.5),
    right: mm(8) + mm(1.5),
    bottom: mm(8) + mm(1.5),
    borderWidth: 0.4,
    borderStyle: 'solid',
    borderColor: COLORS.hair,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    height: LOGO_HEIGHT,
    width: LOGO_HEIGHT * LOGO_ASPECT,
  },
  docLabel: {
    fontSize: 7,
    fontWeight: 600,
    letterSpacing: 7 * 0.2, // 0.2em at 7pt
    textTransform: 'uppercase',
    color: COLORS.brown,
  },

  title: {
    fontFamily: DISPLAY_FONT,
    fontWeight: 600,
    fontSize: 17,
    color: COLORS.brown,
    marginTop: mm(12),
  },
  strapline: {
    fontSize: 8.4,
    color: COLORS.muted,
    marginTop: mm(1.8),
    paddingBottom: mm(5.5),
    borderBottomWidth: 0.7,
    borderBottomStyle: 'solid',
    borderBottomColor: COLORS.hair,
  },

  label: {
    fontSize: 5.9,
    fontWeight: 500,
    letterSpacing: 5.9 * 0.17, // 0.17em at 5.9pt
    textTransform: 'uppercase',
    color: COLORS.muted,
    marginBottom: mm(1.7),
  },
  value: {
    fontSize: 8.8,
    fontWeight: 500,
    lineHeight: 1.4,
  },

  meta: {
    flexDirection: 'row',
    paddingTop: mm(4.6),
    paddingBottom: mm(4),
    borderBottomWidth: 0.7,
    borderBottomStyle: 'solid',
    borderBottomColor: COLORS.hair,
  },
  metaCell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    paddingRight: mm(6),
  },

  issuedTo: {
    paddingTop: mm(4.6),
    paddingBottom: mm(4),
    borderBottomWidth: 0.7,
    borderBottomStyle: 'solid',
    borderBottomColor: COLORS.hair,
  },
  customerName: {
    fontSize: 10.4,
    fontWeight: 600,
    lineHeight: 1.4,
    color: COLORS.brown,
  },

  table: {
    marginTop: mm(9),
  },
  tableHead: {
    flexDirection: 'row',
    paddingBottom: mm(2.8),
    borderBottomWidth: 0.7,
    borderBottomStyle: 'solid',
    borderBottomColor: COLORS.hair,
  },
  th: {
    fontSize: 5.9,
    fontWeight: 500,
    letterSpacing: 5.9 * 0.17,
    textTransform: 'uppercase',
    color: COLORS.muted,
  },
  itemRow: {
    flexDirection: 'row',
    paddingTop: mm(4.4),
    paddingBottom: mm(4.4),
  },
  itemName: {
    fontSize: 9.6,
    fontWeight: 500,
    color: COLORS.brown,
  },
  itemDesc: {
    fontSize: 8,
    color: COLORS.muted,
    lineHeight: 1.65,
    marginTop: mm(2),
  },
  amount: {
    fontSize: 9.6,
    fontWeight: 500,
    textAlign: 'right',
  },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: mm(4.4),
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: COLORS.brown,
  },
  totalLabel: {
    fontSize: 6.4,
    fontWeight: 500,
    letterSpacing: 6.4 * 0.17, // 0.17em at 6.4pt
    textTransform: 'uppercase',
    color: COLORS.muted,
  },
  totalAmount: {
    fontFamily: DISPLAY_FONT,
    fontWeight: 600,
    fontSize: 18,
    color: COLORS.amber,
    lineHeight: 1,
    textAlign: 'right',
  },

  // The description column takes the space the amount column does not need.
  descriptionColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingRight: mm(6) },
  amountColumn: { flexShrink: 0 },

  terms: {
    marginTop: mm(7),
    fontSize: 8,
    lineHeight: 1.7,
    color: COLORS.muted,
  },

  // Pushes the footer to the bottom of the sheet however short the content is.
  spacer: { flexGrow: 1, minHeight: mm(8) },
  footNote: {
    textAlign: 'center',
    fontSize: 7.4,
    letterSpacing: 7.4 * 0.03, // 0.03em at 7.4pt
    color: COLORS.muted,
  },
})

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

export function ReceiptDocument({ content }: { content: ReceiptContent }) {
  return (
    <Document
      title={`Receipt ${content.receiptNumber} — Fourteen Fisherman`}
      author="Fourteen Fisherman"
      subject={`${content.planName} — ${content.amount}`}
      creator="Fourteen Fisherman"
      producer="Fourteen Fisherman"
    >
      <Page size="A4" orientation="portrait" style={styles.page}>
        <View style={styles.frame} fixed />
        <View style={styles.frameInner} fixed />

        <View style={styles.sheet}>
          <View style={styles.header}>
            {/* react-pdf's Image is a PDF primitive with no alt attribute. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image style={styles.logo} src={RECEIPT_LOGO_PNG} />
            <Text style={styles.docLabel}>Receipt</Text>
          </View>

          <Text style={styles.title}>{content.planName}</Text>
          <Text style={styles.strapline}>{content.planStrapline}</Text>

          <View style={styles.meta}>
            <MetaField label="Receipt number" value={content.receiptNumber} />
            <MetaField label="Date of payment" value={content.paymentDate} />
            <MetaField label="Payment method" value={content.paymentMethod} />
            <MetaField label="Status" value="Paid in full" />
          </View>

          <View style={styles.issuedTo}>
            <Text style={styles.label}>Issued to</Text>
            <Text style={styles.customerName}>{content.customerName}</Text>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHead}>
              <View style={styles.descriptionColumn}>
                <Text style={styles.th}>Description</Text>
              </View>
              <View style={styles.amountColumn}>
                <Text style={[styles.th, { textAlign: 'right' }]}>Amount</Text>
              </View>
            </View>

            <View style={styles.itemRow}>
              <View style={styles.descriptionColumn}>
                <Text style={styles.itemName}>{content.planName}</Text>
                <View style={styles.itemDesc}>
                  {/* One line per `<span>` in the spec's LINE_ITEMS. */}
                  {content.lineItems.map((line) => (
                    <Text key={line}>{line}</Text>
                  ))}
                </View>
              </View>
              <View style={styles.amountColumn}>
                <Text style={styles.amount}>{content.amount}</Text>
              </View>
            </View>

            <View style={styles.totalRow}>
              <View style={styles.descriptionColumn}>
                <Text style={styles.totalLabel}>{content.totalLabel}</Text>
              </View>
              <View style={styles.amountColumn}>
                <Text style={styles.totalAmount}>{content.amount}</Text>
              </View>
            </View>
          </View>

          <View style={styles.terms}>
            {/* One line per `<br>` in the spec's TERMS_BLOCK. */}
            {content.terms.map((line) => (
              <Text key={line}>{line}</Text>
            ))}
          </View>

          <View style={styles.spacer} />

          <Text style={styles.footNote}>
            Fourteen Fisherman &nbsp;·&nbsp; hello@fourteenfisherman.com
          </Text>
        </View>
      </Page>
    </Document>
  )
}
