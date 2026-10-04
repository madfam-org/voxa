import { DEMO_BOARD_ID } from '@voxa/core';
import { apiFetch } from '@/lib/api-client';
import { getUsageConsent, getUtteranceTextConsent } from '@/lib/consent';

/**
 * Records one button press for usage counts. Sent only when signed in, with
 * the usage-counts choice on, and never for the shared demo board (the API
 * enforces the same rules). The spoken text is sent only when the API has
 * reported a text-retention consent that applies to the user's organization;
 * otherwise the request carries the board and button ids only.
 */
export async function logButtonActivation(
  signedIn: boolean,
  input: { boardId: string; buttonId: string; speechText: string },
): Promise<void> {
  if (!signedIn || input.boardId === DEMO_BOARD_ID || !getUsageConsent()) return;

  const body: { boardId: string; buttonId: string; speechText?: string } = {
    boardId: input.boardId,
    buttonId: input.buttonId,
  };
  if (getUtteranceTextConsent()) body.speechText = input.speechText;

  try {
    await apiFetch('/v1/events/activations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    /* best-effort telemetry */
  }
}
