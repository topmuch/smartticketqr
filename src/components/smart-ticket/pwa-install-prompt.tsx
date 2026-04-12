'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone } from 'lucide-react';
import { usePwaInstall } from '@/hooks/use-pwa-install';

const DISMISS_KEY = 'smartticketqr-pwa-dismissed';

function getInitialDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  const wasDismissed = localStorage.getItem(DISMISS_KEY);
  if (!wasDismissed) return false;
  const dismissedAt = parseInt(wasDismissed, 10);
  const isExpired = Date.now() - dismissedAt > 7 * 24 * 60 * 60 * 1000;
  if (isExpired) {
    localStorage.removeItem(DISMISS_KEY);
    return false;
  }
  return true;
}

export function PwaInstallPrompt() {
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(getInitialDismissed);
  const animTriggered = useRef(false);
  const [installing, setInstalling] = useState(false);

  // Banner becomes visible after a short delay when conditions are met
  const shouldShow = canInstall && !dismissed && !isInstalled;

  useEffect(() => {
    if (shouldShow && !animTriggered.current) {
      animTriggered.current = true;
      const timer = setTimeout(() => {
        // DOM manipulation to trigger animation — not setState
        const el = document.getElementById('pwa-install-banner');
        if (el) {
          el.style.transform = 'translateY(0)';
          el.style.opacity = '1';
        }
      }, 500);
      return () => {
        clearTimeout(timer);
        animTriggered.current = false;
      };
    }
  }, [shouldShow]);

  const handleInstall = async () => {
    setInstalling(true);
    const accepted = await promptInstall();
    setInstalling(false);
    if (!accepted) {
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  if (!shouldShow) return null;

  return (
    <div
      id="pwa-install-banner"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 transition-all duration-500 ease-out translate-y-full opacity-0"
    >
      <div className="mx-auto max-w-md rounded-xl border bg-white p-4 shadow-lg sm:p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#007BFF]/10">
            <Smartphone className="h-6 w-6 text-[#007BFF]" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">
              Installer SmartTicketQR
            </h3>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">
              Ajoutez l&apos;application à votre écran d&apos;accueil pour un accès rapide et une utilisation hors connexion.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleInstall}
                disabled={installing}
                className="bg-[#007BFF] hover:bg-[#0056b3] text-white h-8 text-xs gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                {installing ? 'Installation...' : 'Installer'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-8 text-xs text-gray-500 hover:text-gray-700"
              >
                Plus tard
              </Button>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
