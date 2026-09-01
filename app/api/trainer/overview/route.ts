import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getTrainerCohort } from '@/lib/trainer/guard';
import { pointsFromResult } from '@/lib/development/domainPoints';
import { isPassingVerdict } from '@/lib/clinical-master/scoring';
import { MAX_WEIGHTED_SCORE, type DomainKey } from '@/lib/clinical-master/types';

/**
 * Trainer cohort API. Guarded (fail-closed) by {@link getTrainerCohort} — the
 * check runs before any data access, and 403 comes back with no hint about
 * whether a cohort exists. Modelled on /api/admin/progress: same service-role
 * client, same "identity is secondary context, degrade rather than fail" rule.
 *
 * GET — one entry per student, each carrying their sessions in the order they
 * were sat, with the per-domain split the chart's hover readout needs.
 *
 * SCOPING IS THE WHOLE SECURITY MODEL HERE. Every query below filters on
 * `cohort.studentIds`, which the guard has already stripped the trainer's own
 * id out of. Nothing widens that: there is no user id in the request to trust,
 * and no path where an empty student list turns into an unfiltered read — the
 * early return below exists so `.in('user_id', [])` can never be reached with
 * a list this route did not build.
 */

/**
 * Sessions read per cohort, newest first. A three-student pilot doing forty
 * cases each is 120 rows; this is a runaway guard, not a window, and the page
 * is built to show the whole programme.
 */
const MAX_SESSIONS = 1000;

export interface TrainerSession {
  id: string;
  stationTitle: string;
  /** completed_at when there is one, else started_at. */
  date: string;
  startedAt: string;
  /** Raw clinical_sessions.status — the page needs 'processing' to say "Marking". */
  status: string;
  verdict: string | null;
  /** Null when the session has no result row yet: pending, not zero. */
  weightedScore: number | null;
  maxScore: number;
  passed: boolean;
  hasRecording: boolean;
  /** Weighted points per domain, for the chart's hover breakdown. */
  domainPoints: Partial<Record<DomainKey, number>>;
}

export interface TrainerStudent {
  userId: string;
  email: string | null;
  fullName: string | null;
  /** Oldest → newest, the direction a chart reads. */
  sessions: TrainerSession[];
}

export interface TrainerOverviewResponse {
  cohortName: string;
  /** How many cases the cohort was assigned — the denominator for "5 cases". */
  assignedCount: number;
  students: TrainerStudent[];
  /** The session cap was hit; the oldest attempts are missing. Say so, don't hide it. */
  truncated: boolean;
}

interface SessionRow {
  id: string;
  user_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  recording_path: string | null;
  stations: { title: string | null } | null;
  session_results: {
    verdict: string | null;
    weighted_score: number | string | null;
    max_score: number | string | null;
    domains: unknown;
  } | null;
}

/** A number PostgREST may have handed back as a string, or null. */
function numberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  const cohort = await getTrainerCohort();
  if (!cohort) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // A cohort of one — the trainer alone — is a real state during setup, and
  // `.in('user_id', [])` is a query nobody should have to reason about.
  if (cohort.studentIds.length === 0) {
    const empty: TrainerOverviewResponse = {
      cohortName: cohort.name,
      assignedCount: cohort.stationIds.length,
      students: [],
      truncated: false,
    };
    return NextResponse.json(empty);
  }

  const { data, error } = await supabase
    .from('clinical_sessions')
    .select(
      'id, user_id, status, started_at, completed_at, recording_path, stations(title), session_results(verdict, weighted_score, max_score, domains)',
    )
    .in('user_id', cohort.studentIds)
    // Not `.eq('status', 'completed')`: a trainer needs to see the case their
    // student is waiting on a mark for, and the abandoned one they walked out
    // of. The page renders those as "Marking" and as unscored rows rather than
    // dropping them, so the count of sessions matches what the student did.
    .order('started_at', { ascending: false })
    .limit(MAX_SESSIONS);

  if (error) {
    console.error('[trainer-overview] session query failed', error);
    return NextResponse.json({ error: 'Failed to load cohort' }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as SessionRow[];

  const byStudent = new Map<string, TrainerSession[]>();
  for (const studentId of cohort.studentIds) byStudent.set(studentId, []);

  for (const row of rows) {
    // Defensive: the filter above already guarantees this, and a row that
    // somehow arrived from outside the cohort must be dropped rather than
    // attributed to a student who did not sit it.
    const sessions = byStudent.get(row.user_id);
    if (!sessions) continue;

    const result = row.session_results;
    const weightedScore = numberOrNull(result?.weighted_score ?? null);
    sessions.push({
      id: row.id,
      stationTitle: row.stations?.title ?? 'Untitled case',
      date: row.completed_at ?? row.started_at,
      startedAt: row.started_at,
      status: row.status,
      verdict: result?.verdict ?? null,
      weightedScore,
      maxScore: numberOrNull(result?.max_score ?? null) ?? MAX_WEIGHTED_SCORE,
      // The verdict decides, not the score against a threshold — it is what
      // the marking engine actually wrote, and the two must never disagree
      // between this page and the student's own report.
      passed: isPassingVerdict(result?.verdict),
      hasRecording: Boolean(row.recording_path),
      domainPoints: pointsFromResult(result?.domains),
    });
  }

  // ── Who each student is ──
  // Secondary context: a failure here degrades to a null identity rather than
  // failing the page, exactly as /api/admin/progress does.
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', cohort.studentIds);
  if (profileError) console.error('[trainer-overview] profile lookup failed', profileError);

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, { email: p.email ?? null, fullName: p.full_name ?? null }]),
  );

  const body: TrainerOverviewResponse = {
    cohortName: cohort.name,
    assignedCount: cohort.stationIds.length,
    // Cohort join order, so the colour assigned to a student on the page is
    // stable between loads and between the chart and the list.
    students: cohort.studentIds.map((userId) => ({
      userId,
      email: profileById.get(userId)?.email ?? null,
      fullName: profileById.get(userId)?.fullName ?? null,
      // Reversed to oldest → newest here rather than on the client: "session
      // number" on the chart's x-axis is a position in this array, so the
      // order is part of the contract, not a rendering detail.
      sessions: (byStudent.get(userId) ?? []).slice().reverse(),
    })),
    truncated: rows.length >= MAX_SESSIONS,
  };

  return NextResponse.json(body);
}
