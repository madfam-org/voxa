/**
 * WebSocket URL for live board sync. The socket is authorized by a single-use
 * ticket from `POST /v1/ws-ticket` (valid 30 seconds); an access token never
 * goes in the URL, where proxies and servers would log it.
 */
export function buildBoardSyncWsUrl(baseUrl: string, boardId: string, ticket?: string): string {
  const wsBase = baseUrl.replace(/\/$/, '').replace(/^http/, 'ws');
  const params = new URLSearchParams({ boardId });
  if (ticket) params.set('ticket', ticket);
  return `${wsBase}/v1/ws?${params.toString()}`;
}
