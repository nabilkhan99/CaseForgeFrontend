'use client';

import { useEffect, useState } from 'react';

/**
 * Which cases the signed-in user may actually open, for the surfaces that have
 * to draw a lock.
 *
 * `null` means NO LIMIT, and is also the value before the answer arrives. Both
 * readings collapse to "draw nothing special", which is the safe default in a
 * UI sense: a paying customer must never see 195 of their 200 cases flash as
 * locked while a fetch resolves, and the actual gate is server-side at
 * create-session / realtime-token regardless of what this returns. Same
 * null-until-known rule as the navbar's lectures lock.
 *
 * A Set rather than the array `/api/subscription` sends: the library asks this
 * question once per station, two hundred times per render.
 */
export function useCohortAllowlist(): Set<string> | null {
  const [stationIds, setStationIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/subscription')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.cohort) return;
        const ids = data.cohort.stationIds;
        if (Array.isArray(ids)) setStationIds(new Set<string>(ids));
      })
      .catch(() => {
        // No lock rather than a wrong one. The server still refuses.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return stationIds;
}

/** True when a cohort limit is in force AND this station is outside it. */
export function isStationLocked(allowlist: Set<string> | null, stationId: string): boolean {
  return allowlist !== null && !allowlist.has(stationId);
}
