'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, Suspense } from 'react';

function RedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const stationId = searchParams.get('station');

  useEffect(() => {
    if (stationId) {
      router.replace(`/clinical-master/station/${stationId}`);
    } else {
      router.replace('/dashboard/library');
    }
  }, [stationId, router]);

  return (
    <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
      <div className="animate-pulse text-muted text-sm">Redirecting...</div>
    </div>
  );
}

export default function ClinicalMasterPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-surface" />}>
      <RedirectContent />
    </Suspense>
  );
}
