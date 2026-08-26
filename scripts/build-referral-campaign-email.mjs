/**
 * Builds the referral-programme campaign email (Brevo campaign 6).
 *
 *   node scripts/build-referral-campaign-email.mjs <outdir>
 *
 * Writes:
 *   <outdir>/referral-email-campaign.html — Brevo merge tags intact, hero from
 *     the hosted URL. This is what goes into the campaign via the API.
 *   <outdir>/referral-email-filled.html — tags filled with a real example
 *     (Ishaq's code) for eyeballing in a browser.
 *
 * Copy is Nabil's own wording (2026-08-21) — plain, not salesy. The button
 * opens WhatsApp with the share message pre-written because a mailto/native
 * share isn't possible from email, and WhatsApp is where this audience shares;
 * a plain link to the sharer's own page would just refer them to themselves.
 */
import { writeFileSync } from 'node:fs';

const outdir = process.argv[2] ?? '.';
const HERO = 'https://www.fourteenfisherman.com/email/referral-hero.jpg';

// Our own share page (app/share/[code]). Linking wa.me directly broke twice
// over: Brevo's click-tracker re-encodes wrapped links, and wa.me's web
// interstitial cannot hand off to the app from inside an email client's
// in-app browser, so it dead-ends on "install WhatsApp". The page offers the
// native share sheet instead, with clipboard copy as the fallback.
/** Same five steps the share page lists, so the two never drift apart. */
const HOW_IT_WORKS = [
  'Share your link with your friends.',
  'They sign up through your link.',
  'We verify which course they joined.',
  'We email you both to arrange payment.',
  'You both get paid.',
];

const WA_HREF = '{{ contact.REFERRAL_SHARE_URL }}';

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>£100 for you. £100 for them</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F5F0EB;font-family:-apple-system,BlinkMacSystemFont,'Plus Jakarta Sans','Segoe UI',Roboto,sans-serif;color:#1C1917;-webkit-font-smoothing:antialiased;">
    <div style="display:none;font-size:1px;color:#F5F0EB;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">Split £200 with your mates. Your personal link is inside.</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F5F0EB;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background-color:#FFFCF8;border-radius:18px;border:1px solid rgba(28,25,23,0.06);box-shadow:0 1px 2px rgba(28,25,23,0.04);">
            <tr>
              <td style="padding:36px 40px 20px 40px;">
                <img src="https://www.fourteenfisherman.com/fourteenfishermann-dark.png" alt="Fourteen Fisherman" width="200" height="30" style="display:block;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td style="padding:0 20px;">
                <img src="${HERO}" alt="£100 for you, £100 for them." width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0;outline:none;text-decoration:none;border-radius:12px;">
              </td>
            </tr>
            <tr>
              <td style="padding:26px 40px 0 40px;">
                <h1 style="margin:0 0 18px 0;font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:#1C1917;">Split &pound;200 with your mates.</h1>
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#44403C;">{% if contact.FIRSTNAME %}Hi {{ contact.FIRSTNAME }},{% else %}Hi there,{% endif %}</p>
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#44403C;">You found us early, so you get this first: we&rsquo;ve just launched a referral programme, and we&rsquo;ve made it a generous one.</p>
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#44403C;">Send your personal link to another GP trainee sweating the SCA and you both get paid: <strong style="color:#1C1917;">&pound;100 for you, and &pound;100 for them</strong> when they join the Complete SCA Course.</p>
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#44403C;">They sign up through your link and their &pound;100 comes back to them by bank transfer after they join. The course itself stays a full-price course on a full-price receipt, which matters if they&rsquo;re claiming it on their study budget.</p>
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#44403C;">We see they signed up through your link, and we send you your &pound;100 by bank transfer too.</p>
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#44403C;">Other plans pay too: Self-Study is <strong style="color:#1C1917;">&pound;50 each</strong> (even on the monthly plan).</p>
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#44403C;">Your link is live until <strong style="color:#1C1917;">26 September</strong>, then it stops working.</p>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;color:#78716C;">Your referral page:</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 8px 40px;">
                <a href="${WA_HREF}" style="display:inline-block;background-color:#B45309;color:#FFFCF8;font-size:15px;font-weight:600;text-decoration:none;padding:14px 26px;border-radius:10px;letter-spacing:-0.005em;mso-padding-alt:0;">
                  Open my referral page
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 40px 0 40px;">
                <p style="margin:0;font-size:13px;line-height:1.5;color:#78716C;">Opens your own page, where you can send your link straight to WhatsApp and watch the clicks, signups and payments come in.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 0 40px;">
                <div style="height:1px;line-height:1px;font-size:1px;background-color:rgba(28,25,23,0.08);">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 40px 0 40px;">
                <p style="margin:0 0 14px 0;font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#78716C;">How it works</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  ${HOW_IT_WORKS.map(
                    (step, i) => `<tr>
                    <td valign="top" width="26" style="padding:0 0 10px 0;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                        <td align="center" valign="middle" width="20" height="20" style="width:20px;height:20px;background-color:#F5F0EB;border-radius:10px;font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;font-weight:600;color:#B45309;line-height:20px;">${i + 1}</td>
                      </tr></table>
                    </td>
                    <td valign="top" style="padding:0 0 10px 0;font-size:14px;line-height:1.5;color:#44403C;">${step}</td>
                  </tr>`,
                  ).join('')}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 40px 0 40px;">
                <p style="margin:0 0 10px 0;font-size:13px;line-height:1.6;color:#78716C;">There&rsquo;s no cap: every friend who joins through your link pays out again. Transfers go out once the order is confirmed, and we&rsquo;ll email you to arrange yours.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 40px 36px 40px;">
                <p style="margin:0 0 4px 0;font-size:15px;line-height:1.5;color:#44403C;">Speak soon,</p>
                <p style="margin:0;font-size:15px;line-height:1.5;font-weight:600;color:#1C1917;">The Fourteen Fisherman Team</p>
              </td>
            </tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
            <tr>
              <td style="padding:20px 8px 0 8px;text-align:center;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#78716C;">Fourteen Fisherman &middot; The gold standard for SCA prep<br><a href="https://www.fourteenfisherman.com" style="color:#78716C;text-decoration:underline;">fourteenfisherman.com</a> &middot; <a href="{{ unsubscribe }}" style="color:#78716C;text-decoration:underline;">Unsubscribe</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

writeFileSync(`${outdir}/referral-email-campaign.html`, html);
writeFileSync(
  `${outdir}/referral-email-filled.html`,
  html
    .replace('{% if contact.FIRSTNAME %}Hi {{ contact.FIRSTNAME }},{% else %}Hi there,{% endif %}', 'Hi Ishaq,')
    .replaceAll('{{ contact.REFERRAL_URL }}', 'https://www.fourteenfisherman.com/r/SHAQ2A8Z')
    .replaceAll('{{ contact.REFERRAL_CODE }}', 'SHAQ2A8Z')
    .replace('{{ unsubscribe }}', '#'),
);
console.log('built campaign + filled');
