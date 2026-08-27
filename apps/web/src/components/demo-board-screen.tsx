'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { UiLocale } from '@voxa/i18n';
import {
  applyKeyboardActivation,
  boardForDemoScene,
  formatKeyboardUtterance,
  isLiteracyKeyboardBoard,
  isVisualScheduleBoard,
  listScheduleSteps,
  scheduleProgress,
  type BoardButton,
  type DemoSceneId,
} from '@voxa/core';
import { touchGuardActive } from '@voxa/access';
import { AacButton, BoardGrid, CVI_THEMES } from '@voxa/ui';
import { buttonBorderColor, buttonLabel, buttonSpeech, buttonSymbolUrl } from '@/lib/board-utils';
import { ConversionGate, type ConversionGateVariant } from '@/components/conversion-gate';
import { SiteFooter, SiteNav } from '@/components/site-chrome';
import { TouchGuardOverlay } from '@/components/touch-guard-overlay';
import { VisualScheduleView } from '@/components/visual-schedule-view';
import { useSwitchScan } from '@/hooks/use-switch-scan';
import { brand, classic, neutral, status, stone, surface } from '@/lib/tokens';

const DEMO_SCENE_IDS: DemoSceneId[] = ['communicate', 'literacy', 'schedule', 'access'];

type GateKey = 'firstMessage' | 'templates' | 'access' | 'institution';

interface GateConfig {
  variant: ConversionGateVariant;
  title: string;
  body: string;
  id: string;
}

const GATE_VARIANTS: Record<GateKey, ConversionGateVariant> = {
  firstMessage: 'parent',
  templates: 'feature',
  access: 'feature',
  institution: 'institution',
};

