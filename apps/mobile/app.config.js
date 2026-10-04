/**
 * Dynamic Expo config. Store and EAS identifiers are never committed: they are
 * read from the environment when the config is evaluated.
 *
 * - EAS_PROJECT_ID: the EAS project this app builds under. On EAS Build workers
 *   EAS sets EAS_BUILD_PROJECT_ID itself, so only the machine that starts the
 *   build (a developer shell or the GitHub workflow) needs EAS_PROJECT_ID.
 * - EAS_PROJECT_OWNER (optional): the Expo account that owns the project.
 *
 * Builds must not run against a missing project. When VOXA_REQUIRE_EAS_PROJECT=1
 * (set by the mobile workflows) or on an EAS Build worker (EAS_BUILD=true), a
 * missing project id throws instead of producing a config without one. Local
 * `expo start` and `expo export` keep working without any of these variables.
 */
const appJson = require('./app.json');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function resolveEasProjectId() {
  const projectId = readEnv('EAS_PROJECT_ID') ?? readEnv('EAS_BUILD_PROJECT_ID');
  const required = readEnv('VOXA_REQUIRE_EAS_PROJECT') === '1' || readEnv('EAS_BUILD') === 'true';

  if (!projectId) {
    if (required) {
      throw new Error(
        'EAS_PROJECT_ID is not set. Create the EAS project (cd apps/mobile && npx eas-cli init), ' +
          'then set the EAS_PROJECT_ID repository variable (GitHub) or shell variable (local) to its id.',
      );
    }
    return undefined;
  }
  if (!UUID.test(projectId)) {
    throw new Error('EAS_PROJECT_ID must be the EAS project UUID (8-4-4-4-12 hex digits).');
  }
  return projectId;
}

/**
 * @param {{ config?: import('expo/config').ExpoConfig }} [context] Expo passes
 *   the static app.json config; scripts may call this without it.
 * @returns {import('expo/config').ExpoConfig}
 */
module.exports = (context = {}) => {
  const base = context.config ?? appJson.expo;
  const projectId = resolveEasProjectId();
  const owner = readEnv('EAS_PROJECT_OWNER');
  const { eas: _ignoredEas, ...extra } = base.extra ?? {};

  return {
    ...base,
    ...(owner ? { owner } : {}),
    extra: {
      ...extra,
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl,
      webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? extra.webUrl,
      oidcIssuer: process.env.EXPO_PUBLIC_OIDC_ISSUER ?? extra.oidcIssuer,
      oidcClientId: process.env.EXPO_PUBLIC_OIDC_CLIENT_ID ?? extra.oidcClientId,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
