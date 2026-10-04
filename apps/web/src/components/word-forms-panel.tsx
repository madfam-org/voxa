'use client';

import { useTranslations } from 'next-intl';
import type { BoardButton, PartOfSpeechTag } from '@voxa/core';
import { mergeSpeechForms, suggestInflections } from '@voxa/vocabulary';
import { brand, neutral, surface } from '@/lib/tokens';
import { useAppDialog } from '@/components/app-dialog';

interface WordFormsPanelProps {
  button: BoardButton;
  disabled?: boolean;
  onChange: (patch: Partial<BoardButton>) => void;
}

export function WordFormsPanel({ button, disabled, onChange }: WordFormsPanelProps): React.ReactNode {
  const t = useTranslations('wordForms');
  const dialogs = useAppDialog();
  if (button.kind !== 'analytic') return null;

  const forms = button.speechForms ?? [];
  const pos = button.partOfSpeech ?? 'noun';

  const applySuggestions = () => {
    const suggested = suggestInflections(button.label || button.speechText, pos as PartOfSpeechTag);
    if (suggested.length === 0) {
      void dialogs.alert(t('noSuggestions'));
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

  const addCustom = async () => {
    const label = await dialogs.prompt(t('formLabelPrompt'));
    if (!label?.trim()) return;
    const speechText = (await dialogs.prompt(t('spokenTextPrompt'), { defaultValue: label.trim() })) ?? label.trim();
    const id = `custom-${Date.now()}`;
    onChange({
      speechForms: [...forms, { id, label: label.trim(), speechText: speechText.trim() }],
    });
  };

  return (
    <section style={{ marginBottom: 16 }}>
      {dialogs.dialog}
      <h3 style={{ margin: '0 0 8px', fontSize: '0.875rem' }}>{t('title')}</h3>
      <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: neutral.muted, lineHeight: 1.4 }}>
        {t('hint')}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <button type="button" disabled={disabled} onClick={applySuggestions} style={btnStyle}>
          {t('suggest')}
        </button>
        <button type="button" disabled={disabled} onClick={() => void addCustom()} style={btnStyle}>
          {t('addCustom')}
        </button>
      </div>

      {forms.length === 0 ? (
        <p style={{ fontSize: '0.8125rem', color: neutral.muted, margin: 0 }}>{t('empty')}</p>
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
                border: form.id === button.activeSpeechFormId ? `1px solid ${brand.primary}` : `1px solid ${neutral.border}`,
                background: surface.base,
              }}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => setActive(form.id)}
                style={{ ...btnStyle, flex: 1, textAlign: 'left' }}
              >
                {form.id === button.activeSpeechFormId
                  ? t('formActive', { label: form.label, speech: form.speechText })
                  : t('form', { label: form.label, speech: form.speechText })}
              </button>
              <button type="button" disabled={disabled} onClick={() => removeForm(form.id)} style={btnStyle}>
                {t('remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const btnStyle: React.CSSProperties = {
  background: surface.overlay,
  color: surface.white,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  padding: '6px 10px',
  minHeight: 34,
  fontSize: '0.8125rem',
  cursor: 'pointer',
};
