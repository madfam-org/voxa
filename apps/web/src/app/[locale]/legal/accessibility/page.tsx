import { getTranslations } from 'next-intl/server';
import { LegalPage, type LegalSection } from '@/components/legal-page';

export default async function AccessibilityPage(): Promise<React.ReactNode> {
  const t = await getTranslations('legal.accessibility');
  const sections = t.raw('sections') as LegalSection[];

  return (
    <LegalPage
      title={t('title')}
      lastUpdated={t('lastUpdated')}
      intro={t('intro')}
      sections={sections}
    />
  );
}
