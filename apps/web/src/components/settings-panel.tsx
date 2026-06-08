'use client';

import {
  EYE_DWELL_MAX_MS,
  EYE_DWELL_MIN_MS,
  SWITCH_INTERVAL_MAX_MS,
  SWITCH_INTERVAL_MIN_MS,
  type ScanOrder,
} from '@voxa/access';
import { CVI_THEMES, type CviTheme } from '@voxa/ui';
import type { CommunicatorSettings } from '@/lib/communicator-settings';
import {
  clearEditorPin,
  editorPinIsConfigured,
  setEditorPin,
} from '@/lib/editor-pin';

interface SettingsPanelProps {
  settings: CommunicatorSettings;
  onChange: (patch: Partial<CommunicatorSettings>) => void;
  onClose: () => void;
  showEditorPinSettings?: boolean;
}

export function SettingsPanel({
  settings,
  onChange,
  onClose,
  showEditorPinSettings = false,
}: SettingsPanelProps): React.ReactNode {
  return (
    <aside
      role="dialog"
      aria-label="Accessibility settings"
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
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Accessibility</h2>
        <button type="button" onClick={onClose} style={closeBtn}>
          Close
        </button>
      </div>

      <Field label="Visual theme (CVI)">
        <select
          value={settings.cviTheme}
          onChange={(e) => onChange({ cviTheme: e.target.value as CviTheme })}
          style={fieldStyle}
        >
          {(Object.keys(CVI_THEMES) as CviTheme[]).map((theme) => (
            <option key={theme} value={theme}>
              {theme}
            </option>
          ))}
        </select>
      </Field>

      <Field label={`Touch target scale (${settings.targetScale.toFixed(1)}×)`}>
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

      <Field label="Access method">
        <select
          value={settings.accessMode}
          onChange={(e) =>
            onChange({ accessMode: e.target.value as CommunicatorSettings['accessMode'] })
          }
          style={fieldStyle}
        >
          <option value="touch">Touch</option>
          <option value="switch">Switch scanning</option>
          <option value="eye-tracking">Eye tracking (dwell)</option>
        </select>
      </Field>

      {settings.accessMode === 'switch' && (
        <>
          <Field label={`Scan speed (${settings.switchIntervalMs} ms)`}>
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
          <Field label="Scan order">
            <select
              value={settings.switchOrder}
              onChange={(e) => onChange({ switchOrder: e.target.value as ScanOrder })}
              style={fieldStyle}
            >
              <option value="row-major">Row by row</option>
              <option value="column-major">Column by column</option>
              <option value="linear">Linear</option>
            </select>
          </Field>
          <Field label="Auditory scan highlight">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={settings.auditoryScanHighlight}
                onChange={(e) => onChange({ auditoryScanHighlight: e.target.checked })}
              />
              Announce focused button
            </label>
          </Field>
          <p style={hintStyle}>Press Space or Enter to select. Arrow Right advances manually.</p>
        </>
      )}

      {settings.accessMode === 'eye-tracking' && (
        <>
          <Field label={`Dwell time (${settings.eyeDwellMs} ms)`}>
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
          <p style={hintStyle}>Hold pointer over a button to activate (simulates eye dwell).</p>
        </>
      )}

      <Field label="Whisper mode (build without speaking)">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={settings.whisperMode}
            onChange={(e) => onChange({ whisperMode: e.target.checked })}
          />
          Add words to the message bar without TTS
        </label>
      </Field>

      <Field label="Hide symbols (text-only CVI mode)">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={settings.hideSymbols}
            onChange={(e) => onChange({ hideSymbols: e.target.checked })}
          />
          Reduce visual complexity
        </label>
      </Field>

      <Field label="Symbol-only mode (hide labels)">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={settings.hideLabels}
            onChange={(e) => onChange({ hideLabels: e.target.checked })}
          />
          Show symbols without text labels
        </label>
      </Field>

      {showEditorPinSettings ? (
        <section style={{ borderTop: '1px solid #333', paddingTop: 12, marginTop: 8 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.9375rem' }}>Editor PIN</h3>
          <p style={hintStyle}>
            {editorPinIsConfigured()
              ? 'A PIN is required to enter Editor or Admin role on this device.'
              : 'Set a PIN so only clinicians can edit vocabulary.'}
          </p>
          <button
            type="button"
            style={closeBtn}
            onClick={() => {
              const pin = window.prompt('New editor PIN (4–8 digits)');
              if (!pin) return;
              try {
                setEditorPin(pin);
                window.alert('Editor PIN saved.');
              } catch (err) {
                window.alert((err as Error).message);
              }
            }}
          >
            {editorPinIsConfigured() ? 'Change PIN' : 'Set PIN'}
          </button>
          {editorPinIsConfigured() ? (
            <button
              type="button"
              style={{ ...closeBtn, marginTop: 8, width: '100%' }}
              onClick={() => {
                if (window.confirm('Remove editor PIN? Editor mode will open without a prompt.')) {
                  clearEditorPin();
                }
              }}
            >
              Remove PIN
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
