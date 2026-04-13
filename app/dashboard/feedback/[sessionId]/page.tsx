'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardFeedbackRedirect() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  useEffect(() => {
    router.replace(`/clinical-master/feedback/${sessionId}`);
  }, [sessionId, router]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-muted text-sm animate-pulse">Redirecting to feedback...</div>
    </div>
  );
}
