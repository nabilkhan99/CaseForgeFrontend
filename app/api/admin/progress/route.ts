import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin/guard';
import { visibleStationStates } from '@/lib/stations/visibility';
import { reduceStationPassMap, type StationAttemptRow } from '@/lib/supabase/queries/passTracking';

/**
 * Admin progress API. Guarded (fail-closed) by the ADMIN_EMAILS allowlist —
 * the check runs before any data access. Returns 403 JSON when not authorized.
 *
 * GET — one row per signed-in user: stations attempted, stations PASSED (best
 * attempt reached a passing verdict, see lib/supabase/queries/passTracking.ts)
 * and last activity, plus the station titles behind each number so a founder
 * can see who is actually getting through the bank.
 *
 * Guest sessions (the /try funnel) carry a null user_id and are excluded —
 * they belong to nobody until the account is claimed.
 */

/** Users returned. A founder scanning progress does not page; they scan. */
const MAX_USERS = 500;
/** Completed sessions read. Comfortably above the current bank (~250) and
 *  bounded so one runaway account cannot blow the response up. */
const MAX_SESSIONS = 5000;

export interface AdminUserProgress {
  userId: string;
  email: string | null;
  fullName: string | null;
  /** Distinct stations with at least one completed attempt. */
  attempted: number;
  /** Distinct stations whose best attempt passed. */
  passed: number;
  /** Most recent completed attempt, ISO. */
  lastActivity: string | null;
  passedStations: string[];
  /** Attempted but not yet passed — the interesting half of the list. */
  unpassedStations: string[];
}

interface SessionRow {
  user_id: string | null;
  station_id: string | null;
  started_at: string;
  stations: { title: string | null } | null;
  session_results: { verdict: string | null; weighted_score: number | string | null } | null;
}

interface UserAccumulator {
  rows: StationAttemptRow[];
  lastActivity: string | null;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('clinical_sessions')
    .select(
      'user_id, station_id, started_at, stations(title), session_results(verdict, weighted_score)',
    )
    .not('user_id', 'is', null)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(MAX_SESSIONS);

  if (error) {
    console.error('[admin-progress] session query failed', error);
    return NextResponse.json({ error: 'Failed to load progress' }, { status: 500 });
  }

  const sessions = (data ?? []) as unknown as SessionRow[];

  // Station titles are needed for the expanded per-user list; a station with no
  // title falls back to its id so a row never silently disappears.
  const titleByStation = new Map<string, string>();
  const byUser = new Map<string, UserAccumulator>();

  for (const session of sessions) {
    if (!session.user_id) continue;
    if (session.station_id && !titleByStation.has(session.station_id)) {
      titleByStation.set(session.station_id, session.stations?.title ?? session.station_id);
    }

    const acc = byUser.get(session.user_id) ?? { rows: [], lastActivity: null };
    acc.rows.push({
      station_id: session.station_id,
      verdict: session.session_results?.verdict ?? null,
      weighted_score: session.session_results?.weighted_score ?? null,
    });
    // Sessions arrive newest-first, so the first one seen is the latest.
    acc.lastActivity ??= session.started_at;
    byUser.set(session.user_id, acc);
  }

  const progress: AdminUserProgress[] = Array.from(byUser.entries()).map(([userId, acc]) => {
    const passMap = reduceStationPassMap(acc.rows);
    const passedStations: string[] = [];
    const unpassedStations: string[] = [];
    for (const [stationId, state] of passMap) {
      const title = titleByStation.get(stationId) ?? stationId;
      (state.passed ? passedStations : unpassedStations).push(title);
    }
    passedStations.sort();
    unpassedStations.sort();

    return {
      userId,
      email: null,
      fullName: null,
      attempted: passMap.size,
      passed: passedStations.length,
      lastActivity: acc.lastActivity,
      passedStations,
      unpassedStations,
    };
  });

  // Most-progressed first; the cap then keeps the busiest users, not an
  // arbitrary slice.
  progress.sort((a, b) => b.passed - a.passed || b.attempted - a.attempted);
  const capped = progress.slice(0, MAX_USERS);

  // ── Who each user is ──
  // Secondary context: a failure here degrades to a null identity rather than
  // failing the page.
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in(
      'id',
      capped.map((p) => p.userId),
    );
  if (profileError) console.error('[admin-progress] profile lookup failed', profileError);

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, { email: p.email ?? null, fullName: p.full_name ?? null }]),
  );

  const { count: totalStations } = await supabase
    .from('stations')
    .select('*', { count: 'exact', head: true })
    .in('is_active', visibleStationStates());

  return NextResponse.json({
    progress: capped.map((p) => ({
      ...p,
      email: profileById.get(p.userId)?.email ?? null,
      fullName: profileById.get(p.userId)?.fullName ?? null,
    })),
    totalStations: totalStations ?? 0,
    truncated: progress.length > MAX_USERS,
  });
}