export function DemoBoardScreen(): React.ReactNode {
  const locale = useLocale() as UiLocale;
  const t = useTranslations('demo');
  const tc = useTranslations('common');
  const tcx = useTranslations('communicator');

  const [scene, setScene] = useState<DemoSceneId>('communicate');
  const board = useMemo(() => boardForDemoScene(scene, locale), [scene, locale]);
  const [utterance, setUtterance] = useState<string[]>([]);
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(() => new Set());
  const [tapCount, setTapCount] = useState(0);
  const [switchScanOn, setSwitchScanOn] = useState(false);
  const [touchGuardOn, setTouchGuardOn] = useState(false);
  const [shownGates, setShownGates] = useState<Set<string>>(() => new Set());
  const [activeGate, setActiveGate] = useState<GateConfig | null>(null);
  const pendingTouchRef = useRef<string | null>(null);

  const literacyMode = isLiteracyKeyboardBoard(board);
  const scheduleMode = isVisualScheduleBoard(board);
  const scheduleSteps = scheduleMode ? listScheduleSteps(board) : [];
  const scheduleState = scheduleMode
    ? scheduleProgress(completedStepIds, scheduleSteps)
    : { completed: 0, total: 0, currentStepId: null };

  const sceneSuggestions = useMemo(
    () => t.raw(`suggestions.${scene}`) as string[],
    [scene, t],
  );

  useEffect(() => {
    setUtterance([]);
    setCompletedStepIds(new Set());
    setSwitchScanOn(scene === 'access');
    setTouchGuardOn(scene === 'access');
  }, [scene]);

  const sorted = [...board.grid.buttons].sort(
    (a, b) => a.position.row - b.position.row || a.position.column - b.position.column,
  );

  const openGate = useCallback(
    (key: GateKey) => {
      if (shownGates.has(key)) return;
      setShownGates((prev) => new Set(prev).add(key));
      setActiveGate({
        id: key,
        variant: GATE_VARIANTS[key],
        title: t(`gates.${key}.title`),
        body: t(`gates.${key}.body`),
      });
    },
    [shownGates, t],
  );

  const activate = useCallback(
    (btn: BoardButton) => {
      if (literacyMode && btn.kind === 'analytic' && btn.keyboardRole) {
        const result = applyKeyboardActivation(utterance, btn);
        setUtterance(result.utterance);
        return;
      }

      if (scheduleMode) {
        setCompletedStepIds((prev) => new Set(prev).add(btn.id as string));
      } else {
        setUtterance((prev) => [...prev, buttonSpeech(btn)]);
      }

      const text = scheduleMode ? buttonSpeech(btn) : buttonSpeech(btn);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = btn.locale;
        window.speechSynthesis.speak(u);
      }

      setTapCount((count) => {
        const next = count + 1;
        if (next === 2) openGate('firstMessage');
        if (next === 6) openGate('templates');
        return next;
      });
    },
    [literacyMode, openGate, scheduleMode, utterance],
  );

  const { isHighlighted, isGroupHighlighted, liveRef } = useSwitchScan({
    enabled: switchScanOn && scene === 'access',
    rows: board.grid.rows,
    columns: board.grid.columns,
    buttons: sorted,
    intervalMs: 1400,
    order: 'row-major',
    groupStrategy: 'none',
    auditoryHighlight: true,
    auditoryVoice: false,
    auditoryBeep: true,
    onSelect: activate,
    getLabel: buttonLabel,
  });

  const handleButtonPress = useCallback(
    (btn: BoardButton) => {
      if (switchScanOn && scene === 'access') return;
      activate(btn);
    },
    [activate, scene, switchScanOn],
  );

  const speakAll = () => {
    const text = literacyMode ? formatKeyboardUtterance(utterance) : utterance.join(' ');
    if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  const themeKey = scene === 'communicate' ? 'classic-light' : 'cvi-dark';
  const theme = CVI_THEMES[themeKey];
  const classicScene = scene === 'communicate';
  const guardActive =
    touchGuardOn &&
    scene === 'access' &&
    !switchScanOn &&
    touchGuardActive({ enabled: true, mask: 'both' });

  const utteranceText = scheduleMode
    ? scheduleState.completed >= scheduleState.total && scheduleState.total > 0
      ? tcx('routineComplete')
      : t('scheduleStep', {
          current: Math.min(scheduleState.completed + 1, scheduleState.total),
          total: scheduleState.total,
        })
    : literacyMode
      ? formatKeyboardUtterance(utterance) || t('typeOnKeyboard')
      : utterance.length
        ? utterance.join(' ')
        : classicScene
          ? t('tapSymbols')
          : t('tapButtons');

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: classicScene ? classic.surface : surface.base,
        color: classicScene ? classic.text : neutral.text,
      }}
    >
      <SiteNav active="demo" />
      <div ref={liveRef} aria-live="polite" aria-atomic="true" style={visuallyHidden} />

      <div style={classicScene ? classicBannerStyle : bannerStyle}>
        <div>
          <strong>{classicScene ? t('classicBannerTitle') : t('platformBannerTitle')}</strong>
          {classicScene ? (
            <span style={{ display: 'block', marginTop: 4, color: classic.textMutedStrong, fontSize: '0.8125rem' }}>
              {t('classicBannerSubtitle')}
            </span>
          ) : (
            <span style={{ display: 'block', marginTop: 4, color: brand.link, fontSize: '0.8125rem' }}>
              {t(`scenes.${scene}.description`)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => openGate('institution')}
            style={classicScene ? classicChipBtnGold : chipBtnGold}
          >
            {t('institutionalPlans')}
          </button>
          <Link
            href="/auth/signin?redirect_to=%2Fapp"
            style={{
              ...(classicScene ? classicChipBtn : chipBtn),
              textDecoration: 'none',
            }}
          >
            {t('openFullApp')}
          </Link>
        </div>
      </div>

      <div
        style={{
          ...sceneTabsStyle,
          background: classicScene ? surface.white : surface.sunken,
          borderBottom: classicScene ? `1px solid ${classic.border}` : `1px solid ${surface.overlay}`,
        }}
        role="tablist"
        aria-label={t('scenesAriaLabel')}
      >
        {DEMO_SCENE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={scene === id}
            onClick={() => setScene(id)}
            style={{
              ...sceneTabBtn,
              color: scene === id ? surface.white : classicScene ? classic.text : neutral.textSubtle,
              background: scene === id ? brand.primary : classicScene ? classic.surfaceAlt : surface.overlay,
              borderColor: scene === id ? brand.mid : classicScene ? classic.borderStrong : neutral.border,
            }}
          >
            {t(`scenes.${id}.name`)}
          </button>
        ))}
      </div>

      {scene === 'access' ? (
        <div style={accessBarStyle}>
          <button
            type="button"
            style={chipBtn}
            onClick={() => {
              setSwitchScanOn((value) => !value);
              if (!switchScanOn) openGate('access');
            }}
          >
            {switchScanOn ? t('switchOn') : t('switchOff')}
          </button>
          <button type="button" style={chipBtn} onClick={() => setTouchGuardOn((value) => !value)}>
            {touchGuardOn ? t('guardOn') : t('guardOff')}
          </button>
          {switchScanOn ? (
            <span style={{ fontSize: '0.8125rem', color: brand.accentSoft }}>{t('switchHint')}</span>
          ) : null}
        </div>
      ) : null}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          style={{
            ...toolbarStyle,
            background: classicScene ? surface.white : theme.background,
            borderBottom: `1px solid ${classicScene ? classic.borderStrong : theme.buttonBorder}`,
          }}
        >
          {!classicScene ? <strong>{board.name}</strong> : null}
          <div
            style={{
              ...utteranceBarStyle,
              background: classicScene ? surface.white : surface.raised,
              border: classicScene ? `2px solid ${classic.text}` : undefined,
              color: classicScene ? classic.text : undefined,
              fontWeight: classicScene ? 600 : undefined,
            }}
            aria-live="polite"
          >
            {utteranceText}
          </div>
          {!scheduleMode ? (
            <button
              type="button"
              onClick={speakAll}
              style={classicScene ? classicActionBtn : actionBtn}
            >
              {tc('speak')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setUtterance([]);
              setCompletedStepIds(new Set());
            }}
            style={classicScene ? classicSecondaryBtn : actionBtn}
          >
            {tc('clear')}
          </button>
        </div>

        {!classicScene ? (
          <div style={suggestionBarStyle}>
            <span style={{ fontSize: '0.75rem', color: stone.text, marginRight: 4 }}>{tc('trySaying')}</span>
            {sceneSuggestions.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => openGate('templates')}
                style={{ ...chipBtn, background: stone.surfaceRaised, cursor: 'pointer' }}
              >
                {text}
              </button>
            ))}
          </div>
        ) : null}

        <main style={{ flex: 1, minHeight: 280, display: 'flex' }}>
          <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
            {scheduleMode ? (
              <VisualScheduleView
                steps={scheduleSteps}
                completedIds={completedStepIds}
                currentStepId={scheduleState.currentStepId}
                targetScale={1}
                isHighlighted={isHighlighted}
                isGroupHighlighted={isGroupHighlighted}
                dwellProgressFor={() => 0}
                renderStepButton={(btn, state) => (
                  <AacButton
                    label={buttonLabel(btn)}
                    symbolUrl={buttonSymbolUrl(btn)}
                    borderColor={buttonBorderColor(btn)}
                    targetScale={1}
                    scanHighlighted={isHighlighted(btn)}
                    scanGroupHighlighted={isGroupHighlighted(btn)}
                    onClick={() => handleButtonPress(btn)}
                    style={
                      state.completed
                        ? { opacity: 0.72, outline: `2px solid ${status.successBorder}` }
                        : state.current
                          ? { outline: `2px solid ${status.warningAccent}` }
                          : undefined
                    }
                  />
                )}
              />
            ) : (
              <>
                <BoardGrid
                  rows={board.grid.rows}
                  columns={board.grid.columns}
                  theme={themeKey}
                  targetScale={classicScene ? 1.15 : 1.1}
                  gapMm={classicScene ? 2 : 4}
                >
                  {sorted.map((btn) => (
                    <AacButton
                      key={btn.id as string}
                      label={buttonLabel(btn)}
                      symbolUrl={buttonSymbolUrl(btn)}
                      borderColor={buttonBorderColor(btn)}
                      presentation={classicScene ? 'symbol-forward' : 'default'}
                      targetScale={classicScene ? 1.15 : 1.1}
                      scanHighlighted={isHighlighted(btn)}
                      scanGroupHighlighted={isGroupHighlighted(btn)}
                      onClick={() => handleButtonPress(btn)}
                      onPointerDown={() => {
                        pendingTouchRef.current = btn.id as string;
                      }}
                      onPointerUp={() => {
                        if (pendingTouchRef.current === (btn.id as string) && switchScanOn && scene === 'access') {
                          if (isHighlighted(btn)) activate(btn);
                        }
                        pendingTouchRef.current = null;
                      }}
                    />
                  ))}
                </BoardGrid>
                {guardActive ? (
                  <TouchGuardOverlay rows={board.grid.rows} columns={board.grid.columns} mask="both" />
                ) : null}
              </>
            )}
          </div>
        </main>
      </div>

      <section style={ctaSectionStyle}>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.25rem', color: neutral.text }}>{t('readyTitle')}</h2>
        <p style={{ margin: '0 0 16px', color: neutral.muted, maxWidth: 640, marginInline: 'auto' }}>
          {t('readyBody')}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/auth/signin?redirect_to=%2Fapp" style={primaryCta}>
            {t('startFree')}
          </Link>
          <Link href="/#institutions" style={secondaryCta}>
            {t('schoolsClinics')}
          </Link>
        </div>
      </section>

      <SiteFooter />

      <ConversionGate
        open={activeGate !== null}
        variant={activeGate?.variant ?? 'parent'}
        title={activeGate?.title ?? ''}
        body={activeGate?.body ?? ''}
        onClose={() => setActiveGate(null)}
      />
    </div>
  );
}

