import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { REFERRAL_COOKIE, REFERRAL_DISPLAY_COOKIE, normalizeCode } from '@/lib/commerce/referrals'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

// Link-preview crawlers (WhatsApp, Facebook, Twitter/X, LinkedIn, Slack,
// Telegram, Discord, iMessage, search bots). They must receive server-rendered
// Open Graph HTML — not a redirect — or shared referral links show no preview.
const PREVIEW_BOT_UA =
  /bot|crawler|spider|whatsapp|facebookexternalhit|facebot|twitterbot|slackbot|telegrambot|discordbot|linkedinbot|pinterest|skypeuripreview|applebot|googlebot|bingbot|vkshare|redditbot/i

const OG_TITLE = 'Fourteen Fisherman — The Complete SCA Course'
const OG_DESCRIPTION =
  'AI practice on 200 stations, 10 hours of on-demand lectures and a full-day Small-Group Coaching session. Fail your SCA after passing all 200 stations, and we pay you £500.'
const OG_IMAGE = 'https://www.fourteenfisherman.com/og/sca-default.jpg'

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Minimal OG document for crawlers. Humans never see it (they get the 307). */
function previewHtml(canonicalUrl: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(OG_TITLE)}</title>
<meta name="description" content="${escapeHtml(OG_DESCRIPTION)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Fourteen Fisherman">
<meta property="og:url" content="${escapeHtml(canonicalUrl)}">
<meta property="og:title" content="${escapeHtml(OG_TITLE)}">
<meta property="og:description" content="${escapeHtml(OG_DESCRIPTION)}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="1200">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(OG_TITLE)}">
<meta name="twitter:description" content="${escapeHtml(OG_DESCRIPTION)}">
<meta name="twitter:image" content="${OG_IMAGE}">
<meta http-equiv="refresh" content="0;url=https://www.fourteenfisherman.com/#pricing">
</head>
<body><a href="https://www.fourteenfisherman.com/#pricing">Fourteen Fisherman — The Complete SCA Course</a></body>
</html>`
}

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

  // Social/search crawlers get an OG preview document and stop there: no
  // attribution cookie (meaningless for a bot) and no click increment (would
  // inflate the referral dashboard every time a link is shared in a group).
  const userAgent = request.headers.get('user-agent') ?? ''
  if (PREVIEW_BOT_UA.test(userAgent)) {
    return new Response(previewHtml(request.url), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

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
