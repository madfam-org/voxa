'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { BoardButton, MediaAsset, RecordedSpeech } from '@voxa/core';
import { uploadBoardMedia } from '@/lib/upload-media';
import { neutral, status, surface } from '@/lib/tokens';

interface RecordedMediaPanelProps {
  boardId: string;
  signedIn: boolean;
  recordedBy: string;
  button: BoardButton;
  disabled?: boolean;
  onAudioChange: (audio: RecordedSpeech | undefined) => void;
  onVideoChange: (video: MediaAsset | undefined) => void;
}

export function RecordedMediaPanel({
  boardId,
  signedIn,
  recordedBy,
  button,
  disabled,
  onAudioChange,
  onVideoChange,
}: RecordedMediaPanelProps): React.ReactNode {
  const t = useTranslations('recordedMedia');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const audio = button.kind === 'glp' ? button.audio : button.audio;
  const video = button.kind === 'glp' ? button.video : undefined;
  const isGlp = button.kind === 'glp';

  const uploadFile = useCallback(
    async (file: File, onSuccess: (url: string, mimeType: string) => void) => {
      if (!signedIn) {
        setError(t('signInToUpload'));
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const uploaded = await uploadBoardMedia(boardId, file, file.name);
        onSuccess(uploaded.url, uploaded.mimeType);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [signedIn, boardId, t],
  );

  const startRecording = useCallback(async () => {
    if (!signedIn) {
      setError(t('signInToRecord'));
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError(t('noMicrophone'));
      return;
    }

    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const file = new File([blob], `recording-${Date.now()}.webm`, {
          type: blob.type || 'audio/webm',
        });
        await uploadFile(file, (url) => {
          onAudioChange({ url, recordedBy, durationMs: undefined });
        });
        setRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [signedIn, onAudioChange, recordedBy, t, uploadFile]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, []);

  return (
    <section style={{ marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: '0.875rem' }}>{t('title')}</h3>
      <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: neutral.muted, lineHeight: 1.4 }}>
        {t('hint')}
      </p>

      {audio?.url ? (
        <p style={{ fontSize: '0.8125rem', color: status.success, margin: '0 0 8px' }}>
          {t('audioAttached')}
        </p>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {!recording ? (
          <button type="button" disabled={disabled || busy} onClick={() => void startRecording()} style={btnStyle}>
            {t('record')}
          </button>
        ) : (
          <button type="button" onClick={stopRecording} style={{ ...btnStyle, background: status.dangerStrong }}>
            {t('stop')}
          </button>
        )}
        <label style={{ ...btnStyle, cursor: disabled || busy ? 'not-allowed' : 'pointer' }}>
          {t('uploadAudio')}
          <input
            type="file"
            accept="audio/*"
            disabled={disabled || busy}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void uploadFile(file, (url) => onAudioChange({ url, recordedBy }));
              e.target.value = '';
            }}
          />
        </label>
        {audio?.url ? (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => onAudioChange(undefined)}
            style={btnStyle}
          >
            {t('removeAudio')}
          </button>
        ) : null}
      </div>

      {isGlp ? (
        <>
          <h3 style={{ margin: '12px 0 8px', fontSize: '0.875rem' }}>{t('videoTitle')}</h3>
          {video?.url ? (
            <p style={{ fontSize: '0.8125rem', color: status.success, margin: '0 0 8px' }}>
              {t('videoAttached')}
            </p>
          ) : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <label style={{ ...btnStyle, cursor: disabled || busy ? 'not-allowed' : 'pointer' }}>
              {t('uploadVideo')}
              <input
                type="file"
                accept="video/*"
                disabled={disabled || busy}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void uploadFile(file, (url, mimeType) => onVideoChange({ url, mimeType }));
                  e.target.value = '';
                }}
              />
            </label>
            {video?.url ? (
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => onVideoChange(undefined)}
                style={btnStyle}
              >
                {t('removeVideo')}
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {error ? <p style={{ color: status.danger, fontSize: '0.8125rem', margin: '8px 0 0' }}>{error}</p> : null}
    </section>
  );
}

const btnStyle: React.CSSProperties = {
  background: surface.overlay,
  color: surface.white,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  padding: '8px 12px',
  minHeight: 38,
  fontSize: '0.8125rem',
  cursor: 'pointer',
};
