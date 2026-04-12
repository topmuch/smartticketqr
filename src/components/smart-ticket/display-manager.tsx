'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  Ticket,
  QrCode,
  Monitor,
  Wifi,
  WifiOff,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ValidatedTicket {
  id: string;
  holderName: string;
  ticketType: string;
  eventName: string;
  organization: string;
  validatedAt: string; // ISO date string
  isValid: boolean;
  ticketCode?: string;
}

interface DisplayManagerProps {
  /** Title shown in the header */
  title?: string;
  /** Subtitle shown below the title */
  subtitle?: string;
  /** Organization name */
  organization?: string;
  /** Event name */
  eventName?: string;
  /** Accent color for valid status (default: green) */
  accentColor?: string;
  /** Auto-cycle interval in ms (default: 8000) */
  cycleInterval?: number;
  /** External tickets (if not polling) */
  tickets?: ValidatedTicket[];
  /** Polling URL for real-time data */
  pollUrl?: string;
  /** WebSocket URL for real-time data */
  wsUrl?: string;
  /** Custom empty state message */
  emptyMessage?: string;
  /** CSS class */
  className?: string;
}

// ── Animation Variants ──────────────────────────────────────────────────────

const slideIn = {
  initial: { opacity: 0, y: 40, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -40, scale: 0.95 },
};

// ── Component ───────────────────────────────────────────────────────────────

