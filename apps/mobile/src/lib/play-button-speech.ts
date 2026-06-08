import type { BoardButton } from '@voxa/core';
import { buttonMediaVideo, buttonRecordedSpeech } from '@voxa/core';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { buttonSpeech } from '@/lib/board-utils';

let activeSound: Audio.Sound | null = null;

async function stopActiveSound(): Promise<void> {
  if (!activeSound) return;
  try {
    await activeSound.stopAsync();
    await activeSound.unloadAsync();
  } catch {
    /* ignore */
  }
  activeSound = null;
}

async function playRemoteAudio(
  url: string,
  headers?: Record<string, string>,
): Promise<void> {
  await stopActiveSound();
  const { sound } = await Audio.Sound.createAsync({ uri: url, headers });
  activeSound = sound;
  await sound.playAsync();
  await new Promise<void>((resolve) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) resolve();
    });
  });
  await stopActiveSound();
}

/** Play recorded media when present; otherwise fall back to TTS. */
export async function speakButton(
  btn: BoardButton,
  options?: { accessToken?: string },
): Promise<void> {
  const headers = options?.accessToken
    ? { Authorization: `Bearer ${options.accessToken}` }
    : undefined;

  const video = buttonMediaVideo(btn);
  if (video?.url) {
    await playRemoteAudio(video.url, headers);
    return;
  }

  const audio = buttonRecordedSpeech(btn);
  if (audio?.url) {
    await playRemoteAudio(audio.url, headers);
    return;
  }

  Speech.speak(buttonSpeech(btn), { language: btn.locale });
}

export function speakText(text: string, locale = 'en-US'): void {
  Speech.speak(text, { language: locale });
}
