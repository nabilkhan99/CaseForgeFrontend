import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(req: NextRequest) {
    const stationId = req.nextUrl.searchParams.get('stationId');

    if (!stationId) {
        return NextResponse.json({ error: 'stationId required' }, { status: 400 });
    }

    try {
        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from('stations')
            .select('id, candidate_instructions')
            .eq('id', stationId)
            .eq('is_free_trial', true)
            .eq('is_active', true)
            .single();

        if (error || !data) {
            return NextResponse.json({ error: 'Station not found or not available for free trial' }, { status: 404 });
        }

        return NextResponse.json({ candidate_instructions: data.candidate_instructions });
    } catch (error) {
        console.error('Station detail error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
