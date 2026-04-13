'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function CaseDetailRedirect() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  useEffect(() => {
    router.replace(`/portfolio/${id}`);
  }, [id, router]);
  return null;
}
