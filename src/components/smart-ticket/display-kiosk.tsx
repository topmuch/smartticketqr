'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react';
import {
  KioskTemplate,
  CompactTemplate,
  FullTemplate,
  QueueTemplate,
  TransportTemplate,
  type ValidatedTicket,
  type DisplayStats,
  type DisplayOrg,
  type DisplayEvent,
} from './display-templates';

// ── Types ───────────────────────────────────────────────────────────────────

// Display config type
export interface DisplayConfig {
  id: string;
  name: string;
  eventId: string | null;
  template: 'kiosk' | 'compact' | 'full' | 'queue' | 'transport';
  cycleInterval: number;
  accentColor: string;
  showStats: boolean;
  showOrganization: boolean;
}

interface DisplayKioskProps {
  config?: Partial<DisplayConfig>;
  organization?: Partial<DisplayOrg>;
  eventId?: string;
  className?: string;
}

const DEFAULT_STATS: DisplayStats = {
  totalScans: 0,
  valid: 0,
  rejected: 0,
  validationRate: 0,
  totalTickets: 0,
  scannedCount: 0,
};

const DEFAULT_ORG: DisplayOrg = {
  name: 'SmartTicketQR',
  primaryColor: '#28A745',
};

// ── Component ───────────────────────────────────────────────────────────────

