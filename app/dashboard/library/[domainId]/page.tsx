'use client';

import Link from 'next/link';
import { Suspense, use, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { getStationsForDomain, type Station } from '@/lib/supabase/queries/station-library';
import PageHeader from '@/components/ui/PageHeader';
import Container from '@/components/ui/Container';
import PrimaryButton from '@/components/ui/PrimaryButton';
import ScoreBadge from '@/components/ui/ScoreBadge';
import LibraryFilters from '@/components/library/LibraryFilters';
import StationRow from '@/components/library/StationRow';
import { useLibraryFilters } from '@/components/library/useLibraryFilters';
import { shouldShowDifficulty } from '@/lib/stations/difficulty';
import { filterStations, isFilterActive } from '@/lib/stations/librarySearch';
import { MAX_WEIGHTED_SCORE } from '@/lib/clinical-master/types';

interface PageProps {
  params: Promise<{ domainId: string }>;
}

function DomainSpinner() {
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

function DomainDetailContent({ domainId }: { domainId: string }) {
  const [stations, setStations] = useState<Station[]>([]);
  const [domainName, setDomainName] = useState('');
  const [loading, setLoading] = useState(true);
  // See the note on the library index: `undefined` means auth is still
  // resolving, and fetching before then shows a returning user an empty
  // progress column.
  const [user, setUser] = useState<User | null | undefined>(undefined);

  const { filters, setQuery, setStatus, clear } = useLibraryFilters();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (user === undefined) return;
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      const supabase = createClient();
      const { data: domain } = await supabase
        .from('domains')
        .select('name')
        .eq('id', domainId)
        .single();

      const stationsData = await getStationsForDomain(domainId, user?.id);
      if (cancelled) return;

      if (domain) setDomainName(domain.name);
      setStations(stationsData);
      setLoading(false);
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [domainId, user]);

  const filtering = isFilterActive(filters);
  const results = useMemo(() => filterStations(stations, filters), [stations, filters]);

  // Judged across the domain, not the filtered results: 185 of the bank's 200
  // cases are "intermediate", so most domains are single-tier and the pill
  // would just be the same word stamped on every row.
  const showDifficulty = useMemo(
    () => shouldShowDifficulty(stations.map(s => s.difficulty)),
    [stations],
  );

  const completedCount = stations.filter(s => s.attempts.length > 0).length;
  const passedCount = stations.filter(s => s.passed).length;
  // Average off the marked weighted scores, not clinical_sessions.overall_score:
  // the latter mixes two scales, so averaging it produced a red "8% REFER" badge
  // sitting next to "5 of 5 passed". These come from session_results, are all on
  // the 0–MAX_WEIGHTED_SCORE scale, and agree with the verdicts beside them.
  const scoredStations = stations.filter(s => s.bestScore !== null);
  const avgScore = scoredStations.length > 0
    ? Math.round(
        (scoredStations.reduce(
          (sum, s) => sum + (s.bestScore ?? 0) / (s.bestMaxScore ?? MAX_WEIGHTED_SCORE),
          0,
        ) / scoredStations.length) * 100,
      )
    : 0;

  // "0 of 10 passed · 0 attempted" is the greeting the dashboard explicitly
  // refuses to give; before the first attempt the count is the only honest
  // thing to say.
  const subtitle = stations.length === 0
    ? undefined
    : completedCount === 0
      ? `${stations.length} case${stations.length !== 1 ? 's' : ''}`
      : `${passedCount} of ${stations.length} passed · ${completedCount} attempted${avgScore > 0 ? ` · Best-attempt average: ${avgScore}%` : ''}`;

  return (
    <div>
      <PageHeader
        title={domainName || 'Loading...'}
        subtitle={subtitle}
        breadcrumbs={[
          { label: 'Library', href: '/dashboard/library' },
          { label: domainName || '...', href: `/dashboard/library/${domainId}` },
        ]}
      >
        {avgScore > 0 && <ScoreBadge score={avgScore} showLabel />}
      </PageHeader>

      {loading ? (
        <DomainSpinner />
      ) : stations.length === 0 ? (
        <Container>
          <div className="py-8 text-center">
            <p className="mb-2 text-[15px] text-muted">No cases available</p>
            <p className="mb-6 text-[13px] text-muted">More cases coming soon for this domain</p>
            <Link href="/dashboard/library">
              <PrimaryButton size="sm">Back to Library</PrimaryButton>
            </Link>
          </div>
        </Container>
      ) : (
        <>
          <LibraryFilters
            query={filters.query}
            onQueryChange={setQuery}
            status={filters.status}
            onStatusChange={setStatus}
            placeholder={`Search ${domainName || 'this domain'}`}
            resultLabel={
              filtering ? `${results.length} of ${stations.length}` : undefined
            }
          />

          {results.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[15px] text-muted">No cases match that.</p>
              <button
                type="button"
                onClick={clear}
                className="mt-3 text-[13px] font-semibold text-primary hover:underline focus-visible-ring"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div>
              {results.map((station, i) => (
                <motion.div
                  key={station.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.04 }}
                >
                  <StationRow station={station} showDifficulty={showDifficulty} />
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function DomainDetailPage({ params }: PageProps) {
  const { domainId } = use(params);

  // useSearchParams (via useLibraryFilters) needs a boundary for the build's
  // prerender pass.
  return (
    <Suspense fallback={<DomainSpinner />}>
      <DomainDetailContent domainId={domainId} />
    </Suspense>
  );
}
