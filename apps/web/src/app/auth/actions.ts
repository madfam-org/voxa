'use server';

import { signIn, signOut } from '@/auth';
import { isAccountSwitchPrompt, runAccountSwitch } from '@/lib/account-switch';
import { JANUA_PROVIDER_ID } from '@/lib/auth-env';
import { normalizeAuthRedirectPath } from '@/lib/auth-redirect';

/**
 * Sign-in server actions. Next.js accepts server actions only from this
 * origin (it checks `Origin` against `Host`), which is their CSRF guard.
 */
function redirectTarget(formData: FormData): string {
  const raw = formData.get('redirect_to');
  return normalizeAuthRedirectPath(typeof raw === 'string' ? raw : null);
}

/** «Continuar con Janua»: no `prompt`, so a live Janua session is reused. */
export async function continueWithJanua(formData: FormData): Promise<void> {
  await signIn(JANUA_PROVIDER_ID, { redirectTo: redirectTarget(formData) });
}

/** «Cambiar de cuenta» (`select_account`) and «Entrar como otra persona» (`login`). */
export async function switchAccount(formData: FormData): Promise<void> {
  const prompt = formData.get('prompt');
  if (!isAccountSwitchPrompt(prompt)) throw new Error('Unknown account switch');
  await runAccountSwitch(prompt, redirectTarget(formData), { signIn, signOut });
}
