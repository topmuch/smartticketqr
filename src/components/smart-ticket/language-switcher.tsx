'use client';

import React from 'react';
import { Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

const LOCALE_FLAGS: Record<Locale, string> = {
  fr: '\u{1f1eb}\u{1f1f7}',
  en: '\u{1f1ec}\u{1f1e7}',
  pt: '\u{1f1f5}\u{1f1f9}',
  es: '\u{1f1ea}\u{1f1f8}',
};

export function LanguageSwitcher() {
  const { locale, setLocale, localeNames, availableLocales } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <span className="text-sm leading-none">{LOCALE_FLAGS[locale]}</span>
          <span className="hidden sm:inline">{localeNames[locale]}</span>
          <Globe className="h-3.5 w-3.5 sm:hidden" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {availableLocales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => setLocale(loc)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span className="text-base leading-none">{LOCALE_FLAGS[loc]}</span>
            <span className="flex-1 text-sm">{localeNames[loc]}</span>
            {locale === loc && (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSwitcher;
