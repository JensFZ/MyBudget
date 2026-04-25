'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { locales, translations, Lang } from '@/lib/translations';
import type { TranslationSet } from '@/lib/translations';

export type { Lang };

const DEFAULT_LANG: Lang = 'de';
const STORAGE_KEY = 'mybudget_lang';

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string>) => string;
  tMonthShort: (index: number) => string;
  tMonthLong: (index: number) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

function interpolate(str: string, vars?: Record<string, string>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (stored && stored in locales) {
        setLangState(stored);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  function setLang(newLang: Lang) {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {
      // ignore
    }
  }

  const dict: TranslationSet = translations[lang];

  function t(key: string, vars?: Record<string, string>): string {
    const val = dict[key];
    if (typeof val === 'string') return interpolate(val, vars);
    // fallback to English
    const fallback = translations['en'][key];
    if (typeof fallback === 'string') return interpolate(fallback, vars);
    return key;
  }

  function tMonthShort(index: number): string {
    const arr = dict.months_short;
    if (Array.isArray(arr)) return arr[index] ?? String(index + 1);
    return String(index + 1);
  }

  function tMonthLong(index: number): string {
    const arr = dict.months_long;
    if (Array.isArray(arr)) return arr[index] ?? String(index + 1);
    return String(index + 1);
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t, tMonthShort, tMonthLong }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
