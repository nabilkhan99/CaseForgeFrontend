import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

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
