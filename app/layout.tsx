import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import VisitBeacon from '@/components/VisitBeacon';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  title: 'Kia Memoirs',
  description: 'Photo library',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1A1A1A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={montserrat.variable + ' font-montserrat min-h-dvh antialiased'}>
        <header className="border-b-4 border-rast-gold bg-rast-charcoal pt-safe px-safe">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-3 py-3">
            <a href="/" className="text-lg font-bold text-rast-gold">Kia Memoirs</a>
            <a href="/admin" className="p-2 text-sm text-rast-cream/70 hover:text-rast-gold">Admin</a>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-3 px-safe py-3">{children}</main>
        <VisitBeacon />
      </body>
    </html>
  );
}
