'use client';

import { useEffect, useState } from 'react';
import {
  configureSpeech,
  resolveSpeechVoice,
} from '@/lib/play-button-speech';
import type { CommunicatorSettings } from '@/lib/communicator-settings';
import { chosenVoiceForLocale, loadVoices } from '@/lib/speech-voices';

export interface DeviceVoices {
  /** False when the browser has no speech synthesis at all. */
  supported: boolean;
  /** True once the list arrived or the bounded wait ended (the list may still be empty). */
  loaded: boolean;
  voices: SpeechSynthesisVoice[];
}

/**
 * The device's voices, loaded without hanging on browsers that never fire
 * `voiceschanged`, and refreshed when the list changes later (voices
 * installed or downloaded while the app is open).
 */
export function useDeviceVoices(): DeviceVoices {
  const [state, setState] = useState<DeviceVoices>({ supported: true, loaded: false, voices: [] });

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !window.speechSynthesis) {
      setState({ supported: false, loaded: true, voices: [] });
      return;
    }
    const synth = window.speechSynthesis;
    let active = true;
    void loadVoices(synth).then((voices) => {
      if (active) setState({ supported: true, loaded: true, voices });
    });
    const refresh = () => {
      try {
        const voices = synth.getVoices();
        if (active && voices.length > 0) setState({ supported: true, loaded: true, voices });
      } catch {
        /* keep the last list */
      }
    };
    synth.addEventListener?.('voiceschanged', refresh);
    return () => {
      active = false;
      synth.removeEventListener?.('voiceschanged', refresh);
    };
  }, []);

  return state;
}

export interface MissingVoiceNotice {
  /** The chosen voice that is no longer on this device. */
  chosenVoiceURI: string;
  /** The voice Voxa speaks with instead (null: the browser's default for the language). */
  fallbackName: string | null;
}

/**
 * Applies the communicator's voice and tuning to the speech module and
 * reports a chosen voice that is no longer on this device. The notice is
 * recorded as shown the moment it appears, so it is shown once per voice;
 * it stays on screen until dismissed.
 */
export function useSpeechSettings(
  settings: CommunicatorSettings,
  setSettings: (patch: Partial<CommunicatorSettings>) => void,
  speechLocale: string,
): {
  deviceVoices: DeviceVoices;
  missingVoiceNotice: MissingVoiceNotice | null;
  dismissMissingVoiceNotice: () => void;
} {
  const deviceVoices = useDeviceVoices();
  const { voiceURIByLocale, speechRate, speechPitch, speechVolume, voiceMissingNoticeFor } = settings;
  const [notice, setNotice] = useState<MissingVoiceNotice | null>(null);

  useEffect(() => {
    configureSpeech({ voiceURIByLocale, rate: speechRate, pitch: speechPitch, volume: speechVolume });
  }, [voiceURIByLocale, speechRate, speechPitch, speechVolume]);

  const chosenVoiceURI = chosenVoiceForLocale(voiceURIByLocale, speechLocale);
  useEffect(() => {
    if (!deviceVoices.loaded || !chosenVoiceURI || chosenVoiceURI === voiceMissingNoticeFor) return;
    const resolution = resolveSpeechVoice(speechLocale, { voiceURIByLocale });
    if (!resolution.chosenMissing) return;
    setNotice({ chosenVoiceURI, fallbackName: resolution.voice?.name ?? null });
    setSettings({ voiceMissingNoticeFor: chosenVoiceURI });
  }, [deviceVoices, chosenVoiceURI, voiceMissingNoticeFor, speechLocale, voiceURIByLocale, setSettings]);

  return { deviceVoices, missingVoiceNotice: notice, dismissMissingVoiceNotice: () => setNotice(null) };
}
