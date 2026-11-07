import type { Metadata } from 'next';
import './globals.css';
import './landing.css';

export const metadata: Metadata = {
  title: 'Closeout | Failure in. Evidence out.',
  description: 'Closeout solves complex factory failures, physical or firmware, and closes each one only when a held-out build proves the fix.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Martian+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
