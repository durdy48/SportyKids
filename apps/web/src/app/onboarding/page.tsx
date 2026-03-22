'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/user-context';
import { OnboardingWizard } from '@/components/OnboardingWizard';

export default function OnboardingPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [loading, user, router]);

  if (loading) return null;
  if (user) return null;

  return <OnboardingWizard />;
}
