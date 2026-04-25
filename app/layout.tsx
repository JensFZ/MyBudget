import type { Metadata } from 'next';
import { Merriweather } from 'next/font/google';
import { cookies } from 'next/headers';
import './globals.css';
import { I18nProvider } from '@/lib/i18n';
import { verifySession } from '@/lib/auth';
import db from '@/lib/db';

const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['300', '400', '700', '900'],
  variable: '--font-sans',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (token) {
      const { userId } = await verifySession(token);
      const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string } | undefined;
      if (user?.name) {
        return { title: `${user.name} Budget`, description: 'Persönliche Budgetverwaltung' };
      }
    }
  } catch { /* not logged in */ }
  return { title: 'MyBudget', description: 'Persönliche Budgetverwaltung' };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={merriweather.variable}>
      <body className="bg-gray-100">
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
