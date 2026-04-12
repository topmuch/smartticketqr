'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  QrCode,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScheduleEntry {
  id: string;
  lineName: string;
  vehicleType: string;
  origin: string;
  destination: string;
  time: string; // "HH:MM"
  status: 'on_time' | 'delayed' | 'cancelled';
  delayMinutes: number;
  note: string | null;
  lineColor: string;
}

interface BoardData {
  organization: {
    name: string;
    logoUrl?: string;
    primaryColor: string;
  };
  departures: ScheduleEntry[];
  arrivals: ScheduleEntry[];
  updatedAt: string;
}

// ── Vehicle Icon helper ───────────────────────────────────────────────────────

function VehicleIcon({
  type,
  className = 'h-5 w-5',
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

function formatCountdown(minutes: number): string {
  if (minutes <= 0) return 'Maintenant';
  if (minutes < 60) return `Dans ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `Dans ${h}h`;
  return `Dans ${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`;
}

function getEstimatedTime(time: string, delayMinutes: number): string {
  const total = parseTimeToMinutes(time) + delayMinutes;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({
  entry,
  accentColor,
}: {
  entry: ScheduleEntry;
  accentColor: string;
}) {
  const minutesUntil = getMinutesUntilNow(entry.time);
  const isPast = minutesUntil < -5;
  const isSoon = minutesUntil >= 0 && minutesUntil <= 30;

  if (entry.status === 'cancelled') {
    return (
      <div className="flex items-center gap-1.5">
        <XCircle className="h-4 w-4 text-red-400 shrink-0" />
        <span className="text-sm font-semibold text-red-400">Annulé</span>
      </div>
    );
  }

  if (entry.status === 'delayed') {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-sm font-semibold text-amber-400">
            Retardé de {entry.delayMinutes} min
          </span>
        </div>
        <span className="pl-5.5 text-xs text-amber-300/70">
          Estimé {getEstimatedTime(entry.time, entry.delayMinutes)}
        </span>
      </div>
    );
  }

  // on_time
  if (isPast) {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle className="h-4 w-4 text-slate-500 shrink-0" />
        <span className="text-sm text-slate-500">Parti</span>
      </div>
    );
  }

  if (isSoon && minutesUntil <= 60) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
          <span className="text-sm font-semibold" style={{ color: accentColor }}>
            {formatCountdown(minutesUntil)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
      <span className="text-sm font-semibold text-emerald-400">À l&apos;heure</span>
    </div>
  );
}

// ── Schedule Row ──────────────────────────────────────────────────────────────

function ScheduleRow({
  entry,
  direction,
  accentColor,
}: {
  entry: ScheduleEntry;
  direction: 'departure' | 'arrival';
  accentColor: string;
}) {
  const minutesUntil = getMinutesUntilNow(entry.time);
  const isPast = minutesUntil < -5;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
        isPast
          ? 'bg-slate-800/40 opacity-50'
          : 'bg-slate-800/70 hover:bg-slate-700/60'
      } ${entry.status === 'cancelled' ? 'opacity-60' : ''}`}
    >
      {/* Vehicle icon + line name */}
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: entry.lineColor + '25' }}
      >
        <VehicleIcon type={entry.vehicleType} className="h-6 w-6" style={{ color: entry.lineColor }} as any />
      </div>

      {/* Line info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white truncate">
            {entry.lineName}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-300">
          {direction === 'departure' ? (
            <>
              <span className="truncate">{entry.origin}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span className="truncate font-semibold text-white">
                {entry.destination}
              </span>
            </>
          ) : (
            <>
              <span className="truncate font-semibold text-white">
                {entry.origin}
              </span>
              <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span className="truncate">{entry.destination}</span>
            </>
          )}
        </div>
      </div>

      {/* Time */}
      <div className="shrink-0 text-right">
        <div className="text-lg font-bold tabular-nums text-white md:text-2xl">
          {entry.status === 'delayed'
            ? getEstimatedTime(entry.time, entry.delayMinutes)
            : entry.time}
        </div>
      </div>

      {/* Status */}
      <div className="w-40 shrink-0 hidden sm:block">
        <StatusBadge entry={entry} accentColor={accentColor} />
      </div>
    </div>
  );
}

// ── Mobile Status (shown below row on small screens) ──────────────────────────

function MobileStatus({
  entry,
  accentColor,
}: {
  entry: ScheduleEntry;
  accentColor: string;
}) {
  return (
    <div className="block sm:hidden px-4 pb-2 pl-[68px]">
      <StatusBadge entry={entry} accentColor={accentColor} />
    </div>
  );
}

