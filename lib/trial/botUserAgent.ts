/**
 * Is this request's User-Agent a crawler, a link unfurler or a script?
 *
 * `/try/talk` opens a paid-for consultation as a side effect of a GET. Its
 * prefetch check catches browsers reaching ahead; this catches the machines
 * that fetch a link on purpose: search crawlers following it, chat apps
 * building a preview card, AI crawlers, and plain HTTP clients.
 *
 * A denylist of tokens those clients actually send. Matching a bare "bot"
 * would refuse real phones (the Cubot handsets put "CUBOT" in their UA), so the
 * generic rules need the shapes crawlers use: "SomethingBot/1.0", a contact URL
 * like "(+https://example.com/bot.html)", or the words crawler and spider. An
 * empty User-Agent is refused too: every browser sends one.
 */

const GENERIC = [
  /bot\//i,
  /\+https?:\/\//i,
  /crawler/i,
  /spider/i,
  /headlesschrome/i,
  /lighthouse/i,
]

const NAMED = [
  'facebookexternalhit',
  'facebot',
  'slackbot',
  'twitterbot',
  'linkedinbot',
  'discordbot',
  'telegrambot',
  'whatsapp',
  'skypeuripreview',
  'pinterestbot',
  'redditbot',
  'applebot',
  'googlebot',
  'bingbot',
  'bingpreview',
  'google-inspectiontool',
  'googleother',
  'mediapartners-google',
  'adsbot-google',
  'duckduckbot',
  'yandexbot',
  'baiduspider',
  'embedly',
  'iframely',
  'vkshare',
  'mastodon',
  'gptbot',
  'chatgpt-user',
  'claudebot',
  'claude-web',
  'perplexitybot',
  'ccbot',
  'bytespider',
  'petalbot',
  'ahrefsbot',
  'semrushbot',
  'mj12bot',
  'python-requests',
  'python-urllib',
  'curl/',
  'wget/',
  'go-http-client',
  'node-fetch',
  'axios/',
  'undici',
  'okhttp',
]

export function isKnownBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? '').trim()
  if (!ua) return true
  const lower = ua.toLowerCase()
  if (NAMED.some((token) => lower.includes(token))) return true
  return GENERIC.some((pattern) => pattern.test(ua))
}
