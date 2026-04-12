'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth-store';
import {
  Bus,
  Ship,
  TrainFront,
  Clock,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  Search,
  Users,
  Building2,
  Plane,
  CircleDot,
  Filter,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BoardEntry {
  id: string;
  lineName: string;
  lineColor: string;
  vehicleType: string;
  origin: string;
  destination: string;
  time: string;
  status: string;
  delayMinutes: number;
  note: string | null;
  availableSeats: number;
  totalSeats: number;
  company: string;
  transportType: string;
}

interface BoardData {
  organization: {
    name: string;
    logoUrl?: string;
    primaryColor: string;
  };
  departures: BoardEntry[];
  arrivals: BoardEntry[];
  updatedAt: string;
}

type StatusType = 'on_time' | 'delayed' | 'boarding' | 'departed' | 'cancelled';

// ── Vehicle Icon helper ───────────────────────────────────────────────────────

function VehicleIcon({
  type,
  className = 'h-4 w-4',
}: {
  type: string;
  className?: string;
}) {
  switch (type) {
    case 'boat':
    case 'ferry':
      return <Ship className={className} />;
    case 'train':
      return <TrainFront className={className} />;
    case 'plane':
      return <Plane className={className} />;
    default:
      return <Bus className={className} />;
  }
}

// ── Time utilities ────────────────────────────────────────────────────────────

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getMinutesUntilNow(time: string): number {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return parseTimeToMinutes(time) - nowMinutes;
}

function formatCountdown(t: any, minutes: number): string {
  if (minutes <= 0) return t('board.now');
  if (minutes < 60) return `${t('board.in')} ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${t('board.in')} ${h}h`;
  return `${t('board.in')} ${h}h${String(m).padStart(2, '0')}`;
}

function getEstimatedTime(time: string, delayMinutes: number): string {
  const total = parseTimeToMinutes(time) + delayMinutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function deriveStatus(entry: BoardEntry): StatusType {
  if (entry.status === 'cancelled') return 'cancelled';
  if (entry.status === 'delayed') return 'delayed';
  const minutesUntil = getMinutesUntilNow(entry.time);
  if (minutesUntil < -5) return 'departed';
  if (minutesUntil >= 0 && minutesUntil <= 15) return 'boarding';
  return 'on_time';
}

// ── Status Badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<StatusType, { bg: string; text: string; dot: string; pulse?: boolean }> = {
  on_time: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  delayed: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  boarding: { bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-700 dark:text-sky-400', dot: 'bg-sky-500', pulse: true },
  departed: { bg: 'bg-slate-50 dark:bg-slate-800/40', text: 'text-slate-500 dark:text-slate-400', dot: 'bg-slate-400' },
  cancelled: { bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
};

function StatusBadge({ status, t }: { status: StatusType; t: any }) {
  const style = STATUS_STYLES[status];
  const labels: Record<StatusType, string> = {
    on_time: t('board.onTime'),
    delayed: t('board.delayed'),
    boarding: t('board.boarding'),
    departed: t('board.departed'),
    cancelled: t('board.cancelled'),
  };

  return (
    <Badge variant="outline" className={`${style.bg} ${style.text} border-current/15 gap-1.5 px-2.5 py-1`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot} ${style.pulse ? 'animate-pulse' : ''}`} />
      {labels[status]}
    </Badge>
  );
}

// ── Seat indicator ────────────────────────────────────────────────────────────

function SeatIndicator({ available, total, t }: { available: number; total: number; t: any }) {
  const ratio = available / total;
  const isFull = available === 0;
  const isLow = ratio > 0 && ratio <= 0.2;

  return (
    <div className="flex items-center gap-1.5">
      <Users className={`h-3.5 w-3.5 ${isFull ? 'text-red-400' : isLow ? 'text-amber-500' : 'text-emerald-500'}`} />
      <span className={`text-xs font-semibold tabular-nums ${isFull ? 'text-red-600 dark:text-red-400' : isLow ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
        {isFull ? t('board.full') : `${available}/${total}`}
      </span>
    </div>
  );
}

// ── Live Clock ────────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState<string>('--:--:--');
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      );
      setDate(
        now.toLocaleDateString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-xl font-bold tabular-nums tracking-tight">{time}</span>
      </div>
      <span className="text-xs text-muted-foreground capitalize">{date}</span>
    </div>
  );
}

// ── Countdown display ─────────────────────────────────────────────────────────

function CountdownDisplay({ entry, t }: { entry: BoardEntry; t: any }) {
  const status = deriveStatus(entry);

  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-1.5 text-red-500">
        <XCircle className="h-4 w-4" />
        <span className="text-xs font-medium">{t('board.cancelled')}</span>
      </div>
    );
  }

  if (status === 'departed') {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <CheckCircle className="h-4 w-4" />
        <span className="text-xs font-medium">{t('board.departed')}</span>
      </div>
    );
  }

  const minutesUntil = getMinutesUntilNow(entry.time);

  if (status === 'delayed') {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">
            {t('board.delayOf')} {entry.delayMinutes} min
          </span>
        </div>
        <span className="text-[10px] text-amber-500/70 pl-5">
          {t('board.estimated')} {getEstimatedTime(entry.time, entry.delayMinutes)}
        </span>
      </div>
    );
  }

  if (status === 'boarding') {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
          <CircleDot className="h-3.5 w-3.5 animate-pulse" />
          <span className="text-xs font-semibold">{t('board.boarding')}</span>
        </div>
        <span className="text-[10px] text-sky-500/70 pl-5">
          {formatCountdown(t, minutesUntil)}
        </span>
      </div>
    );
  }

  // on_time
  return (
    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
      {minutesUntil <= 60 ? formatCountdown(t, minutesUntil) : t('board.onTime')}
    </span>
  );
}