export function DisplayKiosk({
  config,
  organization,
  eventId: propEventId,
  className = '',
}: DisplayKioskProps) {
  const [tickets, setTickets] = useState<ValidatedTicket[]>([]);
  const [stats, setStats] = useState<DisplayStats>(DEFAULT_STATS);
  const [event, setEvent] = useState<DisplayEvent | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const cycleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const effectiveEventId = config?.eventId || propEventId || '';
  const template = config?.template || 'kiosk';
  const cycleInterval = config?.cycleInterval || 8;
  const accentColor = config?.accentColor || '#28A745';
  const showStats = config?.showStats !== false;

  const org: DisplayOrg = {
    name: config?.showOrganization !== false
      ? (organization?.name || DEFAULT_ORG.name)
      : '',
    primaryColor: organization?.primaryColor || config?.accentColor || DEFAULT_ORG.primaryColor,
    logoUrl: organization?.logoUrl,
  };

  // ── Fetch validated tickets ─────────────────────────────────────────────

  const fetchTickets = useCallback(async () => {
    if (!effectiveEventId) return;
    try {
      const params = new URLSearchParams({ limit: '50' });
      const res = await fetch(`/api/display/validated?${params}`, {
        headers: { 'X-Event-Id': effectiveEventId },
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || data.tickets || [];
        setTickets(list);
        setIsOnline(true);
      }
    } catch {
      setIsOnline(false);
    }
  }, [effectiveEventId]);

  // ── Fetch stats ─────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    if (!effectiveEventId) return;
    try {
      const res = await fetch(`/api/display/stats?eventId=${effectiveEventId}`, {
        headers: { 'X-Event-Id': effectiveEventId },
      });
      if (res.ok) {
        const data = await res.json();
        setStats((prev) => ({
          ...prev,
          ...data,
          validationRate: data.totalScans > 0 ? (data.valid / data.totalScans) * 100 : 0,
        }));
      }
    } catch {
      // silent
    }
  }, [effectiveEventId]);

  // ── Fetch event details ─────────────────────────────────────────────────

  useEffect(() => {
    if (!effectiveEventId) return;
    let active = true;
    fetch(`/api/events/${effectiveEventId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (active && data) {
          setEvent({
            id: data.id,
            name: data.name,
            startDate: data.startDate,
            endDate: data.endDate,
            location: data.location,
            totalTickets: data.totalTickets,
            soldTickets: data.soldTickets,
            type: data.type,
          });
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [effectiveEventId]);

  // ── Initial data fetch ──────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      await Promise.all([fetchTickets(), fetchStats()]);
      if (!cancelled) setIsInitialLoading(false);
    };

    init();

    return () => { cancelled = true; };
  }, [fetchTickets, fetchStats]);

  // ── Stats polling (every 10s) ───────────────────────────────────────────

  useEffect(() => {
    if (!effectiveEventId) return;

    statsTimerRef.current = setInterval(() => {
      fetchStats();
    }, 10000);

    return () => {
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    };
  }, [effectiveEventId, fetchStats]);

  // ── WebSocket connection ────────────────────────────────────────────────

  useEffect(() => {
    let socket: Socket;

    const connect = () => {
      socket = io('/?XTransformPort=3004', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 3000,
      });

      socket.on('connect', () => {
        setWsConnected(true);
        setIsOnline(true);
        // Join event room
        if (effectiveEventId) {
          socket.emit('join-event', effectiveEventId);
        }
      });

      socket.on('disconnect', () => {
        setWsConnected(false);
      });

      socket.on('connect_error', () => {
        setWsConnected(false);
        setIsOnline(false);
      });

      // Listen for new validation events
      socket.on('validation', (data: { ticket?: ValidatedTicket; type: string }) => {
        if (data.ticket) {
          setTickets((prev) => [data.ticket!, ...prev].slice(0, 50));
          setActiveIndex(0);
          // Refresh stats
          fetchStats();
        }
      });

      // Listen for bulk data
      socket.on('validated-tickets', (data: ValidatedTicket[]) => {
        if (Array.isArray(data)) {
          setTickets(data.slice(0, 50));
        }
      });

      socketRef.current = socket;
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [effectiveEventId, fetchStats]);

  // ── Auto-cycle for kiosk and transport templates ────────────────────────

  useEffect(() => {
    if (tickets.length <= 1) return;
    if (template !== 'kiosk' && template !== 'transport') return;

    cycleTimerRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % tickets.length);
    }, cycleInterval * 1000);

    return () => {
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);
    };
  }, [tickets.length, template, cycleInterval]);

  // Keep activeIndex in bounds
  const safeIndex = tickets.length > 0 ? activeIndex % tickets.length : 0;
  const currentTicket = (template === 'kiosk' || template === 'transport')
    ? tickets[safeIndex] || null
    : null;

  // ── Loading state ────────────────────────────────────────────────────────

  if (isInitialLoading) {
    return (
      <div className={`flex min-h-screen items-center justify-center bg-gray-950 ${className}`}>
        <div className="flex flex-col items-center gap-4 text-white">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: accentColor }} />
          <p className="text-sm text-gray-400">Chargement de l&apos;écran...</p>
        </div>
      </div>
    );
  }

  // ── Render template ─────────────────────────────────────────────────────

  const templateProps = {
    ticket: currentTicket,
    tickets,
    stats: showStats ? stats : { ...DEFAULT_STATS },
    org,
    accentColor,
    event,
  };

  const renderedTemplate = (() => {
    switch (template) {
      case 'compact':
        return <CompactTemplate {...templateProps} />;
      case 'full':
        return <FullTemplate {...templateProps} />;
      case 'queue':
        return <QueueTemplate {...templateProps} />;
      case 'transport':
        return <TransportTemplate {...templateProps} />;
      case 'kiosk':
      default:
        return <KioskTemplate {...templateProps} />;
    }
  })();

  return (
    <div className={`relative ${className}`}>
      {renderedTemplate}

      {/* Connection indicator overlay */}
      <div className="pointer-events-none fixed right-3 top-3 z-50">
        {wsConnected ? (
          <div className="flex items-center gap-1.5 rounded-full bg-green-500/20 px-3 py-1.5 text-xs text-green-400 backdrop-blur-sm">
            <Wifi className="h-3 w-3" />
            <span>En direct</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full bg-yellow-500/20 px-3 py-1.5 text-xs text-yellow-400 backdrop-blur-sm">
            <WifiOff className="h-3 w-3" />
            <span>Reconnexion...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default DisplayKiosk;
