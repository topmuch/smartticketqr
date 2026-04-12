'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2, RefreshCw, QrCode } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
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
  type TemplateProps,
} from './display-templates';

// ── Types ───────────────────────────────────────────────────────────────────

interface DisplayConfig {
  id: string;
  name: string;
  eventId: string | null;
  template: 'kiosk' | 'compact' | 'full' | 'queue' | 'transport';
  cycleInterval: number;
  accentColor: string;
  showStats: boolean;
  showOrganization: boolean;
  autoRefresh: boolean;
  isPublic: boolean;
  isActive: boolean;
  createdAt: string;
}

interface ScreenData {
  config: DisplayConfig;
  organization: {
    name: string;
    logoUrl?: string;
    primaryColor?: string;
  };
  tickets: Array<{
    id: string;
    holderName: string;
    ticketType: string;
    eventName: string;
    isValid: boolean;
    validatedAt: string;
    ticketCode?: string;
  }>;
  stats: {
    totalScans: number;
    validScans: number;
    rejectedScans: number;
    validationRate: number;
    activeTickets: number;
    eventCapacity: number;
    occupancyRate: number;
    lastScanAt: string | null;
  };
  event?: {
    id: string;
    name: string;
    startDate?: string;
    endDate?: string;
    location?: string;
    totalTickets?: number;
    soldTickets?: number;
    type?: string;
  };
}

interface PublicDisplayProps {
  configId: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PublicDisplay({ configId }: PublicDisplayProps) {
  const [data, setData] = useState<ScreenData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  const cycleInterval = data?.config?.cycleInterval || 8;
  const template = data?.config?.template || 'kiosk';

  // ── Fetch screen data ────────────────────────────────────────────────────

  const fetchData = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setIsInitialLoading(true);
      setError(null);

      const res = await fetch(`/api/display/screens?configId=${encodeURIComponent(configId)}`);

      if (!res.ok) {
        if (res.status === 404) {
          setError('Configuration non trouvée. Vérifiez le lien.');
        } else if (res.status === 403) {
          setError('Cet écran n\'est pas accessible publiquement ou est désactivé.');
        } else if (res.status === 429) {
          setError('Trop de requêtes. Veuillez patienter.');
        } else {
          setError('Erreur lors du chargement de l\'écran.');
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
  }, [configId]);

  // ── Initial fetch ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!configId) return;
    fetchData(true);
  }, [configId, fetchData]);

  // ── Auto-refresh data every 15s ──────────────────────────────────────────

  useEffect(() => {
    if (!data) return;
    const interval = setInterval(() => {
      fetchData(false);
    }, 15_000);
    return () => clearInterval(interval);
  }, [data, fetchData]);

  // ── WebSocket connection for real-time updates ───────────────────────────

  useEffect(() => {
    if (!data?.config?.eventId) return;

    const s = io('/?XTransformPort=3004', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
    });

    s.on('connect', () => {
      setWsConnected(true);
      if (data.config.eventId) {
        s.emit('join-event', data.config.eventId);
      }
    });

    s.on('disconnect', () => setWsConnected(false));
    s.on('connect_error', () => setWsConnected(false));

    // Listen for new validation events to refresh data
    s.on('validation', () => {
      fetchData(false);
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [data?.config?.eventId, fetchData]);

  // ── Auto-cycle for kiosk and transport templates ────────────────────────

  useEffect(() => {
    if (!data) return;
    const tickets = mapTickets(data.tickets);
    if (tickets.length <= 1) return;
    if (template !== 'kiosk' && template !== 'transport') return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % tickets.length);
    }, cycleInterval * 1000);

    return () => clearInterval(timer);
  }, [data, template, cycleInterval]);

  // ── Data mappers ─────────────────────────────────────────────────────────

  function mapTickets(raw: ScreenData['tickets']): ValidatedTicket[] {
    return raw.map((t) => ({
      id: t.id,
      holderName: t.holderName,
      ticketType: t.ticketType,
      eventName: t.eventName,
      organization: data?.organization?.name || 'SmartTicketQR',
      validatedAt: t.validatedAt,
      isValid: t.isValid,
      ticketCode: t.ticketCode,
    }));
  }

  function mapStats(raw: ScreenData['stats']): DisplayStats {
    return {
      totalScans: raw.totalScans,
      valid: raw.validScans,
      rejected: raw.rejectedScans,
      validationRate: raw.validationRate,
      totalTickets: raw.eventCapacity,
      scannedCount: raw.activeTickets,
    };
  }

  function mapOrg(): DisplayOrg {
    if (!data) return { name: 'SmartTicketQR', primaryColor: '#28A745' };
    return {
      name: data.config.showOrganization !== false ? data.organization.name : '',
      primaryColor: data.organization.primaryColor || data.config.accentColor || '#28A745',
      logoUrl: data.organization.logoUrl,
    };
  }

  function mapEvent(): DisplayEvent | null {
    if (!data?.event) return null;
    return data.event;
  }

  // ── Loading state ────────────────────────────────────────────────────────

  if (isInitialLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">Chargement de l&apos;écran...</p>
            <p className="mt-1 text-sm text-gray-500">
              Connexion au serveur SmartTicketQR
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 text-white">
        <div className="flex flex-col items-center gap-6 text-center max-w-md">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/15">
            <AlertTriangle className="h-10 w-10 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Écran indisponible</h1>
            <p className="mt-2 text-sm text-gray-400">
              {error || 'Une erreur inattendue est survenue.'}
            </p>
          </div>
          <button
            onClick={() => fetchData(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </button>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <QrCode className="h-3.5 w-3.5" />
            <span>SmartTicketQR Dynamic Display</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Build template props ─────────────────────────────────────────────────

  const tickets = mapTickets(data.tickets);
  const stats = mapStats(data.stats);
  const org = mapOrg();
  const event = mapEvent();
  const accentColor = data.config.accentColor || '#28A745';

  const safeIndex = tickets.length > 0 ? activeIndex % tickets.length : 0;
  const currentTicket = (template === 'kiosk' || template === 'transport')
    ? tickets[safeIndex] || null
    : null;

  const templateProps: TemplateProps = {
    ticket: currentTicket,
    tickets,
    stats: data.config.showStats !== false ? stats : {
      totalScans: 0,
      valid: 0,
      rejected: 0,
      validationRate: 0,
    },
    org,
    accentColor,
    event,
  };

  // ── Render template ─────────────────────────────────────────────────────

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
    <div className="relative min-h-screen">
      {renderedTemplate}

      {/* Connection indicator */}
      <div className="pointer-events-none fixed right-3 top-3 z-50">
        {wsConnected ? (
          <div className="flex items-center gap-1.5 rounded-full bg-green-500/20 px-3 py-1.5 text-xs text-green-400 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span>En direct</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full bg-yellow-500/20 px-3 py-1.5 text-xs text-yellow-400 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
            <span>Reconnexion...</span>
          </div>
        )}
      </div>

      {/* SmartTicketQR watermark */}
      <div className="pointer-events-none fixed bottom-2 right-3 z-50 flex items-center gap-1.5 opacity-20">
        <QrCode className="h-3 w-3 text-gray-400" />
        <span className="text-[10px] text-gray-500">SmartTicketQR</span>
      </div>
    </div>
  );
}
