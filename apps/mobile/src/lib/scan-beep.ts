import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { encodeScanBeepWav, SCAN_STEP_BEEP, type ScanBeepSpec } from '@voxa/access';

let configured = false;

async function ensureAudioMode(): Promise<void> {
  if (configured) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
  });
  configured = true;
}

function wavToDataUri(wav: Uint8Array): string {
  let binary = '';
  for (const byte of wav) binary += String.fromCharCode(byte);
  const encode =
    typeof globalThis.btoa === 'function'
      ? globalThis.btoa.bind(globalThis)
      : (value: string) => Buffer.from(value, 'binary').toString('base64');
  return `data:audio/wav;base64,${encode(binary)}`;
}

export async function playMobileScanBeep(spec: ScanBeepSpec = SCAN_STEP_BEEP): Promise<void> {
  await ensureAudioMode();
  const uri = wavToDataUri(encodeScanBeepWav(spec));
  const player = createAudioPlayer({ uri });
  player.volume = 1;
  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    if (!status.didJustFinish) return;
    subscription.remove();
    player.remove();
  });
  player.play();
}
