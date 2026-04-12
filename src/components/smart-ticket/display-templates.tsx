'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  QrCode,
  Ticket,
  Users,
  Clock,
  ArrowRight,
  Bus,
  Ship,
  TrainFront,
  BarChart3,
  Timer,
  Hash,
  AlertTriangle,
  Gauge,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ValidatedTicket {
  id: string;
  holderName: string;
  ticketType: string;
  eventName: string;
  organization: string;
  validatedAt: string;
  isValid: boolean;
  ticketCode?: string;
}

export interface DisplayStats {
  totalScans: number;
  valid: number;
  rejected: number;
  validationRate: number;
  totalTickets?: number;
  scannedCount?: number;
}

export interface DisplayOrg {
  name: string;
  primaryColor: string;
  logoUrl?: string;
}

export interface DisplayEvent {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  totalTickets?: number;
  soldTickets?: number;
  type?: string;
}

export interface TemplateProps {
  ticket?: ValidatedTicket | null;
  tickets: ValidatedTicket[];
  stats: DisplayStats;
  org: DisplayOrg;
  accentColor: string;
  event?: DisplayEvent | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function formatTimeWithSeconds(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span>{time}</span>;
}

function OrgBranding({ org }: { org: DisplayOrg }) {
  return (
    <div className="flex items-center gap-2">
      {org.logoUrl ? (
        <img
          src={org.logoUrl}
          alt={org.name}
          className="h-8 w-8 rounded-lg object-cover"
        />
      ) : (
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: org.primaryColor + '30' }}
        >
          <QrCode className="h-4 w-4" style={{ color: org.primaryColor }} />
        </div>
      )}
      <span className="text-sm font-semibold tracking-tight">{org.name}</span>
    </div>
  );
}

// ── Kiosk Template ──────────────────────────────────────────────────────────

