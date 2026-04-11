'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, X, CreditCard, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { useAppStore } from '@/store/app-store';

interface SubscriptionStatus {
  plan: string;
  status: string;
  trialEndsAt: string | null;
  usage: {
    eventsUsed: number;
    eventsLimit: number;
    ticketsThisMonth: number;
    ticketsLimit: number;
  };
}

type BannerType = 'expired' | 'trial' | 'limit' | null;

const DISMISS_KEY = 'smart-ticket-subscription-banner-dismissed';

function checkDismissal(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (stored) {
      const { timestamp } = JSON.parse(stored);
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        return true;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return false;
}

function getFallbackStatus(): SubscriptionStatus | null {
  const org = useOrgStore.getState().currentOrganization;
  if (org) {
    return {
      plan: org.subscriptionPlan,
      status: org.subscriptionStatus,
      trialEndsAt: null,
      usage: { eventsUsed: 0, eventsLimit: 5, ticketsThisMonth: 0, ticketsLimit: 500 },
    };
  }
  return null;
}

export default function SubscriptionBanner() {
  const [bannerType, setBannerType] = useState<BannerType>(null);
  const [visible, setVisible] = useState(true);
  const [dismissed, setDismissed] = useState(checkDismissal);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [usagePercent, setUsagePercent] = useState<number>(0);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const token = useAuthStore((s) => s.token);
  const currentOrg = useOrgStore((s) => s.currentOrganization);

  const evaluateStatus = useCallback((data: SubscriptionStatus) => {
    if (data.status === 'expired') {
      setBannerType('expired');
    } else if (data.status === 'trial' && data.trialEndsAt) {
      const days = Math.max(0, Math.ceil((new Date(data.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      setTrialDaysLeft(days);
      if (days <= 7) {
        setBannerType('trial');
      }
    }

    const { eventsLimit, ticketsThisMonth, ticketsLimit } = data.usage;
    const effectiveLimit = ticketsLimit || eventsLimit * 500;
    const pct = effectiveLimit > 0 ? (ticketsThisMonth / effectiveLimit) * 100 : 0;
    setUsagePercent(Math.round(pct));

    if (pct > 80) {
      setBannerType('limit');
    }
  }, []);

  useEffect(() => {
    if (!token || dismissed) return;

    async function fetchSubscription() {
      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': currentOrg?.id || '',
        };
        const res = await fetch('/api/subscriptions', { headers });
        if (!res.ok) {
          const fallback = getFallbackStatus();
          if (fallback) evaluateStatus(fallback);
          return;
        }
        const data = await res.json();
        evaluateStatus(data);
      } catch {
        const fallback = getFallbackStatus();
        if (fallback) evaluateStatus(fallback);
      }
    }

    fetchSubscription();
  }, [token, currentOrg?.id, dismissed, evaluateStatus]);

  function handleDismiss() {
    setVisible(false);
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify({ timestamp: Date.now() }));
    } catch {
      // Ignore storage errors
    }
  }

  function handleUpgrade() {
    setCurrentPage('billing');
  }

  if (dismissed || !bannerType || !visible) return null;

  const bannerConfig = {
    expired: {
      bg: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
      icon: <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />,
      title: 'Abonnement expiré',
      description: 'Mettez à niveau maintenant pour continuer.',
      buttonClass: 'bg-red-600 hover:bg-red-700 text-white',
    },
    trial: {
      bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800',
      icon: <Clock className="h-4 w-4 text-yellow-500 shrink-0" />,
      title: `Votre essai expire dans ${trialDaysLeft} jour${(trialDaysLeft ?? 0) > 1 ? 's' : ''}`,
      description: 'Passez à un plan payant pour ne rien perdre.',
      buttonClass: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    },
    limit: {
      bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
      icon: <TrendingUp className="h-4 w-4 text-amber-500 shrink-0" />,
      title: `Vous avez utilisé ${usagePercent}% de votre limite de tickets`,
      description: 'Envisagez de mettre à niveau votre plan.',
      buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
  };

  const config = bannerConfig[bannerType];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={`flex items-center gap-3 rounded-lg border px-4 py-3 mb-4 ${config.bg}`}
      >
        {config.icon}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{config.title}</p>
          <p className="text-xs opacity-80 hidden sm:block">{config.description}</p>
        </div>
        <Button size="sm" className={config.buttonClass} onClick={handleUpgrade}>
          <CreditCard className="h-3.5 w-3.5 mr-1.5" />
          Mettre à niveau
        </Button>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
