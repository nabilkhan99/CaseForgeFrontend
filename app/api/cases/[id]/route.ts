import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
    const { id } = await context.params;

    if (!id) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    try {
        const supabase = getSupabaseAdmin();

        const { data: station, error } = await supabase
            .from('stations')
            .select('id, title, patient_name, patient_age, difficulty, consultation_type, reading_duration_seconds, consultation_duration_seconds, candidate_instructions, station_script, data_gathering, clinical_management, relating_to_others, clinical_learning_points, domain_id')
            .eq('id', id)
            .eq('is_active', true)
            .single();

        if (error || !station) {
            return NextResponse.json({ error: 'Case not found' }, { status: 404 });
        }

        const { data: domain } = await supabase
            .from('domains')
            .select('name')
            .eq('id', station.domain_id)
            .single();

        return NextResponse.json({
            case: {
                ...station,
                domain_name: domain?.name || 'Unknown',
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
