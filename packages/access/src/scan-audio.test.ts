import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { encodeScanBeepWav, SCAN_GROUP_BEEP, SCAN_STEP_BEEP } from './scan-audio.js';

describe('scan audio cues', () => {
  it('encodes a valid WAV tone for scan beeps', () => {
    const wav = encodeScanBeepWav(SCAN_STEP_BEEP, 22050);
    assert.equal(String.fromCharCode(...wav.slice(0, 4)), 'RIFF');
    assert.equal(String.fromCharCode(...wav.slice(8, 12)), 'WAVE');
    assert.ok(wav.length > 44);
  });

  it('uses a lower frequency for group scan cues', () => {
    assert.ok(SCAN_GROUP_BEEP.frequencyHz < SCAN_STEP_BEEP.frequencyHz);
  });
});
