import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── Supabase admin client (server-side only) ──

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

// ── API Route Handler (thin trigger + result checker) ──

export async function POST(request: NextRequest) {
    try {
        const { sessionId } = await request.json();
        if (!sessionId) {
            return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // 1. Check if feedback already exists → return immediately
        const { data: existingResults } = await supabase
            .from('session_results')
            .select('*')
            .eq('session_id', sessionId)
            .maybeSingle();

        if (existingResults) {
            const { data: session } = await supabase
                .from('clinical_sessions')
                .select('overall_score, station_id, stations(title)')
                .eq('id', sessionId)
                .single();

            return NextResponse.json({
                status: 'ready',
                feedback: {
                    data_gathering: {
                        domain: 'Data Gathering',
                        score: existingResults.data_gathering_score || 0,
                        strengths: existingResults.data_gathering_feedback?.strengths || [],
                        improvements: existingResults.data_gathering_feedback?.improvements || [],
                    },
                    clinical_management: {
                        domain: 'Clinical Management',
                        score: existingResults.clinical_management_score || 0,
                        strengths: existingResults.clinical_management_feedback?.strengths || [],
                        improvements: existingResults.clinical_management_feedback?.improvements || [],
                    },
                    interpersonal_skills: {
                        domain: 'Interpersonal Skills',
                        score: existingResults.interpersonal_skills_score || 0,
                        strengths: existingResults.interpersonal_skills_feedback?.strengths || [],
                        improvements: existingResults.interpersonal_skills_feedback?.improvements || [],
                    },
                    overall_summary: existingResults.overall_summary || '',
                    key_learning_points: existingResults.key_learning_points || [],
                    overall_score: session?.overall_score || 0,
                    station_title: (session?.stations as { title?: string } | null)?.title || 'Station Feedback',
                },
            });
        }

        // 2. Verify session exists and has a transcript
        const { data: session, error: sessionError } = await supabase
            .from('clinical_sessions')
            .select('id, transcript, status')
            .eq('id', sessionId)
            .single();

        if (sessionError || !session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        if (!session.transcript || (Array.isArray(session.transcript) && session.transcript.length === 0)) {
            return NextResponse.json({ error: 'No transcript available yet' }, { status: 404 });
        }

        // 3. Trigger Supabase Edge Function (fire-and-forget)
        //    The Edge Function has 150s timeout — plenty for Gemini.
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        fetch(`${supabaseUrl}/functions/v1/generate-feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ sessionId }),
        }).catch((err) => {
            console.error('Failed to trigger edge function:', err);
        });

        // 4. Return immediately — frontend will poll for results
        return NextResponse.json({ status: 'generating' });
    } catch (error) {
        console.error('Feedback route error:', error);
        return NextResponse.json(
            { error: 'Failed to process request', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
