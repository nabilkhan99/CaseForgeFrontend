import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pushTrialLeadToBrevo } from '@/lib/marketing/trialLead';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The email gate between finishing a free mock station and seeing the report.
 * Records the lead in trial_leads and upserts a Brevo contact (best-effort).
 * Idempotent: re-submitting the same session or email succeeds quietly.
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId, email } = (await req.json()) as { sessionId?: string; email?: string };

    const normalizedEmail = email?.trim().toLowerCase() ?? '';
    if (!sessionId || !EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // The session must exist and be a guest trial session.
    const { data: session, error: sessionError } = await supabase
      .from('clinical_sessions')
      .select('id, user_id, station_id, stations(title)')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) {
      console.error('[capture-lead] session lookup failed', sessionError);
      return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
    }
    if (!session || session.user_id !== null) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { error: insertError } = await supabase.from('trial_leads').insert({
      email: normalizedEmail,
      session_id: sessionId,
      station_id: session.station_id ?? null,
    });

    // 23505 = this session or email already captured — that's fine, let them in.
    if (insertError && insertError.code !== '23505') {
      console.error('[capture-lead] lead insert failed', insertError);
      return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
    }

    const stationTitle = (session.stations as { title?: string } | null)?.title ?? null;
    await pushTrialLeadToBrevo({ email: normalizedEmail, stationTitle, score: null });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('[capture-lead] unexpected error', error);
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
  }
}
