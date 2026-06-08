'use client';

import Link from 'next/link';

const navLink: React.CSSProperties = {
  color: '#d4d4d4',
  textDecoration: 'none',
  fontWeight: 500,
  fontSize: '0.9375rem',
};

export function SiteNav({ active }: { active?: 'home' | 'demo' | 'app' }): React.ReactNode {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '16px 24px',
        borderBottom: '1px solid #262626',
        background: 'rgba(10,10,10,0.92)',
        backdropFilter: 'blur(8px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <Link href="/" style={{ color: '#fafafa', fontWeight: 800, fontSize: '1.25rem', textDecoration: 'none' }}>
        Voxa
      </Link>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <Link href="/#why-aac" style={{ ...navLink, opacity: active === 'home' ? 1 : 0.85 }}>
          Why AAC
        </Link>
        <Link href="/demo" style={{ ...navLink, color: active === 'demo' ? '#93c5fd' : navLink.color }}>
          Live demo
        </Link>
        <Link href="/#pricing" style={navLink}>
          Pricing
        </Link>
        <Link
          href="/auth/signin?redirect_to=%2Fapp"
          style={{
            ...navLink,
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid #404040',
          }}
        >
          Sign in
        </Link>
        <Link
          href="/app"
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            background: '#2563eb',
            color: '#fff',
            fontWeight: 700,
            textDecoration: 'none',
            fontSize: '0.9375rem',
          }}
        >
          Open communicator
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter(): React.ReactNode {
  return (
    <footer
      style={{
        padding: '32px 24px 48px',
        borderTop: '1px solid #262626',
        color: '#a3a3a3',
        fontSize: '0.875rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'space-between',
        maxWidth: 1100,
        margin: '0 auto',
      }}
    >
      <p style={{ margin: 0, maxWidth: 420, lineHeight: 1.6 }}>
        Voxa is augmentative and alternative communication (AAC) built for real families, therapists, and
        classrooms — motor planning, CVI-friendly design, and cloud sync when you are ready.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Link href="/legal/privacy" style={{ color: '#93c5fd' }}>
          Privacy
        </Link>
        <Link href="/legal/terms" style={{ color: '#93c5fd' }}>
          Terms
        </Link>
        <Link href="/legal/accessibility" style={{ color: '#93c5fd' }}>
          Accessibility
        </Link>
      </div>
    </footer>
  );
}
