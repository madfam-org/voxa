import type { BoardButton } from '@voxa/core';
import { buttonMediaVideo, buttonRecordedSpeech } from '@voxa/core';
import { buttonSpeech } from '@/lib/board-utils';

let activeVideo: HTMLVideoElement | null = null;

async function fetchAuthorizedBlob(url: string, accessToken?: string): Promise<Blob> {
  const headers: HeadersInit = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Media fetch failed (${res.status})`);
  return res.blob();
}

async function playBlobAudio(blob: Blob): Promise<void> {
  const blobUrl = URL.createObjectURL(blob);
  try {
    const audio = new Audio(blobUrl);
    await audio.play();
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('Audio playback failed'));
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function stopActiveVideo(): void {
  if (!activeVideo) return;
  activeVideo.pause();
  activeVideo.remove();
  activeVideo = null;
}

async function playRemoteVideo(url: string, accessToken?: string): Promise<void> {
  stopActiveVideo();
  const blob = await fetchAuthorizedBlob(url, accessToken);
  const blobUrl = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.src = blobUrl;
  video.playsInline = true;
  video.style.position = 'fixed';
  video.style.width = '1px';
  video.style.height = '1px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  document.body.appendChild(video);
  activeVideo = video;
  try {
    await video.play();
    await new Promise<void>((resolve, reject) => {
      video.onended = () => resolve();
      video.onerror = () => reject(new Error('Video playback failed'));
    });
  } finally {
    stopActiveVideo();
    URL.revokeObjectURL(blobUrl);
  }
}

function speakWithTts(text: string, locale: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(text), { lang: locale }));
}

/** Play recorded media when present; otherwise fall back to TTS. */
export async function speakButton(
  btn: BoardButton,
  options?: { accessToken?: string },
): Promise<void> {
  const video = buttonMediaVideo(btn);
  if (video?.url) {
    await playRemoteVideo(video.url, options?.accessToken);
    return;
  }

  const audio = buttonRecordedSpeech(btn);
  if (audio?.url) {
    const blob = await fetchAuthorizedBlob(audio.url, options?.accessToken);
    await playBlobAudio(blob);
    return;
  }

  speakWithTts(buttonSpeech(btn), btn.locale);
}

export function speakText(text: string, locale = 'en-US'): void {
  speakWithTts(text, locale);
}
