'use client';

import {
  EYE_DWELL_MAX_MS,
  EYE_DWELL_MIN_MS,
  GROUP_CYCLES_MAX,
  GROUP_CYCLES_MIN,
  SWITCH_INTERVAL_MIN_MS,
  SWITCH_INTERVAL_MAX_MS,
  type ScanOrder,
  type SwitchGroupStrategy,
  type SwitchScanMode,
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
import {
  SCAN_ACCEPTANCE_MAX_MS,
  SCAN_FIRST_ITEM_HOLD_MAX_MS,
  SCAN_POST_SELECTION_PAUSE_MAX_MS,
  type CommunicatorSettings,
} from '@/lib/communicator-settings';
import {
  clearEditorPin,
  editorPinIsConfigured,
  setEditorPin,
} from '@/lib/editor-pin';
import { LanguageSwitcher } from '@/components/language-switcher';
import { PrivacySettingsSection } from '@/components/consent-choices';
import { useAppDialog } from '@/components/app-dialog';
import { neutral, surface } from '@/lib/tokens';

interface SettingsPanelProps {
  settings: CommunicatorSettings;
  onChange: (patch: Partial<CommunicatorSettings>) => void;
  onClose: () => void;
  showEditorPinSettings?: boolean;
  boardDisplay?: BoardDisplayPreferences;
  onBoardDisplayChange?: (patch: Partial<BoardDisplayPreferences>) => void;
  /** Signed-in user's token: privacy choices are saved to their server record. */
  accessToken?: string;
}

export function SettingsPanel({
  settings,
  onChange,
  onClose,
  showEditorPinSettings = false,
  boardDisplay,
  onBoardDisplayChange,
  accessToken,
}: SettingsPanelProps): React.ReactNode {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const tCvi = useTranslations('cviThemes');
  const tl = useTranslations('language');
  const dialogs = useAppDialog();

  return (
    <aside
      role="dialog"
      aria-label={t('title')}
      style={{
        width: 320,
        background: surface.section,
        color: neutral.textSubtle,
        borderLeft: `1px solid ${neutral.borderSubtle}`,
        padding: 16,
        overflowY: 'auto',
      }}
    >
      {dialogs.dialog}
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
          <Field label={t('scanMode')}>
            <select
              value={settings.switchScanMode}
              onChange={(e) => onChange({ switchScanMode: e.target.value as SwitchScanMode })}
              style={fieldStyle}
            >
              <option value="auto">{t('scanModeAuto')}</option>
              <option value="step">{t('scanModeStep')}</option>
            </select>
          </Field>
          <p style={hintStyle}>
            {settings.switchScanMode === 'step' ? t('scanModeHintStep') : t('scanModeHintAuto')}
          </p>
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
          {settings.switchGroupStrategy !== 'none' ? (
            <Field label={t('groupCycles', { n: settings.switchGroupCycles })}>
              <input
                type="range"
                min={GROUP_CYCLES_MIN}
                max={GROUP_CYCLES_MAX}
                step={1}
                value={settings.switchGroupCycles}
                onChange={(e) => onChange({ switchGroupCycles: Number(e.target.value) })}
                style={{ width: '100%' }}
              />
            </Field>
          ) : null}
          <Field label={t('firstItemHold', { ms: settings.switchFirstItemHoldMs })}>
            <input
              type="range"
              min={0}
              max={SCAN_FIRST_ITEM_HOLD_MAX_MS}
              step={100}
              value={settings.switchFirstItemHoldMs}
              onChange={(e) => onChange({ switchFirstItemHoldMs: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </Field>
          <Field label={t('acceptanceTime', { ms: settings.switchAcceptanceMs })}>
            <input
              type="range"
              min={0}
              max={SCAN_ACCEPTANCE_MAX_MS}
              step={50}
              value={settings.switchAcceptanceMs}
              onChange={(e) => onChange({ switchAcceptanceMs: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </Field>
          <p style={hintStyle}>{t('acceptanceHint')}</p>
          <Field label={t('postSelectionPause', { ms: settings.switchPostSelectionPauseMs })}>
            <input
              type="range"
              min={0}
              max={SCAN_POST_SELECTION_PAUSE_MAX_MS}
              step={100}
              value={settings.switchPostSelectionPauseMs}
              onChange={(e) => onChange({ switchPostSelectionPauseMs: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </Field>
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
              <option value="event-bridge">{t('gazeBridge')}</option>
            </select>
          </Field>
          <p style={hintStyle}>
            {settings.gazeSource === 'event-bridge' ? t('gazeHintBridge') : t('gazeHintPointer')}
          </p>
        </>
      )}

      <Field label={t('spanishAgreement')}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={settings.spanishAgreement}
            onChange={(e) => onChange({ spanishAgreement: e.target.checked })}
          />
          {t('spanishAgreementHint')}
        </label>
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
        <section style={{ borderTop: `1px solid ${neutral.borderSubtle}`, paddingTop: 12, marginTop: 8 }}>
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

      <PrivacySettingsSection accessToken={accessToken} />

      {showEditorPinSettings ? (
        <section style={{ borderTop: `1px solid ${neutral.borderSubtle}`, paddingTop: 12, marginTop: 8 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.9375rem' }}>{t('editorPin')}</h3>
          <p style={hintStyle}>
            {editorPinIsConfigured() ? t('editorPinConfigured') : t('editorPinUnset')}
          </p>
          <button
            type="button"
            style={closeBtn}
            onClick={async () => {
              const pin = await dialogs.prompt(t('pinPrompt'), { secret: true });
              if (!pin) return;
              if (!/^\d{4,8}$/.test(pin)) {
                await dialogs.alert(t('pinInvalid'));
                return;
              }
              try {
                setEditorPin(pin);
                await dialogs.alert(t('pinSaved'));
              } catch {
                await dialogs.alert(t('pinStorageUnavailable'));
              }
            }}
          >
            {editorPinIsConfigured() ? t('changePin') : t('setPin')}
          </button>
          {editorPinIsConfigured() ? (
            <button
              type="button"
              style={{ ...closeBtn, marginTop: 8, width: '100%' }}
              onClick={async () => {
                if (await dialogs.confirm(t('pinRemoveConfirm'))) {
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
  background: surface.base,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  color: neutral.textSubtle,
  padding: '8px 10px',
};

const closeBtn: React.CSSProperties = {
  background: surface.overlay,
  color: surface.white,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  padding: '8px 12px',
  minWidth: 38,
  minHeight: 38,
  cursor: 'pointer',
};

const hintStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: neutral.muted,
  marginTop: -8,
  marginBottom: 12,
};
