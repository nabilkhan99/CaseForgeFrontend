import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        // Fetch all active stations (bypasses RLS — this is public data)
        const { data: stations, error: stationsError } = await supabase
            .from('stations')
            .select('id, title, patient_name, patient_age, difficulty, consultation_type, reading_duration_seconds, consultation_duration_seconds, candidate_instructions, domain_id')
            .eq('is_active', true)
            .order('title');

        if (stationsError || !stations) {
            return NextResponse.json({ error: 'Failed to fetch stations' }, { status: 500 });
        }

        // Fetch domains
        const domainIds = [...new Set(stations.map(s => s.domain_id))];
        const { data: domains } = await supabase
            .from('domains')
            .select('id, name, description')
            .in('id', domainIds)
            .order('name');

        if (!domains) {
            return NextResponse.json({ error: 'Failed to fetch domains' }, { status: 500 });
        }

        // Build domain map
        const domainMap: Record<string, { name: string; description: string | null }> = {};
        domains.forEach(d => {
            domainMap[d.id] = { name: d.name, description: d.description };
        });

        // Group stations by domain
        const grouped: Record<string, typeof stations> = {};
        stations.forEach(s => {
            if (!grouped[s.domain_id]) grouped[s.domain_id] = [];
            grouped[s.domain_id].push(s);
        });

        const result = domains
            .filter(d => grouped[d.id]?.length > 0)
            .map(d => ({
                id: d.id,
                name: d.name,
                description: d.description,
                cases: grouped[d.id].map(s => ({
                    ...s,
                    domain_name: domainMap[s.domain_id]?.name || 'Unknown',
                })),
            }));

        return NextResponse.json({ domains: result });
    } catch (error) {
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
