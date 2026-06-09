export interface ScanBeepSpec {
  frequencyHz: number;
  durationMs: number;
  volume: number;
}

/** Standard scan-step cue (Grid/TD Snap style short tone). */
export const SCAN_STEP_BEEP: ScanBeepSpec = {
  frequencyHz: 880,
  durationMs: 55,
  volume: 0.18,
};

/** Lower tone when scanning row/region groups. */
export const SCAN_GROUP_BEEP: ScanBeepSpec = {
  frequencyHz: 660,
  durationMs: 55,
  volume: 0.16,
};

function writeString(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index++) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

/** Build a mono PCM16 WAV tone for mobile playback via data URI. */
export function encodeScanBeepWav(spec: ScanBeepSpec, sampleRate = 44100): Uint8Array {
  const sampleCount = Math.max(1, Math.floor((sampleRate * spec.durationMs) / 1000));
  const dataBytes = sampleCount * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let index = 0; index < sampleCount; index++) {
    const t = index / sampleRate;
    const envelope = Math.min(1, index / 80, (sampleCount - index) / 80);
    const sample = Math.sin(2 * Math.PI * spec.frequencyHz * t) * spec.volume * envelope;
    view.setInt16(44 + index * 2, Math.round(sample * 32767), true);
  }

  return new Uint8Array(buffer);
}

let sharedAudioContext: AudioContext | null = null;

function getBrowserAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  sharedAudioContext ??= new AudioContextCtor();
  return sharedAudioContext;
}

export function playScanBeepInBrowser(spec: ScanBeepSpec = SCAN_STEP_BEEP): void {
  const context = getBrowserAudioContext();
  if (!context) return;

  void context.resume().then(() => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = spec.frequencyHz;
    gain.gain.value = spec.volume;
    oscillator.connect(gain);
    gain.connect(context.destination);
    const start = context.currentTime;
    oscillator.start(start);
    oscillator.stop(start + spec.durationMs / 1000);
  });
}
