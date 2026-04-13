import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        // Fetch all stations
        const { data: stations } = await supabase
            .from('stations')
            .select('*, domains(name)')
            .order('created_at', { ascending: false });

        // Fetch recent sessions with results
        const { data: sessions } = await supabase
            .from('clinical_sessions')
            .select('*, stations(id, title, patient_name), session_results(*), profiles(email, full_name)')
            .order('started_at', { ascending: false })
            .limit(50);

        return NextResponse.json({ stations: stations || [], sessions: sessions || [] });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
