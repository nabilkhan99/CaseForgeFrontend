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

// The after() callback awaits the full mark-consultation round trip (~80-90s),
// and after() is bound by the route's maxDuration — 60 killed the run mid-flight.
export const maxDuration = 300;

/**
 * A marking claim (clinical_sessions.marking_started_at) older than this is
 * presumed dead and can be retaken, so a crashed run self-heals on the page's
 * next trigger poll instead of sticking in 'processing' forever.
 */
const MARKING_CLAIM_STALE_MINUTES = 10;

/**
 * Past this age a session that still has no result is stuck, not slow. Marking
 * takes 80 to 90 seconds; there are production sessions that have sat in
 * 'processing' for two days because the trigger failed and nothing retried it.
 * The page needs to be able to tell "still working" from "this run died".
 */
const STALLED_AFTER_MINUTES = 60;

function minutesSince(iso: string | null | undefined): number | null {
    if (!iso) return null;
    const started = new Date(iso).getTime();
    if (!Number.isFinite(started)) return null;
    return Math.max(0, Math.round((Date.now() - started) / 60000));
}

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
                .select('station_id, transcript, stations(title)')
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
                transcript: Array.isArray(session?.transcript) ? session.transcript : [],
            });
        }

        // 2. Need a transcript before we can mark.
        const { data: session, error: sessionError } = await supabase
            .from('clinical_sessions')
            .select('id, transcript, status, started_at, completed_at, station_id, stations(title)')
            .eq('id', sessionId)
            .single();

        if (sessionError || !session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // 'processing' rows never carry completed_at (it is stamped when the
        // result row lands), so age has to fall back to started_at.
        const ageMinutes = minutesSince(session.completed_at ?? session.started_at);
        const terminal = session.status !== 'reading' && session.status !== 'live';
        // Station details so the page can offer "practise this case again"
        // rather than a dead end when the run can never produce feedback.
        const stationId = (session.station_id as string | null) ?? undefined;
        const stationTitle = (session.stations as { title?: string } | null)?.title;

        if (
            !session.transcript ||
            (Array.isArray(session.transcript) && session.transcript.length === 0)
        ) {
            // A session past the live stage with no transcript will never produce
            // feedback (mic failure / abandoned call) — tell the page to stop polling.
            return NextResponse.json({
                status: terminal ? 'no_transcript' : 'generating',
                triggerQueued: false,
                ageMinutes,
                stationId,
                stationTitle,
            });
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

        let triggerQueued = false;
        if (trigger) {
            // Cross-instance claim: only the request that flips marking_started_at
            // from null (or stale) wins; concurrent polls from other Vercel
            // instances see no row back and skip. An in-memory Set can't give
            // this guarantee — parallel instances each start with an empty one.
            // Cast: marking_started_at postdates the generated types (0005).
            const staleCutoff = new Date(
                Date.now() - MARKING_CLAIM_STALE_MINUTES * 60000
            ).toISOString();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: claim } = await (supabase as any)
                .from('clinical_sessions')
                .update({ marking_started_at: new Date().toISOString() })
                .eq('id', sessionId)
                .or(`marking_started_at.is.null,marking_started_at.lt.${staleCutoff}`)
                .select('id')
                .maybeSingle();

            if (claim) {
                triggerQueued = true;
                const endpoint = `${markingUrl.replace(/\/+$/, '')}/api/mark-consultation`;
                const releaseClaim = async () => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (supabase as any)
                        .from('clinical_sessions')
                        .update({ marking_started_at: null })
                        .eq('id', sessionId)
                        .then(null, (err: unknown) =>
                            console.error('Failed to release marking claim', { sessionId, err })
                        );
                };
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
                            // Give the claim back so the page's next trigger poll retries.
                            await releaseClaim();
                        }
                    } catch (err) {
                        console.error('Failed to trigger marking endpoint:', err);
                        await releaseClaim();
                    }
                });
            }
        }

        return NextResponse.json({
            status: 'generating',
            triggerQueued,
            ageMinutes,
            // A transcript exists and the session is terminal, so marking should
            // have finished long ago. Say so instead of polling into silence.
            stalled: terminal && ageMinutes !== null && ageMinutes >= STALLED_AFTER_MINUTES,
            stationId,
            stationTitle,
        });
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
