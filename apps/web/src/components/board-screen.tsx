'use client';

import { useCallback, useState } from 'react';
import type { BoardButton, PartOfSpeechTag, TeamRole } from '@voxa/core';
import { fitzgeraldColor, type PartOfSpeech } from '@voxa/vocabulary';
import { AacButton, BoardGrid, CVI_THEMES, themeStyles } from '@voxa/ui';
import {
  buttonBorderColor,
  buttonLabel,
  buttonSpeech,
  downloadTextFile,
  posOptions,
  useObfFileInput,
} from '@/lib/board-utils';
import { useCommunicatorSettings } from '@/hooks/use-communicator-settings';
import { useEyeDwellByButton } from '@/hooks/use-eye-dwell';
import { usePredictions } from '@/hooks/use-predictions';
import { useSwitchScan } from '@/hooks/use-switch-scan';
import { useSyncedBoard } from '@/hooks/use-synced-board';
import {
  editorPinIsConfigured,
  isEditorUnlocked,
  lockEditorSession,
  unlockEditor,
} from '@/lib/editor-pin';
import { PredictionStrip } from '@/components/prediction-strip';
import { SettingsPanel } from '@/components/settings-panel';

const headerBtn: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '10px 16px',
  minWidth: 38,
  minHeight: 38,
  cursor: 'pointer',
  fontWeight: 600,
};

const secondaryBtn: React.CSSProperties = {
  ...headerBtn,
  background: '#262626',
  border: '1px solid #404040',
};

