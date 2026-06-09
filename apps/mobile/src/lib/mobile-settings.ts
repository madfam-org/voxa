import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanOrder, SwitchGroupStrategy } from '@voxa/access';

const SETTINGS_KEY = 'voxa-mobile-communicator-settings';

export interface MobileCommunicatorSettings {
  accessMode: 'touch' | 'switch';
  switchIntervalMs: number;
  switchOrder: ScanOrder;
  switchGroupStrategy: SwitchGroupStrategy;
  auditoryScanHighlight: boolean;
  auditoryScanVoice: boolean;
}

const DEFAULTS: MobileCommunicatorSettings = {
  accessMode: 'touch',
  switchIntervalMs: 1200,
  switchOrder: 'row-major',
  switchGroupStrategy: 'none',
  auditoryScanHighlight: true,
  auditoryScanVoice: false,
};

export function parseMobileSettings(raw: string | null): MobileCommunicatorSettings {
  if (!raw) return DEFAULTS;
  try {
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<MobileCommunicatorSettings>) };
  } catch {
    return DEFAULTS;
  }
}

export async function loadMobileSettings(): Promise<MobileCommunicatorSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return parseMobileSettings(raw);
  } catch {
    return DEFAULTS;
  }
}

export async function saveMobileSettings(settings: MobileCommunicatorSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
