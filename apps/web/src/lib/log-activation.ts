import { DEMO_BOARD_ID } from '@voxa/core';
import { getUsageConsent, getUtteranceTextConsent } from '@/lib/consent';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Records one button press for usage counts. Sent only when signed in, with
 * the usage-counts choice on, and never for the shared demo board (the API
 * enforces the same rules). The spoken text is sent only when the API has
 * reported a text-retention consent that applies to the user's organization;
 * otherwise the request carries the board and button ids only.
 */
export async function logButtonActivation(
  accessToken: string | undefined,
  input: { boardId: string; buttonId: string; speechText: string },
): Promise<void> {
  if (!accessToken || input.boardId === DEMO_BOARD_ID || !getUsageConsent()) return;

  const body: { boardId: string; buttonId: string; speechText?: string } = {
    boardId: input.boardId,
    buttonId: input.buttonId,
  };
  if (getUtteranceTextConsent()) body.speechText = input.speechText;

  try {
    await fetch(`${API_URL.replace(/\/$/, '')}/v1/events/activations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    /* best-effort telemetry */
  }
}
