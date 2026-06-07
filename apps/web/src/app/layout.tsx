import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegistration } from '@/components/service-worker-registration';

export const metadata: Metadata = {
  title: 'Voxa — AAC Communication Board',
  description: 'Next-generation augmentative and alternative communication',
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
      </body>
    </html>
  );
}
