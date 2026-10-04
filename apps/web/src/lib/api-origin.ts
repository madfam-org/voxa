/** Origin of the Voxa API that the server-side proxies call. */
export function voxaApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}
