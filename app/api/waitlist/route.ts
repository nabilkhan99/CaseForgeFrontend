import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, full_name, training_stage, sca_date } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('waitlist_entries')
      .insert({
        email: email.toLowerCase().trim(),
        source: 'landing_page',
        full_name: full_name?.trim() ?? null,
        training_stage: training_stage ?? null,
        sca_date: sca_date ?? null,
      });

    // Treat duplicate email as success (23505 = unique_violation)
    if (error && error.code !== '23505') {
      console.error('Waitlist insert error:', error);
      return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 });
    }

    // Send confirmation email (non-blocking — don't fail the request if email fails)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && error?.code !== '23505') {
      const firstName = full_name?.trim().split(' ')[0] || 'there';
      const resend = new Resend(resendKey);
      resend.emails.send({
        from: 'Fourteen Fisherman <hello@fourteenfisherman.com>',
        to: email.toLowerCase().trim(),
        subject: 'Spot reserved — here\u2019s what happens next',
        html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #1C1917;">
  <p style="font-size: 16px; line-height: 1.7; margin-bottom: 20px;">Hi ${firstName},</p>
  <p style="font-size: 16px; line-height: 1.7; margin-bottom: 20px;">You\u2019re on the list. We\u2019ll notify you the moment we go live \u2014 and send you high-yield SCA tips while you wait.</p>
  <p style="font-size: 16px; line-height: 1.7; margin-bottom: 20px;">Know another GP trainee who\u2019d benefit? Share this link with them:<br><a href="https://www.fourteenfisherman.com/waitlist" style="color: #B45309; text-decoration: underline;">www.fourteenfisherman.com/waitlist</a></p>
  <p style="font-size: 16px; line-height: 1.7; margin-bottom: 8px;">Speak soon,</p>
  <p style="font-size: 16px; line-height: 1.7; font-weight: 600;">The Fourteen Fisherman team</p>
</div>`,
      }).catch((emailErr) => {
        console.error('Waitlist confirmation email failed:', emailErr);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Waitlist API error:', error);
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
