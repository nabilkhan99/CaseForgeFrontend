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

      try {
        const result = await brevo.transactionalEmails.sendTransacEmail({
          sender: { name: 'Fourteen Fisherman', email: 'hello@fourteenfisherman.com' },
          to: [{ email: normalisedEmail, name: full_name?.trim() || undefined }],
          subject: 'Spot reserved — here’s what happens next',
          htmlContent: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #1C1917;">
  <p style="font-size: 16px; line-height: 1.7; margin-bottom: 20px;">Hi ${firstName},</p>
  <p style="font-size: 16px; line-height: 1.7; margin-bottom: 20px;">You’re on the list. We’ll notify you the moment we go live — and send you high-yield SCA tips while you wait.</p>
  <p style="font-size: 16px; line-height: 1.7; margin-bottom: 20px;">Know another GP trainee who’d benefit? Share this link with them:<br><a href="https://www.fourteenfisherman.com/waitlist" style="color: #B45309; text-decoration: underline;">www.fourteenfisherman.com/waitlist</a></p>
  <p style="font-size: 16px; line-height: 1.7; margin-bottom: 8px;">Speak soon,</p>
  <p style="font-size: 16px; line-height: 1.7; font-weight: 600;">The Fourteen Fisherman team</p>
</div>`,
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
