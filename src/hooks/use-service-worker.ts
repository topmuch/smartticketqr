'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseServiceWorkerReturn {
  isRegistered: boolean;
  needRefresh: boolean;
  updateServiceWorker: () => Promise<void>;
}

export function useServiceWorker(): UseServiceWorkerReturn {
  const [isRegistered, setIsRegistered] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    let reg: ServiceWorkerRegistration;

    const registerSW = async () => {
      try {
        reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        setRegistration(reg);
        setIsRegistered(true);
      } catch (error) {
        console.error('[SW] Registration failed:', error);
      }
    };

    registerSW();

    // Listen for controller change (new SW took control)
    const handleControllerChange = () => {
      // Reload the page once the new service worker takes control
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  useEffect(() => {
    if (!registration) return;

    // Check for updates periodically
    const interval = setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000); // every hour

    // Listen for the updatefound event
    const handleUpdateFound = () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          // A new service worker is installed, but waiting
          if (navigator.serviceWorker.controller) {
            // We already have a controller, so this is an update
            setNeedRefresh(true);
          }
          // Otherwise, it's the first install — no refresh needed
        }
      });
    };

    registration.addEventListener('updatefound', handleUpdateFound);

    return () => {
      clearInterval(interval);
      registration.removeEventListener('updatefound', handleUpdateFound);
    };
  }, [registration]);

  const updateServiceWorker = useCallback(async () => {
    if (!registration?.waiting) return;

    // Send SKIP_WAITING message to the waiting SW
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // The controllerchange listener will trigger the reload
  }, [registration]);

  return { isRegistered, needRefresh, updateServiceWorker };
}