// ── Schedule Column (TV layout) ───────────────────────────────────────────────

function ScheduleColumn({
  title,
  entries,
  direction,
  accentColor,
}: {
  title: string;
  entries: ScheduleEntry[];
  direction: 'departure' | 'arrival';
  accentColor: string;
}) {
  return (
    <div className="flex flex-col">
      {/* Column header */}
      <div
        className="flex items-center gap-2 rounded-t-xl px-4 py-3"
        style={{ backgroundColor: accentColor }}
      >
        {direction === 'departure' ? (
          <ArrowRight className="h-5 w-5 text-white" />
        ) : (
          <ArrowLeft className="h-5 w-5 text-white" />
        )}
        <h2 className="text-lg font-bold tracking-wide text-white uppercase">
          {title}
        </h2>
        <span className="ml-auto text-sm font-medium text-white/80">
          {entries.length} voyage{entries.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Schedule list */}
      <div className="flex flex-col gap-2 rounded-b-xl bg-slate-900/50 p-2 max-h-[calc(100vh-240px)] overflow-y-auto scrollbar-thin">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Clock className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Aucun {direction === 'departure' ? 'départ' : 'arrivée'} prévu</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id}>
              <ScheduleRow
                entry={entry}
                direction={direction}
                accentColor={accentColor}
              />
              <MobileStatus entry={entry} accentColor={accentColor} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Live Clock ────────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState<string>('--:--:--');

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Clock className="h-5 w-5 text-slate-400" />
      <span className="text-2xl font-bold tabular-nums text-white md:text-3xl">
        {time}
      </span>
    </div>
  );
}

// ── Mobile Tab Toggle ─────────────────────────────────────────────────────────

