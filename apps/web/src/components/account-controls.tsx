'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { continueWithJanua, switchAccount } from '@/app/auth/actions';
import { purgeAccountData } from '@/lib/account-data';

/**
 * Account controls (ruling R44). On a shared tablet the next person must
 * never be signed in as the previous caregiver, so sign-out and both
 * switches delete this account's local data (`purgeAccountData`) before the
 * form is submitted; «Continuar con Janua» keeps it.
 */
function usePurgeBeforeSubmit() {
  const purged = useRef(false);
  return (event: React.FormEvent<HTMLFormElement>) => {
    if (purged.current) return;
    event.preventDefault();
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    void purgeAccountData().finally(() => {
      purged.current = true;
      form.requestSubmit(submitter instanceof HTMLElement ? submitter : undefined);
    });
  };
}

interface SwitchFormsProps {
  redirectTo: string;
  buttonStyle: React.CSSProperties;
}

function SwitchForms({ redirectTo, buttonStyle }: SwitchFormsProps): React.ReactNode {
  const t = useTranslations('auth');
  const purgeSelect = usePurgeBeforeSubmit();
  const purgeLogin = usePurgeBeforeSubmit();
  return (
    <>
      <form action={switchAccount} onSubmit={purgeSelect} style={{ display: 'contents' }}>
        <input type="hidden" name="prompt" value="select_account" />
        <input type="hidden" name="redirect_to" value={redirectTo} />
        <button type="submit" style={buttonStyle} data-voxa-account-switch="select_account">
          {t('switchAccount')}
        </button>
      </form>
      <form action={switchAccount} onSubmit={purgeLogin} style={{ display: 'contents' }}>
        <input type="hidden" name="prompt" value="login" />
        <input type="hidden" name="redirect_to" value={redirectTo} />
        <button type="submit" style={buttonStyle} data-voxa-account-switch="login">
          {t('signInAsSomeoneElse')}
        </button>
      </form>
    </>
  );
}

/** Signed-in surface: both switches and sign-out, as toolbar buttons. */
export function AccountControls({
  redirectTo,
  buttonStyle,
}: {
  redirectTo: string;
  buttonStyle: React.CSSProperties;
}): React.ReactNode {
  const t = useTranslations('auth');
  const purgeSignOut = usePurgeBeforeSubmit();
  return (
    <>
      <SwitchForms redirectTo={redirectTo} buttonStyle={buttonStyle} />
      <form method="post" action="/auth/signout" onSubmit={purgeSignOut} style={{ display: 'contents' }}>
        <button type="submit" style={buttonStyle} data-voxa-sign-out="true">
          {t('signOut')}
        </button>
      </form>
    </>
  );
}

/** Sign-in page: the ordinary sign-in plus both switches. */
export function SignInControls({
  redirectTo,
  primaryStyle,
  secondaryStyle,
}: {
  redirectTo: string;
  primaryStyle: React.CSSProperties;
  secondaryStyle: React.CSSProperties;
}): React.ReactNode {
  const t = useTranslations('auth');
  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
      <form action={continueWithJanua} style={{ display: 'contents' }}>
        <input type="hidden" name="redirect_to" value={redirectTo} />
        <button type="submit" style={primaryStyle}>
          {t('continueJanua')}
        </button>
      </form>
      <div role="group" aria-label={t('accountControls')} style={{ display: 'grid', gap: 8 }}>
        <SwitchForms redirectTo={redirectTo} buttonStyle={secondaryStyle} />
      </div>
    </div>
  );
}
