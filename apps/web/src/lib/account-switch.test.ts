import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import en from '@voxa/i18n/messages/en';
import es from '@voxa/i18n/messages/es';
import fr from '@voxa/i18n/messages/fr';
import { ACCOUNT_SWITCH_PROMPTS, isAccountSwitchPrompt, runAccountSwitch } from './account-switch';

function recordingDeps() {
  const calls: Array<{ fn: string; args: unknown[] }> = [];
  return {
    calls,
    deps: {
      signIn: async (...args: unknown[]) => {
        calls.push({ fn: 'signIn', args });
      },
      signOut: async (...args: unknown[]) => {
        calls.push({ fn: 'signOut', args });
      },
    },
  };
}

describe('account switching', () => {
  it('«Cambiar de cuenta» signs in through Janua with prompt=select_account', async () => {
    const { calls, deps } = recordingDeps();
    await runAccountSwitch('select_account', '/app', deps);
    assert.deepEqual(calls, [
      { fn: 'signOut', args: [{ redirect: false }] },
      { fn: 'signIn', args: ['janua', { redirectTo: '/app' }, { prompt: 'select_account' }] },
    ]);
  });

  it('«Entrar como otra persona» signs in through Janua with prompt=login', async () => {
    const { calls, deps } = recordingDeps();
    await runAccountSwitch('login', '/app/edit', deps);
    assert.deepEqual(calls[1], { fn: 'signIn', args: ['janua', { redirectTo: '/app/edit' }, { prompt: 'login' }] });
  });

  it('accepts only the two switch prompts (never none)', () => {
    assert.deepEqual([...ACCOUNT_SWITCH_PROMPTS], ['select_account', 'login']);
    assert.equal(isAccountSwitchPrompt('none'), false);
    assert.equal(isAccountSwitchPrompt('consent'), false);
  });

  it('both controls post the right prompt (sign-in page and signed-in surface share them)', () => {
    const source = readFileSync(join(import.meta.dirname, '..', 'components', 'account-controls.tsx'), 'utf8');
    assert.match(source, /name="prompt" value="select_account"/);
    assert.match(source, /name="prompt" value="login"/);
    assert.match(source, /action=\{switchAccount\}/);
    assert.match(source, /action="\/auth\/signout"/);
    const signIn = readFileSync(join(import.meta.dirname, '..', 'app', '[locale]', 'auth', 'signin', 'page.tsx'), 'utf8');
    assert.match(signIn, /<SignInControls/);
    const board = readFileSync(join(import.meta.dirname, '..', 'components', 'board-screen.tsx'), 'utf8');
    assert.match(board, /<AccountControls/);
  });

  for (const [locale, messages] of Object.entries({ es, en, fr })) {
    it(`has the switch, sign-out and notice texts in ${locale}`, () => {
      const auth = (messages as { auth: Record<string, unknown> }).auth;
      for (const key of ['switchAccount', 'signInAsSomeoneElse', 'signOut', 'accountControls', 'sharedDeviceHint']) {
        assert.equal(typeof auth[key], 'string', `${locale} auth.${key}`);
        assert.ok((auth[key] as string).length > 2);
      }
      const sync = (messages as { sync: Record<string, unknown> }).sync;
      assert.equal(typeof sync.pendingDroppedOtherAccount, 'string');
    });
  }

  it('uses the expected Spanish wording', () => {
    assert.equal(es.auth.switchAccount, 'Cambiar de cuenta');
    assert.equal(es.auth.signInAsSomeoneElse, 'Entrar como otra persona');
  });
});
