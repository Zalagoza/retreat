import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import VisitBeacon from '@/components/VisitBeacon';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { SITE_TITLE, SHARE_TITLE, SHARE_DESCRIPTION } from '@/lib/config';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-montserrat',
});

// WhatsApp needs an absolute image URL, so this must be your real https address
function siteUrl(): URL {
  try {
    if (process.env.NEXT_PUBLIC_SITE_URL) return new URL(process.env.NEXT_PUBLIC_SITE_URL);
  } catch { /* fall through */ }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return new URL('https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL);
  }
  return new URL('http://localhost:3000');
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: SITE_TITLE, template: '%s | KIA Memoirs' },
  description: SHARE_DESCRIPTION,
  openGraph: {
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    siteName: 'KIA Memoirs',
    type: 'website',
    url: '/',
    images: [{ url: '/og', width: 1200, height: 630, alt: SHARE_TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: ['/og'],
  },
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
      <body className={montserrat.variable + ' font-montserrat flex min-h-dvh flex-col antialiased'}>
        <Nav />
        <div aria-hidden className="pt-safe"><div className="h-[60px]" /></div>
        <main className="mx-auto w-full max-w-[1400px] flex-1 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] py-3">
          {children}
        </main>
        <Footer />
        <VisitBeacon />
      </body>
    </html>
  );
}
