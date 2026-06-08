'use client';

import type { BoardButton, PartOfSpeechTag } from '@voxa/core';
import { mergeSpeechForms, suggestInflections } from '@voxa/vocabulary';

interface WordFormsPanelProps {
  button: BoardButton;
  disabled?: boolean;
  onChange: (patch: Partial<BoardButton>) => void;
}

export function WordFormsPanel({ button, disabled, onChange }: WordFormsPanelProps): React.ReactNode {
  if (button.kind !== 'analytic') return null;

  const forms = button.speechForms ?? [];
  const pos = button.partOfSpeech ?? 'noun';

  const applySuggestions = () => {
    const suggested = suggestInflections(button.label || button.speechText, pos as PartOfSpeechTag);
    if (suggested.length === 0) {
      window.alert('No suggested forms for this word yet. Add custom forms below.');
      return;
    }
    onChange({ speechForms: mergeSpeechForms(forms, suggested) });
  };

  const setActive = (formId: string) => {
    const form = forms.find((item) => item.id === formId);
    if (!form) return;
    onChange({ activeSpeechFormId: formId, speechText: form.speechText });
  };

  const removeForm = (formId: string) => {
    const next = forms.filter((item) => item.id !== formId);
    onChange({
      speechForms: next.length ? next : undefined,
      activeSpeechFormId: button.activeSpeechFormId === formId ? undefined : button.activeSpeechFormId,
    });
  };

  const addCustom = () => {
    const label = window.prompt('Form label (shown in editor)', '');
    if (!label?.trim()) return;
    const speechText = window.prompt('Spoken text', label.trim()) ?? label.trim();
    const id = `custom-${Date.now()}`;
    onChange({
      speechForms: [...forms, { id, label: label.trim(), speechText: speechText.trim() }],
    });
  };

  return (
    <section style={{ marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: '0.875rem' }}>Word forms</h3>
      <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#a3a3a3', lineHeight: 1.4 }}>
        Alternate tenses or plurals. Communicators double-tap quickly to cycle forms.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <button type="button" disabled={disabled} onClick={applySuggestions} style={btnStyle}>
          Suggest forms
        </button>
        <button type="button" disabled={disabled} onClick={addCustom} style={btnStyle}>
          Add custom
        </button>
      </div>

      {forms.length === 0 ? (
        <p style={{ fontSize: '0.8125rem', color: '#737373', margin: 0 }}>No alternate forms yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {forms.map((form) => (
            <li
              key={form.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 6,
                border: form.id === button.activeSpeechFormId ? '1px solid #2563eb' : '1px solid #404040',
                background: '#0a0a0a',
              }}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => setActive(form.id)}
                style={{ ...btnStyle, flex: 1, textAlign: 'left' }}
              >
                {form.label} → {form.speechText}
                {form.id === button.activeSpeechFormId ? ' (active)' : ''}
              </button>
              <button type="button" disabled={disabled} onClick={() => removeForm(form.id)} style={btnStyle}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#262626',
  color: '#fff',
  border: '1px solid #404040',
  borderRadius: 6,
  padding: '6px 10px',
  minHeight: 34,
  fontSize: '0.8125rem',
  cursor: 'pointer',
};
