'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/user-context';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { UserProvider } from '@/lib/user-context';

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role !== 'admin') {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading || user?.role !== 'admin') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <span className="text-slate-400 text-sm">Checking access...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-inter overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // The (admin) route group lives outside (main), so it does not inherit the
  // (main)/layout.tsx UserProvider. We provide our own UserProvider here to
  // make useUser() available within all admin pages.
  return (
    <UserProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </UserProvider>
  );
}
