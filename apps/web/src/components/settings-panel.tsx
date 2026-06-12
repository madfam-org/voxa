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
import { CVI_THEMES, CVI_THEME_LABELS, type CviTheme } from '@voxa/ui';
import type { BoardDisplayPreferences } from '@voxa/core';
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
              {CVI_THEME_LABELS[theme]}
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
          <Field label="Group scan">
            <select
              value={settings.switchGroupStrategy}
              onChange={(e) =>
                onChange({ switchGroupStrategy: e.target.value as SwitchGroupStrategy })
              }
              style={fieldStyle}
            >
              <option value="none">Single-level (whole grid)</option>
              <option value="rows">Row groups</option>
              <option value="regions">Region groups (quadrants)</option>
            </select>
          </Field>
          <p style={hintStyle}>
            {settings.switchGroupStrategy === 'none'
              ? 'Hardware: Space/Enter selects; Tab/Arrow Right advances. Bluetooth switches and USB adapters that emulate a keyboard work automatically. Gamepad button 0 selects; button 1 advances.'
              : 'Select a group, then a cell. Hardware keys and gamepad buttons work the same as single-level scan.'}
          </p>
          <Field label="Auditory scan highlight">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={settings.auditoryScanHighlight}
                onChange={(e) => onChange({ auditoryScanHighlight: e.target.checked })}
              />
              Announce focused button (screen reader)
            </label>
          </Field>
          <Field label="Auditory scan beep">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={settings.auditoryScanBeep}
                onChange={(e) => onChange({ auditoryScanBeep: e.target.checked })}
              />
              Play a short tone on each scan step
            </label>
          </Field>
          <Field label="Auditory scan voice">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={settings.auditoryScanVoice}
                onChange={(e) => onChange({ auditoryScanVoice: e.target.checked })}
              />
              Speak scanned label aloud
            </label>
          </Field>
          <Field label="Pause scan while speaking">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={settings.pauseScanWhileSpeaking}
                onChange={(e) => onChange({ pauseScanWhileSpeaking: e.target.checked })}
              />
              Hold scan step during TTS or recordings
            </label>
          </Field>
        </>
      )}

      {settings.accessMode === 'touch' && (
        <>
          <Field label="Touch activation">
            <select
              value={settings.touchActivation}
              onChange={(e) =>
                onChange({ touchActivation: e.target.value as CommunicatorSettings['touchActivation'] })
              }
              style={fieldStyle}
            >
              <option value="press">Press (touch-start)</option>
              <option value="release">Release (touch-up)</option>
            </select>
          </Field>
          <Field label="Touch guard (keyguard)">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={settings.touchGuardEnabled}
                onChange={(e) => onChange({ touchGuardEnabled: e.target.checked })}
              />
              Mask regions between targets
            </label>
          </Field>
          {settings.touchGuardEnabled ? (
            <Field label="Touch guard mask">
              <select
                value={settings.touchGuardMask}
                onChange={(e) =>
                  onChange({ touchGuardMask: e.target.value as TouchGuardMask })
                }
                style={fieldStyle}
              >
                <option value="both">Gutters + perimeter</option>
                <option value="gutter">Between cells only</option>
                <option value="perimeter">Board edge only</option>
              </select>
              <p style={hintStyle}>
                Semi-transparent overlays block accidental touches outside button holes.
              </p>
            </Field>
          ) : null}
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
          <Field label="Gaze source">
            <select
              value={settings.gazeSource}
              onChange={(e) =>
                onChange({
                  gazeSource: e.target.value as CommunicatorSettings['gazeSource'],
                })
              }
              style={fieldStyle}
            >
              <option value="pointer">Pointer hover (simulation)</option>
              <option value="tobii-bridge">Tobii bridge (voxa:gaze events)</option>
            </select>
          </Field>
          <p style={hintStyle}>
            {settings.gazeSource === 'tobii-bridge'
              ? 'Lab inject: window.__voxaInjectGaze(x, y) or dispatch voxa:gaze CustomEvent.'
              : 'Hold pointer over a button to activate (simulates eye dwell).'}
          </p>
        </>
      )}

      <Field label="Symbol diversity (default skin tone)">
        <select
          value={settings.defaultSymbolSkinTone}
          onChange={(e) =>
            onChange({
              defaultSymbolSkinTone: e.target.value as CommunicatorSettings['defaultSymbolSkinTone'],
            })
          }
          style={fieldStyle}
        >
          <option value="white">Light</option>
          <option value="asian">East Asian</option>
          <option value="mulatto">Medium</option>
          <option value="aztec">Tan</option>
          <option value="black">Deep</option>
        </select>
        <p style={hintStyle}>
          Default for new person symbols in the editor. Per-button overrides remain available.
        </p>
      </Field>

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

      {onBoardDisplayChange ? (
        <section style={{ borderTop: '1px solid #333', paddingTop: 12, marginTop: 8 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.9375rem' }}>Board display</h3>
          <p style={hintStyle}>
            Saved with this vocabulary board. Overrides the device settings above when checked.
          </p>
          <Field label="Hide symbols on this board">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={boardDisplay?.hideSymbols ?? false}
                onChange={(e) =>
                  onBoardDisplayChange({ hideSymbols: e.target.checked ? true : undefined })
                }
              />
              Text-only mode for this board
            </label>
          </Field>
          <Field label="Hide labels on this board">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={boardDisplay?.hideLabels ?? false}
                onChange={(e) =>
                  onBoardDisplayChange({ hideLabels: e.target.checked ? true : undefined })
                }
              />
              Symbol-only mode for this board
            </label>
          </Field>
        </section>
      ) : null}

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