export function KioskTemplate({
  ticket,
  tickets,
  stats,
  org,
  accentColor,
  event,
}: TemplateProps) {
  const currentTicket = ticket || (tickets.length > 0 ? tickets[0] : null);

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-gray-800/60 bg-gray-900/80 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <OrgBranding org={org} />
          {event?.name && (
            <>
              <div className="h-4 w-px bg-gray-700" />
              <span className="hidden text-sm text-gray-400 sm:inline">
                {event.name}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock className="h-4 w-4" />
          <LiveClock />
        </div>
      </header>

      {/* Main display area */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
        {!currentTicket ? (
          /* Empty state */
          <div className="flex flex-col items-center gap-6 text-center animate-pulse">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gray-800/60">
              <Ticket className="h-14 w-14 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-400">
                En attente de scan...
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Les billets validés apparaîtront ici automatiquement
              </p>
            </div>
          </div>
        ) : (
          /* Ticket display with CSS animation */
          <div
            className="w-full max-w-2xl animate-[slideInRight_0.5s_ease-out]"
            key={currentTicket.id}
          >
            {/* Status icon */}
            <div className="mb-8 flex justify-center">
              {currentTicket.isValid ? (
                <div
                  className="flex h-28 w-28 items-center justify-center rounded-full animate-[scaleIn_0.4s_ease-out]"
                  style={{ backgroundColor: accentColor + '20' }}
                >
                  <CheckCircle2
                    className="h-16 w-16"
                    style={{ color: accentColor }}
                  />
                </div>
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-red-500/20 animate-[scaleIn_0.4s_ease-out]">
                  <XCircle className="h-16 w-16 text-red-400" />
                </div>
              )}
            </div>

            {/* Ticket card */}
            <div className="w-full rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8">
              {/* Valid/Invalid badge */}
              <div className="mb-4 flex justify-center">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-5 py-1.5 text-sm font-semibold"
                  style={{
                    backgroundColor: currentTicket.isValid
                      ? accentColor + '20'
                      : 'rgba(239, 68, 68, 0.2)',
                    color: currentTicket.isValid
                      ? accentColor
                      : '#ef4444',
                    border: `1px solid ${currentTicket.isValid ? accentColor + '40' : 'rgba(239, 68, 68, 0.4)'}`,
                  }}
                >
                  {currentTicket.isValid ? 'Billet valide' : 'Billet refusé'}
                </span>
              </div>

              {/* Holder name */}
              <h2 className="mb-6 text-center text-3xl font-bold sm:text-4xl">
                {currentTicket.holderName}
              </h2>

              {/* Details grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoBox
                  label="Type de billet"
                  value={currentTicket.ticketType}
                />
                {event?.name && (
                  <InfoBox label="Événement" value={event.name} />
                )}
                <InfoBox label="Organisation" value={org.name} />
                <InfoBox
                  label="Validé à"
                  value={formatTimeWithSeconds(currentTicket.validatedAt)}
                />
                {currentTicket.ticketCode && (
                  <InfoBox label="Code" value={currentTicket.ticketCode} />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom stats bar */}
      {stats && (
        <footer className="flex items-center justify-center gap-6 border-t border-gray-800/60 bg-gray-900/80 px-4 py-3 sm:gap-10 sm:px-6 sm:py-4">
          <StatItem label="Total scans" value={stats.totalScans} />
          <div className="h-6 w-px bg-gray-700" />
          <StatItem
            label="Validés"
            value={stats.valid}
            color={accentColor}
          />
          <div className="h-6 w-px bg-gray-700" />
          <StatItem label="Refusés" value={stats.rejected} color="#ef4444" />
          <div className="h-6 w-px bg-gray-700" />
          <StatItem
            label="Taux"
            value={`${stats.validationRate.toFixed(1)}%`}
            color={accentColor}
          />
        </footer>
      )}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-800/50 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-200">{value}</p>
    </div>
  );
}

function StatItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className="text-lg font-bold"
        style={color ? { color } : { color: '#fff' }}
      >
        {value}
      </p>
    </div>
  );
}

// ── Compact Template ────────────────────────────────────────────────────────

export function CompactTemplate({
  tickets,
  stats,
  org,
  accentColor,
  event,
}: TemplateProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-gray-50 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">
              {event?.name || 'Contrôle d\'entrée'}
            </h1>
            <p className="text-sm text-gray-500">{org.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 rounded-full px-4 py-2"
              style={{ backgroundColor: accentColor + '15' }}
            >
              <Ticket className="h-4 w-4" style={{ color: accentColor }} />
              <span className="text-sm font-semibold" style={{ color: accentColor }}>
                {stats.totalScans} scans
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Validation feed */}
      <main className="flex-1 overflow-hidden">
        {tickets.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Ticket className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-lg font-medium text-gray-400">
                En attente de scan...
              </p>
            </div>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-140px)] overflow-y-auto p-4 sm:p-6">
            <div className="space-y-2">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 transition-all hover:bg-gray-100 animate-[fadeIn_0.3s_ease-out]"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: t.isValid ? accentColor + '20' : 'rgba(239, 68, 68, 0.15)',
                    }}
                  >
                    {t.isValid ? (
                      <CheckCircle2 className="h-4 w-4" style={{ color: accentColor }} />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold">{t.holderName}</p>
                    <p className="text-xs text-gray-400">
                      {t.ticketType} &middot; {formatTime(t.validatedAt)}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase"
                    style={{
                      backgroundColor: t.isValid ? accentColor + '15' : 'rgba(239, 68, 68, 0.1)',
                      color: t.isValid ? accentColor : '#ef4444',
                    }}
                  >
                    {t.isValid ? 'Valide' : 'Refusé'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer stats */}
      <footer className="flex items-center justify-center gap-6 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:gap-10">
        <MiniStat label="Validés" value={stats.valid} color={accentColor} />
        <MiniStat label="Refusés" value={stats.rejected} color="#ef4444" />
        <MiniStat
          label="Taux"
          value={`${stats.validationRate.toFixed(0)}%`}
          color={accentColor}
        />
      </footer>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color || '#6b7280' }} />
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-bold" style={{ color: color || '#111' }}>
        {value}
      </span>
    </div>
  );
}

// ── Full Template ───────────────────────────────────────────────────────────

