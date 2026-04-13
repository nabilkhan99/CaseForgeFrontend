'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function CasesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/portfolio');
  }, [router]);
  return null;
}