export function BoardScreen(): React.ReactNode {
  const [role, setRole] = useState<TeamRole>('communicator');
  const [utterance, setUtterance] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [recentButtonIds, setRecentButtonIds] = useState<string[]>([]);
  const { settings, setSettings } = useCommunicatorSettings();
  const {
    board,
    boardId,
    boardCatalog,
    setBoardId,
    createBoard,
    setBoard,
    syncStatus,
    error,
    warnings,
    pendingSave,
    saveBoard,
    importObf,
    exportObf,
    isEditor,
    isAuthenticated,
  } = useSyncedBoard(role);

  const sorted = [...board.grid.buttons].sort(
    (a, b) => a.position.row - b.position.row || a.position.column - b.position.column,
  );

  const visibleButtons = sorted.filter((btn) => isEditor || !btn.hidden);

  const { textPredictions, symbolPredictions } = usePredictions(board, utterance, recentButtonIds);

  const activate = useCallback(
    (btn: BoardButton) => {
      if (isEditor && editingId) return;
      const text = buttonSpeech(btn);
      setUtterance((prev) => [...prev, text]);
      setRecentButtonIds((prev) => [...prev, btn.id as string].slice(-8));
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = btn.locale;
        window.speechSynthesis.speak(u);
      }
    },
    [isEditor, editingId],
  );

  const applyPrediction = useCallback((text: string) => {
    const words = text.split(/\s+/).filter(Boolean);
    setUtterance(words);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  }, []);

  const switchScanEnabled = settings.accessMode === 'switch' && !isEditor;
  const eyeDwellEnabled = settings.accessMode === 'eye-tracking' && !isEditor;

  const { isHighlighted, liveRef } = useSwitchScan({
    enabled: switchScanEnabled,
    rows: board.grid.rows,
    columns: board.grid.columns,
    buttons: visibleButtons,
    intervalMs: settings.switchIntervalMs,
    order: settings.switchOrder,
    auditoryHighlight: settings.auditoryScanHighlight,
    onSelect: activate,
    getLabel: buttonLabel,
  });

  const { onEnter, onLeave, dwellProgressFor } = useEyeDwellByButton(
    eyeDwellEnabled,
    settings.eyeDwellMs,
    (buttonId) => {
      const btn = visibleButtons.find((b) => (b.id as string) === buttonId);
      if (btn) activate(btn);
    },
  );

  const speakAll = useCallback(() => {
    const text = utterance.join(' ');
    if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }, [utterance]);

  const handleImport = useCallback(
    async (raw: string) => {
      setBusy(true);
      try {
        await importObf(raw);
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [importObf],
  );

  const { open: openObfImport, input: obfInput } = useObfFileInput(handleImport);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const json = await exportObf();
      downloadTextFile(`${board.id as string}.obf`, json);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [exportObf, board.id]);

  const handleCreateBoard = useCallback(async () => {
    const name = window.prompt('Board name', 'My board');
    if (!name?.trim()) return;
    setBusy(true);
    try {
      await createBoard(name.trim());
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [createBoard]);

  const handleRoleChange = useCallback(
    (nextRole: TeamRole) => {
      if (nextRole === 'communicator') {
        lockEditorSession();
        setRole('communicator');
        setEditingId(null);
        return;
      }

      if (!editorPinIsConfigured() || isEditorUnlocked()) {
        setRole(nextRole);
        return;
      }

      const pin = window.prompt('Enter editor PIN to unlock vocabulary editing');
      if (pin && unlockEditor(pin)) {
        setRole(nextRole);
        return;
      }

      if (pin) {
        window.alert('Incorrect PIN. Editor mode stays locked.');
      }
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setBusy(true);
    try {
      await saveBoard();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [saveBoard]);

  const updateButton = (buttonId: string, patch: Partial<BoardButton>) => {
    setBoard({
      ...board,
      grid: {
        ...board.grid,
        buttons: board.grid.buttons.map((b) =>
          (b.id as string) === buttonId ? ({ ...b, ...patch } as BoardButton) : b,
        ),
      },
    });
  };

  const theme = settings.cviTheme;
  const shellStyle = themeStyles(theme);
  const syncLabel =
    syncStatus === 'live'
      ? pendingSave
        ? '● Live (save queued)'
        : '● Live'
      : syncStatus === 'connecting'
        ? '… Connecting'
        : '○ Offline';

  const handleButtonPress = (btn: BoardButton) => {
    if (isEditor) {
      setEditingId(btn.id as string);
      return;
    }
    if (settings.accessMode === 'touch') {
      activate(btn);
    }
  };

  return (
    <div style={{ ...shellStyle, display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {obfInput}
      <div ref={liveRef} aria-live="polite" aria-atomic="true" style={visuallyHidden} />

      <header
        style={{
          padding: '12px 16px',
          background: CVI_THEMES[theme].background,
          color: CVI_THEMES[theme].foreground,
          borderBottom: `1px solid ${CVI_THEMES[theme].buttonBorder}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <strong style={{ fontSize: '1.125rem' }}>
          <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            Voxa
          </a>
        </strong>

        {isAuthenticated && boardCatalog.length > 0 ? (
          <select
            value={boardId}
            onChange={(e) => setBoardId(e.target.value)}
            style={selectStyle}
            aria-label="Board"
          >
            {boardCatalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ opacity: 0.7, fontSize: '0.875rem' }}>{board.name}</span>
        )}

        {isEditor && isAuthenticated && (
          <button type="button" onClick={handleCreateBoard} disabled={busy} style={secondaryBtn}>
            New board
          </button>
        )}

        <span
          style={{
            fontSize: '0.75rem',
            color: syncStatus === 'live' ? '#4ade80' : CVI_THEMES[theme].foreground,
          }}
        >
          {syncLabel} v{board.version}
        </span>

        <select
          value={role}
          onChange={(e) => handleRoleChange(e.target.value as TeamRole)}
          style={selectStyle}
          aria-label="Team role"
        >
          <option value="communicator">Communicator</option>
          <option value="editor">Editor (SLP)</option>
          <option value="admin">Admin</option>
        </select>

        <button type="button" onClick={() => setSettingsOpen((v) => !v)} style={secondaryBtn}>
          Settings
        </button>

        <a href="/auth/signin?redirect_to=%2Fapp" style={{ ...secondaryBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
          Sign in
        </a>

        {isAuthenticated && (
          <a href="/auth/signout" style={{ ...secondaryBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Sign out
          </a>
        )}

        <div style={utteranceBarStyle}>
          {utterance.length ? utterance.join(' ') : 'Tap buttons to build a message…'}
        </div>

        <button type="button" onClick={speakAll} style={headerBtn}>
          Speak
        </button>
        <button type="button" onClick={() => setUtterance([])} style={headerBtn}>
          Clear
        </button>

        {isEditor && (
          <>
            <button type="button" onClick={openObfImport} disabled={busy} style={secondaryBtn}>
              Import OBF
            </button>
            <button type="button" onClick={handleExport} disabled={busy} style={secondaryBtn}>
              Export OBF
            </button>
            <button type="button" onClick={handleSave} disabled={busy} style={secondaryBtn}>
              Save
            </button>
          </>
        )}
      </header>

      {(error || warnings.length > 0) && (
        <div style={{ background: '#171717', color: '#fcd34d', padding: '8px 16px', fontSize: '0.875rem' }}>
          {error}
          {warnings.length > 0 && ` OBF warnings: ${warnings.join('; ')}`}
        </div>
      )}

      {!isEditor && (
        <PredictionStrip
          textPredictions={textPredictions}
          symbolPredictions={symbolPredictions}
          buttons={sorted}
          onApplyText={applyPrediction}
          onSelectSymbol={activate}
        />
      )}

      <main style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <BoardGrid
          rows={board.grid.rows}
          columns={board.grid.columns}
          theme={theme}
          targetScale={settings.targetScale}
        >
          {visibleButtons.map((btn) => (
            <AacButton
              key={btn.id as string}
              label={buttonLabel(btn)}
              borderColor={buttonBorderColor(btn)}
              targetScale={settings.targetScale}
              hideSymbol={settings.hideSymbols}
              hideLabel={settings.hideLabels}
              scanHighlighted={isHighlighted(btn)}
              dwellProgress={dwellProgressFor(btn.id as string)}
              onClick={() => handleButtonPress(btn)}
              onPointerEnter={() => onEnter(btn.id as string)}
              onPointerLeave={onLeave}
              aria-label={
                isEditor && btn.locked
                  ? `${buttonLabel(btn)} (locked motor-plan slot)`
                  : buttonLabel(btn)
              }
            >
              {isEditor && btn.locked ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    fontSize: '0.75rem',
                    lineHeight: 1,
                  }}
                >
                  🔒
                </span>
              ) : null}
            </AacButton>
          ))}
        </BoardGrid>

        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            onChange={setSettings}
            onClose={() => setSettingsOpen(false)}
            showEditorPinSettings={role === 'admin'}
          />
        )}

        {isEditor && editingId && (
          <EditorPanel
            button={sorted.find((b) => (b.id as string) === editingId)!}
            onClose={() => setEditingId(null)}
            onChange={(patch) => updateButton(editingId, patch)}
          />
        )}
      </main>

      <footer
        style={{
          padding: '10px 16px',
          fontSize: '0.75rem',
          color: '#a3a3a3',
          borderTop: '1px solid #262626',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <a href="/legal/privacy" style={{ color: '#93c5fd' }}>
          Privacy
        </a>
        <a href="/legal/terms" style={{ color: '#93c5fd' }}>
          Terms
        </a>
        <a href="/legal/accessibility" style={{ color: '#93c5fd' }}>
          Accessibility
        </a>
      </footer>
    </div>
  );
}

function EditorPanel({
  button,
  onClose,
  onChange,
}: {
  button: BoardButton;
  onClose: () => void;
  onChange: (patch: Partial<BoardButton>) => void;
}) {
  const label = button.kind === 'analytic' ? button.label : button.phrase;
  const speech = button.kind === 'analytic' ? button.speechText : button.phrase;
  const fieldsLocked = button.locked;

  return (
    <aside
      style={{
        width: 280,
        background: '#111',
        color: '#f5f5f5',
        borderLeft: '1px solid #333',
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <h2 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Edit button</h2>

      {fieldsLocked ? (
        <p style={{ fontSize: '0.8125rem', color: '#fcd34d', margin: '0 0 12px' }}>
          Motor-plan slot locked — unlock below to change label, speech, or visibility.
        </p>
      ) : null}

      <label style={labelStyle}>
        Label
        <input
          style={fieldStyle}
          value={label}
          disabled={fieldsLocked}
          onChange={(e) =>
            button.kind === 'analytic'
              ? onChange({ label: e.target.value, speechText: e.target.value })
              : onChange({ phrase: e.target.value })
          }
        />
      </label>

      {button.kind === 'analytic' && (
        <label style={labelStyle}>
          Speech
          <input
            style={fieldStyle}
            value={speech}
            disabled={fieldsLocked}
            onChange={(e) => onChange({ speechText: e.target.value })}
          />
        </label>
      )}

      <label style={labelStyle}>
        Part of speech
        <select
          style={fieldStyle}
          value={button.partOfSpeech ?? 'noun'}
          disabled={fieldsLocked}
          onChange={(e) => onChange({ partOfSpeech: e.target.value as PartOfSpeechTag })}
        >
          {posOptions().map((pos) => (
            <option key={pos} value={pos}>
              {pos} ({fitzgeraldColor(pos as PartOfSpeech)})
            </option>
          ))}
        </select>
      </label>

      <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={button.locked}
          onChange={(e) => onChange({ locked: e.target.checked })}
        />
        Lock position (motor planning)
      </label>

      <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={button.hidden ?? false}
          disabled={fieldsLocked}
          onChange={(e) => onChange({ hidden: e.target.checked })}
        />
        Hide from communicator view
      </label>

      <button type="button" onClick={onClose} style={{ ...headerBtn, marginTop: 16, width: '100%' }}>
        Done
      </button>
    </aside>
  );
}

const selectStyle: React.CSSProperties = {
  background: '#171717',
  color: '#f5f5f5',
  border: '1px solid #404040',
  borderRadius: 6,
  padding: '6px 8px',
  minHeight: 38,
};

const utteranceBarStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 200,
  minHeight: 40,
  background: '#171717',
  borderRadius: 8,
  padding: '8px 12px',
};

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

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: '0.875rem',
  marginBottom: 12,
};

const fieldStyle: React.CSSProperties = {
  background: '#0a0a0a',
  border: '1px solid #404040',
  borderRadius: 6,
  color: '#f5f5f5',
  padding: '8px 10px',
};
