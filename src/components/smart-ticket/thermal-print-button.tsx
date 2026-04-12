'use client';

import React, { useState } from 'react';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { useOrgStore } from '@/store/org-store';
import {
  ThermalPrintManager,
  detectPrinterType,
  isWebBluetoothSupported,
  type PaperWidth as ThermalPaperWidth,
  type TicketPrintData,
  type PrintResult,
} from '@/lib/thermal-printer';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Printer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// TYPES
// ============================================================

interface TicketForPrint {
  id: string;
  ticketCode: string;
  ticketType: string;
  holderName: string;
  holderEmail: string;
  holderPhone?: string | null;
  seatNumber?: string | null;
  price: number;
  currency: string;
  status: string;
  issuedAt?: string;
  event: {
    id: string;
    name: string;
    type: string;
    location?: string | null;
    startDate: string;
    endDate: string;
    description?: string | null;
  };
}

interface ThermalPrintButtonProps {
  ticket: TicketForPrint;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  qrDataUrl?: string;
}

// ============================================================
// QR CODE GENERATION
// ============================================================

function generateQRDataString(ticketCode: string, eventId: string): string {
  const payload = JSON.stringify({
    tc: ticketCode,
    ei: eventId,
    ts: Date.now(),
  });
  return Buffer.from(payload).toString('base64url');
}

async function generateQRImage(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 256,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}

// ============================================================
// PRINT HELPER
// ============================================================

function buildTicketPrintData(
  ticket: TicketForPrint,
  orgName: string,
  qrDataUrl?: string
): TicketPrintData {
  const eventDate = ticket.event.startDate
    ? format(new Date(ticket.event.startDate), 'dd/MM/yyyy HH:mm')
    : 'N/A';
  const eventEndDate = ticket.event.endDate
    ? format(new Date(ticket.event.endDate), 'dd/MM/yyyy HH:mm')
    : eventDate;

  return {
    orgName,
    event: {
      name: ticket.event.name,
      type: ticket.ticketType,
      location: ticket.event.location || undefined,
      startDate: eventDate,
      endDate: eventEndDate,
    },
    ticket: {
      code: ticket.ticketCode,
      type: ticket.ticketType,
      holderName: ticket.holderName,
      holderEmail: ticket.holderEmail,
      holderPhone: ticket.holderPhone || undefined,
      seatNumber: ticket.seatNumber || undefined,
      price: ticket.price,
      currency: ticket.currency,
      status: ticket.status,
      issuedAt: ticket.issuedAt
        ? format(new Date(ticket.issuedAt), 'dd/MM/yyyy')
        : new Date().toISOString().split('T')[0],
      expiresAt: undefined,
    },
    qrDataUrl,
  };
}

// ============================================================
// MAIN COMPONENT: ThermalPrintButton
// ============================================================

export default function ThermalPrintButton({
  ticket,
  variant = 'outline',
  size = 'sm',
  className = '',
  qrDataUrl: externalQrUrl,
}: ThermalPrintButtonProps) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = React.useCallback(async () => {
    if (printing) return;
    setPrinting(true);

    try {
      const org = useOrgStore.getState().currentOrganization;
      let qr = externalQrUrl;
      if (!qr) {
        const qrStr = generateQRDataString(ticket.ticketCode, ticket.event.id);
        qr = await generateQRImage(qrStr);
      }

      const printData = buildTicketPrintData(ticket, org?.name || 'SmartTicketQR', qr);
      const manager = new ThermalPrintManager('80mm');
      const result = await manager.printTicket(printData);

      if (result.success) {
        toast.success('Impression reussie', { description: `Via ${result.method}` });
      } else {
        toast.error('Echec impression', { description: result.error });
      }
    } catch (err) {
      console.error('[ThermalPrint] Error:', err);
      toast.error('Erreur impression', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setPrinting(false);
    }
  }, [ticket, externalQrUrl, printing]);

  const printerType = typeof window !== 'undefined' ? detectPrinterType() : 'unknown';
  const title = printing ? 'Impression...' : `Impression thermique (${printerType})`;

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handlePrint}
      disabled={printing}
      title={title}
    >
      {printing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Printer className="h-4 w-4" />
      )}
      <span className="hidden sm:inline ml-1.5">
        {printing ? 'Impression...' : 'Imprimer'}
      </span>
    </Button>
  );
}

