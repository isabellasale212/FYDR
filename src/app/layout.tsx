import type { Metadata, Viewport } from 'next';
import { DM_Mono, Sora } from 'next/font/google';
import { Providers } from './providers';
import '@/styles/tokens.css';
import '@/styles/base.css';

/* 06-design-system.md §2.1. Four Sora faces and two DM Mono faces, and there is
 * no Sora 500: writing font-weight 500 against Sora synthesises it. */
const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-sora',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Fydr',
  description: 'Athlete performance management for sports clubs.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB" className={`${sora.variable} ${dmMono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