function MobileTabToggle({
  activeTab,
  onTabChange,
  accentColor,
  departureCount,
  arrivalCount,
}: {
  activeTab: 'departures' | 'arrivals';
  onTabChange: (tab: 'departures' | 'arrivals') => void;
  accentColor: string;
  departureCount: number;
  arrivalCount: number;
}) {
  return (
    <div className="flex rounded-xl bg-slate-800 p-1">
      <button
        onClick={() => onTabChange('departures')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
          activeTab === 'departures'
            ? 'text-white shadow-lg'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        style={
          activeTab === 'departures'
            ? { backgroundColor: accentColor }
            : undefined
        }
      >
        <ArrowRight className="h-4 w-4" />
        Départs
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
          {departureCount}
        </span>
      </button>
      <button
        onClick={() => onTabChange('arrivals')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
          activeTab === 'arrivals'
            ? 'text-white shadow-lg'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        style={
          activeTab === 'arrivals'
            ? { backgroundColor: accentColor }
            : undefined
        }
      >
        <ArrowLeft className="h-4 w-4" />
        Arrivées
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
          {arrivalCount}
        </span>
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PublicDisplay({ boardSlug }: { boardSlug: string }) {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isWideScreen, setIsWideScreen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'departures' | 'arrivals'>('departures');

  // ── Responsive detection ───────────────────────────────────────────────
  useEffect(() => {
    function checkWidth() {
      setIsWideScreen(window.innerWidth > 768);
    }
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // ── Fetch board data ───────────────────────────────────────────────────
  const fetchData = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setIsInitialLoading(true);
      setError(null);

      const res = await fetch(
        `/api/board?orgSlug=${encodeURIComponent(boardSlug)}`
      );

      if (!res.ok) {
        if (res.status === 404) {
          setError('Organisation non trouvée. Vérifiez le lien.');
        } else if (res.status === 400) {
          setError('Paramètre invalide dans l\'URL.');
        } else {
          setError('Erreur lors du chargement du tableau.');
        }
        return;
      }

      const json = await res.json();
      setData(json);
    } catch {
      setError('Impossible de se connecter au serveur. Vérifiez votre connexion internet.');
    } finally {
      setIsInitialLoading(false);
    }
  }, [boardSlug]);

  // ── Initial fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!boardSlug) return;
    fetchData(true);
  }, [boardSlug, fetchData]);

  // ── Auto-refresh every 15 seconds ──────────────────────────────────────
  useEffect(() => {
    if (!data) return;
    const interval = setInterval(() => {
      fetchData(false);
    }, 15_000);
    return () => clearInterval(interval);
  }, [data, fetchData]);

  // ── Derived data ───────────────────────────────────────────────────────
  const accentColor = useMemo(
    () => data?.organization?.primaryColor || '#059669',
    [data]
  );

  const departures = useMemo(
    () => data?.departures || [],
    [data]
  );

  const arrivals = useMemo(
    () => data?.arrivals || [],
    [data]
  );

  // ── Loading state ──────────────────────────────────────────────────────
  if (isInitialLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin" style={{ color: accentColor }} />
          <div className="text-center">
            <p className="text-lg font-semibold">Chargement du tableau...</p>
            <p className="mt-1 text-sm text-slate-500">
              Connexion au serveur SmartTicketQR
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-white">
        <div className="flex flex-col items-center gap-6 text-center max-w-md">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/15">
            <AlertTriangle className="h-10 w-10 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Tableau indisponible</h1>
            <p className="mt-2 text-sm text-slate-400">
              {error || 'Une erreur inattendue est survenue.'}
            </p>
          </div>
          <button
            onClick={() => fetchData(true)}
            className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: accentColor }}
          >
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <QrCode className="h-3.5 w-3.5" />
            <span>SmartTicketQR</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: TV Layout (>768px) ─────────────────────────────────────────
  if (isWideScreen) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-950">
        {/* Header */}
        <header
          className="flex items-center justify-between px-6 py-4 border-b border-slate-800"
          style={{ borderTop: `3px solid ${accentColor}` }}
        >
          <div className="flex items-center gap-3">
            {data.organization.logoUrl ? (
              <img
                src={data.organization.logoUrl}
                alt={data.organization.name}
                className="h-10 w-auto object-contain rounded"
              />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white text-lg"
                style={{ backgroundColor: accentColor }}
              >
                {data.organization.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                {data.organization.name}
              </h1>
              <p className="text-xs text-slate-500">Tableau des départs et arrivées</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live indicator */}
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">En direct</span>
            </div>
            <LiveClock />
          </div>
        </header>

        {/* Main content: 2-column layout */}
        <main className="flex-1 grid grid-cols-2 gap-4 p-4 md:gap-6 md:p-6">
          <ScheduleColumn
            title="Départs"
            entries={departures}
            direction="departure"
            accentColor={accentColor}
          />
          <ScheduleColumn
            title="Arrivées"
            entries={arrivals}
            direction="arrival"
            accentColor={accentColor}
          />
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800 px-6 py-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <QrCode className="h-3 w-3" />
              <span>SmartTicketQR — Affichage en temps réel</span>
            </div>
            <span>
              Dernière MAJ :{' '}
              {new Date(data.updatedAt).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </footer>
      </div>
    );
  }

  // ── Render: Mobile Layout (<=768px) ────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b border-slate-800"
        style={{ borderTop: `3px solid ${accentColor}` }}
      >
        <div className="flex items-center gap-3">
          {data.organization.logoUrl ? (
            <img
              src={data.organization.logoUrl}
              alt={data.organization.name}
              className="h-8 w-auto object-contain rounded"
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-white text-sm"
              style={{ backgroundColor: accentColor }}
            >
              {data.organization.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              {data.organization.name}
            </h1>
            <p className="text-[10px] text-slate-500">Départs &amp; arrivées</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-medium text-emerald-400">Live</span>
          </div>
          <div className="text-lg font-bold tabular-nums text-white">
            <Clock className="inline h-3.5 w-3.5 mr-1 text-slate-400 -mt-0.5" />
            {new Date().toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </header>

      {/* Mobile tab toggle */}
      <div className="px-4 pt-4 pb-2">
        <MobileTabToggle
          activeTab={mobileTab}
          onTabChange={setMobileTab}
          accentColor={accentColor}
          departureCount={departures.length}
          arrivalCount={arrivals.length}
        />
      </div>

      {/* Mobile schedule list */}
      <main className="flex-1 px-4 pb-4">
        <div className="flex flex-col gap-2">
          {mobileTab === 'departures' ? (
            departures.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <Clock className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Aucun départ prévu</p>
              </div>
            ) : (
              departures.map((entry) => (
                <div key={entry.id}>
                  <ScheduleRow
                    entry={entry}
                    direction="departure"
                    accentColor={accentColor}
                  />
                  <MobileStatus entry={entry} accentColor={accentColor} />
                </div>
              ))
            )
          ) : arrivals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Clock className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Aucune arrivée prévue</p>
            </div>
          ) : (
            arrivals.map((entry) => (
              <div key={entry.id}>
                <ScheduleRow
                  entry={entry}
                  direction="arrival"
                  accentColor={accentColor}
                />
                <MobileStatus entry={entry} accentColor={accentColor} />
              </div>
            ))
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-4 py-2">
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-600">
          <QrCode className="h-3 w-3" />
          <span>SmartTicketQR — Affichage en temps réel</span>
        </div>
      </footer>
    </div>
  );
}
