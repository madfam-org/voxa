'use client';

import { useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { CommunicatorSettings } from '@/lib/communicator-settings';
import type { DeviceVoices } from '@/hooks/use-device-voices';
import { previewVoice, resolveSpeechVoice } from '@/lib/play-button-speech';
import {
  DEFAULT_SPEECH_TUNING,
  groupVoicesForLocale,
  hasVoiceForLocale,
  HIGHER_VOICE_PRESET,
  normalizeLang,
  SPEECH_PITCH_MAX,
  SPEECH_PITCH_MIN,
  SPEECH_RATE_MAX,
  SPEECH_RATE_MIN,
  SPEECH_TUNING_STEP,
  SPEECH_VOLUME_MAX,
  SPEECH_VOLUME_MIN,
  chosenVoiceForLocale,
  type RankedVoice,
} from '@/lib/speech-voices';
import { neutral, surface } from '@/lib/tokens';

interface VoiceSettingsSectionProps {
  settings: CommunicatorSettings;
  onChange: (patch: Partial<CommunicatorSettings>) => void;
  /** The board's speech locale: the voice list and the choice are for this locale. */
  speechLocale: string;
  deviceVoices: DeviceVoices;
}

/** Language name for a BCP 47 tag in the UI language ("es-MX" → "español (México)"). */
function languageName(tag: string, uiLocale: string): string {
  try {
    return new Intl.DisplayNames([uiLocale], { type: 'language' }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}

function formatNumber(value: number, uiLocale: string): string {
  return new Intl.NumberFormat(uiLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

export function VoiceSettingsSection({
  settings,
  onChange,
  speechLocale,
  deviceVoices,
}: VoiceSettingsSectionProps): React.ReactNode {
  const t = useTranslations('voice');
  const uiLocale = useLocale();
  const [showAll, setShowAll] = useState(false);
  const headingId = useId();
  const locale = normalizeLang(speechLocale);
  const language = languageName(locale, uiLocale);

  const groups = groupVoicesForLocale(deviceVoices.voices, locale);
  const chosenVoiceURI = chosenVoiceForLocale(settings.voiceURIByLocale, locale) ?? '';
  const chosenIsListed = deviceVoices.voices.some((voice) => voice.voiceURI === chosenVoiceURI);
  const chosenInOtherGroup = groups.other.some((r) => r.voice.voiceURI === chosenVoiceURI);
  const automaticVoice = resolveSpeechVoice(locale, { voiceURIByLocale: {} }).voice;
  const noLocaleVoice = deviceVoices.loaded && !hasVoiceForLocale(deviceVoices.voices, locale);

  const optionLabel = ({ voice, hints, needsNetwork }: RankedVoice<SpeechSynthesisVoice>) => {
    const tags = [...hints.map((hint) => t(`hint.${hint}`)), ...(needsNetwork ? [t('needsNetwork')] : [])];
    return tags.length
      ? t('voiceOptionTagged', { name: voice.name, lang: normalizeLang(voice.lang), tags: tags.join(', ') })
      : t('voiceOption', { name: voice.name, lang: normalizeLang(voice.lang) });
  };

  const setVoice = (voiceURI: string) => {
    const next = { ...settings.voiceURIByLocale };
    if (voiceURI) next[locale] = voiceURI;
    else delete next[locale];
    onChange({ voiceURIByLocale: next });
  };

  const tuning = { rate: settings.speechRate, pitch: settings.speechPitch, volume: settings.speechVolume };
  const playPreview = () =>
    previewVoice(t('previewPhrase'), locale, { voiceURI: chosenVoiceURI || undefined, ...tuning });

  const higherPresetOn =
    settings.speechPitch === HIGHER_VOICE_PRESET.pitch && settings.speechRate === HIGHER_VOICE_PRESET.rate;

  return (
    <section
      aria-labelledby={headingId}
      data-voxa-voice-settings=""
      style={{ borderTop: `1px solid ${neutral.borderSubtle}`, paddingTop: 12, marginTop: 8, marginBottom: 8 }}
    >
      <h3 id={headingId} style={{ margin: '0 0 8px', fontSize: '0.9375rem' }}>
        {t('title')}
      </h3>
      <p style={hintStyle}>{t('intro', { language })}</p>

      {!deviceVoices.supported ? (
        <p role="status" style={hintStyle}>
          {t('unsupported')}
        </p>
      ) : (
        <>
          {!deviceVoices.loaded ? (
            <p role="status" style={hintStyle}>
              {t('loading')}
            </p>
          ) : null}

          <label style={fieldLabel}>
            {t('voiceLabel', { language })}
            <select
              value={chosenIsListed || !chosenVoiceURI ? chosenVoiceURI : ''}
              onChange={(e) => setVoice(e.target.value)}
              style={fieldStyle}
            >
              <option value="">
                {automaticVoice
                  ? t('automaticWith', { name: automaticVoice.name })
                  : t('automatic')}
              </option>
              {groups.exact.length > 0 ? (
                <optgroup label={t('groupExact', { language })}>
                  {groups.exact.map((ranked) => (
                    <option key={ranked.voice.voiceURI} value={ranked.voice.voiceURI}>
                      {optionLabel(ranked)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {groups.sameLanguage.length > 0 ? (
                <optgroup label={t('groupSameLanguage')}>
                  {groups.sameLanguage.map((ranked) => (
                    <option key={ranked.voice.voiceURI} value={ranked.voice.voiceURI}>
                      {optionLabel(ranked)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {(showAll || chosenInOtherGroup) && groups.other.length > 0 ? (
                <optgroup label={t('groupOther')}>
                  {groups.other.map((ranked) => (
                    <option key={ranked.voice.voiceURI} value={ranked.voice.voiceURI}>
                      {optionLabel(ranked)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
          <p style={hintStyle}>{t('qualityHint')}</p>

          <label style={checkboxLabel}>
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            {t('showAll', { count: groups.other.length })}
          </label>

          <button type="button" onClick={playPreview} style={buttonStyle}>
            {t('preview')}
          </button>
        </>
      )}

      {noLocaleVoice ? (
        <div data-voxa-voice-install-help="" style={helpBox}>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>{t('installTitle', { language })}</p>
          <ul style={{ margin: '0 0 8px', paddingLeft: 18, lineHeight: 1.5 }}>
            <li>{t('installAndroid', { language })}</li>
            <li>{t('installApple', { language })}</li>
            <li>{t('installWindows', { language })}</li>
          </ul>
          <p style={{ margin: 0 }}>{t('installMeanwhile')}</p>
        </div>
      ) : null}

      <label style={fieldLabel}>
        {t('rate', { value: formatNumber(settings.speechRate, uiLocale) })}
        <input
          type="range"
          min={SPEECH_RATE_MIN}
          max={SPEECH_RATE_MAX}
          step={SPEECH_TUNING_STEP}
          value={settings.speechRate}
          aria-valuetext={formatNumber(settings.speechRate, uiLocale)}
          onChange={(e) => onChange({ speechRate: Number(e.target.value) })}
          style={{ width: '100%' }}
        />
      </label>
      <label style={fieldLabel}>
        {t('pitch', { value: formatNumber(settings.speechPitch, uiLocale) })}
        <input
          type="range"
          min={SPEECH_PITCH_MIN}
          max={SPEECH_PITCH_MAX}
          step={SPEECH_TUNING_STEP}
          value={settings.speechPitch}
          aria-valuetext={formatNumber(settings.speechPitch, uiLocale)}
          onChange={(e) => onChange({ speechPitch: Number(e.target.value) })}
          style={{ width: '100%' }}
        />
      </label>
      <label style={fieldLabel}>
        {t('volume', { percent: Math.round(settings.speechVolume * 100) })}
        <input
          type="range"
          min={SPEECH_VOLUME_MIN}
          max={SPEECH_VOLUME_MAX}
          step={SPEECH_TUNING_STEP}
          value={settings.speechVolume}
          aria-valuetext={t('volumeValue', { percent: Math.round(settings.speechVolume * 100) })}
          onChange={(e) => onChange({ speechVolume: Number(e.target.value) })}
          style={{ width: '100%' }}
        />
      </label>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          aria-pressed={higherPresetOn}
          onClick={() =>
            onChange({ speechPitch: HIGHER_VOICE_PRESET.pitch, speechRate: HIGHER_VOICE_PRESET.rate })
          }
          style={buttonStyle}
        >
          {t('higherPreset')}
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({
              speechRate: DEFAULT_SPEECH_TUNING.rate,
              speechPitch: DEFAULT_SPEECH_TUNING.pitch,
              speechVolume: DEFAULT_SPEECH_TUNING.volume,
            })
          }
          style={buttonStyle}
        >
          {t('resetTuning')}
        </button>
      </div>
      <p style={hintStyle}>{t('higherPresetHint')}</p>
    </section>
  );
}

const fieldLabel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginBottom: 14,
  fontSize: '0.875rem',
};

const checkboxLabel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
  fontSize: '0.875rem',
};

const fieldStyle: React.CSSProperties = {
  background: surface.base,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  color: neutral.textSubtle,
  padding: '8px 10px',
};

const buttonStyle: React.CSSProperties = {
  background: surface.overlay,
  color: surface.white,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  padding: '8px 12px',
  minWidth: 38,
  minHeight: 38,
  cursor: 'pointer',
  marginBottom: 14,
};

const hintStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: neutral.muted,
  marginTop: -8,
  marginBottom: 12,
};

const helpBox: React.CSSProperties = {
  background: surface.raised,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  padding: 10,
  marginBottom: 14,
  fontSize: '0.8125rem',
  color: neutral.textSecondary,
};
