/**
 * Browser side of the same-origin API proxy. Every call to the Voxa API from
 * page code goes to `/api/v1/...` on this origin with the session cookie; the
 * server adds the bearer (`app/api/v1/[...path]/route.ts`). Page code never
 * holds an access token.
 */
export const API_PROXY_BASE = '/api';

export function apiPath(path: `/v1/${string}`): string {
  return `${API_PROXY_BASE}${path}`;
}

export function apiFetch(path: `/v1/${string}`, init: RequestInit = {}): Promise<Response> {
  return fetch(apiPath(path), { credentials: 'same-origin', ...init });
}

/** Origin of the Voxa API for the live-sync WebSocket (opened with a single-use ticket). */
export const API_WS_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
