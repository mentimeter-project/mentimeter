'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ResultsRedirect() {
  const router = useRouter();
  const params = useParams();
  useEffect(() => {
    router.replace(`/admin/review/${params.assessmentId}`);
  }, [router, params.assessmentId]);
  return null;
}
