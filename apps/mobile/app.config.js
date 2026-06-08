/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

module.exports = () => ({
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? appJson.expo.extra.apiUrl,
    oidcIssuer: process.env.EXPO_PUBLIC_OIDC_ISSUER ?? appJson.expo.extra.oidcIssuer,
    oidcClientId: process.env.EXPO_PUBLIC_OIDC_CLIENT_ID ?? appJson.expo.extra.oidcClientId,
  },
});
