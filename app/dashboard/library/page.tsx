'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { getStationIndex, type Station } from '@/lib/supabase/queries/station-library';
import PageHeader from '@/components/ui/PageHeader';
import { getDomainColor } from '@/lib/constants/domains';
import LibraryFilters from '@/components/library/LibraryFilters';
import NextForYou from '@/components/library/NextForYou';
import StationRow from '@/components/library/StationRow';
import { useLibraryFilters } from '@/components/library/useLibraryFilters';
import { shouldShowDifficulty } from '@/lib/stations/difficulty';
import {
  dailySeed,
  filterStations,
  isFilterActive,
  pickNextForYou,
  summariseDomains,
} from '@/lib/stations/librarySearch';

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
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  // `undefined` = auth hasn't answered yet, `null` = genuinely signed out. The
  // data fetch waits for the difference: firing it on the initial null renders
  // a returning user's whole library as "Not started" before the progress
  // arrives a second later.
  const [user, setUser] = useState<User | null | undefined>(undefined);

  const { filters, setQuery, setStatus, setDomainId, clear } = useLibraryFilters();

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
  const filtering = isFilterActive(filters);
  const results = useMemo(
    () => (filtering ? filterStations(stations, filters) : []),
    [filtering, stations, filters],
  );

  // Judged over the rows actually on screen: a pill that says the same word
  // on every visible row is decoration, whether that list is the whole bank or
  // four search results.
  const showDifficulty = useMemo(
    () => shouldShowDifficulty(results.map(s => s.difficulty)),
    [results],
  );

  const nextForYou = useMemo(
    () => pickNextForYou(stations, dailySeed(new Date(), user?.id ?? '')),
    [stations, user],
  );

  const surpriseMe = () => {
    if (stations.length === 0) return;
    const station = stations[Math.floor(Math.random() * stations.length)];
    router.push(`/clinical-master/station/${station.id}?from=${station.domain_id}`);
  };

  return (
    <div>
      <PageHeader
        title="Case Library"
        subtitle={
          stations.length > 0
            ? `${stations.length} cases across ${domains.length} domains`
            : 'No cases available yet'
        }
      />

      {loading ? (
        <LibrarySpinner />
      ) : (
        <>
          {!filtering && nextForYou && (
            <NextForYou station={nextForYou} onSurpriseMe={surpriseMe} />
          )}

          <LibraryFilters
            query={filters.query}
            onQueryChange={setQuery}
            status={filters.status}
            onStatusChange={setStatus}
            domains={domains}
            domainId={filters.domainId}
            onDomainChange={setDomainId}
            resultLabel={
              filtering ? `${results.length} case${results.length !== 1 ? 's' : ''}` : undefined
            }
          />

          {filtering ? (
            results.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[15px] text-muted">No cases match that.</p>
                <button
                  type="button"
                  onClick={clear}
                  className="mt-3 text-[13px] font-medium text-primary hover:underline focus-visible-ring"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div>
                {results.map(station => (
                  <StationRow
                    key={station.id}
                    station={station}
                    showDifficulty={showDifficulty}
                    showDomain
                  />
                ))}
              </div>
            )
          ) : (
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
                      className="group -mx-2 flex items-center gap-4 rounded-lg px-2 py-4 transition-colors hover:bg-black/[0.02] focus-visible-ring"
                    >
                      {/* Domain color indicator */}
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[14px] font-semibold"
                        style={{ background: colors.bg, color: colors.text }}
                      >
                        {domain.name.charAt(0)}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[15px] font-medium leading-snug text-heading transition-colors group-hover:text-primary">
                          {domain.name}
                        </div>
                        <div className="mt-0.5 text-[12px] text-muted">
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
          )}
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
