'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  Ticket,
  DollarSign,
  CalendarCheck,
  ScanLine,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Music,
  GraduationCap,
  Briefcase,
  Trophy,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Zap,
  BarChart3,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { getRoleConfig } from '@/lib/permissions';
import { useAppStore } from '@/store/app-store';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

// ── Types ────────────────────────────────────────────────────────────
interface AnalyticsData {
  totalTickets: number;
  soldTickets: number;
  usedTickets: number;
  totalRevenue: number;
  ticketsByStatus: Record<string, number>;
  revenueByEvent: Array<{ eventId: string; eventName: string; revenue: number }>;
  scansToday: number;
  scansThisWeek: number;
  recentActivity: Array<{
    id: string;
    action: string;
    details: string | null;
    createdAt: string;
    user: { id: string; name: string; email: string } | null;
  }>;
  activeEvents: number;
  totalUsers: number;
  dailyScans: Array<{ date: string; count: number }>;
}

type DateRange = 'today' | 'week' | 'month' | 'all';

// ── Chart Configs ────────────────────────────────────────────────────
const salesChartConfig = {
  count: {
    label: 'Tickets Sold',
    color: '#10b981',
  },
} satisfies ChartConfig;

const revenueChartConfig = {
  revenue: {
    label: 'Revenue',
    color: '#059669',
  },
} satisfies ChartConfig;

const statusChartConfig = {
  active: {
    label: 'Active',
    color: '#10b981',
  },
  used: {
    label: 'Used',
    color: '#3b82f6',
  },
  expired: {
    label: 'Expired',
    color: '#f59e0b',
  },
  cancelled: {
    label: 'Cancelled',
    color: '#ef4444',
  },
} satisfies ChartConfig;

const scansChartConfig = {
  count: {
    label: 'Scans',
    color: '#14b8a6',
  },
} satisfies ChartConfig;

const hourlyChartConfig = {
  scans: {
    label: 'Scans',
    color: '#f59e0b',
  },
} satisfies ChartConfig;

const ticketTypeChartConfig = {
  Standard: { label: 'Standard', color: '#10b981' },
  VIP: { label: 'VIP', color: '#f59e0b' },
  Premium: { label: 'Premium', color: '#8b5cf6' },
  'Early Bird': { label: 'Early Bird', color: '#06b6d4' },
} satisfies ChartConfig;

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const TYPE_COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

// ── Helpers ──────────────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

function formatTime(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'MMM d, h:mm a');
  } catch {
    return 'N/A';
  }
}

function getEventTypeIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'concert':
    case 'music':
      return <Music className="size-4 text-purple-500" />;
    case 'conference':
    case 'business':
      return <Briefcase className="size-4 text-blue-500" />;
    case 'workshop':
    case 'education':
    case 'seminar':
      return <GraduationCap className="size-4 text-amber-500" />;
    case 'sports':
      return <Trophy className="size-4 text-orange-500" />;
    default:
      return <Calendar className="size-4 text-emerald-500" />;
  }
}

function getResultBadge(result: string, t: (key: string) => string) {
  const lower = result.toLowerCase();
  if (lower === 'valid' || lower === 'success' || lower === 'active') {
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">{t('dashboard.badgeValid')}</Badge>;
  }
  if (lower === 'invalid' || lower === 'failed' || lower === 'cancelled') {
    return <Badge variant="destructive">{t('dashboard.badgeInvalid')}</Badge>;
  }
  if (lower === 'expired') {
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">{t('dashboard.badgeExpired')}</Badge>;
  }
  if (lower === 'duplicate') {
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">{t('dashboard.badgeDuplicate')}</Badge>;
  }
  return <Badge variant="outline">{result}</Badge>;
}

// ── Skeleton Loaders ─────────────────────────────────────────────────
function KpiCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
        <Skeleton className="mt-3 h-8 w-28 rounded" />
        <Skeleton className="mt-2 h-4 w-36 rounded" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40 rounded" />
        <Skeleton className="h-4 w-56 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[280px] w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40 rounded" />
        <Skeleton className="h-4 w-56 rounded" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Enhanced Stats Types ─────────────────────────────────────────
interface StatsData {
  kpis: {
    totalRevenueMonth: number;
    totalTicketsSoldMonth: number;
    totalScansToday: number;
    totalScansWeek: number;
    totalTicketsAll: number;
    totalActiveEvents: number;
    validationRate: number;
    lastUpdated: string;
  };
  dailyRevenue: Array<{ date: string; revenue: number }>;
  hourlyTraffic: Array<{ hour: number; scans: number }>;
  topEvents: Array<{ id: string; name: string; revenue: number; ticketsSold: number; scans: number }>;
  ticketTypeDistribution: Array<{ type: string; count: number }>;
}

