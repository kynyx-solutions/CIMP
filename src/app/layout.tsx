import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CIMP-BIIF — Incubation Management Platform',
  description: 'Where great ideas become funded companies',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
