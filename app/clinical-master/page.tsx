'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ClinicalLayout from '@/components/clinical-master/ClinicalLayout';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface StationData {
  id: string;
  title: string;
  patient_name: string;
  reading_duration_seconds: number;
  consultation_duration_seconds: number;
  domain_name: string;
}

function ClinicalMasterContent() {
  const searchParams = useSearchParams();
  const stationId = searchParams.get('station');

  const [station, setStation] = useState<StationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStation() {
      const supabase = createClient();

      if (!stationId) {
        // Try to get any available station
        const { data: stations, error } = await supabase
          .from('stations')
          .select('id, title, patient_name, domain_id, reading_duration_seconds, consultation_duration_seconds')
          .eq('is_active', true)
          .limit(1);

        if (error) {
          console.error('Error fetching stations:', error.message);
          setLoading(false);
          return;
        }

        if (stations && stations.length > 0) {
          const s = stations[0];

          // Fetch domain name separately
          const { data: domain } = await supabase
            .from('domains')
            .select('name')
            .eq('id', s.domain_id)
            .single();

          setStation({
            id: s.id,
            title: s.title,
            patient_name: s.patient_name,
            reading_duration_seconds: s.reading_duration_seconds,
            consultation_duration_seconds: s.consultation_duration_seconds,
            domain_name: domain?.name || 'Unknown',
          });
        }
        setLoading(false);
        return;
      }

      // Fetch specific station
      const { data: s, error } = await supabase
        .from('stations')
        .select('id, title, patient_name, domain_id, reading_duration_seconds, consultation_duration_seconds')
        .eq('id', stationId)
        .single();

      if (error || !s) {
        console.error('Error fetching station:', error?.message);
        setLoading(false);
        return;
      }

      // Fetch domain name separately
      const { data: domain } = await supabase
        .from('domains')
        .select('name')
        .eq('id', s.domain_id)
        .single();

      setStation({
        id: s.id,
        title: s.title,
        patient_name: s.patient_name,
        reading_duration_seconds: s.reading_duration_seconds,
        consultation_duration_seconds: s.consultation_duration_seconds,
        domain_name: domain?.name || 'Unknown',
      });
      setLoading(false);
    }

    fetchStation();
  }, [stationId]);

  const readingMins = station ? Math.floor(station.reading_duration_seconds / 60) : 3;
  const consultMins = station ? Math.floor(station.consultation_duration_seconds / 60) : 8;

  return (
    <ClinicalLayout showSidebar={true} showNotepad={true} stationTitle={station?.title}>
      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-4 md:p-8 bg-[#080c12]">
        {/* Background Gradients */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        {/* Content */}
        <div className="z-10 text-center max-w-2xl w-full flex flex-col items-center">
          {loading ? (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
          ) : station ? (
            <>
              <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
                {station.title}
              </h2>

              <p className="text-indigo-300/60 text-lg mb-2">
                Patient: {station.patient_name}
              </p>
              <p className="text-indigo-400/50 text-sm mb-8">
                {station.domain_name}
              </p>

              <div className="flex items-center gap-3 text-indigo-300/80 font-medium mb-8 md:mb-12 bg-indigo-500/5 px-4 md:px-6 py-2 rounded-full border border-indigo-500/10 text-sm md:text-base">
                <span className="material-symbols-outlined text-[20px]">schedule</span>
                <span className="tracking-wide">{readingMins} min reading / {consultMins} min consultation</span>
              </div>

              <div className="relative group w-full max-w-sm">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                <Link href={`/clinical-master/station/${station.id}`}>
                  <button className="relative w-full py-4 px-8 md:py-6 md:px-12 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center gap-4 text-white font-bold text-lg md:text-xl shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] min-h-[44px]">
                    <span>Start Station</span>
                    <span className="material-symbols-outlined text-2xl">play_circle</span>
                  </button>
                </Link>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <span className="material-symbols-outlined text-6xl text-gray-600">inbox</span>
              <h2 className="text-2xl font-bold text-white">No Stations Available</h2>
              <p className="text-gray-400">More stations are coming soon.</p>
              <Link
                href="/dashboard/library"
                className="px-6 py-3 bg-purple-500/20 border border-purple-500/20 rounded-xl text-purple-400 hover:bg-purple-500/30 transition-all"
              >
                Browse Station Library
              </Link>
            </div>
          )}
        </div>

        {/* Placeholder for station materials */}
        {station && (
          <div className="absolute bottom-12 w-full max-w-4xl px-8 opacity-20">
            <div className="h-24 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center">
              <span className="text-slate-500 font-medium italic">
                Station materials will appear once the timer begins
              </span>
            </div>
          </div>
        )}
      </div>
    </ClinicalLayout>
  );
}

export default function ClinicalMasterPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-[#080c12]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    }>
      <ClinicalMasterContent />
    </Suspense>
  );
}
