'use client';

import {
  EYE_DWELL_MAX_MS,
  EYE_DWELL_MIN_MS,
  SWITCH_INTERVAL_MIN_MS,
  SWITCH_INTERVAL_MAX_MS,
  type ScanOrder,
  type SwitchGroupStrategy,
  type TouchGuardMask,
} from '@voxa/access';
import { CVI_THEMES, type CviTheme } from '@voxa/ui';
import type { BoardDisplayPreferences } from '@voxa/core';
import {
  CONTENT_LOCALE_BY_UI,
  UI_LOCALES,
  type ContentLocale,
  type UiLocale,
} from '@voxa/i18n';
import { useTranslations } from 'next-intl';
import type { CommunicatorSettings } from '@/lib/communicator-settings';
import {
  clearEditorPin,
  editorPinIsConfigured,
  setEditorPin,
} from '@/lib/editor-pin';
import { LanguageSwitcher } from '@/components/language-switcher';

interface SettingsPanelProps {
  settings: CommunicatorSettings;
  onChange: (patch: Partial<CommunicatorSettings>) => void;
  onClose: () => void;
  showEditorPinSettings?: boolean;
  boardDisplay?: BoardDisplayPreferences;
  onBoardDisplayChange?: (patch: Partial<BoardDisplayPreferences>) => void;
}

