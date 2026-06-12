import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export interface LegalSection {
  title: string;
  content: string;
  subsections?: { title: string; content: string }[];
}

interface LegalPageProps {
  title: string;
  intro: string;
  lastUpdated: string;
  sections: LegalSection[];
}

const pageStyle: React.CSSProperties = {
  minHeight: '100dvh',
  background: '#0a0a0a',
  color: '#fafafa',
  padding: '32px 20px 64px',
};

const containerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  lineHeight: 1.6,
};

const linkStyle: React.CSSProperties = {
  color: '#93c5fd',
  textDecoration: 'none',
};

export async function LegalPage({
  title,
  intro,
  lastUpdated,
  sections,
}: LegalPageProps): Promise<React.ReactNode> {
  const t = await getTranslations('legal.shared');

  return (
    <main style={pageStyle}>
      <article style={containerStyle}>
        <p style={{ marginBottom: 24 }}>
          <Link href="/" style={linkStyle}>
            {t('back')}
          </Link>
        </p>
        <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>{title}</h1>
        <p style={{ color: '#a3a3a3', marginBottom: 24 }}>
          {t('lastUpdatedLabel', { date: lastUpdated })}
        </p>
        <p style={{ marginBottom: 32 }}>{intro}</p>

        <nav
          aria-label="Table of contents"
          style={{
            marginBottom: 32,
            padding: 16,
            border: '1px solid #404040',
            borderRadius: 8,
            background: '#171717',
          }}
        >
          <strong>{t('contents')}</strong>
          <ol style={{ marginTop: 12, paddingLeft: 20 }}>
            {sections.map((section, index) => (
              <li key={section.title} style={{ marginBottom: 6 }}>
                <a href={`#section-${index}`} style={linkStyle}>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((section, index) => (
          <section key={section.title} id={`section-${index}`} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: 12 }}>
              {index + 1}. {section.title}
            </h2>
            <p style={{ marginBottom: 12 }}>{section.content}</p>
            {section.subsections?.map((sub) => (
              <div key={sub.title} style={{ marginLeft: 16, marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.05rem', marginBottom: 8 }}>{sub.title}</h3>
                <p>{sub.content}</p>
              </div>
            ))}
          </section>
        ))}

        <hr style={{ borderColor: '#404040', margin: '32px 0' }} />
        <p style={{ color: '#a3a3a3', fontSize: '0.875rem' }}>
          {t('questions')}{' '}
          <a href="mailto:legal@madfam.io" style={linkStyle}>
            legal@madfam.io
          </a>
        </p>
      </article>
    </main>
  );
}
