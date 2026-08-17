import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'app_settings_v1';

export interface AppSettings {
  countryCode: string;
  region: string;
  cityName: string;
  latitude: number | null;
  longitude: number | null;
  biometricLockEnabled: boolean;
  vacationAllowance: number;
  vacationUsed: number;
  sickAllowance: number;
  sickUsed: number;
  timeOffYear: number;
}

export async function loadSettings(): Promise<Partial<AppSettings>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = await loadSettings();
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
}
