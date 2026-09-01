import { after, NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getTrainerCohort } from '@/lib/trainer/guard';
import type { ConsultationFeedback } from '@/lib/clinical-master/types';

/**
 * Feedback orchestrator + poller for the SCA marking engine.
 *
 * If results exist in session_results (new spec schema), return them. Otherwise
 * schedule the Azure Functions marking endpoint (mark-consultation) and return
 * "generating" so the page keeps polling. The Gemini Supabase Edge Function has
 * been retired; marking now runs on Azure (GPT-5.x), guarded by a shared secret.
 */

// Hobby-plan ceiling: Vercel rejects anything above 60 at deploy time. The
// after() callback awaits the ~80-90s mark-consultation round trip, so it is
// severed at 60s — Azure still finishes the run and writes session_results;
// we just can't see a late failure to release the claim, which is what the
// stale-claim TTL below covers. Raise this if the project moves to Fluid
// Compute / Pro (300s), which also restores active failure handling.
export const maxDuration = 60;

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
    stationTitle: string | undefined,
    clinicalLearningPoints: string | null | undefined,
    markScheme: {
        data_gathering?: string | null;
        clinical_management?: string | null;
        relating_to_others?: string | null;
    } | null
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
        clinical_learning_points: clinicalLearningPoints ?? null,
        mark_scheme: markScheme
            ? {
                  data_gathering: markScheme.data_gathering ?? null,
                  clinical_management: markScheme.clinical_management ?? null,
                  relating_to_others: markScheme.relating_to_others ?? null,
              }
            : null,
    };
}

export async function POST(request: NextRequest) {
    try {
        const { sessionId, trigger = true } = await request.json();
        if (!sessionId) {
            return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
        }

        // Verify the caller owns this session (or it's a guest session, or is
        // the trainer whose cohort the sitter belongs to).
        const authSupabase = await createServerClient();
        const {
            data: { user },
        } = await authSupabase.auth.getUser();

        const supabase = getSupabaseAdmin();

        /**
         * This request is a trainer reading a student's report, not the student
         * reading their own. It suppresses the marking trigger below.
         *
         * Marking is a paid Azure call, and the claim it takes
         * (`marking_started_at`) is real state on someone else's session. The
         * Students tab is documented and built as read-only, so a trainer
         * clicking into an unmarked case must not be what spends the money or
         * moves that row — they see the page's existing "not marked yet" state
         * and the student's own next visit starts the run, as it always did.
         */
        let viaTrainer = false;

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
                    .select('id, user_id')
                    .eq('id', sessionId)
                    .is('user_id', null)
                    .maybeSingle();
                if (!guest) {
                    // Not theirs and not a guest session — the last thing it can
                    // be is a student of theirs. The Students tab links straight
                    // to the normal feedback page, so the trainer's read arrives
                    // here exactly as the student's own does; this is the whole
                    // of what makes that link work. Authorising here also sets
                    // `viaTrainer`, which is what keeps the read read-only.
                    //
                    // Kept last and behind two cheap checks: it costs an auth +
                    // two queries, and the overwhelming majority of requests
                    // here are someone reading their own report. Fails closed —
                    // `getTrainerCohort` returns null on any error at all.
                    const { data: sitter } = await supabase
                        .from('clinical_sessions')
                        .select('user_id')
                        .eq('id', sessionId)
                        .maybeSingle();
                    const cohort = sitter?.user_id ? await getTrainerCohort() : null;
                    if (!cohort?.studentIds.includes(sitter!.user_id as string)) {
                        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                    }
                    viaTrainer = true;
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
                // clinical_learning_points rides along so the report can show the
                // same teaching notes as the public case page, instead of sending
                // people off to find their case in another tab.
                .select(
                    'station_id, transcript, stations(title, clinical_learning_points, data_gathering, clinical_management, relating_to_others)'
                )
                .eq('id', sessionId)
                .single();

            const station = session?.stations as
                | {
                      title?: string;
                      clinical_learning_points?: string | null;
                      data_gathering?: string | null;
                      clinical_management?: string | null;
                      relating_to_others?: string | null;
                  }
                | null;
            return NextResponse.json({
                status: 'ready',
                feedback: toFeedback(
                    sessionId,
                    existingResults as SessionResultRow,
                    session?.station_id as string | undefined,
                    station?.title,
                    station?.clinical_learning_points,
                    station
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
        //    A trainer's read never triggers, whatever the client asked for —
        //    see `viaTrainer`. Enforced here rather than by having the Students
        //    tab send `trigger: false`, because a client-supplied flag is a
        //    request, not a guarantee, and the server is the only thing that
        //    knows this request was authorised as a trainer in the first place.
        const markingUrl = process.env.MARKING_API_URL;
        const markingSecret = process.env.MARKING_SHARED_SECRET;
        if (!markingUrl || !markingSecret) {
            return NextResponse.json(
                { error: 'Marking endpoint not configured' },
                { status: 500 }
            );
        }

        let triggerQueued = false;
        if (trigger && !viaTrainer) {
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
