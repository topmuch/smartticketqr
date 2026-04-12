'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  QrCode,
  Ticket,
  User,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Share2,
  Copy,
  Loader2,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ============================================================
// TYPES
// ============================================================

interface TicketData {
  code: string;
  type: string;
  holderName: string;
  status: string;
  price: number;
  currency: string;
  seatNumber?: string;
  expiresAt?: string;
  issuedAt: string;
  validatedAt?: string;
}

interface EventData {
  name: string;
  type: string;
  description?: string;
  location?: string;
  startDate: string;
  endDate: string;
}

interface OrgData {
  name: string;
  color: string;
  logo?: string;
}

interface TicketPublicResponse {
  ticket: TicketData;
  event: EventData;
  organization: OrgData;
  qrImage: string;
}

interface ErrorResponse {
  error: string;
}

// ============================================================
// STATUS CONFIG
// ============================================================

function getStatusConfig(status: string) {
  const configs: Record<string, { label: string; color: string; bgColor: string; icon: typeof CheckCircle2 }> = {
    active: { label: 'Valide', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', icon: CheckCircle2 },
    used: { label: 'Utilisé', color: 'text-sky-600', bgColor: 'bg-sky-100 dark:bg-sky-900/30', icon: CheckCircle2 },
    expired: { label: 'Expiré', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30', icon: AlertTriangle },
    cancelled: { label: 'Annulé', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: XCircle },
  };
  return configs[status] || configs.active;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function PublicTicketView() {
  const [data, setData] = useState<TicketPublicResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [fullScreenQR, setFullScreenQR] = useState(false);

  // Parse URL params on mount
  const params = useMemo(() => {
    if (typeof window === 'undefined') return { code: null, org: null };
    const searchParams = new URLSearchParams(window.location.search);
    return {
      code: searchParams.get('code'),
      org: searchParams.get('org'),
    };
  }, []);

  useEffect(() => {
    const { code, org } = params;

    if (!code || !org) {
      // Wrap in microtask to avoid synchronous setState in effect
      queueMicrotask(() => {
        setError('Paramètres manquants. Veuillez utiliser le lien complet.');
        setLoading(false);
      });
      return;
    }

    fetch(`/api/ticket/public?code=${encodeURIComponent(code)}&org=${encodeURIComponent(org)}`)
      .then((res) => res.json())
      .then((result: TicketPublicResponse | ErrorResponse) => {
        if ('error' in result) {
          setError(result.error);
        } else {
          setData(result);
        }
      })
      .catch(() => setError('Erreur de connexion. Vérifiez votre lien.'))
      .finally(() => setLoading(false));
  }, []);

  const handleCopyCode = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.ticket.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = async () => {
    if (!data) return;
    const shareText = `🎟️ Mon ticket ${data.organization.name}\n${data.ticket.holderName} - ${data.event.name}\nCode: ${data.ticket.code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Ticket - ${data.event.name}`, text: shareText });
      } catch {
        // User cancelled share
      }
    } else {
      navigator.clipboard.writeText(shareText);
    }
  };

  const handleDownloadQR = () => {
    if (!data) return;
    const link = document.createElement('a');
    link.download = `qr-${data.ticket.code}.png`;
    link.href = data.qrImage;
    link.click();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500">Chargement du ticket...</p>
        </motion.div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4 max-w-md"
        >
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold">Ticket introuvable</h2>
          <p className="text-gray-500">{error}</p>
          <p className="text-xs text-gray-400">
            Vérifiez le lien ou contactez l&apos;organisateur.
          </p>
        </motion.div>
      </div>
    );
  }

  if (!data) return null;

  const statusConfig = getStatusConfig(data.ticket.status);
  const StatusIcon = statusConfig.icon;
  const isUsed = data.ticket.status === 'used';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 p-4 flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md"
      >
        {/* Organization Header */}
        <div className="text-center mb-6 pt-8">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ backgroundColor: `${data.organization.color}15` }}
          >
            <Ticket className="h-4 w-4" style={{ color: data.organization.color }} />
            <span className="text-sm font-semibold" style={{ color: data.organization.color }}>
              {data.organization.name}
            </span>
          </div>
        </div>

        {/* Main Ticket Card */}
        <Card className="overflow-hidden border-2 shadow-xl" style={{ borderColor: isUsed ? '#94a3b8' : data.organization.color }}>
          <CardContent className="p-0">
            {/* Status Banner */}
            <div
              className={`${statusConfig.bgColor} px-4 py-3 flex items-center justify-between`}
            >
              <div className="flex items-center gap-2">
                <StatusIcon className={`h-5 w-5 ${statusConfig.color}`} />
                <span className={`font-semibold text-sm ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
              </div>
              <Badge variant="outline" className="text-xs">
                {data.ticket.type}
              </Badge>
            </div>

            {/* QR Code Section */}
            <div
              className="relative cursor-pointer"
              onClick={() => setFullScreenQR(true)}
            >
              <div className="p-6 flex justify-center">
                <div className={`relative p-4 bg-white rounded-2xl shadow-inner ${isUsed ? 'opacity-50' : ''}`}>
                <img
                    src={data.qrImage}
                    alt="QR Code"
                    className="w-56 h-56 sm:w-64 sm:h-64"
                  />
                  {isUsed && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-red-500 text-white rounded-full p-3 shadow-lg">
                        <XCircle className="h-10 w-10" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-center text-xs text-gray-400 pb-2">
                Appuyez pour agrandir le QR Code
              </p>
            </div>

            {/* Divider */}
            <div className="border-t-2 border-dashed mx-6" style={{ borderColor: `${data.organization.color}40` }} />

            {/* Event Info */}
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Événement</p>
                <h2 className="text-lg font-bold">{data.event.name}</h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                  <span>{format(new Date(data.event.startDate), 'dd MMM yyyy')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                  <span>{format(new Date(data.event.startDate), 'HH:mm')}</span>
                </div>
              </div>

              {data.event.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                  <span>{data.event.location}</span>
                </div>
              )}

              {/* Divider */}
              <div className="border-t" />

              {/* Holder Info */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Passager</p>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="font-semibold">{data.ticket.holderName}</span>
                </div>
                {data.ticket.seatNumber && (
                  <p className="text-sm text-gray-500">
                    Siège : <span className="font-mono font-medium">{data.ticket.seatNumber}</span>
                  </p>
                )}
              </div>

              {/* Ticket Code */}
              <div
                className="rounded-xl p-3 text-center"
                style={{ backgroundColor: `${data.organization.color}10` }}
              >
                <p className="text-xs text-gray-400 mb-1">Code Billet</p>
                <p className="font-mono font-bold text-lg tracking-wider" style={{ color: data.organization.color }}>
                  {data.ticket.code}
                </p>
              </div>

              {/* Price */}
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {data.ticket.currency} {data.ticket.price.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6 mb-8">
          <Button variant="outline" className="flex-1" onClick={handleDownloadQR}>
            <Download className="h-4 w-4 mr-2" />
            Télécharger
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleCopyCode}>
            <Copy className="h-4 w-4 mr-2" />
            {copied ? 'Copié !' : 'Copier'}
          </Button>
          <Button
            className="flex-1"
            style={{ backgroundColor: data.organization.color }}
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Partager
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pb-8">
          Ce billet est personnel et non transférable. Présentez-le à l&apos;entrée.
        </p>
      </motion.div>

      {/* Full Screen QR Modal */}
      {fullScreenQR && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4"
          onClick={() => setFullScreenQR(false)}
        >
          <div className="bg-white p-8 rounded-3xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <img
                src={data.qrImage}
                alt="QR Code"
                className={`w-72 h-72 ${isUsed ? 'opacity-50' : ''}`}
              />
            </div>
            <p className="text-center font-mono font-bold text-lg text-gray-800">
              {data.ticket.code}
            </p>
            <p className="text-center text-sm text-gray-500 mt-2">
              {data.event.name}
            </p>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => setFullScreenQR(false)}
            >
              Fermer
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
