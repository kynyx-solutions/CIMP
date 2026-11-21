import type { Metadata } from 'next';
import './globals.css';
import SessionKeeper from '@/components/SessionKeeper';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const DESCRIPTION =
  'CIMP-BIIF supports early-stage founders with mentorship, funding access, infrastructure and a transparent, fully digital incubation process.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'CIMP-BIIF: Startup Incubation & Innovation Fund',
    template: '%s | CIMP-BIIF',
  },
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'CIMP-BIIF',
    title: 'CIMP-BIIF: Startup Incubation & Innovation Fund',
    description: DESCRIPTION,
    locale: 'en_IN',
  },
  twitter: { card: 'summary', title: 'CIMP-BIIF', description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionKeeper />
        {children}
      </body>
    </html>
  );
}
