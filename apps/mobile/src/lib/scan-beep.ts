import { Audio } from 'expo-av';
import { encodeScanBeepWav, SCAN_STEP_BEEP, type ScanBeepSpec } from '@voxa/access';

let configured = false;

async function ensureAudioMode(): Promise<void> {
  if (configured) return;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
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
  const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 1 });
  sound.setOnPlaybackStatusUpdate((status) => {
    if (!status.isLoaded || !status.didJustFinish) return;
    void sound.unloadAsync();
  });
}
