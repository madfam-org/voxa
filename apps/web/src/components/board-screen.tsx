'use client';

import { useCallback, useState } from 'react';
import type { BoardButton, PartOfSpeechTag, TeamRole } from '@voxa/core';
import { fitzgeraldColor, type PartOfSpeech } from '@voxa/vocabulary';
import { AacButton, BoardGrid } from '@voxa/ui';
import {
  buttonBorderColor,
  buttonLabel,
  buttonSpeech,
  downloadTextFile,
  posOptions,
  useObfFileInput,
} from '@/lib/board-utils';
import { useSyncedBoard } from '@/hooks/use-synced-board';

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

export function BoardScreen() {
  const [role, setRole] = useState<TeamRole>('communicator');
  const [utterance, setUtterance] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { board, setBoard, syncStatus, error, warnings, saveBoard, importObf, exportObf, isEditor } =
    useSyncedBoard(role);

  const activate = useCallback((btn: BoardButton) => {
    if (isEditor && editingId) return;
    const text = buttonSpeech(btn);
    setUtterance((prev) => [...prev, text]);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = btn.locale;
      window.speechSynthesis.speak(u);
    }
  }, [isEditor, editingId]);

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

  const sorted = [...board.grid.buttons].sort(
    (a, b) => a.position.row - b.position.row || a.position.column - b.position.column,
  );

  const syncLabel =
    syncStatus === 'live' ? '● Live' : syncStatus === 'connecting' ? '… Connecting' : '○ Offline';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {obfInput}
      <header
        style={{
          padding: '12px 16px',
          background: '#0a0a0a',
          color: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <strong style={{ fontSize: '1.125rem' }}>Voxa</strong>
        <span style={{ opacity: 0.7, fontSize: '0.875rem' }}>{board.name}</span>
        <span style={{ fontSize: '0.75rem', color: syncStatus === 'live' ? '#4ade80' : '#a3a3a3' }}>
          {syncLabel} v{board.version}
        </span>

        <select
          value={role}
          onChange={(e) => setRole(e.target.value as TeamRole)}
          style={{ background: '#171717', color: '#f5f5f5', border: '1px solid #404040', borderRadius: 6, padding: '6px 8px' }}
          aria-label="Team role"
        >
          <option value="communicator">Communicator</option>
          <option value="editor">Editor (SLP)</option>
          <option value="admin">Admin</option>
        </select>

        <div
          style={{
            flex: 1,
            minWidth: 200,
            minHeight: 40,
            background: '#171717',
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
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

      <main style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <BoardGrid rows={board.grid.rows} columns={board.grid.columns} theme="cvi-dark" targetScale={1.2}>
          {sorted.map((btn) => (
            <AacButton
              key={btn.id as string}
              label={buttonLabel(btn)}
              borderColor={buttonBorderColor(btn)}
              targetScale={1.2}
              onClick={() => (isEditor ? setEditingId(btn.id as string) : activate(btn))}
              onDoubleClick={() => !isEditor && activate(btn)}
            />
          ))}
        </BoardGrid>

        {isEditor && editingId && (
          <EditorPanel
            button={sorted.find((b) => (b.id as string) === editingId)!}
            onClose={() => setEditingId(null)}
            onChange={(patch) => updateButton(editingId, patch)}
          />
        )}
      </main>
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

      <label style={labelStyle}>
        Label
        <input
          style={fieldStyle}
          value={label}
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
            onChange={(e) => onChange({ speechText: e.target.value })}
          />
        </label>
      )}

      <label style={labelStyle}>
        Part of speech
        <select
          style={fieldStyle}
          value={button.partOfSpeech ?? 'noun'}
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

      <button type="button" onClick={onClose} style={{ ...headerBtn, marginTop: 16, width: '100%' }}>
        Done
      </button>
    </aside>
  );
}

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
