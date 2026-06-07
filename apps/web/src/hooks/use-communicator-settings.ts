'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_COMMUNICATOR_SETTINGS,
  loadCommunicatorSettings,
  saveCommunicatorSettings,
  type CommunicatorSettings,
} from '@/lib/communicator-settings';

export function useCommunicatorSettings() {
  const [settings, setSettingsState] = useState<CommunicatorSettings>(DEFAULT_COMMUNICATOR_SETTINGS);

  useEffect(() => {
    setSettingsState(loadCommunicatorSettings());
  }, []);

  const setSettings = useCallback((patch: Partial<CommunicatorSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveCommunicatorSettings(next);
      return next;
    });
  }, []);

  return { settings, setSettings };
}
