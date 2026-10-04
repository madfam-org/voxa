import { JANUA_PROVIDER_ID } from './auth-env';

/**
 * Account switching (owner directive 2026-09-21, ruling R44; the enclii model).
 *
 * - «Cambiar de cuenta» → Janua `/authorize` with `prompt=select_account`:
 *   Janua shows a chooser over the accounts this browser holds.
 * - «Entrar como otra persona» → `prompt=login`: Janua asks for credentials
 *   even with a live session.
 * - Sign-out → `POST /auth/signout` (RP-initiated logout, `sign-out.ts`).
 *
 * Both switches first end the Voxa session, so a cancelled switch never
 * leaves the previous person signed in on a shared tablet. The page purges
 * that account's local data before it submits (`account-data.ts`).
 * Auth.js's `signIn(provider, options, authorizationParams)` passes `prompt`
 * through to Janua.
 */
export const ACCOUNT_SWITCH_PROMPTS = ['select_account', 'login'] as const;
export type AccountSwitchPrompt = (typeof ACCOUNT_SWITCH_PROMPTS)[number];

export function isAccountSwitchPrompt(value: unknown): value is AccountSwitchPrompt {
  return typeof value === 'string' && (ACCOUNT_SWITCH_PROMPTS as readonly string[]).includes(value);
}

export interface AccountSwitchDeps {
  signIn: (
    provider: string,
    options: { redirectTo: string },
    authorizationParams: Record<string, string>,
  ) => Promise<unknown>;
  signOut: (options: { redirect: false }) => Promise<unknown>;
}

export async function runAccountSwitch(
  prompt: AccountSwitchPrompt,
  redirectTo: string,
  deps: AccountSwitchDeps,
): Promise<unknown> {
  await deps.signOut({ redirect: false });
  return deps.signIn(JANUA_PROVIDER_ID, { redirectTo }, { prompt });
}
