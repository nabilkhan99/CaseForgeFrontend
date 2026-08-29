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
import DomainProgressStrip from '@/components/library/DomainProgressStrip';
import StatusChips from '@/components/library/StatusChips';
import StationRow from '@/components/library/StationRow';
import { useLibraryFilters } from '@/components/library/useLibraryFilters';
import { shouldShowDifficulty } from '@/lib/stations/difficulty';
import { matchesStatus } from '@/lib/stations/librarySearch';
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

  // Kept for `status` alone. The search field went with the redesign — a topic
  // holds at most twelve cases, all of them on screen — but `?status=` is a
  // link people already hold, and the hook is what keeps it in the URL.
  const { filters, setStatus } = useLibraryFilters();

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

  // 185 of the bank's 200 cases are "intermediate", so most domains are
  // single-tier and the pill would be the same word stamped on every row.
  // Judged over the whole domain, not the filter: the board dims rather than
  // removes, so every row stays on screen and the answer must not change
  // under a chip press.
  const showDifficulty = useMemo(
    () => shouldShowDifficulty(stations.map(s => s.difficulty)),
    [stations],
  );

  const completedCount = stations.filter(s => s.attempts.length > 0).length;
  const passedCount = stations.filter(s => s.passed).length;
  const attemptCount = stations.reduce((total, s) => total + s.attempts.length, 0);
  const matchCount = useMemo(
    () => stations.filter(s => matchesStatus(s, filters.status)).length,
    [stations, filters.status],
  );
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
  //
  // Sessions, not cases: the page now lists every attempt, so a count of cases
  // touched would be smaller than the number of history lines below it.
  const subtitle = stations.length === 0
    ? undefined
    : completedCount === 0
      ? `${stations.length} case${stations.length !== 1 ? 's' : ''}`
      : `${passedCount} of ${stations.length} passed · ${attemptCount} attempt${attemptCount !== 1 ? 's' : ''}${avgScore > 0 ? ` · Best-attempt average: ${avgScore}%` : ''}`;

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
          {/* The row you pressed on the board, reappearing on the page it
              opened. Decorative — see DomainProgressStrip. */}
          <DomainProgressStrip
            stations={stations}
            passedCount={passedCount}
            status={filters.status}
          />

          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-black/[0.07] pt-3">
            <StatusChips
              status={filters.status}
              onStatusChange={setStatus}
              label="Filter cases by progress"
            />

            {/* Only once a chip is pressed: "7 of 7" beside an unfiltered list
                is a number that answers nothing. */}
            {filters.status !== 'all' && (
              <span className="text-[12px] tabular-nums text-muted" aria-live="polite">
                {matchCount} of {stations.length} shown
              </span>
            )}
          </div>

          <div>
            {stations.map((station, i) => {
              const matches = matchesStatus(station, filters.status);

              return (
                <motion.div
                  key={station.id}
                  initial={{ opacity: 0, y: 6 }}
                  // Dimmed, never removed — the same filter behaviour as the
                  // board it came from. A case that drops out of the list takes
                  // its attempt history with it, and this page is now where
                  // that history lives.
                  animate={{ opacity: matches ? 1 : 0.32, y: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.04, duration: 0.25 }}
                >
                  <StationRow station={station} showDifficulty={showDifficulty} />
                </motion.div>
              );
            })}
          </div>
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
