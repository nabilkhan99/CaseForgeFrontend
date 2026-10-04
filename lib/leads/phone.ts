/**
 * Phone numbers as the list shows them, with a tap-to-call link.
 *
 * The trial form's normaliser stores a UK mobile typed without its leading 0
 * as +7…, a Russian number (lib/trial/phone.ts). Until that is fixed and the
 * rows corrected, the list shows the likely UK number, links to it, and flags
 * the row so nobody texts the stored one.
 */

export interface PhoneView {
  display: string
  /** A tel: link, or null when the number cannot be dialled. */
  tel: string | null
  malformed: boolean
}

export function phoneView(raw: string | null | undefined): PhoneView | null {
  const phone = raw?.trim()
  if (!phone) return null
  if (/^\+7\d{9}$/.test(phone)) {
    const likely = `+44${phone.slice(1)}`
    return { display: `+44 ${phone.slice(1, 5)} ${phone.slice(5)}`, tel: `tel:${likely}`, malformed: true }
  }
  if (/^\+44\d{10}$/.test(phone)) {
    return { display: `+44 ${phone.slice(3, 7)} ${phone.slice(7)}`, tel: `tel:${phone}`, malformed: false }
  }
  const dialable = phone.replace(/[^\d+]/g, '')
  return { display: phone, tel: /^\+?\d{9,15}$/.test(dialable) ? `tel:${dialable}` : null, malformed: false }
}