export function SettingsPanel({
  settings,
  onChange,
  onClose,
  showEditorPinSettings = false,
  boardDisplay,
  onBoardDisplayChange,
}: SettingsPanelProps): React.ReactNode {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const tCvi = useTranslations('cviThemes');
  const tl = useTranslations('language');

  return (
    <aside
      role="dialog"
      aria-label={t('title')}
      style={{
        width: 320,
        background: '#111',
        color: '#f5f5f5',
        borderLeft: '1px solid #333',
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>{t('title')}</h2>
        <button type="button" onClick={onClose} style={closeBtn}>
          {tc('close')}
        </button>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <LanguageSwitcher />
        <Field label={tl('label')}>
          <select
            value={settings.uiLocale}
            onChange={(e) => {
              const uiLocale = e.target.value as UiLocale;
              onChange({ uiLocale, contentLocale: CONTENT_LOCALE_BY_UI[uiLocale] });
            }}
            style={fieldStyle}
          >
            {UI_LOCALES.map((code) => (
              <option key={code} value={code}>
                {tl(code)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tl('contentLabel')}>
          <select
            value={settings.contentLocale}
            onChange={(e) => onChange({ contentLocale: e.target.value as ContentLocale })}
            style={fieldStyle}
          >
            {UI_LOCALES.map((code) => (
              <option key={code} value={CONTENT_LOCALE_BY_UI[code]}>
                {tl(code)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={t('visualTheme')}>
        <select
          value={settings.cviTheme}
          onChange={(e) => onChange({ cviTheme: e.target.value as CviTheme })}
          style={fieldStyle}
        >
          {(Object.keys(CVI_THEMES) as CviTheme[]).map((theme) => (
            <option key={theme} value={theme}>
              {tCvi(theme)}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('touchScale', { scale: settings.targetScale.toFixed(1) })}>
        <input
          type="range"
          min={1}
          max={2}
          step={0.1}
          value={settings.targetScale}
          onChange={(e) => onChange({ targetScale: Number(e.target.value) })}
          style={{ width: '100%' }}
        />
      </Field>

      <Field label={t('accessMethod')}>
        <select
          value={settings.accessMode}
          onChange={(e) =>
            onChange({ accessMode: e.target.value as CommunicatorSettings['accessMode'] })
          }
          style={fieldStyle}
        >
          <option value="touch">{t('accessTouch')}</option>
          <option value="switch">{t('accessSwitch')}</option>
          <option value="eye-tracking">{t('accessEye')}</option>
        </select>
      </Field>

      {settings.accessMode === 'switch' && (
        <>
          <Field label={t('scanSpeed', { ms: settings.switchIntervalMs })}>
            <input
              type="range"
              min={SWITCH_INTERVAL_MIN_MS}
              max={SWITCH_INTERVAL_MAX_MS}
              step={100}
              value={settings.switchIntervalMs}
              onChange={(e) => onChange({ switchIntervalMs: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </Field>
          <Field label={t('scanOrder')}>
            <select
              value={settings.switchOrder}
              onChange={(e) => onChange({ switchOrder: e.target.value as ScanOrder })}
              style={fieldStyle}
            >
              <option value="row-major">{t('scanRow')}</option>
              <option value="column-major">{t('scanColumn')}</option>
              <option value="linear">{t('scanLinear')}</option>
            </select>
          </Field>
          <Field label={t('groupScan')}>
            <select
              value={settings.switchGroupStrategy}
              onChange={(e) =>
                onChange({ switchGroupStrategy: e.target.value as SwitchGroupStrategy })
              }
              style={fieldStyle}
            >
              <option value="none">{t('groupNone')}</option>
              <option value="rows">{t('groupRows')}</option>
              <option value="regions">{t('groupRegions')}</option>
            </select>
          </Field>
          <p style={hintStyle}>
            {settings.switchGroupStrategy === 'none' ? t('scanHintNone') : t('scanHintGroup')}
          </p>
          <Field label={t('auditoryHighlight')}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={settings.auditoryScanHighlight}
                onChange={(e) => onChange({ auditoryScanHighlight: e.target.checked })}
              />
              {t('auditoryHighlightHint')}
            </label>
          </Field>
          <Field label={t('auditoryBeep')}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={settings.auditoryScanBeep}
                onChange={(e) => onChange({ auditoryScanBeep: e.target.checked })}
              />
              {t('auditoryBeepHint')}
            </label>
          </Field>
          <Field label={t('auditoryVoice')}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={settings.auditoryScanVoice}
                onChange={(e) => onChange({ auditoryScanVoice: e.target.checked })}
              />
              {t('auditoryVoiceHint')}
            </label>
          </Field>
          <Field label={t('pauseWhileSpeaking')}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={settings.pauseScanWhileSpeaking}
                onChange={(e) => onChange({ pauseScanWhileSpeaking: e.target.checked })}
              />
              {t('pauseWhileSpeakingHint')}
            </label>
          </Field>
        </>
      )}

      {settings.accessMode === 'touch' && (
        <>
          <Field label={t('touchActivation')}>
            <select
              value={settings.touchActivation}
              onChange={(e) =>
                onChange({ touchActivation: e.target.value as CommunicatorSettings['touchActivation'] })
              }
              style={fieldStyle}
            >
              <option value="press">{t('touchPress')}</option>
              <option value="release">{t('touchRelease')}</option>
            </select>
          </Field>
          <Field label={t('touchGuard')}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={settings.touchGuardEnabled}
                onChange={(e) => onChange({ touchGuardEnabled: e.target.checked })}
              />
              {t('touchGuardHint')}
            </label>
          </Field>
          {settings.touchGuardEnabled ? (
            <Field label={t('touchGuardMask')}>
              <select
                value={settings.touchGuardMask}
                onChange={(e) =>
                  onChange({ touchGuardMask: e.target.value as TouchGuardMask })
                }
                style={fieldStyle}
              >
                <option value="both">{t('maskBoth')}</option>
                <option value="gutter">{t('maskGutter')}</option>
                <option value="perimeter">{t('maskPerimeter')}</option>
              </select>
              <p style={hintStyle}>{t('touchGuardHelp')}</p>
            </Field>
          ) : null}
        </>
      )}

      {settings.accessMode === 'eye-tracking' && (
        <>
          <Field label={t('dwellTime', { ms: settings.eyeDwellMs })}>
            <input
              type="range"
              min={EYE_DWELL_MIN_MS}
              max={EYE_DWELL_MAX_MS}
              step={100}
              value={settings.eyeDwellMs}
              onChange={(e) => onChange({ eyeDwellMs: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </Field>
          <Field label={t('gazeSource')}>
            <select
              value={settings.gazeSource}
              onChange={(e) =>
                onChange({
                  gazeSource: e.target.value as CommunicatorSettings['gazeSource'],
                })
              }
              style={fieldStyle}
            >
              <option value="pointer">{t('gazePointer')}</option>
              <option value="tobii-bridge">{t('gazeTobii')}</option>
            </select>
          </Field>
          <p style={hintStyle}>
            {settings.gazeSource === 'tobii-bridge' ? t('gazeHintTobii') : t('gazeHintPointer')}
          </p>
        </>
      )}

      <Field label={t('symbolDiversity')}>
        <select
          value={settings.defaultSymbolSkinTone}
          onChange={(e) =>
            onChange({
              defaultSymbolSkinTone: e.target.value as CommunicatorSettings['defaultSymbolSkinTone'],
            })
          }
          style={fieldStyle}
        >
          <option value="white">{t('skinWhite')}</option>
          <option value="asian">{t('skinAsian')}</option>
          <option value="mulatto">{t('skinMulatto')}</option>
          <option value="aztec">{t('skinAztec')}</option>
          <option value="black">{t('skinBlack')}</option>
        </select>
        <p style={hintStyle}>{t('symbolDiversityHint')}</p>
      </Field>

      <Field label={t('whisperMode')}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={settings.whisperMode}
            onChange={(e) => onChange({ whisperMode: e.target.checked })}
          />
          {t('whisperHint')}
        </label>
      </Field>

      <Field label={t('hideSymbols')}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={settings.hideSymbols}
            onChange={(e) => onChange({ hideSymbols: e.target.checked })}
          />
          {t('hideSymbolsHint')}
        </label>
      </Field>

      <Field label={t('hideLabels')}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={settings.hideLabels}
            onChange={(e) => onChange({ hideLabels: e.target.checked })}
          />
          {t('hideLabelsHint')}
        </label>
      </Field>

      {onBoardDisplayChange ? (
        <section style={{ borderTop: '1px solid #333', paddingTop: 12, marginTop: 8 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.9375rem' }}>{t('boardDisplay')}</h3>
          <p style={hintStyle}>{t('boardDisplayHint')}</p>
          <Field label={t('boardHideSymbols')}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={boardDisplay?.hideSymbols ?? false}
                onChange={(e) =>
                  onBoardDisplayChange({ hideSymbols: e.target.checked ? true : undefined })
                }
              />
              {t('boardHideSymbolsHint')}
            </label>
          </Field>
          <Field label={t('boardHideLabels')}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={boardDisplay?.hideLabels ?? false}
                onChange={(e) =>
                  onBoardDisplayChange({ hideLabels: e.target.checked ? true : undefined })
                }
              />
              {t('boardHideLabelsHint')}
            </label>
          </Field>
        </section>
      ) : null}

      {showEditorPinSettings ? (
        <section style={{ borderTop: '1px solid #333', paddingTop: 12, marginTop: 8 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.9375rem' }}>{t('editorPin')}</h3>
          <p style={hintStyle}>
            {editorPinIsConfigured() ? t('editorPinConfigured') : t('editorPinUnset')}
          </p>
          <button
            type="button"
            style={closeBtn}
            onClick={() => {
              const pin = window.prompt(t('pinPrompt'));
              if (!pin) return;
              try {
                setEditorPin(pin);
                window.alert(t('pinSaved'));
              } catch (err) {
                window.alert((err as Error).message);
              }
            }}
          >
            {editorPinIsConfigured() ? t('changePin') : t('setPin')}
          </button>
          {editorPinIsConfigured() ? (
            <button
              type="button"
              style={{ ...closeBtn, marginTop: 8, width: '100%' }}
              onClick={() => {
                if (window.confirm(t('pinRemoveConfirm'))) {
                  clearEditorPin();
                }
              }}
            >
              {t('removePin')}
            </button>
          ) : null}
        </section>
      ) : null}
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, fontSize: '0.875rem' }}>
      {label}
      {children}
    </label>
  );
}

const fieldStyle: React.CSSProperties = {
  background: '#0a0a0a',
  border: '1px solid #404040',
  borderRadius: 6,
  color: '#f5f5f5',
  padding: '8px 10px',
};

const closeBtn: React.CSSProperties = {
  background: '#262626',
  color: '#fff',
  border: '1px solid #404040',
  borderRadius: 6,
  padding: '8px 12px',
  minWidth: 38,
  minHeight: 38,
  cursor: 'pointer',
};

const hintStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#a3a3a3',
  marginTop: -8,
  marginBottom: 12,
};
