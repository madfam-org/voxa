import type { BoardButton } from '@voxa/core';
import { buttonMediaVideo, buttonRecordedSpeech } from '@voxa/core';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { buttonSpeech } from '@/lib/board-utils';

interface ActivePlayback {
  player: AudioPlayer;
  finish: () => void;
}

let active: ActivePlayback | null = null;

function stopActiveSound(): void {
  if (!active) return;
  const { player, finish } = active;
  active = null;
  try {
    player.pause();
    player.remove();
  } catch {
    /* ignore */
  }
  finish();
}

async function playRemoteAudio(
  url: string,
  headers?: Record<string, string>,
): Promise<void> {
  stopActiveSound();
  const player = createAudioPlayer({ uri: url, headers });
  await new Promise<void>((resolve) => {
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) current.finish();
    });
    let done = false;
    const current: ActivePlayback = {
      player,
      finish: () => {
        if (done) return;
        done = true;
        subscription.remove();
        resolve();
      },
    };
    active = current;
    player.play();
  });
  if (active?.player === player) stopActiveSound();
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
