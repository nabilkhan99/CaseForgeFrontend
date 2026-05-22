import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BrevoClient, BrevoError } from '@getbrevo/brevo';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  // Diagnostic surface returned in the response so operators can tell, from a
  // single log line, why an expected confirmation email did or didn't go out.
  const diag: {
    inserted: boolean;
    alreadyOnList: boolean;
    emailAttempted: boolean;
    emailSent: boolean;
    emailSkipReason?: 'duplicate' | 'missing_BREVO_API_KEY';
    emailError?: string;
    brevoMessageId?: string;
  } = {
    inserted: false,
    alreadyOnList: false,
    emailAttempted: false,
    emailSent: false,
  };

  try {
    const body = await request.json();
    const { email, full_name, training_stage, sca_date } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const normalisedEmail = email.toLowerCase().trim();

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('waitlist_entries')
      .insert({
        email: normalisedEmail,
        source: 'landing_page',
        full_name: full_name?.trim() ?? null,
        training_stage: training_stage ?? null,
        sca_date: sca_date ?? null,
      });

    // Treat duplicate email as success (23505 = unique_violation)
    if (error && error.code !== '23505') {
      console.error('[waitlist] insert failed', { email: normalisedEmail, error });
      return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 });
    }

    if (error?.code === '23505') {
      diag.alreadyOnList = true;
    } else {
      diag.inserted = true;
    }

    const brevoKey = process.env.BREVO_API_KEY;
    if (!brevoKey) {
      diag.emailSkipReason = 'missing_BREVO_API_KEY';
      console.warn('[waitlist] confirmation email skipped: BREVO_API_KEY not set in env');
    } else if (diag.alreadyOnList) {
      diag.emailSkipReason = 'duplicate';
    } else {
      diag.emailAttempted = true;
      const firstName = full_name?.trim().split(' ')[0] || 'there';
      const brevo = new BrevoClient({ apiKey: brevoKey });

      const htmlBody = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>You're on the Fourteen Fisherman waitlist</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F5F0EB;font-family:-apple-system,BlinkMacSystemFont,'Plus Jakarta Sans','Segoe UI',Roboto,sans-serif;color:#1C1917;-webkit-font-smoothing:antialiased;">
    <!-- Preheader (preview line in inbox) -->
    <div style="display:none;font-size:1px;color:#F5F0EB;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">You're on the list — we'll notify you the moment we go live.</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F5F0EB;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background-color:#FFFCF8;border-radius:18px;border:1px solid rgba(28,25,23,0.06);box-shadow:0 1px 2px rgba(28,25,23,0.04);">
            <tr>
              <td style="padding:36px 40px 8px 40px;">
                <img src="https://www.fourteenfisherman.com/fourteenfishermann.png" alt="Fourteen Fisherman" width="44" height="44" style="display:block;border:0;outline:none;text-decoration:none;border-radius:10px;">
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 0 40px;">
                <h1 style="margin:0;font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-0.02em;color:#1C1917;">You're on the list.</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 0 40px;">
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#44403C;">Hi ${firstName},</p>
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#44403C;">Thanks for joining the Fourteen Fisherman waitlist. We'll email you the moment we go live — and in the meantime we'll send the occasional high-yield SCA tip while you wait.</p>
                <p style="margin:0 0 28px 0;font-size:16px;line-height:1.6;color:#44403C;">Know another GP trainee who'd benefit? Forward this email, or share the link:</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 36px 40px;">
                <a href="https://www.fourteenfisherman.com" style="display:inline-block;background-color:#B45309;color:#FFFCF8;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:10px;letter-spacing:-0.005em;mso-padding-alt:0;">
                  www.fourteenfisherman.com
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px;">
                <div style="height:1px;line-height:1px;font-size:1px;background-color:rgba(28,25,23,0.08);">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 36px 40px;">
                <p style="margin:0 0 4px 0;font-size:15px;line-height:1.5;color:#44403C;">Speak soon,</p>
                <p style="margin:0;font-size:15px;line-height:1.5;font-weight:600;color:#1C1917;">The Fourteen Fisherman team</p>
              </td>
            </tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
            <tr>
              <td style="padding:20px 8px 0 8px;text-align:center;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#78716C;">Fourteen Fisherman · The gold standard for SCA prep<br><a href="https://www.fourteenfisherman.com" style="color:#78716C;text-decoration:underline;">fourteenfisherman.com</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

      const textBody = `Hi ${firstName},

You're on the Fourteen Fisherman waitlist. We'll email you the moment we go live — and in the meantime we'll send the occasional high-yield SCA tip while you wait.

Know another GP trainee who'd benefit? Forward this email, or share the link: https://www.fourteenfisherman.com

Speak soon,
The Fourteen Fisherman team

—
Fourteen Fisherman · The gold standard for SCA prep
https://www.fourteenfisherman.com`;

      try {
        const result = await brevo.transactionalEmails.sendTransacEmail({
          sender: { name: 'Fourteen Fisherman', email: 'hello@fourteenfisherman.com' },
          to: [{ email: normalisedEmail, name: full_name?.trim() || undefined }],
          subject: "You're on the Fourteen Fisherman waitlist",
          htmlContent: htmlBody,
          textContent: textBody,
          tags: ['waitlist-confirmation'],
        });
        diag.emailSent = true;
        diag.brevoMessageId = result.messageId;
        console.log('[waitlist] confirmation email sent', {
          email: normalisedEmail,
          brevoMessageId: result.messageId,
        });
      } catch (emailErr) {
        if (emailErr instanceof BrevoError) {
          diag.emailError = `${emailErr.statusCode} ${emailErr.message}`;
          console.error('[waitlist] Brevo API error', {
            email: normalisedEmail,
            statusCode: emailErr.statusCode,
            message: emailErr.message,
          });
        } else {
          diag.emailError = emailErr instanceof Error ? emailErr.message : String(emailErr);
          console.error('[waitlist] Brevo SDK threw', { email: normalisedEmail, emailErr });
        }
      }
    }

    // Single structured summary line at the end — grep for "[waitlist] signup processed"
    // in Vercel logs to audit each signup attempt.
    console.log('[waitlist] signup processed', { email: normalisedEmail, ...diag });
    return NextResponse.json({ success: true, ...diag });
  } catch (error) {
    console.error('[waitlist] unhandled', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from('waitlist_entries')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Waitlist count error:', error);
      return NextResponse.json({ count: 0 });
    }

    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error('Waitlist count API error:', error);
    return NextResponse.json({ count: 0 });
  }
}
