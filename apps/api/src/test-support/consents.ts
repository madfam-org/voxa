type RequestApp = { request: (path: string, init?: RequestInit) => Response | Promise<Response> };

/** Records the caller's consent decisions through `PUT /v1/consents`. */
export async function putConsents(
  app: RequestApp,
  headers: Record<string, string>,
  consents: Record<string, boolean>,
): Promise<void> {
  const res = await app.request('/v1/consents', {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ consents }),
  });
  if (res.status !== 200) {
    throw new Error(`PUT /v1/consents answered ${res.status}: ${await res.text()}`);
  }
}