// ── Next Departure Card ───────────────────────────────────────────────────────

function NextDepartureCard({ entry, t }: { entry: BoardEntry; t: any }) {
  const minutesUntil = getMinutesUntilNow(entry.time);
  const status = deriveStatus(entry);

  return (
    <Card className="border-l-4 overflow-hidden" style={{ borderLeftColor: entry.lineColor }}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: entry.lineColor + '15' }}
          >
            <VehicleIcon type={entry.vehicleType} className="h-6 w-6" style={{ color: entry.lineColor } as any} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold truncate">{entry.lineName}</span>
              <StatusBadge status={status} t={t} />
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="truncate">{entry.origin}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-semibold text-foreground">{entry.destination}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-2xl font-bold tabular-nums tracking-tight">
              {status === 'delayed'
                ? getEstimatedTime(entry.time, entry.delayMinutes)
                : entry.time}
            </div>
            <CountdownDisplay entry={entry} t={t} />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <SeatIndicator available={entry.availableSeats} total={entry.totalSeats} t={t} />
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            <span>{entry.company}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Board Table (desktop) ────────────────────────────────────────────────────

function BoardTable({
  entries,
  direction,
  searchQuery,
  statusFilter,
  t,
}: {
  entries: BoardEntry[];
  direction: 'departure' | 'arrival';
  searchQuery: string;
  statusFilter: string;
  t: any;
}) {
  const filtered = useMemo(() => {
    let result = entries;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.origin.toLowerCase().includes(q) ||
          e.destination.toLowerCase().includes(q) ||
          e.lineName.toLowerCase().includes(q) ||
          e.company.toLowerCase().includes(q)
      );
    }

    if (statusFilter && statusFilter !== 'all') {
      result = result.filter((e) => deriveStatus(e) === statusFilter);
    }

    return result;
  }, [entries, searchQuery, statusFilter]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-3">
          {direction === 'departure' ? (
            <ArrowRight className="h-7 w-7" />
          ) : (
            <ArrowLeft className="h-7 w-7" />
          )}
        </div>
        <p className="text-sm font-medium">
          {searchQuery || statusFilter
            ? `${t('board.showingResults')} 0`
            : direction === 'departure'
            ? t('board.noDepartures')
            : t('board.noArrivals')}
        </p>
      </div>
    );
  }

  return (
    <div className="hidden md:block rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-[180px]">{t('board.route')}</TableHead>
            <TableHead>{direction === 'departure' ? t('board.departure') : t('board.arrival')}</TableHead>
            <TableHead className="w-[140px]">{t('board.company')}</TableHead>
            <TableHead className="w-[100px] text-center">{t('board.seats')}</TableHead>
            <TableHead className="w-[110px]">{t('board.schedule')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((entry) => {
            const status = deriveStatus(entry);
            const isPast = status === 'departed';
            return (
              <TableRow
                key={entry.id}
                className={`${isPast ? 'opacity-50' : ''} ${status === 'cancelled' ? 'opacity-60' : ''}`}
              >
                {/* Route */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: entry.lineColor + '15' }}
                    >
                      <VehicleIcon type={entry.vehicleType} className="h-4 w-4" style={{ color: entry.lineColor } as any} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{entry.lineName}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="truncate">{entry.origin}</span>
                        {direction === 'departure' ? (
                          <ArrowRight className="h-3 w-3 shrink-0" />
                        ) : (
                          <ArrowLeft className="h-3 w-3 shrink-0" />
                        )}
                        <span className="truncate font-medium text-foreground">{entry.destination}</span>
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Time + Status */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold tabular-nums">
                      {status === 'delayed'
                        ? getEstimatedTime(entry.time, entry.delayMinutes)
                        : entry.time}
                    </span>
                    <StatusBadge status={status} t={t} />
                  </div>
                  {status === 'delayed' && (
                    <span className="text-[10px] text-amber-500/70 mt-0.5 block">
                      {t('board.estimated')} {getEstimatedTime(entry.time, entry.delayMinutes)}
                    </span>
                  )}
                </TableCell>

                {/* Company */}
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{entry.company}</span>
                  </div>
                </TableCell>

                {/* Seats */}
                <TableCell className="text-center">
                  <SeatIndicator available={entry.availableSeats} total={entry.totalSeats} t={t} />
                </TableCell>

                {/* Countdown */}
                <TableCell>
                  <CountdownDisplay entry={entry} t={t} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Mobile Card List ──────────────────────────────────────────────────────────

function MobileCardList({
  entries,
  direction,
  searchQuery,
  statusFilter,
  t,
}: {
  entries: BoardEntry[];
  direction: 'departure' | 'arrival';
  searchQuery: string;
  statusFilter: string;
  t: any;
}) {
  const filtered = useMemo(() => {
    let result = entries;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.origin.toLowerCase().includes(q) ||
          e.destination.toLowerCase().includes(q) ||
          e.lineName.toLowerCase().includes(q) ||
          e.company.toLowerCase().includes(q)
      );
    }

    if (statusFilter && statusFilter !== 'all') {
      result = result.filter((e) => deriveStatus(e) === statusFilter);
    }

    return result;
  }, [entries, searchQuery, statusFilter]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground md:hidden">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
          {direction === 'departure' ? (
            <ArrowRight className="h-6 w-6" />
          ) : (
            <ArrowLeft className="h-6 w-6" />
          )}
        </div>
        <p className="text-sm font-medium">
          {direction === 'departure' ? t('board.noDepartures') : t('board.noArrivals')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 md:hidden">
      {filtered.map((entry) => {
        const status = deriveStatus(entry);
        const isPast = status === 'departed';

        return (
          <Card
            key={entry.id}
            className={`p-3 gap-3 ${isPast ? 'opacity-50' : ''} ${status === 'cancelled' ? 'opacity-60' : ''}`}
          >
            {/* Top row: route + status */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: entry.lineColor + '15' }}
                >
                  <VehicleIcon type={entry.vehicleType} className="h-4 w-4" style={{ color: entry.lineColor } as any} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{entry.lineName}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="truncate">{entry.origin}</span>
                    {direction === 'departure' ? (
                      <ArrowRight className="h-3 w-3 shrink-0" />
                    ) : (
                      <ArrowLeft className="h-3 w-3 shrink-0" />
                    )}
                    <span className="truncate font-medium text-foreground">{entry.destination}</span>
                  </div>
                </div>
              </div>
              <StatusBadge status={status} t={t} />
            </div>

            {/* Bottom row: time, seats, company */}
            <div className="flex items-center justify-between gap-2 pl-11">
              <div>
                <span className="text-base font-bold tabular-nums">
                  {status === 'delayed'
                    ? getEstimatedTime(entry.time, entry.delayMinutes)
                    : entry.time}
                </span>
                <span className="ml-2">
                  <CountdownDisplay entry={entry} t={t} />
                </span>
              </div>
              <div className="flex items-center gap-3">
                <SeatIndicator available={entry.availableSeats} total={entry.totalSeats} t={t} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────

function BoardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32 ml-auto" />
      </div>
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ orgName, t }: { orgName: string; t: any }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted mb-4">
        <Bus className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{t('board.noData')}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {orgName} — {t('board.noDepartures')}
      </p>
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground/60">
        <Calendar className="h-3.5 w-3.5" />
        <span>SmartTicketQR</span>
      </div>
    </div>
  );
}

// ── Stats Cards ───────────────────────────────────────────────────────────────

function StatsCards({
  departures,
  arrivals,
  t,
}: {
  departures: BoardEntry[];
  arrivals: BoardEntry[];
  t: any;
}) {
  const activeDepartures = departures.filter((e) => deriveStatus(e) !== 'departed' && deriveStatus(e) !== 'cancelled');
  const activeArrivals = arrivals.filter((e) => deriveStatus(e) !== 'departed' && deriveStatus(e) !== 'cancelled');
  const delayedCount = [...departures, ...arrivals].filter((e) => deriveStatus(e) === 'delayed').length;
  const totalSeatsAvailable = departures.reduce((sum, e) => sum + e.availableSeats, 0);

  const stats = [
    {
      label: t('board.departures'),
      value: activeDepartures.length,
      icon: ArrowRight,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      label: t('board.arrivals'),
      value: activeArrivals.length,
      icon: ArrowLeft,
      color: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-50 dark:bg-sky-950/30',
    },
    {
      label: t('board.delayed'),
      value: delayedCount,
      icon: AlertTriangle,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      label: t('board.seats'),
      value: totalSeatsAvailable,
      icon: Users,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="py-3 px-4 gap-0">
          <CardContent className="p-0">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PassengerBoard({ orgSlug }: { orgSlug?: string }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('departures');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Resolve org slug
  const effectiveOrgSlug = orgSlug || user?.organizationId || '';

  // ── Fetch board data ───────────────────────────────────────────────────
  const fetchData = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) setIsInitialLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set('org', effectiveOrgSlug);
        if (activeTab === 'departures' || activeTab === 'arrivals') {
          // Don't filter server-side, do it client-side so tabs switch instantly
        }
        params.set('limit', '100');

        const res = await fetch(`/api/board?${params.toString()}`);
        if (!res.ok) {
          setError(res.status === 404 ? t('board.noData') : 'Error loading board data');
          return;
        }

        const json = await res.json();
        setData(json);
        setLastRefresh(new Date());
      } catch {
        setError('Network error');
      } finally {
        setIsInitialLoading(false);
      }
    },
    [effectiveOrgSlug, activeTab, t]
  );

  // ── Initial fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!effectiveOrgSlug) return;
    fetchData(true);
  }, [effectiveOrgSlug, fetchData]);

  // ── Auto-refresh every 30 seconds ──────────────────────────────────────
  useEffect(() => {
    if (!data) return;
    const interval = setInterval(() => {
      fetchData(false);
    }, 30_000);
    return () => clearInterval(interval);
  }, [data, fetchData]);

  // ── Derived data ───────────────────────────────────────────────────────
  const departures = useMemo(() => data?.departures || [], [data]);
  const arrivals = useMemo(() => data?.arrivals || [], [data]);

  // Find next departure
  const nextDeparture = useMemo(() => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return departures.find((d) => {
      if (d.status === 'cancelled') return false;
      const [h, m] = d.time.split(':').map(Number);
      return h * 60 + m >= nowMinutes;
    });
  }, [departures]);

  // Current entries based on active tab
  const currentEntries = activeTab === 'departures' ? departures : arrivals;

  // ── Loading state ──────────────────────────────────────────────────────
  if (isInitialLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <BoardSkeleton />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30 mb-4">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold mb-1">{error || 'Error'}</h3>
        <button
          onClick={() => fetchData(true)}
          className="mt-3 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          {t('common.refresh')}
        </button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            {t('board.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.organization.name} — {t('board.departuresAndArrivals')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Last refresh indicator */}
          {lastRefresh && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3" />
              <span>
                {t('board.lastUpdate')}:{' '}
                {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
          {/* Live clock */}
          <LiveClock />
          {/* Refresh button */}
          <button
            onClick={() => fetchData(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background hover:bg-accent transition-colors"
            title={t('common.refresh')}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────────────── */}
      <StatsCards departures={departures} arrivals={arrivals} t={t} />

      {/* ── Next Departure Highlight ────────────────────────────────── */}
      {nextDeparture && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {t('board.nextDeparture')}
          </h2>
          <NextDepartureCard entry={nextDeparture} t={t} />
        </div>
      )}

      {/* ── Main Board ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="departures" className="gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5" />
                  {t('board.departures')}
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                    {departures.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="arrivals" className="gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t('board.arrivals')}
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                    {arrivals.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search + Filter */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={t('board.searchRoute')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 w-[180px] lg:w-[240px] text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[130px] text-sm">
                  <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder={t('board.filterStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('board.allStatuses')}</SelectItem>
                  <SelectItem value="on_time">{t('board.onTime')}</SelectItem>
                  <SelectItem value="boarding">{t('board.boarding')}</SelectItem>
                  <SelectItem value="delayed">{t('board.delayed')}</SelectItem>
                  <SelectItem value="departed">{t('board.departed')}</SelectItem>
                  <SelectItem value="cancelled">{t('board.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Results count */}
          {(searchQuery || statusFilter !== 'all') && (
            <div className="mb-3 text-xs text-muted-foreground">
              {t('board.showingResults')} {currentEntries.length} {t('common.results').toLowerCase()}
            </div>
          )}

          {/* Desktop table */}
          {activeTab === 'departures' ? (
            <>
              <BoardTable
                entries={departures}
                direction="departure"
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                t={t}
              />
              <MobileCardList
                entries={departures}
                direction="departure"
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                t={t}
              />
            </>
          ) : (
            <>
              <BoardTable
                entries={arrivals}
                direction="arrival"
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                t={t}
              />
              <MobileCardList
                entries={arrivals}
                direction="arrival"
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                t={t}
              />
            </>
          )}

          {/* Empty state */}
          {departures.length === 0 && arrivals.length === 0 && (
            <EmptyState orgName={data.organization.name} t={t} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
