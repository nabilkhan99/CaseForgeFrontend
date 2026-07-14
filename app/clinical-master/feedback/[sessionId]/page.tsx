'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import FeedbackReport from '@/components/clinical-master/FeedbackReport';

function LoadingFallback() {
  return (
    <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
      <motion.div
        className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

function FeedbackPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const from = searchParams.get('from');

  return <FeedbackReport sessionId={sessionId} variant="app" from={from} />;
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FeedbackPageContent />
    </Suspense>
  );
}
