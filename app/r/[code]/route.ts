import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { REFERRAL_COOKIE, REFERRAL_DISPLAY_COOKIE, normalizeCode } from '@/lib/commerce/referrals'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days


interface RouteContext {
  params: Promise<{ code: string }>
}

/**
 * Referral landing link: /r/CODE
 *
 * Validates the code (exists + active) and, if valid, drops the `ff_ref`
 * attribution cookie. ALWAYS redirects to /#pricing regardless of validity so
 * the redirect itself reveals nothing. Note: the presence of `Set-Cookie` still
 * differs for valid codes — a deliberate, accepted trade-off (codes are
 * shareable marketing handles, not secrets; a discovered code only rewards its
 * owner).
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { code: rawCode } = await params
  const origin = new URL(request.url).origin
  const response = NextResponse.redirect(`${origin}/#pricing`)

  const code = normalizeCode(rawCode ?? '')
  if (!code) return response

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('referral_codes')
      .select('code, active')
      .eq('code', code)
      .maybeSingle()

    if (error) {
      console.error('[referral-link] code lookup failed', { code, error })
      return response
    }

    if (data?.active) {
      response.cookies.set(REFERRAL_COOKIE, data.code, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
      })

      // Display-only flag (value carries no data): readable by the client so
      // the landing page can show the "you were recommended" notice. Never used
      // for attribution (checkout re-validates ff_ref server-side).
      response.cookies.set(REFERRAL_DISPLAY_COOKIE, '1', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
      })

      // Track the click atomically (dashboard analytics). Non-fatal: a failure
      // here must never break attribution — the cookie is already set above.
      const { error: clickError } = await supabase.rpc('increment_referral_click', {
        p_code: data.code,
      })
      if (clickError) {
        console.error('[referral-link] click increment failed', { code: data.code, clickError })
      }
    }
  } catch (error: unknown) {
    console.error('[referral-link] unexpected error', error)
  }

  return response
}
