'use client';

import { useEffect, useState } from 'react';
import type { TrialSubscription } from '@/app/api/subscription/route';

/**
 * Where the signed-in user stands in their five free stations, or null.
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
