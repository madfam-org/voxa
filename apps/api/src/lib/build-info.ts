/**
 * Build identity: the commit this image was built from.
 *
 * The Dockerfile's runner stage sets `GIT_SHA` from the `GIT_SHA` build arg
 * (the deploy workflows pass `github.sha`; the default is `unknown`). The
 * health endpoint serves it as `build`, so a deploy check can prove that the
 * new image is the one answering, not an old pod. Only a 7–40 character
 * lowercase hex commit id is served; anything else (unset, empty, a value
 * that is not a commit id) answers `unknown`, so no other configuration
 * reaches the response.
 */
const COMMIT_SHA = /^[0-9a-f]{7,40}$/;

export function buildSha(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const value = env.GIT_SHA?.trim().toLowerCase() ?? '';
  return COMMIT_SHA.test(value) ? value : 'unknown';
}
