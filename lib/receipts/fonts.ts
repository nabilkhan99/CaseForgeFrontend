import { Font } from '@react-pdf/renderer'
import { POPPINS_400 } from './assets/poppins400'
import { POPPINS_500 } from './assets/poppins500'
import { POPPINS_600 } from './assets/poppins600'
import { LORA_600 } from './assets/lora600'

/**
 * Poppins (body) and Lora (title and total figure), registered from inlined
 * base64 so there is no filesystem read and no network fetch at render time.
 *
 * The spec is blunt about why this matters: a silent fallback is immediately
 * visible on the total figure, which is the one number a finance team looks at.
 * Registering only the weights the template actually uses means a fallback
 * would be a missing FILE, which throws, rather than a quiet substitution.
 *
 * Weights, and where each is used in the template:
 *   Poppins 400 — body default
 *   Poppins 500 — field values, column headings, line-item name, amount
 *   Poppins 600 — the RECEIPT label and the customer's name
 *   Lora    600 — the plan-name title and the total figure
 */

export const BODY_FONT = 'Poppins'
export const DISPLAY_FONT = 'Lora'

let registered = false

/**
 * Idempotent: @react-pdf/font keeps a module-level store, so re-registering on
 * every warm invocation would rebuild the same four font sources for nothing.
 */
export function registerReceiptFonts(): void {
  if (registered) return

  Font.register({
    family: BODY_FONT,
    fonts: [
      { src: POPPINS_400, fontWeight: 400 },
      { src: POPPINS_500, fontWeight: 500 },
      { src: POPPINS_600, fontWeight: 600 },
    ],
  })

  Font.register({
    family: DISPLAY_FONT,
    fonts: [{ src: LORA_600, fontWeight: 600 }],
  })

  // The receipt is a fixed-height A4 sheet of short, deliberate lines. Nothing
  // on it should ever be broken with a hyphen — least of all a customer's name
  // or an email address. Mirrors `hyphens: none` in the spec's CSS.
  Font.registerHyphenationCallback((word) => [word])

  registered = true
}