const visuallyHidden: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

const bannerStyle: React.CSSProperties = {
  padding: '12px 24px',
  background: classic.text,
  borderBottom: `1px solid ${brand.gradientDeep}`,
  fontSize: '0.875rem',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'center',
  justifyContent: 'space-between',
};

const classicBannerStyle: React.CSSProperties = {
  ...bannerStyle,
  background: surface.white,
  borderBottom: `1px solid ${classic.border}`,
};

const sceneTabsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  padding: '12px 16px',
  borderBottom: `1px solid ${surface.overlay}`,
  background: surface.sunken,
};

const sceneTabBtn: React.CSSProperties = {
  border: `1px solid ${neutral.border}`,
  borderRadius: 999,
  padding: '8px 14px',
  color: neutral.textSubtle,
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const accessBarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
  padding: '8px 16px',
  background: brand.surfaceTint,
  borderBottom: `1px solid ${brand.primaryStrong}`,
};

const toolbarStyle: React.CSSProperties = {
  padding: '12px 16px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'center',
};

const utteranceBarStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 180,
  minHeight: 44,
  background: surface.raised,
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: '1.0625rem',
};

const suggestionBarStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: stone.surface,
  borderBottom: `1px solid ${stone.border}`,
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
};

const ctaSectionStyle: React.CSSProperties = {
  padding: '24px',
  background: surface.raised,
  borderTop: `1px solid ${surface.overlay}`,
  textAlign: 'center',
  color: neutral.text,
};

