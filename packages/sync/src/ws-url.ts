export function buildBoardSyncWsUrl(
  baseUrl: string,
  boardId: string,
  accessToken?: string,
): string {
  const wsBase = baseUrl.replace(/^http/, 'ws');
  const params = new URLSearchParams({ boardId });
  if (accessToken) params.set('accessToken', accessToken);
  return `${wsBase}/v1/ws?${params.toString()}`;
}
