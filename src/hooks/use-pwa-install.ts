'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface UsePwaInstallReturn {
  canInstall: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<boolean>;
}

export function usePwaInstall(): UsePwaInstallReturn {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);

  // Check if already installed (standalone mode) — computed from window
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true);

  const isInstalled = isStandalone || installed;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone) return;

    // Capture the beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      // Prevent the default mini-infobar on mobile
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setInstalled(true);
      setCanInstall(false);
      deferredPrompt.current = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isStandalone]);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt.current) return false;

    try {
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;

      if (outcome === 'accepted') {
        setInstalled(true);
        setCanInstall(false);
      }

      deferredPrompt.current = null;
      return outcome === 'accepted';
    } catch {
      return false;
    }
  }, []);

  return { canInstall, isInstalled, promptInstall };
}
