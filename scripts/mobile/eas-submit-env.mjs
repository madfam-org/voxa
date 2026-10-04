#!/usr/bin/env node
// Check (and, in CI, apply) the store submission settings that eas.json cannot
// read from the environment by itself.
//
// eas.json already references the App Store Connect API key and the Google Play
// service account key through "$VAR" values, which EAS CLI expands at submit
// time. The App Store Connect app id (ascAppId) and the Apple team id have no
// such expansion, so this script writes them into the submit profile of the CI
// checkout. Nothing it writes is committed.
//
// Usage:
//   node scripts/mobile/eas-submit-env.mjs --check [--platform all|ios|android]
//   node scripts/mobile/eas-submit-env.mjs --apply --profile preview|production [--platform all|ios|android]
//
// Environment (names only; values never printed):
//   iOS:     ASC_APP_ID, ASC_API_KEY_PATH, ASC_API_KEY_ID, ASC_API_KEY_ISSUER_ID,
//            APPLE_TEAM_ID (optional)
//   Android: GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EAS_JSON = resolve(ROOT, 'apps/mobile/eas.json');

function parseArgs(argv) {
  const args = { mode: undefined, profile: undefined, platform: 'all' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check' || arg === '--apply') args.mode = arg.slice(2);
    else if (arg === '--profile') args.profile = argv[++i];
    else if (arg === '--platform') args.platform = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.mode) throw new Error('Pass --check or --apply.');
  if (!['all', 'ios', 'android'].includes(args.platform)) {
    throw new Error('--platform must be all, ios or android.');
  }
  if (args.mode === 'apply' && !args.profile) throw new Error('--apply needs --profile.');
  return args;
}

function env(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** @returns {string[]} problems, each naming a variable but never its value */
function checkPlatform(platform) {
  const problems = [];
  const requireSet = (name) => {
    if (!env(name)) problems.push(`${name} is not set`);
  };
  const requireFile = (name) => {
    const value = env(name);
    if (!value) problems.push(`${name} is not set`);
    else if (!existsSync(value)) problems.push(`${name} does not point to an existing file`);
  };

  if (platform === 'ios') {
    requireSet('ASC_APP_ID');
    if (env('ASC_APP_ID') && !/^\d{1,30}$/.test(env('ASC_APP_ID'))) {
      problems.push('ASC_APP_ID must be the numeric App Store Connect app id');
    }
    requireFile('ASC_API_KEY_PATH');
    requireSet('ASC_API_KEY_ID');
    requireSet('ASC_API_KEY_ISSUER_ID');
    if (env('APPLE_TEAM_ID') && !/^[0-9A-Z]{10}$/.test(env('APPLE_TEAM_ID'))) {
      problems.push('APPLE_TEAM_ID must be 10 uppercase letters or digits');
    }
  } else {
    requireFile('GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH');
  }
  return problems;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const platforms = args.platform === 'all' ? ['ios', 'android'] : [args.platform];

  const problems = platforms.flatMap((platform) =>
    checkPlatform(platform).map((problem) => `${platform}: ${problem}`),
  );
  if (problems.length > 0) {
    console.error('Store submission settings are incomplete:');
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error('Set the repository secrets and variables listed in docs/launch/MOBILE_GA.md.');
    process.exit(1);
  }

  if (args.mode === 'check') {
    console.log(`OK   store submission settings present for: ${platforms.join(', ')}`);
    return;
  }

  const easJson = JSON.parse(readFileSync(EAS_JSON, 'utf8'));
  const profile = easJson.submit?.[args.profile];
  if (!profile) throw new Error(`eas.json has no submit profile "${args.profile}".`);
  if (platforms.includes('ios')) {
    profile.ios = {
      ...profile.ios,
      ascAppId: env('ASC_APP_ID'),
      ...(env('APPLE_TEAM_ID') ? { appleTeamId: env('APPLE_TEAM_ID') } : {}),
    };
  }
  writeFileSync(EAS_JSON, `${JSON.stringify(easJson, null, 2)}\n`);
  console.log(`OK   applied store submission settings to submit.${args.profile} for: ${platforms.join(', ')}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
