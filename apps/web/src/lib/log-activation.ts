import { getAiConsent } from '@/components/consent-banner';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function logButtonActivation(
  accessToken: string | undefined,
  input: { boardId: string; buttonId: string; speechText: string },
): Promise<void> {
  if (!accessToken || !getAiConsent()) return;

  try {
    await fetch(`${API_URL.replace(/\/$/, '')}/v1/events/activations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Voxa-AI-Consent': 'true',
      },
      body: JSON.stringify(input),
      keepalive: true,
    });
  } catch {
    /* best-effort telemetry */
  }
}
