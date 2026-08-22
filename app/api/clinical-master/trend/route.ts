import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { TrendReport } from '@/lib/clinical-master/trendTypes';

/**
 * Trend report orchestrator. Returns the latest persisted trend_reports row for
 * the signed-in candidate, and (on demand) triggers the Azure generate-trend
 * endpoint to build a fresh one. The page polls until a report appears.
 *
 * trend_reports is a new table; the generated Supabase types do not include it
 * until the 0003 migration + type regen at go-live, so access is cast.
 */
/** Mirrors MIN_CASES_FOR_PATTERNS in CaseForgeAzure/app/services/trend_service.py. */
const MIN_CASES_FOR_TREND = 3;
/** One trend build per user per window; the engine takes ~1–2 minutes. */
const IN_FLIGHT_TTL_MS = 3 * 60 * 1000;
const inFlight = new Set<string>();

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

        const haveReport = Boolean(latest);

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
        // refreshing — once per user at a time, so a polling page doesn't
        // queue twenty LLM jobs for one report.
        if ((!haveReport || refresh) && !inFlight.has(user.id)) {
            inFlight.add(user.id);
            setTimeout(() => inFlight.delete(user.id), IN_FLIGHT_TTL_MS);
            const markingUrl = process.env.MARKING_API_URL;
            const markingSecret = process.env.MARKING_SHARED_SECRET;
            if (markingUrl && markingSecret) {
                fetch(`${markingUrl.replace(/\/+$/, '')}/api/generate-trend`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-marking-secret': markingSecret },
                    body: JSON.stringify({ candidateId: user.id }),
                }).catch((err) => console.error('Failed to trigger trend endpoint:', err));
            }
        }

        if (haveReport && !refresh) {
            return NextResponse.json({ status: 'ready', report: latest as TrendReport });
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
