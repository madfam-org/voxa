import { LegalPage } from '@/components/legal-page';

const LAST_UPDATED = 'June 7, 2026';

export default function TermsPage(): React.ReactNode {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated={LAST_UPDATED}
      intro="These terms govern your use of Voxa at voxa.madfam.io and related MADFAM services. By using Voxa, you agree to these terms."
      sections={[
        {
          title: 'Service description',
          content:
            'Voxa provides cloud-synced AAC communication boards, team editing for caregivers and SLPs, accessibility modes, and optional AI-assisted features. The service is provided on an “as available” basis during preview and general availability phases.',
        },
        {
          title: 'Accounts',
          content:
            'You sign in through Janua (auth.madfam.io). You are responsible for activity under your account and for maintaining the confidentiality of your session. Notify us promptly of unauthorized access.',
        },
        {
          title: 'Acceptable use',
          content:
            'Do not misuse Voxa to harass others, upload illegal content, attempt to bypass security, or interfere with service operation. Do not use generated symbols or speech output to impersonate others or violate applicable law.',
        },
        {
          title: 'Content and ownership',
          content:
            'You retain ownership of boards and media you upload. You grant MADFAM a limited license to host, sync, and display that content solely to operate the service. Open Board Format export remains available to avoid lock-in.',
        },
        {
          title: 'Clinical disclaimer',
          content:
            'Voxa is not a medical device unless explicitly labeled and cleared as such. It does not provide diagnosis or treatment. Clinicians remain responsible for assessment and therapy decisions.',
        },
        {
          title: 'Paid plans',
          content:
            'When billing is enabled through MADFAM (Dhanam), subscription terms, refunds, and taxes will be presented at checkout. Free tiers may have usage limits.',
        },
        {
          title: 'Termination',
          content:
            'You may stop using Voxa at any time. We may suspend access for violations of these terms or to protect the platform. Upon termination, export your boards where possible before account closure.',
        },
        {
          title: 'Limitation of liability',
          content:
            'To the maximum extent permitted by law, MADFAM is not liable for indirect or consequential damages. Our aggregate liability is limited to fees paid in the twelve months before the claim, or fifty US dollars if no fees were paid.',
        },
        {
          title: 'Governing law',
          content:
            'These terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-law rules, except where mandatory consumer protections apply in your jurisdiction.',
        },
      ]}
    />
  );
}
