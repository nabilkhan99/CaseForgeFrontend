import { after, NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isTrendReportV2 } from '@/lib/clinical-master/trendTypes';

/**
 * Trend report orchestrator. Returns the latest persisted trend_reports row for
 * the signed-in candidate, and (on demand) triggers the Azure generate-trend
 * endpoint to build a fresh one. The page polls until a report appears.
 *
 * trend_reports is a new table; the generated Supabase types do not include it
 * until the 0003 migration + type regen at go-live, so access is cast.
 */
// The after() callback awaits the full generate-trend round trip (~1-2 min),
// and after() is bound by the route's maxDuration.
export const maxDuration = 300;

/** Mirrors MIN_CASES_FOR_PATTERNS in CaseForgeAzure/app/services/trend_service.py. */
const MIN_CASES_FOR_TREND = 3;
/**
 * One trend build per candidate at a time, enforced by a claim row in
 * trend_generation_claims (cross-instance — an in-memory Set only guards one
 * Vercel instance). A claim older than this TTL is presumed dead and can be
 * taken over, so a crashed build self-heals on a later visit.
 */
const CLAIM_TTL_MS = 3 * 60 * 1000;

export async function POST(request: NextRequest) {
    try {
        const authSupabase = await createServerClient();
        const {
            data: { user },
        } = await authSupabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let refresh = false;
        try {
            const body = await request.json();
            refresh = Boolean(body?.refresh);
        } catch {
            /* no body */
        }

        const supabase = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: latest } = await (supabase as any)
            .from('trend_reports')
            .select('*')
            .eq('candidate_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        /**
         * A row in the v1 shape is not a report this product can render — its
         * fields carry different meanings, and half of them no longer exist.
         * Treating it as absent is what makes the migration self-healing: the
         * page asks, the route finds nothing renderable, triggers a rebuild and
         * answers 'generating', and the next row that lands is v2. Rendering it
         * partially, or serving it and hoping, would pin an account to a report
         * it can never move off.
         */
        const report = isTrendReportV2(latest) ? latest : null;
        const haveReport = report !== null;

        // The trend engine needs MIN_CASES marked consultations before it can
        // say anything. Answer that here rather than kicking off a build and
        // letting the page poll for a minute to learn the same thing.
        if (!haveReport) {
            // session_results carries no user id; count completed sessions,
            // which is what a result row hangs off.
            const { count } = await supabase
                .from('clinical_sessions')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('status', 'completed');
            const marked = count ?? 0;
            if (marked < MIN_CASES_FOR_TREND) {
                return NextResponse.json({ status: 'insufficient_data', marked, required: MIN_CASES_FOR_TREND });
            }
        }

        // Trigger a fresh build when none exists yet, or when explicitly
        // refreshing — once per candidate at a time, so a polling page (or the
        // same candidate on two devices) doesn't queue twenty LLM jobs for one
        // report. Winning the claim insert (or taking over a stale one) is the
        // licence to call the engine.
        if (!haveReport || refresh) {
            const markingUrl = process.env.MARKING_API_URL;
            const markingSecret = process.env.MARKING_SHARED_SECRET;
            if (markingUrl && markingSecret) {
                const claimedAt = new Date().toISOString();
                // Cast: trend_generation_claims postdates the generated types (0005).
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: inserted } = await (supabase as any)
                    .from('trend_generation_claims')
                    .upsert(
                        { candidate_id: user.id, started_at: claimedAt },
                        { onConflict: 'candidate_id', ignoreDuplicates: true }
                    )
                    .select('candidate_id')
                    .maybeSingle();

                let claimed = Boolean(inserted);
                if (!claimed) {
                    const staleCutoff = new Date(Date.now() - CLAIM_TTL_MS).toISOString();
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { data: retaken } = await (supabase as any)
                        .from('trend_generation_claims')
                        .update({ started_at: claimedAt })
                        .eq('candidate_id', user.id)
                        .lt('started_at', staleCutoff)
                        .select('candidate_id')
                        .maybeSingle();
                    claimed = Boolean(retaken);
                }

                if (claimed) {
                    const endpoint = `${markingUrl.replace(/\/+$/, '')}/api/generate-trend`;
                    after(async () => {
                        try {
                            const res = await fetch(endpoint, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'x-marking-secret': markingSecret,
                                },
                                body: JSON.stringify({ candidateId: user.id }),
                            });
                            if (res.ok) {
                                // Release our claim (and only ours — lte guards a
                                // concurrent refresh's newer claim) so a future
                                // refresh doesn't wait out the TTL.
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                await (supabase as any)
                                    .from('trend_generation_claims')
                                    .delete()
                                    .eq('candidate_id', user.id)
                                    .lte('started_at', claimedAt);
                            } else {
                                // Leave the claim: the TTL gates the retry so a
                                // failing engine (rate limits) isn't hammered.
                                const body = await res.text().catch(() => '');
                                console.error('Trend endpoint returned an error', {
                                    candidateId: user.id,
                                    status: res.status,
                                    body: body.slice(0, 500),
                                });
                            }
                        } catch (err) {
                            console.error('Failed to trigger trend endpoint:', err);
                        }
                    });
                }
            }
        }

        if (report && !refresh) {
            return NextResponse.json({ status: 'ready', report });
        }
        return NextResponse.json({ status: 'generating' });
    } catch (error) {
        console.error('Trend route error:', error);
        return NextResponse.json(
            { error: 'Failed to process request', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
