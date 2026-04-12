'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { I18nProvider } from '@/lib/i18n';
import { useServiceWorker } from '@/hooks/use-service-worker';
import PwaInstallPrompt from '@/components/smart-ticket/pwa-install-prompt';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
          },
        },
      }),
  );

  // Register service worker for PWA support
  useServiceWorker();

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <PwaInstallPrompt />
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
