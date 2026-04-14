'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Check,
  CreditCard,
  AlertTriangle,
  Clock,
  Loader2,
  Star,
  Zap,
  Crown,
  X,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import RoleGate from '@/components/smart-ticket/role-gate';

// ── Types ───────────────────────────────────────────────────────────────────

interface UsageData {
  eventsUsed: number;
  eventsLimit: number;
  usersUsed: number;
  usersLimit: number;
  ticketsThisMonth: number;
  ticketsLimit: number;
}

interface SubscriptionInfo {
  plan: string;
  status: string;
  startDate: string;
  endDate: string | null;
  trialEndsAt: string | null;
  usage: UsageData;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  eventsLimit: number;
  ticketsPerEvent: number;
  usersLimit: number;
  features: string[];
}

interface SubscriptionRecord {
  id: string;
  plan: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
}

type PaymentMethod = 'wave' | 'orange_money' | 'manual';
type DurationMonths = 1 | 3 | 12;

// ── Constants ───────────────────────────────────────────────────────────────

const PLAN_ORDER = ['starter', 'pro', 'enterprise'] as const;

const PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 5000,
    eventsLimit: 5,
    ticketsPerEvent: 500,
    usersLimit: 3,
    features: [
      '5 events max',
      '500 tickets par événement',
      '3 utilisateurs',
      'QR Scanner basique',
      'Export CSV',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 25000,
    eventsLimit: 50,
    ticketsPerEvent: 5000,
    usersLimit: 20,
    features: [
      '50 événements max',
      '5 000 tickets par événement',
      '20 utilisateurs',
      'QR Scanner avancé',
      'Export PDF & CSV',
      'Analytics détaillés',
      'Support prioritaire',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99000,
    eventsLimit: -1,
    ticketsPerEvent: -1,
    usersLimit: -1,
    features: [
      'Événements illimités',
      'Tickets illimités',
      'Utilisateurs illimités',
      'Toutes les fonctionnalités',
      'API complète',
      'Support dédié 24/7',
      'Marque blanche',
      'SLA garanti',
    ],
  },
];

const DURATION_OPTIONS: { months: DurationMonths; label: string; discount: number }[] = [
  { months: 1, label: '1 mois', discount: 0 },
  { months: 3, label: '3 mois', discount: 10 },
  { months: 12, label: '12 mois', discount: 20 },
];

const PAYMENT_METHODS: { id: PaymentMethod; label: string; iconBg: string; iconText: string }[] = [
  { id: 'wave', label: 'Wave (Sénégal)', iconBg: 'bg-blue-500', iconText: 'W' },
  { id: 'orange_money', label: 'Orange Money', iconBg: 'bg-orange-500', iconText: 'OM' },
  { id: 'manual', label: 'Manuel (Espèces/Virement)', iconBg: 'bg-gray-500', iconText: '$' },
];

const barChartConfig: ChartConfig = {
  tickets: { label: 'Tickets', color: 'hsl(var(--chart-1))' },
};

const pieChartConfig: ChartConfig = {
  used: { label: 'Utilisé', color: 'hsl(var(--chart-1))' },
  remaining: { label: 'Restant', color: 'hsl(var(--chart-2))' },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('XOF', 'FCFA');
}

