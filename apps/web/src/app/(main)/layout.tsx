import type { Metadata } from 'next';
import { UserProvider } from '@/lib/user-context';
import { NavBar } from '@/components/NavBar';
import { OfflineBanner } from '@/components/OfflineBanner';

export const metadata: Metadata = {
  title: 'SportyKids - Sports news for kids',
  description: 'Personalized sports news, short videos and interactive quizzes for kids.',
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <OfflineBanner />
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </UserProvider>
  );
}
