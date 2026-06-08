/**
 * Uygulama-genel sabitler.
 */
import Config from 'react-native-config';

export const API_BASE_URL: string =
  Config.API_BASE_URL ?? 'http://10.0.2.2:8000/api/v1';

// Master prompt § 6.5: 12 desteklenen dil — etiketler Latin alfabesinde
// (TR'de okunduğunda da anlamlı olsun diye Türkçe isimleri kullandık).
export const SUPPORTED_LANGUAGES = [
  {code: 'tr', label: 'Türkçe'},
  {code: 'en', label: 'English'},
  {code: 'de', label: 'Almanca'},
  {code: 'fr', label: 'Fransızca'},
  {code: 'es', label: 'İspanyolca'},
  {code: 'ar', label: 'Arapça'},
  {code: 'ru', label: 'Rusça'},
  {code: 'zh', label: 'Çince'},
  {code: 'ja', label: 'Japonca'},
  {code: 'ko', label: 'Korece'},
  {code: 'pt', label: 'Portekizce'},
  {code: 'it', label: 'İtalyanca'},
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

// JWT secure storage anahtarları
export const KEYCHAIN_SERVICE = 'tourlens.auth';

// Tercih edilen dil için AsyncStorage anahtarı
export const LANGUAGE_STORAGE_KEY = 'tourlens.language';

// Polling
export const UPLOAD_POLL_INTERVAL_MS = 1500;
export const UPLOAD_POLL_MAX_ATTEMPTS = 60; // ~90 saniye

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
