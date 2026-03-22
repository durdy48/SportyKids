import type { Metadata } from 'next';
import { Poppins, Inter } from 'next/font/google';
import '@/styles/globals.css';
import { UserProvider } from '@/lib/user-context';
import { NavBar } from '@/components/NavBar';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'SportyKids - Noticias deportivas para niños',
  description: 'Noticias deportivas personalizadas, vídeos cortos y quizzes interactivos para niños.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${poppins.variable} ${inter.variable}`}>
      <body className="bg-[var(--color-background)] font-[family-name:var(--font-inter)] text-[var(--color-text)] min-h-screen">
        <UserProvider>
          <NavBar />
          <main className="max-w-6xl mx-auto px-4 py-6">
            {children}
          </main>
        </UserProvider>
      </body>
    </html>
  );
}
