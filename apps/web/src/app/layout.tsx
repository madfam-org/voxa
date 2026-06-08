import type { Metadata, Viewport } from 'next';
import { ConsentBanner } from '@/components/consent-banner';
import { ServiceWorkerRegistration } from '@/components/service-worker-registration';

export const metadata: Metadata = {
  title: 'Voxa — AAC Communication Platform',
  description:
    'Modern augmentative and alternative communication (AAC) for families and institutions. Free for parents. Live demo, CVI themes, AI predictions, and cloud sync.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Voxa',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100dvh' }}>
        <ServiceWorkerRegistration />
        {children}
        <ConsentBanner />
      </body>
    </html>
  );
}
