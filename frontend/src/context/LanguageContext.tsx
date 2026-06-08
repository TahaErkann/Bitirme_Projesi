/**
 * LanguageContext — uygulama dilini AsyncStorage'da saklar; t() ile birlikte
 * UI metinlerini canlı günceller. Auth kullanıcısı varsa giriş yapıldığında
 * `user.preferred_language` ile senkronize edilir.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {LanguageCode, LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES} from '@/utils/constants';
import {t as translate} from '@/utils/i18n';

interface LanguageContextValue {
  lang: LanguageCode;
  setLang: (l: LanguageCode) => Promise<void>;
  t: (key: string) => string;
  ready: boolean;
}

const DEFAULT_LANG: LanguageCode = 'tr';

const LanguageContext = createContext<LanguageContextValue>({
  lang: DEFAULT_LANG,
  setLang: async () => undefined,
  t: (k: string) => translate(k, DEFAULT_LANG),
  ready: false,
});

const SUPPORTED_CODES = new Set(SUPPORTED_LANGUAGES.map(l => l.code));

export const LanguageProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [lang, setLangState] = useState<LanguageCode>(DEFAULT_LANG);
  const [ready, setReady] = useState(false);

  // İlk açılışta AsyncStorage'dan oku
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (stored && SUPPORTED_CODES.has(stored as LanguageCode)) {
          setLangState(stored as LanguageCode);
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setLang = useCallback(async (l: LanguageCode) => {
    setLangState(l);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, l);
    } catch {
      // sessizce yut — yine de in-memory dil değişti
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang,
      t: (key: string) => translate(key, lang),
      ready,
    }),
    [lang, setLang, ready],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