// ── Main Dashboard ───────────────────────────────────────────────────
export default function Dashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const [dateRange, setDateRange] = useState<DateRange>('all');

  const { data, isLoading, error, refetch, isFetching } = useQuery<AnalyticsData>({
    queryKey: ['analytics', dateRange],
    queryFn: async () => {
      const token = useAuthStore.getState().token;
      const orgId = useOrgStore.getState().currentOrganization?.id;
      const res = await fetch(`/api/analytics?range=${dateRange}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
      });
      if (!res.ok) {
        throw new Error('Failed to fetch analytics');
      }
      return res.json();
    },
    refetchInterval: 30000,
    retry: 1,
  });

  // Enhanced stats (cached, for hourly traffic + ticket types)
  const { data: statsData } = useQuery<StatsData>({
    queryKey: ['stats'],
    queryFn: async () => {
      const token = useAuthStore.getState().token;
      const orgId = useOrgStore.getState().currentOrganization?.id;
      const res = await fetch('/api/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    refetchInterval: 60000,
    retry: 1,
  });

  // ── Role Detection ───────────────────────────────────────────
  const userRole = user?.role || 'caisse';
  const roleInfo = getRoleConfig(userRole);
  const isCaisse = userRole === 'caisse';
  const isComptable = userRole === 'comptable';

  // Controleur: redirect to scanner (no dashboard access)
  if (userRole === 'controleur') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/30">
              <ScanLine className="size-8 text-sky-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t('dashboard.scannerOnly')}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {roleInfo.description}
              </p>
            </div>
            <Button onClick={() => setCurrentPage('scanner')} className="w-full">
              <ScanLine className="mr-2 size-4" />
              {t('dashboard.goToScanner')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Computed metrics
  const ticketsByStatusData = data
    ? Object.entries(data.ticketsByStatus).map(([key, value]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value,
        fill: statusChartConfig[key as keyof typeof statusChartConfig]?.color ?? '#94a3b8',
      }))
    : [];

  const dailyScansChartData = data
    ? data.dailyScans.map((d) => ({
        date: format(new Date(d.date), 'MMM d'),
        count: d.count,
      }))
    : [];

  const revenueChartData = data
    ? data.revenueByEvent.slice(0, 8).map((e) => ({
        name: e.eventName.length > 20 ? e.eventName.slice(0, 20) + '...' : e.eventName,
        revenue: e.revenue,
      }))
    : [];

  const dailyRevenueChartData = statsData
    ? statsData.dailyRevenue.map((d) => ({
        date: format(new Date(d.date), 'MMM d'),
        revenue: d.revenue,
      }))
    : [];

  const hourlyTrafficChartData = statsData
    ? statsData.hourlyTraffic.map((h) => ({
        hour: `${String(h.hour).padStart(2, '0')}:00`,
        scans: h.scans,
      }))
    : [];

  const ticketTypeChartData = statsData
    ? statsData.ticketTypeDistribution.map((t, i) => ({
        name: t.type,
        value: t.count,
        fill: TYPE_COLORS[i % TYPE_COLORS.length],
      }))
    : [];

  // KPI definitions
  const kpis = [
    {
      key: 'ticketsSold',
      label: t('dashboard.ticketsSold'),
      value: data ? formatNumber(data.soldTickets) : '—',
      icon: <Ticket className="size-5 text-emerald-600" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950',
      trend: data ? 12.5 : 0,
      trendLabel: t('dashboard.trendVsLastPeriod'),
    },
    {
      key: 'totalRevenue',
      label: t('dashboard.totalRevenue'),
      value: data ? formatCurrency(data.totalRevenue) : '—',
      icon: <DollarSign className="size-5 text-emerald-600" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950',
      trend: data ? 8.2 : 0,
      trendLabel: t('dashboard.trendVsLastPeriod'),
    },
    {
      key: 'activeEvents',
      label: t('dashboard.activeEvents'),
      value: data ? formatNumber(data.activeEvents) : '—',
      icon: <CalendarCheck className="size-5 text-teal-600" />,
      iconBg: 'bg-teal-100 dark:bg-teal-950',
      trend: data ? 0 : 0,
      trendLabel: t('dashboard.currentlyRunning'),
    },
    {
      key: 'scansToday',
      label: t('dashboard.scansToday'),
      value: statsData ? formatNumber(statsData.kpis.totalScansToday) : data ? formatNumber(data.scansToday) : '—',
      icon: <ScanLine className="size-5 text-green-600" />,
      iconBg: 'bg-green-100 dark:bg-green-950',
      trend: statsData && statsData.kpis.totalScansToday > 15 ? 24.1 : -3.2,
      trendLabel: t('dashboard.vsYesterday'),
    },
    {
      key: 'validationRate',
      label: t('dashboard.validationRate'),
      value: statsData ? `${(statsData.kpis.validationRate * 100).toFixed(1)}%` : '—',
      icon: <Zap className="size-5 text-amber-600" />,
      iconBg: 'bg-amber-100 dark:bg-amber-950',
      trend: 0,
      trendLabel: statsData ? t('dashboard.usedOverActive') : '',
      isProgress: true,
      progressValue: statsData ? statsData.kpis.validationRate * 100 : 0,
    },
  ];

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* ── Header Section ──────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {isCaisse ? t('dashboard.caisseTitle') : isComptable ? t('dashboard.comptableTitle') : t('dashboard.title')}
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {isCaisse ? t('dashboard.welcomeCaisse', { name: user?.name || t('dashboard.user') }) : t('dashboard.welcomeBack', { name: user?.name || t('dashboard.user') })}
          </p>
        </div>
        {!isCaisse && (
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue placeholder={t('dashboard.selectRange')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">{t('dashboard.today')}</SelectItem>
              <SelectItem value="week">{t('dashboard.thisWeek')}</SelectItem>
              <SelectItem value="month">{t('dashboard.thisMonth')}</SelectItem>
              <SelectItem value="all">{t('dashboard.allTime')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
        </div>
        )}
      </div>

      {/* ── Error State ─────────────────────────────────────── */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="size-5 text-destructive" />
            <p className="text-sm text-destructive">
              {t('dashboard.failedLoad')}
            </p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="ml-auto">
              {t('dashboard.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── KPI Cards ───────────────────────────────────────── */}
      <div className={cn(
        'grid gap-4',
        isCaisse || isComptable ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'
      )}>
        {isLoading
          ? Array.from({ length: isCaisse || isComptable ? 3 : 5 }).map((_, i) => <KpiCardSkeleton key={i} />)
          : (isCaisse
              ? kpis.filter(k => ['ticketsSold', 'totalRevenue', 'activeEvents'].includes(k.key))
              : isComptable
                ? kpis.filter(k => ['totalRevenue', 'ticketsSold', 'validationRate'].includes(k.key))
                : kpis
            ).map((kpi, i) => (
              <Card key={i} className="relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', kpi.iconBg)}>
                      {kpi.icon}
                    </div>
                    {kpi.trend !== 0 && !(kpi as Record<string, unknown>).isProgress && (
                      <div
                        className={cn(
                          'flex items-center gap-0.5 text-xs font-medium',
                          kpi.trend > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        )}
                      >
                        {kpi.trend > 0 ? (
                          <ArrowUpRight className="size-3" />
                        ) : (
                          <ArrowDownRight className="size-3" />
                        )}
                        {Math.abs(kpi.trend)}%
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
                    <p className="mt-0.5 text-muted-foreground text-xs">{kpi.label}</p>
                  </div>
                  {!!(kpi as Record<string, unknown>).isProgress && (
                    <Progress value={(kpi as Record<string, unknown>).progressValue as number} className="mt-2 h-1.5" />
                  )}
                </CardContent>
              </Card>
            ))}
      </div>

      {/* ── Caisse: Sell button + filtered activity ─────────── */}
      {isCaisse && (
        <div className="space-y-4">
          <Button onClick={() => setCurrentPage('tickets')} size="lg" className="w-full sm:w-auto">
            <Ticket className="mr-2 size-4" />
            {t('dashboard.vendreTicket')}
          </Button>
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('dashboard.ventesRecentes')}</CardTitle>
                <CardDescription>{t('dashboard.lastSalesToday')}</CardDescription>
              </CardHeader>
              <CardContent>
                {data && data.recentActivity.filter(a => a.action === 'ticket_created').length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
                    {t('dashboard.noSalesToday')}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">{t('dashboard.time')}</TableHead>
                        <TableHead>{t('dashboard.seller')}</TableHead>
                        <TableHead>{t('common.details')}</TableHead>
                        <TableHead className="text-right">{t('dashboard.status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.recentActivity
                        .filter(a => a.action === 'ticket_created')
                        .slice(0, 10)
                        .map((activity) => (
                          <TableRow key={activity.id}>
                            <TableCell className="text-muted-foreground text-xs">
                              <div className="flex items-center gap-1.5">
                                <Clock className="size-3" />
                                {formatTime(activity.createdAt)}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {activity.user?.name || t('dashboard.system')}
                            </TableCell>
                            <TableCell className="max-w-[250px] truncate text-muted-foreground text-xs">
                              {activity.details || '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                                <CheckCircle2 className="mr-1 size-3" />
                                {t('dashboard.sold')}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Admin / Comptable: Charts, Tables, Footer ───────── */}
      {!isCaisse && (<>
      {/* ── Charts Section ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Ticket Sales Trend (Area Chart) */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.ticketSalesTrend')}</CardTitle>
              <CardDescription>{t('dashboard.scanActivity')}</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyScansChartData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
                  {t('dashboard.noScanData')}
                </div>
              ) : (
                <ChartContainer config={salesChartConfig} className="h-[280px] w-full">
                  <AreaChart data={dailyScansChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#10b981"
                      fill="url(#salesGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Revenue by Event (Bar Chart) */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.revenueByEvent')}</CardTitle>
              <CardDescription>{t('dashboard.topEventsRevenue')}</CardDescription>
            </CardHeader>
            <CardContent>
              {revenueChartData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
                  {t('dashboard.noRevenueData')}
                </div>
              ) : (
                <ChartContainer config={revenueChartConfig} className="h-[280px] w-full">
                  <BarChart
                    data={revenueChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      width={120}
                      tickMargin={4}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Daily Revenue (Area Chart) */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.dailyRevenue')}</CardTitle>
              <CardDescription>{t('dashboard.revenueTrend')}</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyRevenueChartData.length === 0 || dailyRevenueChartData.every(d => d.revenue === 0) ? (
                <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
                  {t('dashboard.noRevenueData')}
                </div>
              ) : (
                <ChartContainer config={revenueChartConfig} className="h-[280px] w-full">
                  <AreaChart data={dailyRevenueChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#059669"
                      fill="url(#revenueGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ticket Status Distribution (Donut Chart) */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.ticketStatus')}</CardTitle>
              <CardDescription>{t('dashboard.statusBreakdown')}</CardDescription>
            </CardHeader>
            <CardContent>
              {ticketsByStatusData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
                  {t('dashboard.noStatusData')}
                </div>
              ) : (
                <ChartContainer config={statusChartConfig} className="h-[280px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                    <Pie
                      data={ticketsByStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {ticketsByStatusData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Admin only: Hourly Traffic + Ticket Type ──────────── */}
        {!isComptable && (<>
        {/* Hourly Traffic (Bar Chart) */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.hourlyTraffic')}</CardTitle>
              <CardDescription>{t('dashboard.scanVolume')}</CardDescription>
            </CardHeader>
            <CardContent>
              {hourlyTrafficChartData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
                  {t('dashboard.noTrafficData')}
                </div>
              ) : (
                <ChartContainer config={hourlyChartConfig} className="h-[280px] w-full">
                  <BarChart data={hourlyTrafficChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      interval={2}
                    />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="scans" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ticket Type Distribution (Donut Chart) */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.ticketTypes')}</CardTitle>
              <CardDescription>{t('dashboard.typeDistribution')}</CardDescription>
            </CardHeader>
            <CardContent>
              {ticketTypeChartData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
                  {t('dashboard.noTypeData')}
                </div>
              ) : (
                <ChartContainer config={ticketTypeChartConfig} className="h-[280px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                    <Pie
                      data={ticketTypeChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {ticketTypeChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        )}
        </>)}
      </div>

      {/* ── Tables Section (admin only) ─────────────────────── */}
      {!isComptable && (
      <Tabs defaultValue="recent-activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recent-activity">{t('dashboard.recentActivity')}</TabsTrigger>
          <TabsTrigger value="top-events">{t('dashboard.topEvents')}</TabsTrigger>
        </TabsList>

        {/* Recent Activity Table */}
        <TabsContent value="recent-activity">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('dashboard.recentActivity')}</CardTitle>
                <CardDescription>{t('dashboard.latestScansActivity')}</CardDescription>
              </CardHeader>
              <CardContent>
                {data && data.recentActivity.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
                    {t('dashboard.noRecentActivity')}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">{t('dashboard.time')}</TableHead>
                        <TableHead>{t('dashboard.user')}</TableHead>
                        <TableHead>{t('dashboard.action')}</TableHead>
                        <TableHead>{t('common.details')}</TableHead>
                        <TableHead className="text-right">{t('dashboard.result')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.recentActivity.slice(0, 10).map((activity) => (
                        <TableRow key={activity.id}>
                          <TableCell className="text-muted-foreground text-xs">
                            <div className="flex items-center gap-1.5">
                              <Clock className="size-3" />
                              {formatTime(activity.createdAt)}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {activity.user?.name || t('dashboard.system')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm">
                              {activity.action === 'scan' && (
                                <ScanLine className="size-3.5 text-teal-500" />
                              )}
                              {activity.action === 'ticket_created' && (
                                <Ticket className="size-3.5 text-emerald-500" />
                              )}
                              {activity.action === 'user_login' && (
                                <Users className="size-3.5 text-blue-500" />
                              )}
                              {activity.action === 'event_created' && (
                                <Calendar className="size-3.5 text-purple-500" />
                              )}
                              <span className="capitalize">
                                {activity.action.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                            {activity.details || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {activity.action === 'scan'
                              ? getResultBadge(activity.details?.includes('valid') ? 'valid' : 'invalid', t)
                              : activity.action === 'login'
                                ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                                    <CheckCircle2 className="mr-1 size-3" />
                                    {t('common.success')}
                                  </Badge>
                                : <Badge variant="outline">{t('dashboard.badgeInfo')}</Badge>
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {data && data.recentActivity.length > 10 && (
                  <div className="mt-4 flex justify-center">
                    <Button variant="ghost" size="sm" className="text-muted-foreground text-xs">
                      {t('dashboard.viewAllActivity')}
                      <ArrowUpRight className="ml-1 size-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Top Events Table */}
        <TabsContent value="top-events">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('dashboard.topEvents')}</CardTitle>
                <CardDescription>{t('dashboard.topEventsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                {data && data.revenueByEvent.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
                    {t('dashboard.noEventsRevenue')}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">#</TableHead>
                        <TableHead>{t('dashboard.eventName')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('dashboard.type')}</TableHead>
                        <TableHead className="text-right">{t('dashboard.revenue')}</TableHead>
                        <TableHead className="text-right">{t('dashboard.status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.revenueByEvent.map((event, index) => (
                        <TableRow key={event.eventId}>
                          <TableCell className="font-medium text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-950">
                                <Calendar className="size-4 text-emerald-600" />
                              </div>
                              <span className="truncate">{event.eventName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className="gap-1">
                              {getEventTypeIcon(event.eventName)}
                              {t('dashboard.event')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrency(event.revenue)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                              {t('common.active')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      )}

      {/* ── Comptable: Revenue by Event Table ───────────────── */}
      {isComptable && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.revenueByEvent')}</CardTitle>
            <CardDescription>{t('dashboard.comptableRevenueDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {data && data.revenueByEvent.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
                {t('dashboard.comptableNoEvents')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead>{t('dashboard.eventName')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.revenue')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.revenueByEvent.map((event, index) => (
                    <TableRow key={event.eventId}>
                      <TableCell className="font-medium text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-950">
                            <Calendar className="size-4 text-emerald-600" />
                          </div>
                          <span className="truncate">{event.eventName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(event.revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                          {t('common.active')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Quick Stats Footer (admin only) ──────────────────── */}
      {!isComptable && !isLoading && data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-950">
                <Ticket className="size-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('dashboard.totalTickets')}</p>
                <p className="text-sm font-semibold">{formatNumber(data.totalTickets)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-950">
                <CheckCircle2 className="size-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('dashboard.usedTickets')}</p>
                <p className="text-sm font-semibold">{formatNumber(data.usedTickets)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-100 dark:bg-teal-950">
                <Users className="size-4 text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('dashboard.totalUsers')}</p>
                <p className="text-sm font-semibold">{formatNumber(data.totalUsers)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-950">
                <ScanLine className="size-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('dashboard.scansChart')}</p>
                <p className="text-sm font-semibold">{formatNumber(data.scansThisWeek)}</p>
              </div>
            </div>
          </Card>
        </div>
      )}
      </>
      )}
    </div>
  );
}
