import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  accessChoiceFromSettings,
  accessSettingsPatch,
  existingBoardFor,
  FIRST_RUN_ACCESS,
  initialBoardLanguage,
  initialGridTemplate,
  shouldOfferFirstRun,
  type FirstRunGate,
} from './first-run';
import { DEFAULT_COMMUNICATOR_SETTINGS } from './communicator-settings';

const gate = (patch: Partial<FirstRunGate> = {}): FirstRunGate => ({
  communicatorScreen: true,
  signedIn: true,
  catalogLoaded: true,
  catalog: [{ id: 'demo-core', name: 'Demo' }],
  userId: 'u1',
  done: false,
  ...patch,
});

describe('first-run gate', () => {
  it('offers the setup to a signed-in user whose list holds only the read-only demo board', () => {
    assert.equal(shouldOfferFirstRun(gate()), true);
    assert.equal(shouldOfferFirstRun(gate({ catalog: [] })), true);
  });

  it('never offers it to a returning user with a board, signed out, before the list loads, on /app/edit, or twice', () => {
    assert.equal(shouldOfferFirstRun(gate({ catalog: [{ id: 'b1', name: 'Mine', ownerUserId: 'u1' }] })), false);
    assert.equal(shouldOfferFirstRun(gate({ catalog: [{ id: 'org', name: 'Shared', ownerUserId: 'other' }] })), false);
    assert.equal(shouldOfferFirstRun(gate({ signedIn: false })), false);
    assert.equal(shouldOfferFirstRun(gate({ catalogLoaded: false })), false);
    assert.equal(shouldOfferFirstRun(gate({ communicatorScreen: false })), false);
    assert.equal(shouldOfferFirstRun(gate({ done: true })), false);
  });

  it('picks the existing board to open: owned first, else a shared one, never the demo', () => {
    const catalog = [
      { id: 'demo-core', name: 'Demo' },
      { id: 'shared', name: 'Shared', ownerUserId: 'other' },
      { id: 'mine', name: 'Mine', ownerUserId: 'u1' },
    ];
    assert.equal(existingBoardFor(catalog, 'u1')?.id, 'mine');
    assert.equal(existingBoardFor(catalog, 'u2')?.id, 'shared');
    assert.equal(existingBoardFor([{ id: 'demo-core', name: 'Demo' }], 'u1'), undefined);
  });
});

describe('first-run choices map onto the existing settings', () => {
  it('maps each access choice to the Settings fields and back', () => {
    assert.deepEqual(accessSettingsPatch('touch'), { accessMode: 'touch', touchGuardEnabled: false });
    assert.deepEqual(accessSettingsPatch('switch'), { accessMode: 'switch' });
    assert.deepEqual(accessSettingsPatch('dwell'), { accessMode: 'eye-tracking', gazeSource: 'pointer' });
    assert.deepEqual(accessSettingsPatch('keyguard'), { accessMode: 'touch', touchGuardEnabled: true });
    for (const choice of FIRST_RUN_ACCESS) {
      const settings = { ...DEFAULT_COMMUNICATOR_SETTINGS, ...accessSettingsPatch(choice) };
      assert.equal(accessChoiceFromSettings(settings), choice);
    }
  });

  it('starts on es-MX and the 36-cell core board unless a valid choice is stored', () => {
    assert.equal(initialBoardLanguage(undefined), 'es-MX');
    assert.equal(initialBoardLanguage('de-DE'), 'es-MX');
    assert.equal(initialBoardLanguage('fr-FR'), 'fr-FR');
    assert.equal(initialGridTemplate(), 'core-36');
    assert.equal(initialGridTemplate('core-60'), 'core-60');
    assert.equal(initialGridTemplate('core-47'), 'core-36');
  });
});