function formatFCFAShort(amount: number): string {
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}K FCFA`;
  }
  return `${amount} FCFA`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">Actif</Badge>;
    case 'trial':
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800">Essai</Badge>;
    case 'expired':
      return <Badge variant="destructive">Expiré</Badge>;
    case 'cancelled':
      return <Badge variant="secondary">Annulé</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getPaymentMethodBadge(method: string) {
  const m = PAYMENT_METHODS.find((p) => p.id === method);
  if (m) {
    return (
      <span className="flex items-center gap-1.5 text-xs">
        <span className={cn('inline-flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-bold text-white', m.iconBg)}>
          {m.iconText}
        </span>
        {m.label}
      </span>
    );
  }
  return <span className="text-xs">{method}</span>;
}

function getPlanIcon(planId: string, className?: string) {
  const cls = className || 'h-5 w-5';
  switch (planId) {
    case 'pro':
      return <Zap className={cn(cls, 'text-emerald-500')} />;
    case 'enterprise':
      return <Crown className={cn(cls, 'text-amber-500')} />;
    default:
      return <Star className={cn(cls, 'text-gray-500')} />;
  }
}

function getPlanBorderColor(planId: string, isCurrent: boolean) {
  if (isCurrent) return '';
  switch (planId) {
    case 'pro':
      return 'border-emerald-400 dark:border-emerald-600';
    case 'enterprise':
      return 'border-amber-400 dark:border-amber-600';
    default:
      return 'border-border';
  }
}

function getPlanBgColor(planId: string) {
  switch (planId) {
    case 'pro':
      return 'bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/20 dark:to-card';
    case 'enterprise':
      return 'bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/20 dark:to-card';
    default:
      return '';
  }
}

// ── API helper ──────────────────────────────────────────────────────────────

function getApiHeaders() {
  const token = useAuthStore.getState().token;
  const orgId = useOrgStore.getState().currentOrganization?.id;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Organization-Id': orgId || '',
  };
}

// ── Component ───────────────────────────────────────────────────────────────

export default function BillingPage() {
  const queryClient = useQueryClient();
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const currentPlan = useOrgStore((s) => s.currentOrganization?.subscriptionPlan);

  // Payment dialog state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wave');
  const [duration, setDuration] = useState<DurationMonths>(1);

  // Fetch subscription info
  const { data: subscription, isLoading: subLoading } = useQuery<SubscriptionInfo>({
    queryKey: ['subscription'],
    queryFn: async () => {
      const res = await fetch('/api/subscriptions', {
        headers: getApiHeaders(),
      });
      if (!res.ok) {
        // Fallback to org store data
        const org = useOrgStore.getState().currentOrganization;
        return {
          plan: org?.subscriptionPlan || 'starter',
          status: org?.subscriptionStatus || 'trial',
          startDate: org?.createdAt || new Date().toISOString(),
          endDate: null,
          trialEndsAt: null,
          usage: {
            eventsUsed: 0,
            eventsLimit: 5,
            usersUsed: 0,
            usersLimit: 3,
            ticketsThisMonth: 0,
            ticketsLimit: 500,
          },
        } as SubscriptionInfo;
      }
      return res.json();
    },
    placeholderData: (prev) => prev,
  });

  // Fetch plans
  const { data: plans } = useQuery<SubscriptionPlan[]>({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/subscription-plans', {
          headers: getApiHeaders(),
        });
        if (!res.ok) return PLANS;
        const json = await res.json();
        // API returns { plans: [...] } with field names: code, priceMonthly, maxEvents, etc.
        // Normalize to match SubscriptionPlan interface: id, price, eventsLimit, etc.
        const rawPlans = Array.isArray(json) ? json : (json.plans || json.data || PLANS);
        if (!Array.isArray(rawPlans)) return PLANS;
        return rawPlans.map((p: Record<string, unknown>) => ({
          id: String(p.code || p.id || ''),
          name: String(p.name || ''),
          price: Number(p.priceMonthly ?? p.price ?? 0),
          eventsLimit: Number(p.maxEvents ?? p.eventsLimit ?? 0),
          ticketsPerEvent: Number(p.maxTicketsPerEvent ?? p.ticketsPerEvent ?? 0),
          usersLimit: Number(p.maxUsers ?? p.usersLimit ?? 0),
          features: Array.isArray(p.features) ? p.features : [],
        })) as SubscriptionPlan[];
      } catch {
        return PLANS;
      }
    },
  });

  // Fetch history
  const { data: history, isLoading: histLoading } = useQuery<SubscriptionRecord[]>({
    queryKey: ['subscription-history'],
    queryFn: async () => {
      const res = await fetch('/api/subscriptions?view=history', {
        headers: getApiHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.data || [];
    },
  });

  // Create subscription mutation
  const subscribeMutation = useMutation({
    mutationFn: async (body: { plan: string; paymentMethod: string; durationMonths: number }) => {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create subscription');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Abonnement activé avec succès !');
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-history'] });
      setShowPaymentDialog(false);
      setSelectedPlan(null);
    },
    onError: (error) => {
      toast.error('Échec de l\'abonnement', { description: error.message });
    },
  });

  // Simulate payment mutation
  const simulatePaymentMutation = useMutation({
    mutationFn: async (body: { plan: string; paymentMethod: string; durationMonths: number }) => {
      const res = await fetch('/api/webhooks/payment/simulate', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Simulation failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Paiement simulé avec succès !');
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-history'] });
      setShowPaymentDialog(false);
      setSelectedPlan(null);
    },
    onError: (error) => {
      toast.error('Simulation échouée', { description: error.message });
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────

  const activePlans = Array.isArray(plans) && plans.length > 0 ? plans : PLANS;
  const currentPlanId = subscription?.plan || currentPlan || 'starter';
  const currentIndex = PLAN_ORDER.indexOf(currentPlanId as typeof PLAN_ORDER[number]);

  function handleSelectPlan(plan: SubscriptionPlan) {
    setSelectedPlan(plan);
    setPaymentMethod('wave');
    setDuration(1);
    setShowPaymentDialog(true);
  }

  function handlePayment() {
    if (!selectedPlan) return;
    subscribeMutation.mutate({
      plan: selectedPlan.id,
      paymentMethod,
      durationMonths: duration,
    });
  }

  function handleSimulatePayment() {
    if (!selectedPlan) return;
    simulatePaymentMutation.mutate({
      plan: selectedPlan.id,
      paymentMethod,
      durationMonths: duration,
    });
  }

  // ── Computed values ─────────────────────────────────────────────────────

  const usage = subscription?.usage;
  const eventsPercent = usage ? Math.min((usage.eventsUsed / (usage.eventsLimit || 1)) * 100, 100) : 0;
  const usersPercent = usage ? Math.min((usage.usersUsed / (usage.usersLimit || 1)) * 100, 100) : 0;
  const ticketsPercent = usage ? Math.min((usage.ticketsThisMonth / (usage.ticketsLimit || 1)) * 100, 100) : 0;

  const isExpired = subscription?.status === 'expired';
  const isTrial = subscription?.status === 'trial';
  const trialDaysLeft = isTrial && subscription?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const selectedDurationOption = DURATION_OPTIONS.find((d) => d.months === duration);
  const totalWithDiscount = selectedPlan
    ? Math.round(selectedPlan.price * duration * (1 - (selectedDurationOption?.discount || 0) / 100))
    : 0;

  // Mock monthly ticket data for chart
  const monthlyTicketData = useMemo(() => [
    { month: 'Jan', tickets: 120 },
    { month: 'Fév', tickets: 190 },
    { month: 'Mar', tickets: 150 },
    { month: 'Avr', tickets: 280 },
    { month: 'Mai', tickets: 220 },
    { month: 'Jun', tickets: 350 },
  ], []);

  const usagePieData = useMemo(() => {
    if (!usage) return [];
    const used = usage.eventsUsed;
    const limit = usage.eventsLimit || 1;
    return [
      { name: 'used', value: used },
      { name: 'remaining', value: Math.max(0, limit - used) },
    ];
  }, [usage]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <RoleGate permission="settings.edit" redirectTo="dashboard">
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2">
            <CreditCard className="h-7 w-7 text-emerald-500" />
            Facturation & Abonnements
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gérez votre abonnement et vos méthodes de paiement
          </p>
        </div>
      </div>

      {/* ── Alert Banners ───────────────────────────────────────────────── */}
      {isExpired && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Votre abonnement a expiré</p>
              <p className="text-xs text-red-600 dark:text-red-400">Mettez à niveau pour continuer à utiliser SmartTicketQR.</p>
            </div>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                const proPlan = activePlans.find((p) => p.id === 'pro');
                if (proPlan) handleSelectPlan(proPlan);
              }}
            >
              Mettre à niveau
            </Button>
          </CardContent>
        </Card>
      )}

      {isTrial && trialDaysLeft !== null && trialDaysLeft <= 7 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30">
          <CardContent className="flex items-center gap-3 py-4">
            <Clock className="h-5 w-5 text-yellow-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Votre essai expire dans {trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">Passez à un plan payant pour ne rien perdre.</p>
            </div>
            <Button
              size="sm"
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
              onClick={() => {
                const proPlan = activePlans.find((p) => p.id === 'pro');
                if (proPlan) handleSelectPlan(proPlan);
              }}
            >
              Mettre à niveau
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Current Plan Card ───────────────────────────────────────────── */}
      {subLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {getPlanIcon(currentPlanId, 'h-8 w-8')}
                <div>
                  <CardTitle className="text-xl capitalize">
                    Plan {PLANS.find((p) => p.id === currentPlanId)?.name || currentPlanId}
                  </CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-2">
                    {getStatusBadge(subscription?.status || 'trial')}
                    {subscription?.endDate && (
                      <span className="text-xs text-muted-foreground">
                        Expire le {format(new Date(subscription.endDate), 'd MMM yyyy')}
                      </span>
                    )}
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage('billing')}
                className="hidden sm:flex"
              >
                Gérer l&apos;abonnement
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Events usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Événements</span>
                  <span className="font-medium">
                    {usage?.eventsUsed ?? 0} / {usage?.eventsLimit === -1 ? '∞' : usage?.eventsLimit ?? '-'}
                  </span>
                </div>
                <Progress
                  value={usage?.eventsLimit === -1 ? 10 : eventsPercent}
                  className={cn(
                    'h-2',
                    eventsPercent > 80 && 'text-amber-500 [&>div]:bg-amber-500',
                    eventsPercent > 95 && 'text-red-500 [&>div]:bg-red-500'
                  )}
                />
              </div>
              {/* Users usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Utilisateurs</span>
                  <span className="font-medium">
                    {usage?.usersUsed ?? 0} / {usage?.usersLimit === -1 ? '∞' : usage?.usersLimit ?? '-'}
                  </span>
                </div>
                <Progress
                  value={usage?.usersLimit === -1 ? 10 : usersPercent}
                  className={cn(
                    'h-2',
                    usersPercent > 80 && 'text-amber-500 [&>div]:bg-amber-500',
                    usersPercent > 95 && 'text-red-500 [&>div]:bg-red-500'
                  )}
                />
              </div>
              {/* Tickets usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tickets ce mois</span>
                  <span className="font-medium">
                    {usage?.ticketsThisMonth?.toLocaleString('fr-FR') ?? 0} / {usage?.ticketsLimit === -1 ? '∞' : usage?.ticketsLimit?.toLocaleString('fr-FR') ?? '-'}
                  </span>
                </div>
                <Progress
                  value={usage?.ticketsLimit === -1 ? 10 : ticketsPercent}
                  className={cn(
                    'h-2',
                    ticketsPercent > 80 && 'text-amber-500 [&>div]:bg-amber-500',
                    ticketsPercent > 95 && 'text-red-500 [&>div]:bg-red-500'
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Plan Comparison Cards ───────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Choisir un plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          {activePlans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const planIndex = PLAN_ORDER.indexOf(plan.id as typeof PLAN_ORDER[number]);
            const isUpgrade = planIndex > currentIndex;
            const isPro = plan.id === 'pro';
            const isEnterprise = plan.id === 'enterprise';

            return (
              <motion.div
                key={plan.id}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="relative"
              >
                {/* Badges */}
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-emerald-600 text-white px-3 py-0.5 text-xs shadow-sm">
                      <Zap className="h-3 w-3 mr-1" />
                      Le plus populaire
                    </Badge>
                  </div>
                )}
                {isEnterprise && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-amber-500 text-white px-3 py-0.5 text-xs shadow-sm">
                      <Crown className="h-3 w-3 mr-1" />
                      Meilleur rapport
                    </Badge>
                  </div>
                )}

                <Card
                  className={cn(
                    'relative overflow-hidden transition-shadow hover:shadow-lg',
                    getPlanBorderColor(plan.id, isCurrent),
                    getPlanBgColor(plan.id),
                    isCurrent && 'ring-2 ring-emerald-500/50'
                  )}
                >
                  {isCurrent && (
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 text-xs">
                        Plan actuel
                      </Badge>
                    </div>
                  )}
                  <CardContent className="pt-6 p-6">
                    {/* Plan header */}
                    <div className="text-center mb-6">
                      <div className="flex justify-center mb-3">
                        {getPlanIcon(plan.id, 'h-10 w-10')}
                      </div>
                      <h3 className="text-xl font-bold">{plan.name}</h3>
                      <div className="mt-2">
                        <span className="text-3xl font-extrabold">{formatFCFA(plan.price)}</span>
                        <span className="text-sm text-muted-foreground">/mois</span>
                      </div>
                    </div>

                    <Separator className="mb-4" />

                    {/* Features */}
                    <ul className="space-y-3 mb-6 min-h-[200px]">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    {isCurrent ? (
                      <Button variant="outline" className="w-full" disabled>
                        Plan actuel
                      </Button>
                    ) : (
                      <Button
                        className={cn(
                          'w-full gap-2',
                          isPro
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : isEnterprise
                              ? 'bg-amber-500 hover:bg-amber-600 text-white'
                              : 'bg-gray-800 hover:bg-gray-900 text-white dark:bg-gray-700 dark:hover:bg-gray-600'
                        )}
                        onClick={() => handleSelectPlan(plan)}
                      >
                        {isUpgrade ? 'Mettre à niveau' : 'Rétrograder'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Usage Charts ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: Tickets per month */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-500" />
              Tickets par mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barChartConfig} className="h-[250px] w-full">
              <BarChart data={monthlyTicketData} accessibilityLayer>
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="tickets"
                  radius={[4, 4, 0, 0]}
                >
                  {monthlyTicketData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === monthlyTicketData.length - 1 ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-1) / 0.5)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Pie Chart: Plan usage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Utilisation du plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={pieChartConfig} className="h-[250px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={usagePieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  strokeWidth={2}
                >
                  {usagePieData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-2))'}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            {usage && (
              <div className="flex justify-center gap-6 mt-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Utilisé: {usage.eventsUsed}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 rounded-full bg-emerald-200 dark:bg-emerald-800" />
                  <span className="text-muted-foreground">Restant: {Math.max(0, (usage.eventsLimit || 1) - usage.eventsUsed)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Subscription History ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des abonnements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {histLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : history && history.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead className="hidden sm:table-cell">Méthode</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-sm">
                      {format(new Date(record.createdAt), 'd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <span className="capitalize font-medium text-sm">{record.plan}</span>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatFCFA(record.amount)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {getPaymentMethodBadge(record.paymentMethod)}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <CreditCard className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucun historique d&apos;abonnement</p>
              <p className="text-xs text-muted-foreground mt-1">
                Vos abonnements passés apparaîtront ici
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Payment Method Selection Dialog ──────────────────────────────── */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPlan && getPlanIcon(selectedPlan.id, 'h-6 w-6')}
              {selectedPlan && `Passer au plan ${selectedPlan.name}`}
            </DialogTitle>
            <DialogDescription>
              Choisissez votre méthode de paiement et la durée de l&apos;abonnement
            </DialogDescription>
          </DialogHeader>

          {/* Duration selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Durée de l&apos;abonnement</label>
            <div className="grid grid-cols-3 gap-3">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.months}
                  onClick={() => setDuration(opt.months)}
                  className={cn(
                    'relative flex flex-col items-center rounded-lg border-2 p-3 transition-all',
                    duration === opt.months
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <span className="text-sm font-semibold">{opt.label}</span>
                  {opt.discount > 0 && (
                    <Badge className="mt-1 text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-transparent">
                      -{opt.discount}%
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Payment method selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Méthode de paiement</label>
            <div className="space-y-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border-2 p-3 transition-all text-left',
                    paymentMethod === method.id
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold text-white shrink-0',
                      method.iconBg
                    )}
                  >
                    {method.iconText}
                  </span>
                  <span className="text-sm font-medium">{method.label}</span>
                  {paymentMethod === method.id && (
                    <Check className="h-4 w-4 text-emerald-500 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Price summary */}
          <Card className="bg-muted/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {selectedPlan?.name} x {duration} mois
                </span>
                <span>{formatFCFA(selectedPlan ? selectedPlan.price * duration : 0)}</span>
              </div>
              {(selectedDurationOption?.discount ?? 0) > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Remise ({selectedDurationOption?.discount}%)
                  </span>
                  <span className="text-emerald-600">
                    -{formatFCFA(selectedPlan ? selectedPlan.price * duration * (selectedDurationOption?.discount || 0) / 100 : 0)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between font-bold">
                <span>Total</span>
                <span className="text-lg">{formatFCFA(totalWithDiscount)}</span>
              </div>
            </CardContent>
          </Card>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)} className="w-full sm:w-auto">
              Annuler
            </Button>
            <Button
              onClick={handlePayment}
              disabled={subscribeMutation.isPending}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {subscribeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer le paiement
            </Button>
            <Button
              onClick={handleSimulatePayment}
              disabled={simulatePaymentMutation.isPending}
              variant="secondary"
              className="w-full sm:w-auto gap-2"
            >
              {simulatePaymentMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simuler le paiement (Demo)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </RoleGate>
  );
}
