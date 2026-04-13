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

        const { data: stations, error } = await supabase
            .from('stations')
            .select('id, title, patient_name, patient_age, difficulty, reading_duration_seconds, consultation_duration_seconds, domains(id, name)')
            .eq('is_active', true)
            .eq('is_free_trial', true)
            .order('title');

        if (error) {
            console.error('Error fetching free cases:', error);
            return NextResponse.json({ error: 'Failed to fetch cases' }, { status: 500 });
        }

        return NextResponse.json({ stations: stations || [] });
    } catch (error) {
        console.error('Free cases API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
