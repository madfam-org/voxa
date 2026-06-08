import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { BoardButton } from '@voxa/core';
import { fitzgeraldColor, resolvePartOfSpeech } from '@voxa/vocabulary';
import type { ScanOrder } from '@voxa/access';
import { buttonLabel, buttonSpeech } from '@/lib/board-utils';
import { speakButton, speakText } from '@/lib/play-button-speech';
import { useMobileAuth } from '@/hooks/use-mobile-auth';
import { useMobileSwitchScan } from '@/hooks/use-mobile-switch-scan';
import { useMobileSyncedBoard } from '@/hooks/use-mobile-synced-board';
import { MobileSwitchKeyCapture } from '@/components/mobile-switch-key-capture';
import {
  loadMobileSettings,
  saveMobileSettings,
  type MobileCommunicatorSettings,
} from '@/lib/mobile-settings';

/** 1 cm minimum touch target @ 96 dpi, scaled 1.2× */
const TARGET = Math.round(38 * 1.2);

export function MobileBoardScreen() {
  const [utterance, setUtterance] = useState<string[]>([]);
  const [settings, setSettings] = useState<MobileCommunicatorSettings>({
    accessMode: 'touch',
    switchIntervalMs: 1200,
    switchOrder: 'row-major',
    auditoryScanHighlight: true,
    auditoryScanVoice: false,
  });
  const { accessToken, userId, isAuthenticated, configured, signIn, signOut, loading: authLoading } =
    useMobileAuth();
  const {
    board,
    boardCatalog,
    syncStatus,
    error,
    pendingSave,
    syncError,
    setBoardId,
    retryPendingSave,
  } = useMobileSyncedBoard({ accessToken, userId });

  useEffect(() => {
    void loadMobileSettings().then(setSettings);
  }, []);

  const switchScanEnabled = settings.accessMode === 'switch';

  const sorted = [...board.grid.buttons].sort(
    (a, b) => a.position.row - b.position.row || a.position.column - b.position.column,
  );

  const activate = useCallback(
    (btn: BoardButton) => {
      if (btn.navigateToBoardId) {
        void setBoardId(btn.navigateToBoardId as string);
        return;
      }
      const text = buttonSpeech(btn);
      setUtterance((prev) => [...prev, text]);
      void speakButton(btn, { accessToken });
    },
    [accessToken, setBoardId],
  );

  const { isHighlighted, advance, select, activeLabel } = useMobileSwitchScan({
    enabled: switchScanEnabled,
    rows: board.grid.rows,
    columns: board.grid.columns,
    buttons: sorted,
    intervalMs: settings.switchIntervalMs,
    order: settings.switchOrder,
    auditoryHighlight: settings.auditoryScanHighlight,
    auditoryVoice: settings.auditoryScanVoice,
    onSelect: activate,
  });

  const toggleSwitchMode = useCallback(() => {
    const nextMode = settings.accessMode === 'switch' ? 'touch' : 'switch';
    const next = { ...settings, accessMode: nextMode as MobileCommunicatorSettings['accessMode'] };
    setSettings(next);
    void saveMobileSettings(next);
  }, [settings]);

  const patchSettings = useCallback((patch: Partial<MobileCommunicatorSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    void saveMobileSettings(next);
  }, [settings]);

  const configureSwitchScan = useCallback(() => {
    Alert.alert(
      'Switch scan speed',
      `${settings.switchIntervalMs} ms · ${settings.switchOrder.replace('-', ' ')}`,
      [
        { text: 'Faster (600 ms)', onPress: () => patchSettings({ switchIntervalMs: 600 }) },
        { text: 'Default (1200 ms)', onPress: () => patchSettings({ switchIntervalMs: 1200 }) },
        { text: 'Slower (2000 ms)', onPress: () => patchSettings({ switchIntervalMs: 2000 }) },
        {
          text: 'Row-major order',
          onPress: () => patchSettings({ switchOrder: 'row-major' as ScanOrder }),
        },
        {
          text: 'Column-major order',
          onPress: () => patchSettings({ switchOrder: 'column-major' as ScanOrder }),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [patchSettings, settings.switchIntervalMs, settings.switchOrder]);

  const pickBoard = useCallback(() => {
    if (boardCatalog.length <= 1) return;
    Alert.alert(
      'Switch board',
      undefined,
      boardCatalog.map((item) => ({
        text: item.name,
        onPress: () => void setBoardId(item.id),
      })),
    );
  }, [boardCatalog, setBoardId]);

  const syncLabel =
    syncStatus === 'live'
      ? pendingSave
        ? '● Live (save queued)'
        : '● Live'
      : syncStatus === 'connecting'
        ? '… Connecting'
        : '○ Offline';

  return (
    <View style={styles.root}>
      <MobileSwitchKeyCapture enabled={switchScanEnabled} onAdvance={advance} onSelect={select} />
      <View style={styles.header}>
        <Text style={styles.title}>Voxa</Text>
        <Text style={styles.meta}>
          {board.name} · {syncLabel} v{board.version}
        </Text>
        {isAuthenticated && boardCatalog.length > 1 ? (
          <Pressable style={styles.headerBtnSecondary} onPress={pickBoard}>
            <Text style={styles.headerBtnText}>Boards</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.headerBtnSecondary} onPress={toggleSwitchMode}>
          <Text style={styles.headerBtnText}>
            {switchScanEnabled ? 'Switch on' : 'Switch off'}
          </Text>
        </Pressable>
        {!authLoading && configured ? (
          isAuthenticated ? (
            <Pressable style={styles.headerBtnSecondary} onPress={() => void signOut()}>
              <Text style={styles.headerBtnText}>Sign out</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.headerBtnSecondary} onPress={() => void signIn()}>
              <Text style={styles.headerBtnText}>Sign in</Text>
            </Pressable>
          )
        ) : null}
        <Text style={styles.utterance}>
          {utterance.length ? utterance.join(' ') : 'Tap to communicate…'}
        </Text>
        <Pressable
          style={styles.headerBtn}
          onPress={() => {
            const text = utterance.join(' ');
            if (text) speakText(text);
          }}
        >
          <Text style={styles.headerBtnText}>Speak</Text>
        </Pressable>
        <Pressable style={styles.headerBtn} onPress={() => setUtterance([])}>
          <Text style={styles.headerBtnText}>Clear</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.banner}>{error}</Text> : null}

      {syncStatus === 'offline' && !pendingSave ? (
        <View style={styles.offlineRow}>
          <Text style={styles.offlineText}>
            {error ?? 'Offline — using cached board until connection returns.'}
          </Text>
        </View>
      ) : null}

      {pendingSave ? (
        <View style={styles.pendingRow}>
          <Text style={styles.pendingText}>
            {syncError ? `Save queued — ${syncError}` : 'Save queued — will sync when online'}
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => void retryPendingSave()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {switchScanEnabled ? (
        <View style={styles.switchBar}>
          <Text style={styles.switchMeta} numberOfLines={1}>
            Scan: {activeLabel || '—'}
          </Text>
          <Pressable style={styles.switchBtn} onPress={advance} accessibilityLabel="Advance scan">
            <Text style={styles.switchBtnText}>Next</Text>
          </Pressable>
          <Pressable style={styles.switchBtn} onPress={configureSwitchScan} accessibilityLabel="Switch scan settings">
            <Text style={styles.switchBtnText}>Tune</Text>
          </Pressable>
          <Pressable style={styles.switchBtnPrimary} onPress={select} accessibilityLabel="Select scanned cell">
            <Text style={styles.switchBtnText}>Select</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.grid}>
        {sorted.map((btn) => {
          const borderColor = fitzgeraldColor(resolvePartOfSpeech(btn));
          const highlighted = isHighlighted(btn);
          return (
            <Pressable
              key={btn.id as string}
              accessibilityRole="button"
              accessibilityLabel={buttonLabel(btn)}
              accessibilityState={{ selected: highlighted }}
              onPress={() => {
                if (switchScanEnabled) {
                  if (highlighted) activate(btn);
                  return;
                }
                activate(btn);
              }}
              style={[
                styles.cell,
                { borderColor: highlighted ? '#60a5fa' : borderColor },
                highlighted ? styles.cellHighlighted : null,
              ]}
            >
              <Text style={styles.cellLabel}>{buttonLabel(btn)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: { color: '#f5f5f5', fontSize: 18, fontWeight: '700' },
  meta: { color: '#a3a3a3', fontSize: 12 },
  utterance: {
    flexGrow: 1,
    minWidth: 160,
    color: '#f5f5f5',
    backgroundColor: '#171717',
    padding: 10,
    borderRadius: 8,
  },
  headerBtn: {
    backgroundColor: '#2563eb',
    minWidth: TARGET,
    minHeight: TARGET,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  headerBtnSecondary: {
    backgroundColor: '#262626',
    minHeight: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#404040',
  },
  headerBtnText: { color: '#fff', fontWeight: '600' },
  banner: { color: '#fcd34d', padding: 8, paddingHorizontal: 12, fontSize: 13 },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#422006',
  },
  offlineRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
  },
  offlineText: { color: '#93c5fd', fontSize: 13 },
  pendingText: { flex: 1, color: '#fde68a', fontSize: 13 },
  retryBtn: {
    backgroundColor: '#78350f',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  switchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#172554',
  },
  switchMeta: { flex: 1, color: '#bfdbfe', fontSize: 13 },
  switchBtn: {
    backgroundColor: '#262626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#404040',
  },
  switchBtnPrimary: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  switchBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
    justifyContent: 'center',
  },
  cell: {
    width: TARGET * 2.2,
    minHeight: TARGET * 1.4,
    borderWidth: 3,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#111',
  },
  cellHighlighted: {
    backgroundColor: '#1e3a8a',
  },
  cellLabel: { color: '#f5f5f5', fontWeight: '600', textAlign: 'center' },
});
