// Expo's default Metro config detects the pnpm workspace (watch folders and
// node_modules paths) on its own since SDK 52. Hierarchical lookup must stay
// on: pnpm's isolated layout resolves a package's dependencies next to it.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
