import { after, NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { ConsultationFeedback } from '@/lib/clinical-master/types';

/**
 * Feedback orchestrator + poller for the SCA marking engine.
 *
 * If results exist in session_results (new spec schema), return them. Otherwise
 * schedule the Azure Functions marking endpoint (mark-consultation) and return
 * "generating" so the page keeps polling. The Gemini Supabase Edge Function has
 * been retired; marking now runs on Azure (GPT-5.x), guarded by a shared secret.
 */

export const maxDuration = 60;

interface SessionResultRow {
    verdict: string;
    weighted_score: number | string | null;
    max_score: number | string | null;
    one_line_summary: string | null;
    tier3_override_applied: boolean | null;
    domains: unknown;
    timing: unknown;
    focus_areas: unknown;
    capability_links: string[] | null;
    confidence: unknown;
}

function toFeedback(
    sessionId: string,
    row: SessionResultRow,
    stationId: string | undefined,
    stationTitle: string | undefined
): ConsultationFeedback {
    return {
        session_id: sessionId,
        overall: {
            verdict: (row.verdict as ConsultationFeedback['overall']['verdict']) ?? 'Fail',
            weighted_score: Number(row.weighted_score ?? 0),
            max_score: Number(row.max_score ?? 10.5),
            one_line_summary: row.one_line_summary ?? '',
            tier3_override_applied: Boolean(row.tier3_override_applied),
        },
        domains: (row.domains as ConsultationFeedback['domains']) ?? [],
        timing: (row.timing as ConsultationFeedback['timing']) ?? null,
        focus_areas: (row.focus_areas as ConsultationFeedback['focus_areas']) ?? [],
        capability_links: row.capability_links ?? [],
        confidence: (row.confidence as ConsultationFeedback['confidence']) ?? {
            transcript_quality: 'high',
            notes: '',
        },
        station_id: stationId,
        station_title: stationTitle ?? 'Station Feedback',
    };
}

export async function POST(request: NextRequest) {
    try {
        const { sessionId, trigger = true } = await request.json();
        if (!sessionId) {
            return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
        }

        // Verify the caller owns this session (or it's a guest session).
        const authSupabase = await createServerClient();
        const {
            data: { user },
        } = await authSupabase.auth.getUser();

        const supabase = getSupabaseAdmin();

        if (user) {
            const { data: owned } = await supabase
                .from('clinical_sessions')
                .select('id')
                .eq('id', sessionId)
                .eq('user_id', user.id)
                .maybeSingle();

            if (!owned) {
                const { data: guest } = await supabase
                    .from('clinical_sessions')
                    .select('id')
                    .eq('id', sessionId)
                    .is('user_id', null)
                    .maybeSingle();
                if (!guest) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
            }
        }

        // 1. Results already exist -> return them in the spec shape.
        //    select('*') + cast: the generated types still describe the legacy
        //    columns until the 0001 migration + type regen land at go-live.
        const { data: existingResultsRaw } = await supabase
            .from('session_results')
            .select('*')
            .eq('session_id', sessionId)
            .maybeSingle();
        const existingResults = existingResultsRaw as unknown as SessionResultRow | null;

        if (existingResults) {
            const { data: session } = await supabase
                .from('clinical_sessions')
                .select('station_id, stations(title)')
                .eq('id', sessionId)
                .single();

            const stationTitle = (session?.stations as { title?: string } | null)?.title;
            return NextResponse.json({
                status: 'ready',
                feedback: toFeedback(
                    sessionId,
                    existingResults as SessionResultRow,
                    session?.station_id as string | undefined,
                    stationTitle
                ),
            });
        }

        // 2. Need a transcript before we can mark.
        const { data: session, error: sessionError } = await supabase
            .from('clinical_sessions')
            .select('id, transcript, status')
            .eq('id', sessionId)
            .single();

        if (sessionError || !session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }
        if (
            !session.transcript ||
            (Array.isArray(session.transcript) && session.transcript.length === 0)
        ) {
            return NextResponse.json({ error: 'No transcript available yet' }, { status: 404 });
        }

        // 3. Trigger the Azure marking endpoint once; later polls pass trigger=false.
        const markingUrl = process.env.MARKING_API_URL;
        const markingSecret = process.env.MARKING_SHARED_SECRET;
        if (!markingUrl || !markingSecret) {
            return NextResponse.json(
                { error: 'Marking endpoint not configured' },
                { status: 500 }
            );
        }

        if (trigger) {
            const endpoint = `${markingUrl.replace(/\/+$/, '')}/api/mark-consultation`;
            after(async () => {
                try {
                    const res = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-marking-secret': markingSecret,
                        },
                        body: JSON.stringify({ sessionId }),
                    });

                    if (!res.ok) {
                        const body = await res.text().catch(() => '');
                        console.error('Marking endpoint returned an error', {
                            sessionId,
                            status: res.status,
                            body: body.slice(0, 500),
                        });
                    }
                } catch (err) {
                    console.error('Failed to trigger marking endpoint:', err);
                }
            });
        }

        return NextResponse.json({ status: 'generating' });
    } catch (error) {
        console.error('Feedback route error:', error);
        return NextResponse.json(
            {
                error: 'Failed to process request',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