const classicChipBtn: React.CSSProperties = {
  background: surface.white,
  border: `1px solid ${classic.textMuted}`,
  borderRadius: 999,
  padding: '6px 14px',
  color: classic.textSecondary,
  fontSize: '0.8125rem',
  cursor: 'pointer',
};

const classicChipBtnGold: React.CSSProperties = {
  ...classicChipBtn,
  borderColor: status.warningOnLight,
  color: status.warningFillDeep,
  background: status.warningTint,
};

const actionBtn: React.CSSProperties = {
  background: brand.primary,
  color: surface.white,
  border: 'none',
  borderRadius: 8,
  padding: '10px 16px',
  fontWeight: 600,
  cursor: 'pointer',
  minHeight: 44,
};

const classicActionBtn: React.CSSProperties = {
  ...actionBtn,
  borderRadius: 6,
  minHeight: 40,
  padding: '8px 14px',
};

const classicSecondaryBtn: React.CSSProperties = {
  ...classicActionBtn,
  background: surface.white,
  color: classic.text,
  border: `2px solid ${classic.text}`,
};

const chipBtn: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${neutral.border}`,
  borderRadius: 999,
  padding: '6px 14px',
  color: neutral.borderLight,
  fontSize: '0.8125rem',
  cursor: 'pointer',
};

const chipBtnGold: React.CSSProperties = {
  ...chipBtn,
  borderColor: status.premiumBorder,
  color: status.premium,
};

const primaryCta: React.CSSProperties = {
  padding: '12px 22px',
  borderRadius: 10,
  background: brand.primary,
  color: surface.white,
  fontWeight: 700,
  textDecoration: 'none',
};

const secondaryCta: React.CSSProperties = {
  padding: '12px 22px',
  borderRadius: 10,
  border: `1px solid ${neutral.disabled}`,
  color: neutral.borderLight,
  textDecoration: 'none',
};
