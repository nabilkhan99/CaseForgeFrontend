'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { getStationIndex, type Station } from '@/lib/supabase/queries/station-library';
import PageHeader from '@/components/ui/PageHeader';
import { getDomainColor } from '@/lib/constants/domains';
import StationBoard from '@/components/library/StationBoard';
import { useLibraryFilters } from '@/components/library/useLibraryFilters';
import { summariseDomains } from '@/lib/stations/librarySearch';
import { useCohortAllowlist } from '@/hooks/useCohortAllowlist';

function LibrarySpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <motion.div
        className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

function StationLibraryContent() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  // `undefined` = auth hasn't answered yet, `null` = genuinely signed out. The
  // data fetch waits for the difference: firing it on the initial null renders
  // a returning user's whole library as "Not started" before the progress
  // arrives a second later.
  const [user, setUser] = useState<User | null | undefined>(undefined);

  // Kept for `status` alone. The search field and the domain select moved off
  // this page with the redesign, but `?status=` is a link people already hold,
  // and the hook is what keeps it in the URL.
  const { filters, setStatus } = useLibraryFilters();

  // null for everyone without a trainer-pilot seat, and until the answer
  // arrives — so nobody watches their library flash as locked on load.
  const allowlist = useCohortAllowlist();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (user === undefined) return;
    let cancelled = false;

    async function fetchStations() {
      setLoading(true);
      const data = await getStationIndex(user?.id);
      if (cancelled) return;
      setStations(data);
      setLoading(false);
    }

    fetchStations();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const domains = useMemo(() => summariseDomains(stations), [stations]);
  const passedTotal = useMemo(
    () => stations.reduce((total, station) => total + (station.passed ? 1 : 0), 0),
    [stations],
  );

  /**
   * A cohort student's progress is progress through their five cases, not
   * through the bank. "2 of 200 passed" would be true and useless — it counts a
   * denominator they were never given.
   */
  const assignedPassed = useMemo(
    () =>
      allowlist
        ? stations.reduce(
            (total, station) =>
              total + (allowlist.has(station.id) && station.passed ? 1 : 0),
            0,
          )
        : 0,
    [stations, allowlist],
  );

  const subtitle =
    stations.length === 0
      ? 'No cases available yet'
      : allowlist
        ? `${assignedPassed} of your ${allowlist.size} assigned cases passed`
        : `${passedTotal} of ${stations.length} passed across ${domains.length} topic areas`;

  return (
    <div>
      {/* The board's summary line, promoted to the subtitle: the board is now
          the page, and a count of cases and domains restated above it would be
          the same sentence with the progress taken out. */}
      <PageHeader title="Case Library" subtitle={subtitle} />

      {loading ? (
        <LibrarySpinner />
      ) : (
        <>
          {/* The page, above `sm`. Its own chips carry the progress filter. */}
          <StationBoard
            stations={stations}
            status={filters.status}
            onStatusChange={setStatus}
            allowlist={allowlist}
          />

          {/* Mobile only. The board is hidden below `sm` because an 18px square
              cannot be a touch target, so without this list a phone would open
              the library on nothing it could tap. Above `sm` the board's domain
              names are the same twenty-eight links and this would be a second
              set saying the same thing. */}
          <div className="sm:hidden">
            <div className="divide-y divide-hairline">
              {domains.map((domain, index) => {
                const colors = getDomainColor(domain.name, index);
                const hasCompleted = domain.completed_count > 0;

                return (
                  <motion.div
                    key={domain.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 12) * 0.04 }}
                  >
                    <Link
                      href={`/dashboard/library/${domain.id}`}
                      className="group -mx-2 flex items-center gap-4 rounded-[10px] px-2 py-4 transition-colors hover:bg-black/[0.02] focus-visible-ring"
                    >
                      {/* Domain color indicator */}
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] text-[13px] font-semibold"
                        style={{ background: colors.bg, color: colors.text }}
                      >
                        {domain.name.charAt(0)}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[15px] font-medium leading-snug text-heading transition-colors group-hover:text-primary">
                          {domain.name}
                        </div>
                        <div className="mt-0.5 text-[13px] text-muted">
                          {domain.station_count} case{domain.station_count !== 1 ? 's' : ''}
                          {hasCompleted && ` · ${domain.completed_count} attempted`}
                          {/* Zero passes stays unsaid, matching the dashboard rule
                              that "Passed 0 of N" is a poor thing to greet someone
                              with. Attempts are already shown above. */}
                          {domain.passed_count > 0 && (
                            <span className="ml-1 font-medium" style={{ color: '#15803D' }}>
                              {`· ${domain.passed_count} of ${domain.station_count} passed`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Coverage, not a grade. This used to feed completed/total
                          into ScoreBadge, whose Pass/Borderline/Refer thresholds
                          turned "3 of 9 done" into a red "33% Refer". */}
                      {hasCompleted && (
                        <span className="flex-shrink-0 text-[11px] font-medium tabular-nums text-muted">
                          {domain.completed_count}/{domain.station_count}
                        </span>
                      )}

                      {/* Chevron */}
                      <svg
                        className="h-4 w-4 flex-shrink-0 text-muted transition-colors group-hover:text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function StationLibraryPage() {
  // useSearchParams (via useLibraryFilters) needs a boundary for the build's
  // prerender pass.
  return (
    <Suspense fallback={<LibrarySpinner />}>
      <StationLibraryContent />
    </Suspense>
  );
}
