'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  FileText,
  MessageCircle,
  RefreshCw,
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

interface PublicTicketViewProps {
  ticketCode: string;
  orgSlug: string;
}

// ============================================================
// STATUS CONFIG
// ============================================================

function getStatusConfig(status: string) {
  const configs: Record<string, { label: string; color: string; bgColor: string; icon: typeof CheckCircle2 }> = {
    active: { label: 'Valide', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', icon: CheckCircle2 },
    used: { label: 'Utilis\u00e9', color: 'text-sky-600', bgColor: 'bg-sky-100 dark:bg-sky-900/30', icon: CheckCircle2 },
    expired: { label: 'Expir\u00e9', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30', icon: AlertTriangle },
    cancelled: { label: 'Annul\u00e9', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: XCircle },
  };
  return configs[status] || configs.active;
}

// ============================================================
// FETCH WITH TIMEOUT
// ============================================================

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function PublicTicketView({ ticketCode, orgSlug }: PublicTicketViewProps) {
  const [data, setData] = useState<TicketPublicResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [fullScreenQR, setFullScreenQR] = useState(false);

  // Fetch ticket data
  const fetchTicket = useCallback(async () => {
    setLoading(true);
    setError(null);
    console.log('\u{1f3ab} Fetching ticket:', { ticketCode, orgSlug });

    try {
      const res = await fetchWithTimeout(
        `/api/ticket/public?code=${encodeURIComponent(ticketCode)}&org=${encodeURIComponent(orgSlug)}`
      );

      console.log('\u{1f4cb} Response status:', res.status);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        console.error('\u274c Ticket fetch failed:', res.status, errData);
        setError(errData.error || `Erreur serveur (${res.status})`);
        return;
      }

      const result: TicketPublicResponse | ErrorResponse = await res.json();

      if ('error' in result) {
        console.error('\u274c Ticket API returned error:', result.error);
        setError(result.error);
      } else {
        console.log('\u2705 Ticket loaded successfully:', {
          code: result.ticket.code,
          holder: result.ticket.holderName,
          status: result.ticket.status,
          event: result.event.name,
        });
        setData(result);
      }
    } catch (err) {
      const message = err instanceof DOMException && err.name === 'AbortError'
        ? 'D\u00e9lai d\u2019attente d\u00e9pass\u00e9. V\u00e9rifiez votre connexion.'
        : 'Erreur de connexion. V\u00e9rifiez votre lien.';
      console.error('\u274c Ticket fetch exception:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [ticketCode, orgSlug]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  // Retry handler
  const handleRetry = useCallback(() => {
    fetchTicket();
  }, [fetchTicket]);

  const handleCopyCode = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.ticket.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = async () => {
    if (!data) return;
    const shareText = `\u{1f3a9} Mon ticket ${data.organization.name}\n${data.ticket.holderName} - ${data.event.name}\nCode: ${data.ticket.code}`;
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

  // WhatsApp handler
  const handleWhatsApp = () => {
    if (!data) return;
    const message = [
      `\u{1f3a9} *Ticket - ${data.organization.name}*`,
      ``,
      `\u{1f464} ${data.ticket.holderName}`,
      `\u{1f3ad} ${data.event.name}`,
      `\u{1f4c5} ${format(new Date(data.event.startDate), 'dd/MM/yyyy HH:mm')}`,
      data.event.location ? `\u{1f4cd} ${data.event.location}` : '',
      ``,
      `\u{1f4cb} Code: *${data.ticket.code}*`,
      `\u{1f4b0} ${data.ticket.currency} ${data.ticket.price.toFixed(2)}`,
      ``,
      `\u2705 Statut: ${getStatusConfig(data.ticket.status).label}`,
    ].filter(Boolean).join('\n');

    const encoded = encodeURIComponent(message);
    // Open WhatsApp web/app with the ticket message
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  // PDF download handler (simple text-based PDF using print)
  const handleDownloadPDF = () => {
    if (!data) return;
    // Create a printable ticket layout
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // Fallback: use browser print
      window.print();
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket - ${data.ticket.code}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 20px; }
          .ticket { max-width: 400px; margin: 0 auto; border: 2px solid ${data.organization.color || '#059669'}; border-radius: 12px; overflow: hidden; }
          .header { background: ${data.organization.color || '#059669'}; color: white; padding: 16px; text-align: center; }
          .header h1 { font-size: 18px; margin-bottom: 4px; }
          .header p { font-size: 12px; opacity: 0.9; }
          .body { padding: 20px; }
          .event { margin-bottom: 16px; }
          .event h2 { font-size: 16px; margin-bottom: 4px; }
          .event .date { color: #666; font-size: 13px; }
          .event .location { color: #666; font-size: 13px; margin-top: 2px; }
          .divider { border-top: 1px dashed #ddd; margin: 16px 0; }
          .holder { margin-bottom: 12px; }
          .holder .label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px; }
          .holder .name { font-size: 15px; font-weight: 600; }
          .code-section { text-align: center; padding: 12px; background: #f8f8f8; border-radius: 8px; margin-bottom: 12px; }
          .code-section .label { font-size: 11px; color: #999; }
          .code-section .code { font-size: 20px; font-weight: 700; letter-spacing: 2px; font-family: monospace; color: ${data.organization.color || '#059669'}; }
          .price { text-align: center; font-size: 24px; font-weight: 700; margin-top: 12px; }
          .footer { text-align: center; font-size: 10px; color: #aaa; padding: 12px 20px; border-top: 1px solid #eee; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <h1>${data.organization.name}</h1>
            <p>SmartTicketQR</p>
          </div>
          <div class="body">
            <div class="event">
              <h2>${data.event.name}</h2>
              <div class="date">${format(new Date(data.event.startDate), 'dd MMM yyyy')} - ${format(new Date(data.event.startDate), 'HH:mm')}</div>
              ${data.event.location ? `<div class="location">${data.event.location}</div>` : ''}
            </div>
            <div class="divider"></div>
            <div class="holder">
              <div class="label">Passager</div>
              <div class="name">${data.ticket.holderName}</div>
              ${data.ticket.seatNumber ? `<div style="font-size:13px;color:#666;margin-top:2px">Si\u00e8ge: ${data.ticket.seatNumber}</div>` : ''}
            </div>
            <div class="code-section">
              <div class="label">Code Billet</div>
              <div class="code">${data.ticket.code}</div>
            </div>
            <div class="price">${data.ticket.currency} ${data.ticket.price.toFixed(2)}</div>
          </div>
          <div class="footer">
            Ce billet est personnel et non transf\u00e9rable. Pr\u00e9sentez-le \u00e0 l'entr\u00e9e.
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
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
            V\u00e9rifiez le lien ou contactez l&apos;organisateur.
          </p>
          <Button variant="outline" onClick={handleRetry} className="mt-2 gap-2">
            <RefreshCw className="h-4 w-4" />
            R\u00e9essayer
          </Button>
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
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">\u00c9v\u00e9nement</p>
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
                    Si\u00e8ge : <span className="font-mono font-medium">{data.ticket.seatNumber}</span>
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
        <div className="grid grid-cols-2 gap-3 mt-6 mb-4">
          <Button variant="outline" className="flex-1 gap-2" onClick={handleDownloadPDF}>
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={handleDownloadQR}>
            <Download className="h-4 w-4" />
            QR
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-8">
          <Button variant="outline" className="flex-1 gap-2" onClick={handleCopyCode}>
            <Copy className="h-4 w-4" />
            {copied ? 'Copi\u00e9 !' : 'Copier'}
          </Button>
          <Button
            className="flex-1 gap-2"
            style={{ backgroundColor: data.organization.color }}
            onClick={handleWhatsApp}
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
        </div>
        <Button
          variant="ghost"
          className="w-full mb-8 gap-2 text-muted-foreground"
          onClick={handleShare}
        >
          <Share2 className="h-4 w-4" />
          Partager via...
        </Button>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pb-8">
          Ce billet est personnel et non transf\u00e9rable. Pr\u00e9sentez-le \u00e0 l&apos;entr\u00e9e.
        </p>
      </motion.div>

      {/* Full Screen QR Modal */}
      <AnimatePresence>
        {fullScreenQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4"
            onClick={() => setFullScreenQR(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white p-8 rounded-3xl max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
