'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

const LOCALE_FLAGS: Record<Locale, string> = {
  fr: '\u{1f1eb}\u{1f1f7}',
  en: '\u{1f1ec}\u{1f1e7}',
  pt: '\u{1f1f5}\u{1f1f9}',
  es: '\u{1f1ea}\u{1f1f8}',
};

const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'FR',
  en: 'EN',
  pt: 'PT',
  es: 'ES',
};

export function LanguageSwitcher() {
  const { locale, setLocale, localeNames, availableLocales } = useTranslation();

  return (
    <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
      <SelectTrigger
        className="h-8 w-auto min-w-[72px] gap-1.5 border-border/60 bg-muted/40 px-2.5 text-xs font-medium focus:ring-1 focus:ring-ring/20"
        aria-label="Select language"
      >
        <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <SelectValue>
          <span className="flex items-center gap-1.5">
            <span className="text-sm leading-none">{LOCALE_FLAGS[locale]}</span>
            <span className="hidden sm:inline text-muted-foreground">
              {localeNames[locale]}
            </span>
            <span className="sm:hidden text-muted-foreground font-semibold">
              {LOCALE_LABELS[locale]}
            </span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end" className="w-48">
        {availableLocales.map((loc) => (
          <SelectItem key={loc} value={loc} className="gap-2 py-2">
            <span className="text-base leading-none mr-1">{LOCALE_FLAGS[loc]}</span>
            <span className="flex-1 text-sm">{localeNames[loc]}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default LanguageSwitcher;
