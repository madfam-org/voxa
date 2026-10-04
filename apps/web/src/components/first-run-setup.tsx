'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CORE_GRID_SIZES,
  coreGridSize,
  createStarterBoard,
  type CoreGridTemplateId,
  type StarterContentLocale,
} from '@voxa/core';
import { CVI_THEMES } from '@voxa/ui';
import type { CommunicatorSettings } from '@/lib/communicator-settings';
import {
  accessChoiceFromSettings,
  accessSettingsPatch,
  FIRST_RUN_ACCESS,
  FIRST_RUN_LANGUAGES,
  FIRST_RUN_STEPS,
  initialBoardLanguage,
  initialGridTemplate,
  type FirstRunAccess,
  type FirstRunBoardSummary,
  type FirstRunStep,
} from '@/lib/first-run';
import { buttonBorderColor, buttonLabel, buttonSymbolUrl } from '@/lib/board-utils';
import type { DeviceVoices } from '@/hooks/use-device-voices';
import { VoiceSettingsSection } from '@/components/voice-settings-section';
import { brand, neutral, status, surface } from '@/lib/tokens';

export type FirstRunCreateResult = { kind: 'created' } | { kind: 'board-limit' } | { kind: 'error'; message: string };

interface FirstRunSetupProps {
  settings: CommunicatorSettings;
  onChange: (patch: Partial<CommunicatorSettings>) => void;
  deviceVoices: DeviceVoices;
  /** A board the user already has: the last step opens it instead of creating another. */
  existingBoard?: FirstRunBoardSummary;
  onCreate: (templateId: CoreGridTemplateId, contentLocale: StarterContentLocale, name: string) => Promise<FirstRunCreateResult>;
  onOpenBoard: (boardId: string) => void;
  /** Closed: 'completed' after a board was created or opened, 'skipped' otherwise. */
  onClose: (outcome: 'completed' | 'skipped') => void;
}

const LANGUAGE_KEY: Record<StarterContentLocale, 'languageEsMx' | 'languageEnUs' | 'languageFrFr'> = {
  'es-MX': 'languageEsMx',
  'en-US': 'languageEnUs',
  'fr-FR': 'languageFrFr',
};

const ACCESS_KEY: Record<FirstRunAccess, { label: string; hint: string }> = {
  touch: { label: 'accessTouch', hint: 'accessTouchHint' },
  switch: { label: 'accessSwitch', hint: 'accessSwitchHint' },
  dwell: { label: 'accessDwell', hint: 'accessDwellHint' },
  keyguard: { label: 'accessKeyguard', hint: 'accessKeyguardHint' },
};

const SIZE_HINT_KEY: Record<CoreGridTemplateId, 'sizeHint24' | 'sizeHint36' | 'sizeHint60'> = {
  'core-24': 'sizeHint24',
  'core-36': 'sizeHint36',
  'core-60': 'sizeHint60',
};

/**
 * Guided first-run setup: board language, access method, grid size (with a
 * live preview of the real template), voice, then the first board. Every
 * step can be skipped; every control is a native button or form field, so
 * keyboards and switch interfaces that send Tab/Space/Enter operate it.
 * A native modal <dialog>: focus stays inside and Escape skips the setup.
 */
