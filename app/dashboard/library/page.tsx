'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { getDomains, type Domain } from '@/lib/supabase/queries/station-library';
import Link from 'next/link';
import { motion } from 'framer-motion';
import PageHeader from '@/components/ui/PageHeader';
import ScoreBadge from '@/components/ui/ScoreBadge';
import { getDomainColor } from '@/lib/constants/domains';

export default function StationLibraryPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  useEffect(() => {
    async function fetchDomains() {
      setLoading(true);
      const data = await getDomains(user?.id);
      setDomains(data);
      setLoading(false);
    }
    fetchDomains();
  }, [user]);

  const totalStations = domains.reduce((sum, d) => sum + d.station_count, 0);
  const domainCount = domains.filter(d => d.station_count > 0).length;

  return (
    <div>
      <PageHeader
        title="Station Library"
        subtitle={
          totalStations > 0
            ? `${totalStations} stations across ${domainCount} domains`
            : 'No stations available yet'
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <motion.div
            className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      ) : (
        <div className="divide-y divide-black/[0.06]">
          {domains
            .filter(d => d.station_count > 0)
            .map((domain, index) => {
              const colors = getDomainColor(domain.name, index);
              // Compute average score from completed count (we only have count, so show completion)
              const hasCompleted = domain.completed_count > 0;

              return (
                <motion.div
                  key={domain.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Link
                    href={`/dashboard/library/${domain.id}`}
                    className="flex items-center gap-4 py-4 px-2 -mx-2 rounded-lg hover:bg-black/[0.02] transition-colors group"
                  >
                    {/* Domain color indicator */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-bold flex-shrink-0"
                      style={{ background: colors.bg, color: colors.text }}
                    >
                      {domain.name.charAt(0)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold text-heading truncate group-hover:text-primary transition-colors">
                        {domain.name}
                      </div>
                      <div className="text-[12px] text-muted mt-0.5">
                        {domain.station_count} station{domain.station_count !== 1 ? 's' : ''}
                        {hasCompleted && ` \u00B7 ${domain.completed_count} completed`}
                      </div>
                    </div>

                    {/* Score or completion */}
                    {hasCompleted && (
                      <ScoreBadge
                        score={Math.round((domain.completed_count / domain.station_count) * 100)}
                        size="sm"
                      />
                    )}

                    {/* Chevron */}
                    <svg
                      className="w-4 h-4 text-muted group-hover:text-primary transition-colors flex-shrink-0"
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
    </div>
  );
}
