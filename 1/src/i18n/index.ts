import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from './translations';

const LANGUAGE_STORAGE_KEY = 'app_language_v1';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'bg', label: 'Български' },
  { code: 'ru', label: 'Русский' },
];

const resources = Object.fromEntries(
  Object.entries(translations).map(([code, strings]) => [code, { translation: strings }])
);

function detectDeviceLanguage(): string {
  const deviceLang = Localization.getLocales()[0]?.languageCode || 'en';
  return SUPPORTED_LANGUAGES.some(l => l.code === deviceLang) ? deviceLang : 'en';
}

// Initialize synchronously with the device's language as a sensible default
// — resources are already bundled in the app, so there's no network wait,
// and this means translated text is correct from the very first render.
i18n.use(initReactI18next).init({
  resources,
  lng: detectDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Then check for a saved preference (from a previous manual language
// change) and apply it if it differs from the device-detected default.
AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then(saved => {
  if (saved && saved !== i18n.language) {
    i18n.changeLanguage(saved);
  }
});

export async function setAppLanguage(code: string) {
  await i18n.changeLanguage(code);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
}

export default i18n;
