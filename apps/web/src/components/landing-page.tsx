'use client';

import Link from 'next/link';
import { SiteFooter, SiteNav } from '@/components/site-chrome';

const section: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: '64px 24px',
};

const card: React.CSSProperties = {
  background: '#171717',
  border: '1px solid #333',
  borderRadius: 16,
  padding: 24,
};

export function LandingPage(): React.ReactNode {
  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#fafafa' }}>
      <SiteNav active="home" />

      {/* Hero */}
      <section
        style={{
          ...section,
          paddingTop: 48,
          paddingBottom: 48,
          display: 'grid',
          gap: 40,
          alignItems: 'center',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 12px',
              color: '#93c5fd',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontSize: '0.8125rem',
            }}
          >
            Augmentative &amp; alternative communication
          </p>
          <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.1 }}>
            Every person deserves a voice that keeps up with their life.
          </h1>
          <p style={{ margin: '0 0 28px', color: '#a3a3a3', fontSize: '1.125rem', lineHeight: 1.65, maxWidth: 540 }}>
            AAC apps turn taps, switches, or gaze into spoken language — at home, in therapy, and in
            class. <strong style={{ color: '#e5e5e5' }}>Voxa</strong> is a modern communication board
            with motor planning, CVI-friendly themes, AI-assisted predictions, and secure cloud sync —
            designed so families start free and institutions scale with confidence.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Link href="/demo" style={primaryCta}>
              Try the live demo
            </Link>
            <Link href="/auth/signin?redirect_to=%2Fapp" style={secondaryCta}>
              Sign in free (parents)
            </Link>
          </div>
        </div>
        <div style={{ ...card, background: 'linear-gradient(145deg, #1e3a5f 0%, #171717 60%)' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '1.125rem' }}>Why AAC is life-changing</h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: '#d4d4d4', lineHeight: 1.7 }}>
            <li>Reduces frustration when speech alone is not enough</li>
            <li>Supports language development, not just request-and-response</li>
            <li>Builds independence for meals, play, medical visits, and friendships</li>
            <li>Gives caregivers and clinicians a shared, evidence-aligned tool</li>
          </ul>
          <p style={{ margin: '16px 0 0', fontSize: '0.875rem', color: '#93c5fd' }}>
            Research consistently shows early, robust AAC access improves communication outcomes — not
            delays speech.
          </p>
        </div>
      </section>

      {/* Why AAC deep dive */}
      <section id="why-aac" style={{ background: '#111', borderBlock: '1px solid #262626' }}>
        <div style={section}>
          <h2 style={{ margin: '0 0 12px', fontSize: '1.75rem' }}>Communication is a human right</h2>
          <p style={{ margin: '0 0 32px', color: '#a3a3a3', maxWidth: 720, lineHeight: 1.65 }}>
            Digital AAC replaces paper boards with speech output, vocabulary that grows with the user,
            and access methods matched to physical ability. Voxa focuses on what practitioners and
            families ask for most: stable motor plans, visually accessible layouts, and tools that work
            offline when the network does not.
          </p>
          <div
            style={{
              display: 'grid',
              gap: 20,
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            }}
          >
            {FEATURES.map((f) => (
              <div key={f.title} style={card}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.0625rem' }}>{f.title}</h3>
                <p style={{ margin: 0, color: '#a3a3a3', lineHeight: 1.6, fontSize: '0.9375rem' }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo CTA */}
      <section style={section}>
        <div
          style={{
            ...card,
            display: 'grid',
            gap: 24,
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            alignItems: 'center',
            borderColor: '#2563eb',
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.5rem' }}>High-fidelity demo — no signup wall</h2>
            <p style={{ margin: 0, color: '#a3a3a3', lineHeight: 1.6 }}>
              Experience a real core-word board: tap &ldquo;I&rdquo;, &ldquo;want&rdquo;, &ldquo;more&rdquo;, hear
              speech output, and feel how motor planning keeps words in predictable places. When you are
              ready, one click creates a free account to save and sync.
            </p>
          </div>
          <Link href="/demo" style={{ ...primaryCta, textAlign: 'center', justifyContent: 'center' }}>
            Open interactive demo →
          </Link>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ background: '#111', borderBlock: '1px solid #262626' }}>
        <div style={section}>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.75rem', textAlign: 'center' }}>Simple, honest pricing</h2>
          <p style={{ margin: '0 0 40px', textAlign: 'center', color: '#a3a3a3' }}>
            Always free for individual parents. Institutional plans fund secure hosting and analytics for
            teams.
          </p>
          <div
            style={{
              display: 'grid',
              gap: 24,
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            }}
          >
            <div style={{ ...card, borderColor: '#2563eb' }}>
              <p style={{ margin: '0 0 4px', color: '#93c5fd', fontWeight: 700, fontSize: '0.8125rem' }}>
                PARENTS &amp; CAREGIVERS
              </p>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.5rem' }}>Free</h3>
              <p style={{ margin: '0 0 16px', color: '#a3a3a3', fontSize: '0.9375rem' }}>
                Forever free for individual families supporting one communicator at home.
              </p>
              <ul style={{ margin: '0 0 20px', paddingLeft: 18, color: '#d4d4d4', lineHeight: 1.7, fontSize: '0.9375rem' }}>
                <li>Cloud sync &amp; backup</li>
                <li>OBF import/export</li>
                <li>CVI themes &amp; access methods</li>
                <li>Starter AI predictions</li>
              </ul>
              <Link href="/auth/signin?redirect_to=%2Fapp" style={primaryCta}>
                Create free account
              </Link>
            </div>
            <div style={card}>
              <p style={{ margin: '0 0 4px', color: '#a3a3a3', fontWeight: 700, fontSize: '0.8125rem' }}>
                EXTENDED FAMILY
              </p>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.5rem' }}>Family</h3>
              <p style={{ margin: '0 0 16px', color: '#a3a3a3', fontSize: '0.9375rem' }}>
                More boards and shared editing for siblings, grandparents, and co-parents.
              </p>
              <ul style={{ margin: '0 0 20px', paddingLeft: 18, color: '#d4d4d4', lineHeight: 1.7, fontSize: '0.9375rem' }}>
                <li>Multiple boards &amp; profiles</li>
                <li>Small care team (editors)</li>
                <li>Priority sync</li>
              </ul>
              <Link href="/auth/signin?redirect_to=%2Fapp" style={secondaryCta}>
                Sign in to upgrade
              </Link>
            </div>
            <div id="institutions" style={{ ...card, borderColor: '#ca8a04' }}>
              <p style={{ margin: '0 0 4px', color: '#fbbf24', fontWeight: 700, fontSize: '0.8125rem' }}>
                SCHOOLS, CLINICS &amp; DISTRICTS
              </p>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.5rem' }}>Institutional</h3>
              <p style={{ margin: '0 0 16px', color: '#a3a3a3', fontSize: '0.9375rem' }}>
                Paid plans for organizations that need compliance, roles, and aggregate usage insight by
                communicator — without exposing private message content.
              </p>
              <ul style={{ margin: '0 0 20px', paddingLeft: 18, color: '#d4d4d4', lineHeight: 1.7, fontSize: '0.9375rem' }}>
                <li>Unlimited boards &amp; team roles</li>
                <li>Full AI &amp; GLP workflows</li>
                <li>Usage dashboards by final user</li>
                <li>Dedicated onboarding &amp; SLA</li>
              </ul>
              <a
                href="mailto:hello@madfam.io?subject=Voxa%20institutional%20plan"
                style={{ ...secondaryCta, borderColor: '#ca8a04', color: '#fde68a' }}
              >
                Contact sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Conversion footer CTA */}
      <section style={{ ...section, textAlign: 'center', paddingBottom: 32 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '1.75rem' }}>Start where you are. Grow when you need to.</h2>
        <p style={{ margin: '0 0 24px', color: '#a3a3a3', maxWidth: 560, marginInline: 'auto', lineHeight: 1.6 }}>
          Try the demo as a visitor, create a free parent account in minutes, or talk with us about
          rolling Voxa out across your organization.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/demo" style={primaryCta}>
            Try demo
          </Link>
          <Link href="/app" style={secondaryCta}>
            Open my communicator
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

const FEATURES = [
  {
    title: 'Motor planning first',
    body: 'Core words stay in fixed locations so users build muscle memory — the same principle behind leading dedicated AAC devices.',
  },
  {
    title: 'CVI & access modes',
    body: 'High-contrast themes, switch scanning, and eye-dwell support mean the same board adapts to cortical visual impairment and different physical access.',
  },
  {
    title: 'AI that respects consent',
    body: 'Optional predictions speed multi-word messages; families control AI consent, and institutional policies can be enforced centrally.',
  },
  {
    title: 'Open Board Format',
    body: 'Import and export OBF to collaborate with SLPs and migrate from other apps without lock-in.',
  },
  {
    title: 'Offline-ready',
    body: 'Boards cache locally so communication continues on unreliable school Wi‑Fi or during travel.',
  },
  {
    title: 'Janua identity',
    body: 'One MADFAM sign-in across Voxa and partner tools — fewer passwords for caregivers and staff.',
  },
];

const primaryCta: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '14px 22px',
  borderRadius: 10,
  background: '#2563eb',
  color: '#fff',
  fontWeight: 700,
  textDecoration: 'none',
  fontSize: '1rem',
};

const secondaryCta: React.CSSProperties = {
  ...primaryCta,
  background: 'transparent',
  border: '1px solid #404040',
  color: '#e5e5e5',
};
