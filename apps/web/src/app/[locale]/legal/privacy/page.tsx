import { LegalPage } from '@/components/legal-page';

const LAST_UPDATED = 'June 7, 2026';

export default function PrivacyPage(): React.ReactNode {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro="Voxa is an augmentative and alternative communication (AAC) platform operated by MADFAM. This policy describes how we collect, use, and protect information when you use voxa.madfam.io and related services."
      sections={[
        {
          title: 'Information we collect',
          content:
            'We collect account information from Janua SSO (name, email, user id), communication board data you create or sync, optional usage telemetry if you opt in, and standard service logs (IP address, user agent, request timestamps) for security and reliability.',
        },
        {
          title: 'How we use information',
          content:
            'We use your data to provide AAC board sync, team collaboration, accessibility features, and optional AI-assisted predictions. We do not sell utterance or board data to third parties. AI features send only the minimum context required and only when you have opted in.',
        },
        {
          title: 'Children and guardians',
          content:
            'Voxa may be used by minors with guardian or clinician oversight. Account creation and billing are managed by adults. We do not knowingly collect marketing profiles on children. Guardians may request access, correction, or deletion of a dependent’s board data by contacting us.',
        },
        {
          title: 'Data storage and retention',
          content:
            'Board data is stored in encrypted PostgreSQL in our cloud infrastructure. You may export boards in Open Board Format (OBF). We retain data while your account is active and for a limited period after closure for backup integrity, unless law requires longer retention.',
        },
        {
          title: 'Sharing',
          content:
            'We share data only with infrastructure providers (hosting, identity, payment when applicable) under contract, or when required by law. Clinical records belong in your healthcare provider’s systems — Voxa is a communication tool, not an electronic health record.',
        },
        {
          title: 'Your choices',
          content:
            'You can opt out of AI telemetry in Settings. You can export or delete boards where your role permits. You may sign out at any time to end your browser session.',
        },
        {
          title: 'Security',
          content:
            'We use TLS in transit, access controls, and MADFAM platform security practices. No method is 100% secure; report concerns to security@madfam.io.',
        },
        {
          title: 'Changes',
          content:
            'We will post updates on this page with a revised “Last updated” date. Material changes may be notified by email or in-product notice.',
        },
      ]}
    />
  );
}
