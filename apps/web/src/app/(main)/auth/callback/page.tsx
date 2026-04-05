'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/lib/user-context';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useUser();

  useEffect(() => {
    const token = searchParams.get('token');
    const refresh = searchParams.get('refresh');
    const error = searchParams.get('error');

    // C4: Remove sensitive tokens from the URL immediately after reading
    window.history.replaceState({}, '', '/auth/callback');

    if (error) {
      router.replace('/login?error=' + error);
      return;
    }

    if (token && refresh) {
      localStorage.setItem('sportykids_access_token', token);
      localStorage.setItem('sportykids_refresh_token', refresh);

      // Fetch user data and redirect to home
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      fetch(`${apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => {
          // W5: Check response status before parsing JSON
          if (!res.ok) throw new Error('Auth failed');
          return res.json();
        })
        .then(user => {
          if (user.id) {
            localStorage.setItem('sportykids_usuario_id', user.id);
            setUser(user);
          }
          router.replace('/');
        })
        .catch(() => router.replace('/'));
    } else {
      router.replace('/login?error=missing_tokens');
    }
  }, [searchParams, router, setUser]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
