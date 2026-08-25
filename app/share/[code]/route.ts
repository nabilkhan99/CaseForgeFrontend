import { NextResponse } from 'next/server'
import { normalizeCode, referralUrl } from '@/lib/commerce/referrals'

interface RouteContext {
  params: Promise<{ code: string }>
}

/**
 * /share/CODE — bounce into WhatsApp with the referral message pre-written.
 *
 * Exists because email clients can't open a native share sheet and Brevo's
 * click-tracker mangles a wa.me URL with an encoded message inside it. The
 * campaign email links here instead: a plain https link the tracker can wrap
 * safely, with the WhatsApp URL built server-side where nothing re-encodes it.
 *
 * Deliberately no code validation or DB lookup: the destination is the
 * sharer's own /r/CODE link, which already handles dead codes by degrading to
 * a plain redirect. Validating here would add a DB round-trip to every share
 * click for no behavioural difference.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { code: rawCode } = await params
  const code = normalizeCode(rawCode ?? '')
  const link = referralUrl('https://www.fourteenfisherman.com', code || 'SHARE')

  const message = `If you're prepping for the SCA — join through my link and you get £100 back on the Complete course: ${link}`
  return NextResponse.redirect(`https://wa.me/?text=${encodeURIComponent(message)}`, 307)
}
