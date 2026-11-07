import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Closeout | Failure in. Evidence out.',
  description: 'An interactive factory failure demo. Run real C firmware against a synthetic beacon, reject a bad shortcut, and verify the fix on held-out units.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