export function FirstRunSetup({
  settings,
  onChange,
  deviceVoices,
  existingBoard,
  onCreate,
  onOpenBoard,
  onClose,
}: FirstRunSetupProps): React.ReactNode {
  const t = useTranslations('firstRun');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const stepHeadingId = useId();
  const [stepIndex, setStepIndex] = useState(0);
  const [language, setLanguage] = useState<StarterContentLocale>(() => initialBoardLanguage(settings.contentLocale));
  const [access, setAccess] = useState<FirstRunAccess>(() => accessChoiceFromSettings(settings));
  const [templateId, setTemplateId] = useState<CoreGridTemplateId>(() => initialGridTemplate());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const closedRef = useRef(false);

  const step: FirstRunStep = FIRST_RUN_STEPS[stepIndex] ?? 'create';

  useEffect(() => {
    const node = dialogRef.current;
    if (node && !node.open && typeof node.showModal === 'function') node.showModal();
  }, []);

  // Move focus to the new step's heading so screen readers and switch users start at the top.
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex]);

  const close = (outcome: 'completed' | 'skipped') => {
    if (closedRef.current) return;
    closedRef.current = true;
    dialogRef.current?.close();
    onClose(outcome);
  };

  const applyStep = () => {
    if (step === 'language') onChange({ contentLocale: language });
    if (step === 'access') onChange(accessSettingsPatch(access));
  };

  const goNext = (apply: boolean) => {
    if (apply) applyStep();
    setProblem(null);
    setStepIndex((index) => Math.min(index + 1, FIRST_RUN_STEPS.length - 1));
  };

  const goBack = () => {
    setProblem(null);
    setStepIndex((index) => Math.max(index - 1, 0));
  };

  const create = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const result = await onCreate(templateId, language, t('boardName'));
      if (result.kind === 'created') {
        close('completed');
        return;
      }
      setProblem(result.kind === 'board-limit' ? t('limitReached') : t('createFailed', { detail: result.message }));
    } finally {
      setBusy(false);
    }
  };

  const preview = useMemo(
    () => createStarterBoard(templateId, { locale: language, boardId: 'first-run-preview' }),
    [templateId, language],
  );
  const size = coreGridSize(templateId);
  const theme = CVI_THEMES[settings.cviTheme] ?? CVI_THEMES['cvi-dark'];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      data-voxa-first-run=""
      data-voxa-first-run-step={step}
      onCancel={(event) => {
        event.preventDefault();
        close('skipped');
      }}
      style={dialogStyle}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 id={titleId} style={{ margin: 0, fontSize: '1.25rem' }}>
            {t('title')}
          </h2>
          <p style={{ ...hintStyle, marginTop: 4 }}>
            {t('stepOf', { step: stepIndex + 1, total: FIRST_RUN_STEPS.length })}
          </p>
        </div>
        <button type="button" onClick={() => close('skipped')} style={secondaryButton}>
          {t('skipAll')}
        </button>
      </div>

      <section aria-labelledby={stepHeadingId} style={{ marginTop: 12 }}>
        <h3 id={stepHeadingId} ref={headingRef} tabIndex={-1} style={{ margin: '0 0 8px', fontSize: '1.0625rem' }}>
          {step === 'language'
            ? t('languageTitle')
            : step === 'access'
              ? t('accessTitle')
              : step === 'size'
                ? t('sizeTitle')
                : step === 'voice'
                  ? t('voiceTitle')
                  : existingBoard
                    ? t('existingTitle')
                    : t('createTitle')}
        </h3>

        {step === 'language' ? (
          <>
            <p style={hintStyle}>{t('languageHint')}</p>
            <div role="group" aria-labelledby={stepHeadingId} style={optionList}>
              {FIRST_RUN_LANGUAGES.map((code) => (
                <ChoiceButton key={code} selected={language === code} onSelect={() => setLanguage(code)} value={code}>
                  {t(LANGUAGE_KEY[code])}
                </ChoiceButton>
              ))}
            </div>
          </>
        ) : null}

        {step === 'access' ? (
          <>
            <div role="group" aria-labelledby={stepHeadingId} style={optionList}>
              {FIRST_RUN_ACCESS.map((choice) => (
                <ChoiceButton
                  key={choice}
                  selected={access === choice}
                  onSelect={() => setAccess(choice)}
                  value={choice}
                  hint={t(ACCESS_KEY[choice].hint)}
                >
                  {t(ACCESS_KEY[choice].label)}
                </ChoiceButton>
              ))}
            </div>
            <p style={{ ...hintStyle, marginTop: 8 }}>{t('accessMore')}</p>
          </>
        ) : null}

        {step === 'size' ? (
          <>
            <div role="group" aria-labelledby={stepHeadingId} style={optionList}>
              {CORE_GRID_SIZES.map((item) => (
                <ChoiceButton
                  key={item.templateId}
                  selected={templateId === item.templateId}
                  onSelect={() => setTemplateId(item.templateId)}
                  value={item.templateId}
                  hint={t(SIZE_HINT_KEY[item.templateId])}
                >
                  {t('sizeOption', { cells: item.cells, rows: item.rows, columns: item.columns })}
                </ChoiceButton>
              ))}
            </div>
            <p style={{ ...hintStyle, marginTop: 8 }}>{t('motorPlanNote')}</p>
            <p data-voxa-review-status="pending-clinical-review" style={reviewNote}>
              {t('reviewNote')}
            </p>
            <div
              role="img"
              aria-label={t('previewLabel', { cells: size.cells, rows: size.rows, columns: size.columns })}
              data-voxa-first-run-preview=""
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${size.columns}, minmax(0, 1fr))`,
                gap: 4,
                padding: 8,
                background: theme.background,
                borderRadius: 8,
                border: `1px solid ${neutral.border}`,
              }}
            >
              {[...preview.grid.buttons]
                .sort((a, b) => a.position.row - b.position.row || a.position.column - b.position.column)
                .map((button) => {
                  const symbol = buttonSymbolUrl(button);
                  return (
                    <div
                      key={button.id as string}
                      aria-hidden
                      data-voxa-preview-cell={button.id as string}
                      style={{
                        gridRow: button.position.row + 1,
                        gridColumn: button.position.column + 1,
                        minHeight: 40,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        padding: 2,
                        background: theme.chrome.messageBarBackground,
                        color: theme.chrome.messageBarForeground,
                        border: `3px solid ${buttonBorderColor(button)}`,
                        borderRadius: 6,
                        fontSize: '0.6875rem',
                        lineHeight: 1.1,
                        textAlign: 'center',
                        overflow: 'hidden',
                        wordBreak: 'break-word',
                      }}
                    >
                      {symbol ? <img src={symbol} alt="" width={18} height={18} style={{ display: 'block' }} /> : null}
                      <span>{buttonLabel(button)}</span>
                    </div>
                  );
                })}
            </div>
          </>
        ) : null}

        {step === 'voice' ? (
          <>
            <p style={hintStyle}>{t('voiceHint')}</p>
            <VoiceSettingsSection
              settings={settings}
              onChange={onChange}
              speechLocale={language}
              deviceVoices={deviceVoices}
            />
          </>
        ) : null}

        {step === 'create' ? (
          existingBoard ? (
            <>
              <p style={bodyText}>{t('existingBody', { name: existingBoard.name })}</p>
              <button
                type="button"
                onClick={() => {
                  onOpenBoard(existingBoard.id);
                  close('completed');
                }}
                style={primaryButton}
              >
                {t('openExisting', { name: existingBoard.name })}
              </button>
            </>
          ) : (
            <>
              <p style={bodyText}>
                {t('createSummary', { cells: size.cells, rows: size.rows, columns: size.columns, language: t(LANGUAGE_KEY[language]) })}
              </p>
              <p data-voxa-review-status="pending-clinical-review" style={reviewNote}>
                {t('reviewNote')}
              </p>
              <button type="button" onClick={() => void create()} disabled={busy} aria-busy={busy} style={primaryButton}>
                {busy ? t('creating') : t('createAction')}
              </button>
            </>
          )
        ) : null}

        {problem ? (
          <p role="alert" style={{ ...bodyText, color: status.danger, marginTop: 12 }}>
            {problem}
          </p>
        ) : null}
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <button type="button" onClick={goBack} disabled={stepIndex === 0} style={secondaryButton}>
          {t('back')}
        </button>
        {step !== 'create' ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => goNext(false)} style={secondaryButton}>
              {t('skipStep')}
            </button>
            <button type="button" onClick={() => goNext(true)} style={primaryButton}>
              {t('next')}
            </button>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}

function ChoiceButton({
  selected,
  onSelect,
  value,
  hint,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  value: string;
  hint?: string;
  children: React.ReactNode;
}): React.ReactNode {
  const hintId = useId();
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-describedby={hint ? hintId : undefined}
      data-voxa-choice={value}
      onClick={onSelect}
      style={{
        textAlign: 'left',
        background: selected ? brand.surfaceTint : surface.overlay,
        color: neutral.text,
        border: `${selected ? 3 : 1}px solid ${selected ? brand.link : neutral.border}`,
        borderRadius: 8,
        padding: selected ? '10px 12px' : '12px 14px',
        minHeight: 48,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        fontSize: '1rem',
        fontWeight: 600,
      }}
    >
      <span>{children}</span>
      {hint ? (
        <span id={hintId} style={{ fontSize: '0.8125rem', fontWeight: 400, color: neutral.textSecondary }}>
          {hint}
        </span>
      ) : null}
    </button>
  );
}

const dialogStyle: React.CSSProperties = {
  maxWidth: 720,
  width: 'calc(100% - 32px)',
  maxHeight: 'calc(100dvh - 32px)',
  overflowY: 'auto',
  background: surface.raised,
  color: neutral.text,
  border: `1px solid ${neutral.border}`,
  borderRadius: 12,
  padding: 20,
};

const optionList: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };

const hintStyle: React.CSSProperties = { margin: '0 0 8px', fontSize: '0.875rem', color: neutral.textSecondary };

const bodyText: React.CSSProperties = { margin: '0 0 12px', lineHeight: 1.5 };

const reviewNote: React.CSSProperties = {
  margin: '0 0 12px',
  padding: '8px 10px',
  fontSize: '0.875rem',
  color: neutral.text,
  background: surface.overlay,
  borderLeft: `4px solid ${status.warning}`,
  borderRadius: 4,
};

const primaryButton: React.CSSProperties = {
  background: brand.primary,
  color: surface.white,
  border: 'none',
  borderRadius: 8,
  padding: '10px 16px',
  minHeight: 44,
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: surface.overlay,
  border: `1px solid ${neutral.border}`,
};
