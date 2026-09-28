import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getTrainerCohort } from '@/lib/trainer/guard';
import { isTrendReportV2, type TrendReportV2 } from '@/lib/clinical-master/trendTypes';
import type { DomainCasePoints } from '@/lib/development/domainAverages';
import {
  DOMAIN_FETCH_MULTIPLE,
  DOMAIN_WINDOW,
  MARKED_SESSION_COLUMNS,
  domainCaseSeriesFromRows,
  type MarkedSessionRow,
} from '@/lib/development/domainCaseSeries';

/**
 * One student's Development page, as their trainer sees it.
 *
 * Built for one to one coaching: the coach opens this before or during a
 * session to see what the student sees — the domain averages, the trajectory
 * and the patterns costing marks — without asking them to share a screen.
 *
 * SAME GUARD, NARROWER DOOR. {@link getTrainerCohort} runs before any data
 * access, exactly as on /api/trainer/overview; what is new is a user id in the
 * URL, and that id is trusted only once it is found in `cohort.studentIds`.
 * Anyone else — a student in another cohort, a made-up id, the trainer's own
 * account (the guard strips it) — gets the same 403 a non-trainer gets, so the
 * response never says whether the id exists.
 *
 * READ-ONLY, IN THE BILLING SENSE TOO. The student's own page asks
 * /api/clinical-master/trend, which builds a report when none exists — a paid
 * Azure call. This route only reads the latest row. A coach looking at an
 * account with no report sees "not built yet", and the build happens when the
 * student next opens their own page, on their own account.
 */

/** Mirrors the student's page: a row that isn't v2 is no report at all. */
export interface TrainerStudentDevelopmentResponse {
  report: TrendReportV2 | null;
  /** The domain averages series, oldest → newest — the same one the student's page draws. */
  domainCases: DomainCasePoints[];
  /** Evidence station id → station title. Ids that resolve to nothing are absent. */
  caseTitles: Record<string, string>;
  /** Completed sessions — the count the trend route holds against its three-case minimum. */
  markedCount: number;
}

const FORBIDDEN = { error: 'Forbidden' };
const FAILED = { error: 'Failed to load development' };

interface CaseTitleRow {
  id: string;
  title: string | null;
}

/** Every evidence case id across the report's patterns, once each. */
function evidenceCaseIds(report: TrendReportV2): string[] {
  const ids = report.patterns.flatMap((pattern) =>
    (pattern.evidence ?? []).map((item) => item?.case_id),
  );
  return Array.from(
    new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0)),
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const cohort = await getTrainerCohort();
  if (!cohort) {
    return NextResponse.json(FORBIDDEN, { status: 403 });
  }

  const { userId } = await params;
  if (!cohort.studentIds.includes(userId)) {
    return NextResponse.json(FORBIDDEN, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const [trend, sessions, completed] = await Promise.all([
      // Cast: trend_reports postdates the generated types, as in the trend route.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('trend_reports')
        .select('*')
        .eq('candidate_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('clinical_sessions')
        .select(MARKED_SESSION_COLUMNS)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(DOMAIN_WINDOW * DOMAIN_FETCH_MULTIPLE),
      // session_results carries no user id; completed sessions are what the
      // trend route counts, so "2 of 3" here matches the student's own page.
      supabase
        .from('clinical_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed'),
    ]);

    // Unlike the student's trend route, a failed read is not "no report": a
    // coach told "not built yet" about a report that exists would be told
    // something false about their student.
    const failure = trend.error ?? sessions.error ?? completed.error;
    if (failure) {
      console.error('[trainer-development] read failed', failure);
      return NextResponse.json(FAILED, { status: 500 });
    }

    const report = isTrendReportV2(trend.data) ? trend.data : null;
    const rows = (sessions.data ?? []) as unknown as MarkedSessionRow[];

    // Secondary context, like the overview route's profile lookup: a failure
    // degrades to an empty map, and the evidence table hides unnamed rows.
    let caseTitles: Record<string, string> = {};
    const ids = report ? evidenceCaseIds(report) : [];
    if (ids.length > 0) {
      const { data: stations, error: titleError } = await supabase
        .from('stations')
        .select('id, title')
        .in('id', ids);
      if (titleError) {
        console.error('[trainer-development] case title lookup failed', titleError);
      } else {
        caseTitles = Object.fromEntries(
          ((stations ?? []) as CaseTitleRow[])
            .filter((station) => Boolean(station.title))
            .map((station) => [station.id, station.title as string]),
        );
      }
    }

    const body: TrainerStudentDevelopmentResponse = {
      report,
      domainCases: domainCaseSeriesFromRows(rows),
      caseTitles,
      markedCount: completed.count ?? 0,
    };
    return NextResponse.json(body);
  } catch (error: unknown) {
    console.error('[trainer-development] unexpected failure', error);
    return NextResponse.json(FAILED, { status: 500 });
  }
}
