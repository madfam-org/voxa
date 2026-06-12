import { LegalPage } from '@/components/legal-page';

const LAST_UPDATED = 'June 7, 2026';

export default function AccessibilityStatementPage(): React.ReactNode {
  return (
    <LegalPage
      title="Accessibility Statement"
      lastUpdated={LAST_UPDATED}
      intro="Voxa targets WCAG 2.2 Level AA and AAC-specific accessibility beyond baseline web requirements. We welcome feedback from communicators, caregivers, and SLPs."
      sections={[
        {
          title: 'Conformance target',
          content:
            'We design for WCAG 2.2 Level AA including target size (2.5.8), pointer alternatives (2.5.7), contrast, and keyboard operability. AAC buttons default to at least 1 cm × 1 cm with user-adjustable scaling.',
        },
        {
          title: 'AAC-specific features',
          content:
            'Voxa includes CVI themes, switch scanning, eye-dwell selection, single-pointer alternatives to drag gestures, and motor-planning grid locks. See docs/accessibility.md in our repository for engineering details.',
        },
        {
          title: 'Known limitations',
          content:
            'Third-party symbol images may lack alternative text if imported from external boards. Some AI prediction features require connectivity. Mobile apps are catching up to web accessibility parity.',
        },
        {
          title: 'Assessment approach',
          content:
            'We combine automated checks, manual SLP review before releases, and hardware testing with switch and eye-tracking devices where available.',
        },
        {
          title: 'Feedback',
          content:
            'Email accessibility@madfam.io with the page or feature, assistive technology used, and steps to reproduce barriers. We aim to respond within five business days.',
        },
      ]}
    />
  );
}