// ============================================================
// THERMAL PRINT DIALOG (Preview + Settings)
// ============================================================

interface ThermalPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: TicketForPrint;
  qrDataUrl?: string;
}

export function ThermalPrintDialog({
  open,
  onOpenChange,
  ticket,
  qrDataUrl,
}: ThermalPrintDialogProps) {
  const [printing, setPrinting] = useState(false);
  const [paperWidth, setPaperWidth] = useState<ThermalPaperWidth>('80mm');
  const [qr, setQr] = useState<string>(qrDataUrl || '');

  const org = useOrgStore.getState().currentOrganization;

  React.useEffect(() => {
    if (open && !qr) {
      const qrStr = generateQRDataString(ticket.ticketCode, ticket.event.id);
      generateQRImage(qrStr).then(setQr);
    }
  }, [open, ticket.ticketCode, ticket.event.id, qr]);

  const handlePrint = async () => {
    if (printing || !qr) return;
    setPrinting(true);

    try {
      const printData = buildTicketPrintData(ticket, org?.name || 'SmartTicketQR', qr);
      const manager = new ThermalPrintManager(paperWidth);
      const result = await manager.printTicket(printData);

      if (result.success) {
        toast.success('Impression reussie', { description: `Via ${result.method}` });
        onOpenChange(false);
      } else {
        toast.error('Echec impression', { description: result.error });
      }
    } catch (err) {
      console.error('[ThermalPrint] Error:', err);
      toast.error('Erreur impression', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setPrinting(false);
    }
  };

  const eventDate = ticket.event.startDate
    ? format(new Date(ticket.event.startDate), 'dd/MM/yyyy HH:mm')
    : 'TBA';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Impression Thermique
          </DialogTitle>
          <DialogDescription>
            Imprimer le billet pour imprimante thermique (58mm/80mm)
          </DialogDescription>
        </DialogHeader>

        {/* Print Preview */}
        <div className="thermal-print-preview rounded-lg">
          <div className={`thermal-print-container thermal-print-${paperWidth === '58mm' ? '58' : '80'}`} style={{ display: 'block' }}>
            <div className="thermal-ticket">
              <div className="thermal-ticket-header">
                <div className="org-name">{org?.name || 'SmartTicketQR'}</div>
                <div className="ticket-type-badge">{ticket.ticketType}</div>
              </div>
              <div className="thermal-ticket-event">
                <div className="event-name">{ticket.event.name}</div>
                <div className="event-detail">{eventDate}</div>
                {ticket.event.location && (
                  <div className="event-detail">{ticket.event.location}</div>
                )}
              </div>
              <div className="thermal-ticket-holder">
                <div className="holder-label">Passager</div>
                <div className="holder-name">{ticket.holderName}</div>
                {ticket.holderPhone && (
                  <div className="holder-detail">Tel: {ticket.holderPhone}</div>
                )}
              </div>
              <div className="thermal-ticket-details">
                <div className="detail-row">
                  <span className="detail-label">Code</span>
                  <span className="detail-value">{ticket.ticketCode}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Type</span>
                  <span className="detail-value">{ticket.ticketType}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Montant</span>
                  <span className="detail-value">{ticket.currency} {ticket.price.toFixed(2)}</span>
                </div>
              </div>
              {qr && (
                <div className="thermal-ticket-qr">
                  <img src={qr} alt="QR" />
                </div>
              )}
              <div className="thermal-ticket-footer">
                <div className="footer-text">Non transferable. ID requise.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="flex items-center gap-4">
          <Label>Largeur papier</Label>
          <Select value={paperWidth} onValueChange={(v) => setPaperWidth(v as ThermalPaperWidth)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="80mm">80mm</SelectItem>
              <SelectItem value="58mm">58mm</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Printer info */}
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Printer className="h-3 w-3" />
          Detecte: {detectPrinterType()} | Bluetooth: {isWebBluetoothSupported() ? 'Oui' : 'Non'}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handlePrint} disabled={printing || !qr}>
            {printing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Impression...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
