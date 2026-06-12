import { getTranslations } from 'next-intl/server';
import { LegalPage, type LegalSection } from '@/components/legal-page';

export default async function TermsPage(): Promise<React.ReactNode> {
  const t = await getTranslations('legal.terms');
  const shared = await getTranslations('legal.shared');
  const sections = t.raw('sections') as LegalSection[];

  return (
    <LegalPage
      title={t('title')}
      lastUpdatedLabel={shared('lastUpdatedLabel', { date: t('lastUpdated') })}
      intro={t('intro')}
      sections={sections}
      backLabel={shared('back')}
      contentsLabel={shared('contents')}
      questionsLabel={shared('questions')}
    />
  );
}
