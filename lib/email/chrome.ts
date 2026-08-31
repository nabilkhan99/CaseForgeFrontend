/**
 * The house chrome every Fourteen Fisherman email is wrapped in.
 *
 * This markup was copy-pasted into eight senders. That is not a tidiness
 * complaint: each copy had drifted, so a change to the brand — the logo URL,
 * the card colour, the `color-scheme` meta that stops Outlook dark mode
 * inverting the cream — had to be found and made eight times, and the copies
 * that were missed just stayed wrong. This is the one definition.
 *
 * Deliberately string templates rather than a component library: these are
 * table-based emails with inline styles, which is the only thing that renders
 * the same in Outlook, Gmail and Apple Mail, and no renderer we have produces
 * that shape better than a template literal does.
 *
 * Adopted so far by {@link ./receiptEmail} and {@link ./accountEmail}. The
 * remaining senders (referralEmail, payoutReadyEmail, verificationEmail,
 * leadAlertEmail) still carry their own copies and should be migrated onto this
 * when they are next touched.
 */

export const BRAND = {
  senderName: 'Fourteen Fisherman',
  senderEmail: 'hello@fourteenfisherman.com',
  siteUrl: 'https://www.fourteenfisherman.com',
  logoUrl: 'https://www.fourteenfisherman.com/fourteenfishermann-dark.png',
} as const

const COLORS = {
  pageBg: '#F5F0EB',
  cardBg: '#FFFCF8',
  heading: '#1C1917',
  body: '#44403C',
  quiet: '#78716C',
  amber: '#B45309',
} as const

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Plus Jakarta Sans','Segoe UI',Roboto,sans-serif"

/** One body paragraph. */
export function paragraph(text: string): string {
  return `<p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:${COLORS.body};">${text}</p>`
}

/**
 * The primary action, as a real button.
 *
 * `href` is interpolated verbatim and never HTML-escaped. That is deliberate
 * and it is load-bearing: escaping `&` to `&amp;` inside an href silently
 * corrupts every set-password token we send, and the buyer is told their link
 * has expired. Callers pass a URL they built themselves, never user input.
 */
export function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background-color:${COLORS.amber};color:#FFFFFF;font-size:16px;font-weight:600;line-height:1;text-decoration:none;padding:16px 28px;border-radius:12px;">${label}</a>`
}

/**
 * The same URL again as plain text under the button.
 *
 * Not decoration: a button is an `<a>` with a background, and the clients most
 * likely to strip or mangle it are the corporate ones a trainee's deanery
 * address sits behind. The copyable URL is the fallback that stops a stripped
 * button becoming a support ticket.
 */
export function fallbackLink(href: string): string {
  return `<p style="margin:0;font-size:13px;line-height:1.5;color:${COLORS.quiet};word-break:break-all;">Or paste this into your browser:<br><a href="${href}" style="color:${COLORS.quiet};">${href}</a></p>`
}

export function divider(): string {
  return `<div style="height:1px;line-height:1px;font-size:1px;background-color:rgba(28,25,23,0.08);">&nbsp;</div>`
}

export function signoff(closing: string): string {
  return `<p style="margin:0 0 4px 0;font-size:15px;line-height:1.5;color:${COLORS.body};">${closing}</p>
                <p style="margin:0;font-size:15px;line-height:1.5;font-weight:600;color:${COLORS.heading};">The Fourteen Fisherman Team</p>`
}

/** One row of the card. `padding` is the CSS shorthand for its cell. */
export function row(html: string, padding: string): string {
  return `<tr>
              <td style="padding:${padding};">
                ${html}
              </td>
            </tr>`
}

export interface EmailShellArgs {
  /** `<title>`, and what a client with no preheader support shows. */
  title: string
  /** The grey line under the subject in the inbox list. */
  preheader: string
  /** The big line at the top of the card. */
  heading: string
  /** Card rows, in order. Build them with {@link row}. */
  rows: readonly string[]
  /** Small print beneath the card. Defaults to the plain brand line. */
  footerHtml?: string
}

/**
 * Wrap content in the house shell: cream page, rounded card, wordmark, heading.
 */
export function emailShell({
  title,
  preheader,
  heading,
  rows,
  footerHtml,
}: EmailShellArgs): string {
  const footer =
    footerHtml ??
    `<p style="margin:0;font-size:13px;line-height:1.5;color:${COLORS.quiet};">${BRAND.senderName} · <a href="${BRAND.siteUrl}" style="color:${COLORS.quiet};text-decoration:underline;">fourteenfisherman.com</a></p>`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${COLORS.pageBg};font-family:${FONT_STACK};color:${COLORS.heading};-webkit-font-smoothing:antialiased;">
    <div style="display:none;font-size:1px;color:${COLORS.pageBg};line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${COLORS.pageBg};">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background-color:${COLORS.cardBg};border-radius:18px;border:1px solid rgba(28,25,23,0.06);box-shadow:0 1px 2px rgba(28,25,23,0.04);">
            <tr>
              <td style="padding:36px 40px 8px 40px;">
                <img src="${BRAND.logoUrl}" alt="Fourteen Fisherman" width="200" height="30" style="display:block;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 0 40px;">
                <h1 style="margin:0;font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-0.02em;color:${COLORS.heading};">${heading}</h1>
              </td>
            </tr>
            ${rows.join('\n            ')}
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
            <tr>
              <td style="padding:20px 8px 0 8px;text-align:center;">
                ${footer}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