export function FullTemplate({
  tickets,
  stats,
  org,
  accentColor,
  event,
}: TemplateProps) {
  const capacityPercent =
    stats.totalTickets && stats.totalTickets > 0
      ? ((stats.scannedCount || stats.totalScans) / stats.totalTickets) * 100
      : 0;

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      {/* Event banner */}
      <header className="border-b border-gray-800/60 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <OrgBranding org={org} />
            {event?.name && (
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold">{event.name}</h1>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
                  {event.location && <span>{event.location}</span>}
                  {event.startDate && (
                    <span>{new Date(event.startDate).toLocaleDateString('fr-FR')}</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock className="h-4 w-4" />
            <LiveClock />
          </div>
        </div>
        {/* Capacity bar */}
        {stats.totalTickets && stats.totalTickets > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Remplissage</span>
              <span>
                {stats.scannedCount || stats.totalScans} / {stats.totalTickets}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(capacityPercent, 100)}%`,
                  backgroundColor: accentColor,
                }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Live feed */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-gray-800/40 px-4 py-3 sm:px-6">
            <h2 className="text-sm font-semibold text-gray-300">
              Dernières validations
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {tickets.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <QrCode className="mx-auto h-10 w-10 animate-pulse text-gray-700" />
                  <p className="mt-3 text-sm text-gray-600">
                    En attente de scan...
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.slice(0, 20).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-lg bg-gray-900/80 px-3 py-2.5 border border-gray-800/40 transition-colors hover:bg-gray-800/80"
                  >
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: t.isValid ? accentColor + '25' : 'rgba(239,68,68,0.2)',
                      }}
                    >
                      {t.isValid ? (
                        <CheckCircle2 className="h-3.5 w-3.5" style={{ color: accentColor }} />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{t.holderName}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">
                      {formatTime(t.validatedAt)}
                    </span>
                    <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded" style={{
                      backgroundColor: t.isValid ? accentColor + '15' : 'rgba(239,68,68,0.1)',
                      color: t.isValid ? accentColor : '#ef4444',
                    }}>
                      {t.ticketType}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Right: Stats panel */}
        <aside className="hidden w-72 shrink-0 flex-col border-l border-gray-800/60 bg-gray-900/60 lg:flex">
          <div className="border-b border-gray-800/40 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-300">Statistiques</h2>
          </div>
          <div className="flex-1 space-y-6 p-4">
            {/* Big number */}
            <div className="text-center">
              <p className="text-5xl font-bold" style={{ color: accentColor }}>
                {stats.totalScans}
              </p>
              <p className="mt-1 text-xs text-gray-500">Scans totaux</p>
            </div>

            {/* Rate ring */}
            <div className="flex items-center justify-center">
              <div className="relative h-32 w-32">
                <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    stroke="#1f2937"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    stroke={accentColor}
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${(stats.validationRate / 100) * 314.16} 314.16`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold" style={{ color: accentColor }}>
                      {stats.validationRate.toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-gray-500">Taux de validation</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Valid / Rejected bars */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" style={{ color: accentColor }} />
                    Validés
                  </span>
                  <span className="font-semibold">{stats.valid}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: stats.totalScans > 0 ? `${(stats.valid / stats.totalScans) * 100}%` : '0%',
                      backgroundColor: accentColor,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-400" />
                    Refusés
                  </span>
                  <span className="font-semibold">{stats.rejected}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all duration-700"
                    style={{
                      width: stats.totalScans > 0 ? `${(stats.rejected / stats.totalScans) * 100}%` : '0%',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Organization branding */}
          <div className="border-t border-gray-800/40 px-4 py-3 text-center">
            <p className="text-xs text-gray-600">{org.name}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Queue Template ──────────────────────────────────────────────────────────

export function QueueTemplate({
  tickets,
  stats,
  org,
  accentColor,
}: TemplateProps) {
  const currentTicket = tickets.length > 0 ? tickets[0] : null;
  const recentValidated = tickets.filter((t) => t.isValid).slice(0, 3);
  const waitingCount = Math.max(
    0,
    (stats.totalTickets || 0) - (stats.scannedCount || stats.totalScans)
  );
  const avgServiceTime = 30; // seconds estimate
  const estimatedWait = waitingCount * avgServiceTime;

  function formatWaitTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}min ${sec}s`;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-gray-800/60 bg-gray-900/80 px-4 py-3 sm:px-6 sm:py-4">
        <OrgBranding org={org} />
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock className="h-4 w-4" />
          <LiveClock />
        </div>
      </header>

      {/* Main queue display */}
      <main className="flex flex-1 flex-col items-center justify-center p-4 sm:p-8">
        {/* Waiting count */}
        <div className="mb-8 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-gray-500">
            En attente
          </p>
          <p className="mt-1 text-7xl font-black sm:text-8xl" style={{ color: accentColor }}>
            {waitingCount}
          </p>
          <p className="mt-1 text-sm text-gray-500">personnes dans la file</p>
        </div>

        {/* Currently scanning */}
        <div className="mb-8 w-full max-w-lg">
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-widest text-gray-500">
            En cours de validation
          </p>
          {currentTicket ? (
            <div className="animate-[scaleIn_0.4s_ease-out] rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center">
              <div
                className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full"
                style={{
                  backgroundColor: currentTicket.isValid
                    ? accentColor + '20'
                    : 'rgba(239, 68, 68, 0.2)',
                }}
              >
                {currentTicket.isValid ? (
                  <CheckCircle2 className="h-10 w-10" style={{ color: accentColor }} />
                ) : (
                  <XCircle className="h-10 w-10 text-red-400" />
                )}
              </div>
              <h2 className="text-2xl font-bold sm:text-3xl">{currentTicket.holderName}</h2>
              <p className="mt-1 text-sm text-gray-400">{currentTicket.ticketType}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-800 border-dashed bg-gray-900/40 p-8 text-center">
              <QrCode className="mx-auto h-10 w-10 animate-pulse text-gray-700" />
              <p className="mt-3 text-sm text-gray-600">En attente du prochain billet...</p>
            </div>
          )}
        </div>

        {/* Wait time & rate */}
        <div className="mb-8 grid w-full max-w-lg grid-cols-3 gap-4">
          <WaitInfoCard
            icon={<Timer className="h-5 w-5" style={{ color: accentColor }} />}
            label="Temps estimé"
            value={formatWaitTime(estimatedWait)}
          />
          <WaitInfoCard
            icon={<Gauge className="h-5 w-5" style={{ color: accentColor }} />}
            label="Débit"
            value={`${Math.max(1, Math.round(stats.totalScans / Math.max(1, 60)))}/min`}
          />
          <WaitInfoCard
            icon={<Hash className="h-5 w-5" style={{ color: accentColor }} />}
            label="Guichet"
            value="01"
          />
        </div>

        {/* Last 3 validated */}
        {recentValidated.length > 0 && (
          <div className="w-full max-w-lg">
            <p className="mb-2 text-center text-xs font-medium uppercase tracking-widest text-gray-500">
              Dernières validations
            </p>
            <div className="flex items-center justify-center gap-3">
              {recentValidated.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-lg bg-gray-900 border border-gray-800/40 px-3 py-2"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: accentColor }} />
                  <span className="text-sm font-medium">{t.holderName}</span>
                  <span className="text-xs text-gray-500">
                    {formatTime(t.validatedAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer stats */}
      <footer className="flex items-center justify-center gap-6 border-t border-gray-800/60 bg-gray-900/80 px-4 py-3 sm:gap-10">
        <StatItem label="Total" value={stats.totalScans} />
        <div className="h-6 w-px bg-gray-700" />
        <StatItem label="Validés" value={stats.valid} color={accentColor} />
        <div className="h-6 w-px bg-gray-700" />
        <StatItem label="Refusés" value={stats.rejected} color="#ef4444" />
        <div className="h-6 w-px bg-gray-700" />
        <StatItem
          label="Taux"
          value={`${stats.validationRate.toFixed(1)}%`}
          color={accentColor}
        />
      </footer>
    </div>
  );
}

function WaitInfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-gray-900 border border-gray-800/40 px-3 py-3">
      {icon}
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

// ── Transport Template ──────────────────────────────────────────────────────

export function TransportTemplate({
  tickets,
  stats,
  org,
  accentColor,
  event,
}: TemplateProps) {
  const isServiceActive = event?.type && ['bus', 'boat', 'ferry'].includes(event.type)
    ? true
    : tickets.length > 0;

  const TransportIcon =
    event?.type === 'bus'
      ? Bus
      : event?.type === 'ferry'
        ? Ship
        : TrainFront;

  const capacityPercent =
    stats.totalTickets && stats.totalTickets > 0
      ? ((stats.scannedCount || stats.totalScans) / stats.totalTickets) * 100
      : 0;

  // Calculate departure countdown (fake — uses event end date)
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    const target = event?.endDate ? new Date(event.endDate).getTime() : Date.now() + 3600000;
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      const min = Math.floor(diff / 60000);
      const sec = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [event?.endDate]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-700/60 bg-slate-800/80 px-4 py-3 sm:px-6 sm:py-4">
        <OrgBranding org={org} />
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Clock className="h-4 w-4" />
          <LiveClock />
        </div>
      </header>

      {/* Route banner */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-800/80 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: accentColor + '25' }}
          >
            <TransportIcon className="h-7 w-7" style={{ color: accentColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate sm:text-3xl">
              {event?.name || 'Itinéraire'}
            </h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-slate-400">
              {event?.location && <span>{event.location}</span>}
              {event?.startDate && (
                <span>
                  Départ :{' '}
                  {new Date(event.startDate).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold"
              style={{
                backgroundColor: isServiceActive ? accentColor + '20' : 'rgba(239,68,68,0.15)',
                color: isServiceActive ? accentColor : '#ef4444',
              }}
            >
              <span
                className="h-2 w-2 rounded-full animate-pulse"
                style={{ backgroundColor: isServiceActive ? accentColor : '#ef4444' }}
              />
              {isServiceActive ? 'En service' : 'Terminé'}
            </span>
          </div>
        </div>

        {/* Countdown + Capacity */}
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-700/40 border border-slate-600/30 px-4 py-3">
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" />
              Prochain départ
            </p>
            <p className="mt-1 text-3xl font-bold tracking-wider" style={{ color: accentColor }}>
              {countdown}
            </p>
          </div>
          <div className="rounded-xl bg-slate-700/40 border border-slate-600/30 px-4 py-3">
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              Capacité
            </p>
            <div className="mt-2 flex items-end gap-2">
              <p className="text-3xl font-bold" style={{ color: accentColor }}>
                {stats.scannedCount || stats.totalScans}
              </p>
              <span className="mb-1 text-sm text-slate-500">
                / {stats.totalTickets || '—'}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-600/40">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(capacityPercent, 100)}%`,
                  backgroundColor:
                    capacityPercent > 90
                      ? '#ef4444'
                      : capacityPercent > 70
                        ? '#f59e0b'
                        : accentColor,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {capacityPercent.toFixed(0)}% rempli
            </p>
          </div>
        </div>
      </div>

      {/* Boarding feed */}
      <main className="flex-1 overflow-hidden">
        <div className="border-b border-slate-700/40 px-4 py-3 sm:px-6">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <ArrowRight className="h-4 w-4" style={{ color: accentColor }} />
            Embarquement en cours
          </h2>
        </div>
        <div className="max-h-[calc(100vh-380px)] overflow-y-auto p-4 sm:p-6">
          {tickets.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <div className="text-center">
                <Users className="mx-auto h-10 w-10 animate-pulse text-slate-700" />
                <p className="mt-3 text-sm text-slate-600">
                  En attente d&apos;embarquement...
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.slice(0, 25).map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg bg-slate-800/60 border border-slate-700/30 px-4 py-3 animate-[fadeIn_0.3s_ease-out]"
                >
                  <span className="w-6 text-center text-xs font-bold text-slate-500">
                    {i + 1}
                  </span>
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: t.isValid ? accentColor + '25' : 'rgba(239,68,68,0.2)',
                    }}
                  >
                    {t.isValid ? (
                      <CheckCircle2 className="h-4 w-4" style={{ color: accentColor }} />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{t.holderName}</p>
                    <p className="text-xs text-slate-500">
                      {t.ticketType} &middot; {formatTime(t.validatedAt)}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                    style={{
                      backgroundColor: t.isValid ? accentColor + '15' : 'rgba(239,68,68,0.1)',
                      color: t.isValid ? accentColor : '#ef4444',
                    }}
                  >
                    {t.isValid ? 'OK' : 'REFUSÉ'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer stats */}
      <footer className="flex items-center justify-center gap-6 border-t border-slate-700/60 bg-slate-800/80 px-4 py-3 sm:gap-10">
        <TransportStat label="Embarqués" value={stats.valid} color={accentColor} />
        <div className="h-6 w-px bg-slate-600" />
        <TransportStat label="Refusés" value={stats.rejected} color="#ef4444" />
        <div className="h-6 w-px bg-slate-600" />
        <TransportStat
          label="Taux"
          value={`${stats.validationRate.toFixed(1)}%`}
          color={accentColor}
        />
      </footer>
    </div>
  );
}

function TransportStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold" style={{ color: color || '#fff' }}>
        {value}
      </p>
    </div>
  );
}
