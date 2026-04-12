'use client';

import React, { createContext, useContext, useCallback, useSyncExternalStore } from 'react';
import { translations, type Locale, AVAILABLE_LOCALES, LOCALE_NAMES } from './translations';

export type { Locale } from './translations';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  availableLocales: Locale[];
  localeNames: Record<Locale, string>;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'fr';
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('fr')) return 'fr';
  if (lang.startsWith('pt')) return 'pt';
  if (lang.startsWith('es')) return 'es';
  return 'en';
}

function getInitialLocale(): Locale {
  if (typeof localStorage === 'undefined') return detectBrowserLocale();
  const stored = localStorage.getItem('smartticket-lang');
  if (stored && AVAILABLE_LOCALES.includes(stored as Locale)) return stored as Locale;
  return detectBrowserLocale();
}

// Simple external store for locale so we can use useSyncExternalStore
let currentLocale: Locale | null = null;
const localeListeners = new Set<() => void>();

function subscribeLocale(callback: () => void) {
  localeListeners.add(callback);
  return () => localeListeners.delete(callback);
}

function getLocaleSnapshot(): Locale {
  if (currentLocale === null) {
    currentLocale = getInitialLocale();
  }
  return currentLocale;
}

function setLocaleSnapshot(newLocale: Locale) {
  currentLocale = newLocale;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('smartticket-lang', newLocale);
  }
  // Also set a cookie so server-side can read it
  if (typeof document !== 'undefined') {
    document.cookie = `smartticket-lang=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
  }
  localeListeners.forEach((listener) => listener());
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, () => 'fr' as Locale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleSnapshot(newLocale);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const translationsMap = translations[locale] || translations.fr;
      let text = translationsMap[key] || translations.fr[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, String(v));
        });
      }
      return text;
    },
    [locale]
  );

  return (
    <I18nContext.Provider
      value={{ locale, setLocale, t, availableLocales: AVAILABLE_LOCALES, localeNames: LOCALE_NAMES }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used within I18nProvider');
  return context;
}

// Server-side translation helper (can be used in API routes or server components)
export function t(key: string, locale?: Locale, params?: Record<string, string | number>): string {
  const loc = locale || 'fr';
  const translationsMap = translations[loc] || translations.fr;
  let text = translationsMap[key] || translations.fr[key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  return text;
}