export function DisplayManager({
  title = 'Contrôle d\'entrée',
  subtitle = 'Scannez vos billets pour valider votre entrée',
  organization = 'SmartTicketQR',
  eventName = 'Événement',
  accentColor = '#28A745',
  cycleInterval = 8000,
  tickets: externalTickets,
  pollUrl,
  wsUrl,
  emptyMessage = 'En attente de scan...',
  className = '',
}: DisplayManagerProps) {
  const [tickets, setTickets] = useState<ValidatedTicket[]>(externalTickets ?? []);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const cycleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Use externalTickets or internal state; derive safely
  const displayTickets = externalTickets ?? tickets;

  // ── Polling ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!pollUrl || wsUrl) return;

    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(pollUrl);
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setTickets(data);
          setIsOnline(true);
        }
      } catch {
        setIsOnline(false);
      }
    };

    poll();
    const interval = setInterval(poll, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [pollUrl, wsUrl]);

  // ── WebSocket ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!wsUrl) return;

    let ws: WebSocket;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
        setIsOnline(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'validation' && data.ticket) {
            setTickets((prev) => [data.ticket, ...prev].slice(0, 50));
          } else if (Array.isArray(data)) {
            setTickets(data);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        // Reconnect after 3s
        setTimeout(() => {
          if (wsRef.current) connect();
        }, 3000);
      };

      ws.onerror = () => {
        setIsOnline(false);
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      wsRef.current = null;
      ws?.close();
    };
  }, [wsUrl]);

  // ── Online/Offline detection ─────────────────────────────────────────────

  useEffect(() => {
    const goOffline = () => setIsOnline(false);
    const goOnline = () => setIsOnline(true);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // ── Auto-cycle ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (tickets.length <= 1) return;

    cycleTimerRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % tickets.length);
    }, cycleInterval);

    return () => {
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);
    };
  }, [tickets.length, cycleInterval]);

  // Keep activeIndex in bounds (derived)
  const safeIndex = tickets.length > 0 ? activeIndex % tickets.length : 0;

  const handleManualPrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + tickets.length) % tickets.length);
  }, [tickets.length]);

  const handleManualNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % tickets.length);
  }, [tickets.length]);

  // ── Stats ────────────────────────────────────────────────────────────────

  const totalValidated = displayTickets.length;
  const totalValid = displayTickets.filter((t) => t.isValid).length;
  const totalInvalid = totalValidated - totalValid;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={`flex min-h-screen flex-col bg-gray-950 text-white ${className}`}>
      {/* Header bar */}
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900/80 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: accentColor + '20' }}>
            <QrCode className="h-5 w-5" style={{ color: accentColor }} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h1>
            <p className="text-xs text-gray-400">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status */}
          {wsUrl && (
            <div className="flex items-center gap-1.5 text-xs">
              {wsConnected ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-green-400" />
                  <span className="text-green-400">Connecté</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-yellow-400" />
                  <span className="text-yellow-400">Reconnexion...</span>
                </>
              )}
            </div>
          )}

          {!isOnline && (
            <Badge variant="destructive" className="text-xs">
              Hors ligne
            </Badge>
          )}

          {/* Organization & Event */}
          <div className="hidden md:block text-right">
            <p className="text-xs font-medium text-gray-300">{organization}</p>
            <p className="text-xs text-gray-500">{eventName}</p>
          </div>
        </div>
      </header>

      {/* Stats bar */}
      <div className="flex items-center gap-4 border-b border-gray-800/50 bg-gray-900/40 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Monitor className="h-3.5 w-3.5" />
          <span>Mode écran</span>
        </div>
        <div className="h-3 w-px bg-gray-700" />
        <span className="text-xs text-gray-400">
          Total : <span className="font-semibold text-white">{totalValidated}</span>
        </span>
        <span className="text-xs text-green-400">
          Validés : {totalValid}
        </span>
        <span className="text-xs text-red-400">
          Refusés : {totalInvalid}
        </span>
      </div>

      {/* Main content */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
        {displayTickets.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-800/60">
              <Ticket className="h-10 w-10 text-gray-500" />
            </div>
            <p className="text-lg text-gray-400">{emptyMessage}</p>
            <p className="text-sm text-gray-600">
              Les billets validés apparaîtront ici automatiquement
            </p>
          </div>
        ) : (
          /* Ticket display */
          <div className="w-full max-w-2xl">
            <AnimatePresence mode="wait">
              {displayTickets[safeIndex] && (
                <motion.div
                  key={displayTickets[safeIndex].id}
                  {...slideIn}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="flex flex-col items-center"
                >
                  {/* Status icon */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                    className="mb-6"
                  >
                    {displayTickets[safeIndex].isValid ? (
                      <div className="flex h-24 w-24 items-center justify-center rounded-full sm:h-28 sm:w-28" style={{ backgroundColor: accentColor + '20' }}>
                        <CheckCircle2 className="h-14 w-14 sm:h-16 sm:w-16" style={{ color: accentColor }} />
                      </div>
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-500/20 sm:h-28 sm:w-28">
                        <XCircle className="h-14 w-14 text-red-400 sm:h-16 sm:w-16" />
                      </div>
                    )}
                  </motion.div>

                  {/* Ticket card */}
                  <div className="w-full rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8">
                    {/* Valid / Invalid badge */}
                    <div className="mb-4 flex justify-center">
                      <Badge
                        className="px-4 py-1.5 text-sm font-semibold"
                        style={{
                          backgroundColor: displayTickets[safeIndex].isValid ? accentColor + '20' : 'rgba(239, 68, 68, 0.2)',
                          color: displayTickets[safeIndex].isValid ? accentColor : '#ef4444',
                          border: `1px solid ${displayTickets[safeIndex].isValid ? accentColor + '40' : 'rgba(239, 68, 68, 0.4)'}`,
                        }}
                      >
                        {displayTickets[safeIndex].isValid ? 'Billet valide' : 'Billet refusé'}
                      </Badge>
                    </div>

                    {/* Holder name */}
                    <h2 className="mb-4 text-center text-2xl font-bold sm:text-3xl">
                      {displayTickets[safeIndex].holderName}
                    </h2>

                    {/* Details grid */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <InfoRow label="Type de billet" value={displayTickets[safeIndex].ticketType} />
                      <InfoRow label="Événement" value={displayTickets[safeIndex].eventName} />
                      <InfoRow label="Organisation" value={displayTickets[safeIndex].organization} />
                      <InfoRow
                        label="Validé à"
                        value={formatTime(displayTickets[safeIndex].validatedAt)}
                      />
                      {displayTickets[safeIndex].ticketCode && (
                        <InfoRow label="Code" value={displayTickets[safeIndex].ticketCode} />
                      )}
                    </div>
                  </div>

                  {/* Navigation dots + controls */}
                  {displayTickets.length > 1 && (
                    <div className="mt-6 flex items-center gap-4">
                      <button
                        onClick={handleManualPrev}
                        className="rounded-lg bg-gray-800 p-2 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                        aria-label="Billet précédent"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {displayTickets.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveIndex(idx)}
                            className={`h-2 rounded-full transition-all ${
                              idx === safeIndex
                                ? 'w-6'
                                : 'w-2 bg-gray-600 hover:bg-gray-500'
                            }`}
                            style={
                              idx === activeIndex
                                ? { backgroundColor: accentColor }
                                : undefined
                            }
                            aria-label={`Billet ${idx + 1}`}
                          />
                        ))}
                      </div>

                      <button
                        onClick={handleManualNext}
                        className="rounded-lg bg-gray-800 p-2 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                        aria-label="Billet suivant"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 px-4 py-2 text-center text-xs text-gray-600 sm:px-6">
        SmartTicketQR &mdash; Gestion de billets simplifiée &bull; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

// ── Helper: Info Row ────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-800/50 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-200">{value}</p>
    </div>
  );
}

// ── Helper: Format time ─────────────────────────────────────────────────────

function formatTime(isoString: string): string {
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
