'use client';

import { useEffect, useState } from 'react';
import type { TrialSubscription } from '@/app/api/subscription/route';

/**
 * Where the signed-in user stands in their free week, or null.
 *
 * `null` means "not a trial account", and is also the value before the answer
 * arrives — the same null-until-known rule `useCohortAllowlist` follows, and
 * for the same reason: both readings collapse to "draw nothing extra", which is
 * the safe default. A paying customer must never see a trial banner flash on
 * their library while a fetch resolves.
 *
 * `/api/subscription` sends `trial` only when the grant is what decides access,
 * so a truthy value already means "this account is running on the trial" — this
 * hook re-derives nothing.
 */
export function useTrialStatus(): TrialSubscription | null {
  const [trial, setTrial] = useState<TrialSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/subscription')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.trial) return;
        setTrial(data.trial as TrialSubscription);
      })
      .catch(() => {
        // No banner rather than a wrong one. Nothing here gates anything —
        // the server chokepoints do.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return trial;
}

/**
 * The cases a trial account may open, or null when there is no trial limit.
 *
 * The one place the client turns "this account is on a trial" into "these are
 * the cases", so the library, the topic pages and the brief page cannot
 * disagree about it — and so none of them re-derives a gate the entitlement
 * layer has already decided.
 *
 * NULL FOR AN ENDED TRIAL, not an empty list, and that is deliberate: once the
 * five days are up every case is locked, the dashboard's wall says so in
 * sentences, and dashing out two hundred squares underneath it would be the
 * same message delivered as a graveyard. The middleware bounces them off
 * /clinical-master regardless, so nothing is un-gated by this.
 */
export function trialStationAllowlist(trial: TrialSubscription | null): string[] | null {
  if (!trial || trial.state !== 'trial') return null
  return trial.freeStationIds
}

/** True when a trial limit is in force AND this case sits outside it. */
export function isStationLockedForTrial(
  freeStationIds: readonly string[] | null,
  stationId: string,
): boolean {
  return freeStationIds !== null && !freeStationIds.includes(stationId)
}
