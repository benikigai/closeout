import type { Metadata } from 'next';
import { Archivo, Martian_Mono } from 'next/font/google';
import './globals.css';
import './landing.css';

// Self-hosted at build time, so the strict CSP (font-src 'self') never has to allow Google.
const archivo = Archivo({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-archivo', display: 'swap' });
const martianMono = Martian_Mono({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-martian', display: 'swap' });

export const metadata: Metadata = {
  title: 'Closeout | Failure in. Evidence out.',
  description: 'Closeout solves complex factory failures, physical or firmware, and closes each one only when a held-out build proves the fix.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${martianMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
