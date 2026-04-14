// ============================================================
// 🖨️ THERMAL PRINTER INTERFACE — Browser-based Printer Detection & Printing
// ============================================================
// Supports Web Bluetooth, Web Serial, and window.print() fallback.
// Works with ESC/POS-compatible thermal printers (58mm / 80mm).
// ============================================================

import { EscPosBuilder, createReceipt } from '@/lib/escpos-commands';

// ---- Web Serial API type stubs (not always in tsconfig lib) ----

interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  close(): Promise<void>;
}

// ---- Type Aliases ----

export type PrinterType = 'bluetooth' | 'serial' | 'usb' | 'unknown';
export type PaperWidth = '58mm' | '80mm';
export type PrintMethod = 'bluetooth' | 'serial' | 'print_dialog';
export type Locale = 'fr' | 'en';

// ---- Interfaces ----

export interface TicketPrintData {
  orgName: string;
  orgLogo?: string;
  event: {
    name: string;
    type: string;
    location?: string;
    startDate: string;
    endDate: string;
  };
  ticket: {
    code: string;
    type: string;
    holderName: string;
    holderEmail: string;
    holderPhone?: string;
    seatNumber?: string;
    price: number;
    currency: string;
    status: string;
    issuedAt: string;
    expiresAt?: string;
  };
  /** Base64-encoded QR code data URL */
  qrDataUrl?: string;
}

export interface PrintOptions {
  paperWidth?: PaperWidth;
  copies?: number;
  autoCut?: boolean;
  density?: number;
}

export interface PrintResult {
  success: boolean;
  method: PrintMethod;
  error?: string;
  timestamp: string;
}

export interface BatchPrintResult {
  total: number;
  succeeded: number;
  failed: number;
  results: PrintResult[];
  errors: string[];
}

// ---- Constants ----

const BLE_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const BLE_CHARACTERISTIC_UUID = '00002af0-0000-1000-8000-00805f9b34fb';
const BLE_MTU = 20; // Standard BLE packet size
const SERIAL_BAUD_RATE = 9600;

// ---- Bilingual Error Messages ----

const MESSAGES: Record<string, Record<Locale, string>> = {
  bluetoothNotSupported: {
    fr: "Web Bluetooth n'est pas support\u00e9 par votre navigateur.",
    en: 'Web Bluetooth is not supported by your browser.',
  },
  serialNotSupported: {
    fr: "Web Serial n'est pas support\u00e9 par votre navigateur.",
    en: 'Web Serial is not supported by your browser.',
  },
  noPrinterFound: {
    fr: "Aucune imprimante thermique d\u00e9tect\u00e9e. Veuillez v\u00e9rifier qu'elle est allum\u00e9e et en mode appairage.",
    en: 'No thermal printer detected. Please ensure it is powered on and in pairing mode.',
  },
  connectionFailed: {
    fr: "\u00c9chec de la connexion \u00e0 l'imprimante.",
    en: 'Failed to connect to the printer.',
  },
  connectionLost: {
    fr: "Connexion \u00e0 l'imprimante perdue.",
    en: 'Connection to the printer lost.',
  },
  sendFailed: {
    fr: "\u00c9chec de l'envoi des donn\u00e9es \u00e0 l'imprimante.",
    en: 'Failed to send data to the printer.',
  },
  notConnected: {
    fr: "Aucune imprimante connect\u00e9e.",
    en: 'No printer connected.',
  },
  noPrintMethod: {
    fr: "Aucune m\u00e9thode d'impression disponible.",
    en: 'No printing method available.',
  },
  printSuccess: {
    fr: 'Impression r\u00e9ussie.',
    en: 'Print successful.',
  },
  printCancelled: {
    fr: 'Impression annul\u00e9e.',
    en: 'Print cancelled.',
  },
  printDialogFallback: {
    fr: "Utilisation de la bo\u00eete de dialogue d'impression du navigateur.",
    en: 'Using browser print dialog.',
  },
  userCancelled: {
    fr: "L'utilisateur a annul\u00e9 la s\u00e9lection de l'imprimante.",
    en: 'User cancelled printer selection.',
  },
  permissionDenied: {
    fr: 'Permission refus\u00e9e. Veuillez autoriser l\'acc\u00e8s \u00e0 l\'appareil.',
    en: 'Permission denied. Please allow device access.',
  },
  testPrintHeader: {
    fr: '=== TEST D\'IMPRIMANTE ===',
    en: '=== PRINTER TEST ===',
  },
};

// ---- Helpers ----

function getTimestamp(): string {
  return new Date().toISOString();
}

function getLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const lang = (navigator.language || '').toLowerCase();
  return lang.startsWith('fr') ? 'fr' : 'en';
}

function msg(key: string, locale?: Locale): string {
  return MESSAGES[key]?.[locale ?? getLocale()] ?? key;
}

function safeIsWebBluetoothSupported(): boolean {
  try {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  } catch {
    return false;
  }
}

function safeIsWebSerialSupported(): boolean {
  try {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  } catch {
    return false;
  }
}

function detectPlatform(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = (navigator.userAgent || '').toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('linux')) return 'linux';
  return 'unknown';
}

// ---- Exported Feature Detection Helpers ----

export function isWebBluetoothSupported(): boolean {
  return safeIsWebBluetoothSupported();
}

export function isWebSerialSupported(): boolean {
  return safeIsWebSerialSupported();
}

// ---- Exported Printer Detection ----

export function detectPrinterType(): PrinterType {
  if (safeIsWebBluetoothSupported()) {
    return 'bluetooth';
  }

  if (safeIsWebSerialSupported()) {
    return 'serial';
  }

  // Fallback: guess from user agent
  const platform = detectPlatform();
  if (platform === 'windows') return 'usb';
  if (platform === 'android') return 'bluetooth';
  if (platform === 'linux') return 'usb';

  return 'unknown';
}

// ---- BluetoothPrinter Class ----

export class BluetoothPrinter {
  device: BluetoothDevice | null = null;
  server: BluetoothRemoteGATTServer | null = null;
  service: BluetoothRemoteGATTService | null = null;
  characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  private _cancelled = false;

  /**
   * Scan for a BLE thermal printer and connect.
   * Prompts the user to select a device via the browser dialog.
   */
  async connect(): Promise<void> {
    if (!safeIsWebBluetoothSupported()) {
      throw new Error(msg('bluetoothNotSupported'));
    }

    try {
      // Request device — prefer the known service, accept all as fallback
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [BLE_SERVICE_UUID] }],
      });

      this.device = device;

      // Listen for disconnection
      this.device.addEventListener('gattserverdisconnected', () => {
        this.cleanup();
      });

      // Connect to GATT server
      this.server = await this.device.gatt!.connect();

      // Get the print service
      this.service = await this.server!.getPrimaryService(BLE_SERVICE_UUID);

      // Get the write characteristic
      this.characteristic = await this.service!.getCharacteristic(
        BLE_CHARACTERISTIC_UUID,
      );
    } catch (err: unknown) {
      this.cleanup();

      if (err instanceof DOMException && err.name === 'NotFoundError') {
        // No device selected — try acceptAllDevices as fallback
        try {
          const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [BLE_SERVICE_UUID],
          });
          this.device = device;
          this.device.addEventListener('gattserverdisconnected', () => {
            this.cleanup();
          });
          this.server = await this.device.gatt!.connect();
          this.service = await this.server!.getPrimaryService(BLE_SERVICE_UUID);
          this.characteristic = await this.service!.getCharacteristic(
            BLE_CHARACTERISTIC_UUID,
          );
          return;
        } catch (retryErr: unknown) {
          if (retryErr instanceof DOMException) {
            if (retryErr.name === 'NotFoundError') {
              throw new Error(msg('noPrinterFound'));
            }
          }
          throw new Error(msg('connectionFailed'));
        }
      }

      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          throw new Error(msg('permissionDenied'));
        }
        if (err.name === 'NotFoundError') {
          throw new Error(msg('noPrinterFound'));
        }
      }

      throw new Error(msg('connectionFailed'));
    }
  }

  /**
   * Disconnect from the printer and release resources.
   */
  async disconnect(): Promise<void> {
    try {
      if (this.server?.connected) {
        this.server.disconnect();
      }
    } catch {
      // Silently ignore disconnect errors
    }
    this.cleanup();
  }

  /**
   * Send raw bytes to the printer.
   * Data is automatically chunked into BLE MTU-sized packets.
   */
  async send(data: Uint8Array): Promise<void> {
    if (!this.isConnected()) {
      throw new Error(msg('notConnected'));
    }

    this._cancelled = false;

    for (let offset = 0; offset < data.length; offset += BLE_MTU) {
      if (this._cancelled) {
        throw new Error(msg('printCancelled'));
      }

      const chunk = data.slice(offset, offset + BLE_MTU);
      await this.characteristic!.writeValueWithoutResponse(chunk);

      // Small delay between chunks to prevent buffer overflow
      if (offset + BLE_MTU < data.length) {
        await this.delay(50);
      }
    }
  }

  /**
   * Print a full receipt using an EscPosBuilder.
   * Builds the command buffer and sends it in one flow.
   */
  async printReceipt(builder: EscPosBuilder): Promise<void> {
    if (!this.isConnected()) {
      throw new Error(msg('notConnected'));
    }

    const data = builder.toBuffer();
    await this.send(data);
  }

  /**
   * Check if the printer is currently connected.
   */
  isConnected(): boolean {
    return (
      this.device !== null &&
      this.server !== null &&
      this.server.connected === true &&
      this.characteristic !== null
    );
  }

  /**
   * Cancel an in-progress send operation.
   */
  cancel(): void {
    this._cancelled = true;
  }

  // ---- Private ----

  private cleanup(): void {
    this.service = null;
    this.characteristic = null;
    this.server = null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ---- generatePrintHTML ----

/**
 * Generate a clean HTML string for printing via window.print() fallback.
 * Uses thermal-receipt CSS classes and is sized for 58mm or 80mm paper.
 */
export function generatePrintHTML(
  data: TicketPrintData,
  paperWidth: string,
): string {
  const containerWidth = paperWidth === '58mm' ? '58mm' : '80mm';
  const fontSize = paperWidth === '58mm' ? '9px' : '11px';

  const ticketTypeLabel = data.ticket.type.toUpperCase();
  const priceFormatted = `${data.ticket.currency} ${data.ticket.price.toFixed(2)}`;

  const seatLine = data.ticket.seatNumber
    ? `<div class="row"><span class="label">Si\u00e8ge :</span> <span class="value">${escapeHtml(data.ticket.seatNumber)}</span></div>`
    : '';

  const phoneLine = data.ticket.holderPhone
    ? `<div class="row"><span class="label">T\u00e9l :</span> <span class="value">${escapeHtml(data.ticket.holderPhone)}</span></div>`
    : '';

  const locationLine = data.event.location
    ? `<div class="row"><span class="label">Lieu :</span> <span class="value">${escapeHtml(data.event.location)}</span></div>`
    : '';

  const endDateLine =
    data.event.endDate && data.event.endDate !== data.event.startDate
      ? `<div class="row"><span class="label">Fin :</span> <span class="value">${escapeHtml(data.event.endDate)}</span></div>`
      : '';

  const expiresLine = data.ticket.expiresAt
    ? `<div class="row"><span class="label">Expire :</span> <span class="value">${escapeHtml(data.ticket.expiresAt)}</span></div>`
    : '';

  const logoSection = data.orgLogo
    ? `<div class="logo"><img src="${escapeHtml(data.orgLogo)}" alt="Logo" style="max-width:80px;max-height:40px;" /></div>`
    : '';

  const qrSection = data.qrDataUrl
    ? `<div class="qr-code"><img src="${escapeHtml(data.qrDataUrl)}" alt="QR Code" style="width:120px;height:120px;" /></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Billet - ${escapeHtml(data.ticket.code)}</title>
<style>
  @page {
    size: ${containerWidth} auto;
    margin: 0;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: ${fontSize};
    line-height: 1.4;
    color: #000;
    background: #fff;
    width: ${containerWidth};
    margin: 0 auto;
    padding: 2mm;
  }

  @media print {
    body {
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print { display: none !important; }
  }

  .thermal-receipt {
    padding: 2mm;
  }

  .header {
    text-align: center;
    margin-bottom: 4px;
  }

  .header .org-name {
    font-size: 1.4em;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .header .ticket-badge {
    display: inline-block;
    border: 1px dashed #000;
    padding: 1px 6px;
    font-size: 0.9em;
    margin-top: 2px;
  }

  .logo {
    text-align: center;
    margin-bottom: 4px;
  }

  .separator {
    border: none;
    border-top: 1px dashed #000;
    margin: 4px 0;
  }

  .section-title {
    font-weight: bold;
    text-transform: uppercase;
    font-size: 0.85em;
    margin-bottom: 2px;
  }

  .row {
    display: flex;
    justify-content: space-between;
    padding: 1px 0;
  }

  .row .label {
    color: #555;
    flex-shrink: 0;
  }

  .row .value {
    font-weight: bold;
    text-align: right;
    word-break: break-all;
  }

  .event-name {
    font-weight: bold;
    font-size: 1.1em;
    text-align: center;
    margin: 2px 0;
  }

  .price-section {
    text-align: center;
    font-size: 1.6em;
    font-weight: bold;
    margin: 4px 0;
  }

  .qr-code {
    text-align: center;
    margin: 6px 0;
  }

  .footer {
    text-align: center;
    font-size: 0.8em;
    color: #666;
    margin-top: 4px;
  }

  .ticket-code {
    text-align: center;
    font-family: monospace;
    font-size: 1em;
    letter-spacing: 2px;
    margin: 2px 0;
  }

  .status {
    text-align: center;
    font-weight: bold;
    text-transform: uppercase;
  }

  .status.valid { color: #000; }
  .status.used { color: #666; text-decoration: line-through; }
  .status.cancelled { color: #c00; text-decoration: line-through; }
</style>
</head>
<body>
<div class="thermal-receipt">

  <div class="header">
    ${logoSection}
    <div class="org-name">${escapeHtml(data.orgName)}</div>
    <div class="ticket-badge">${escapeHtml(ticketTypeLabel)}</div>
  </div>

  <hr class="separator" />

  <div class="event-name">${escapeHtml(data.event.name)}</div>
  <div class="row"><span class="label">Type :</span> <span class="value">${escapeHtml(data.event.type)}</span></div>
  <div class="row"><span class="label">D\u00e9but :</span> <span class="value">${escapeHtml(data.event.startDate)}</span></div>
  ${endDateLine}
  ${locationLine}

  <hr class="separator" />

  <div class="row"><span class="label">Passager :</span> <span class="value">${escapeHtml(data.ticket.holderName)}</span></div>
  <div class="row"><span class="label">Email :</span> <span class="value">${escapeHtml(data.ticket.holderEmail)}</span></div>
  ${phoneLine}
  ${seatLine}

  <hr class="separator" />

  <div class="ticket-code">${escapeHtml(data.ticket.code)}</div>
  <div class="status ${escapeHtml(data.ticket.status.toLowerCase())}">${escapeHtml(data.ticket.status.toUpperCase())}</div>

  <div class="row"><span class="label">\u00c9mis le :</span> <span class="value">${escapeHtml(data.ticket.issuedAt)}</span></div>
  ${expiresLine}

  <hr class="separator" />

  <div class="price-section">${escapeHtml(priceFormatted)}</div>

  ${qrSection}

  <hr class="separator" />

  <div class="footer">
    Ce billet est non transf\u00e9rable.<br />
    Pr\u00e9sentez-le \u00e0 l'entr\u00e9e.<br />
    <br />
    SmartTicketQR
  </div>

</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Print via the browser's built-in print dialog using a hidden iframe.
 */
function printViaDialog(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error(msg('noPrintMethod')));
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';

    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
              document.body.removeChild(iframe);
              resolve();
            }, 1000);
          } catch {
            document.body.removeChild(iframe);
            reject(new Error(msg('sendFailed')));
          }
        }, 300);
      } catch {
        document.body.removeChild(iframe);
        reject(new Error(msg('sendFailed')));
      }
    };

    iframe.onerror = () => {
      document.body.removeChild(iframe);
      reject(new Error(msg('sendFailed')));
    };

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      reject(new Error(msg('noPrintMethod')));
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();
  });
}

// ---- ThermalPrintManager Class ----

export class ThermalPrintManager {
  paperWidth: PaperWidth = '80mm';
  bluetoothPrinter: BluetoothPrinter;

  private _cancelled = false;

  constructor(paperWidth?: PaperWidth) {
    if (paperWidth) {
      this.paperWidth = paperWidth;
    }
    this.bluetoothPrinter = new BluetoothPrinter();
  }

  /**
   * Print a single ticket.
   * Tries: Web Bluetooth -> Web Serial -> window.print() fallback.
   */
  async printTicket(
    ticketData: TicketPrintData,
    options?: PrintOptions,
  ): Promise<PrintResult> {
    const resolvedWidth = options?.paperWidth ?? this.paperWidth;
    const copies = options?.copies ?? 1;

    this._cancelled = false;

    if (this._cancelled) {
      return {
        success: false,
        method: 'print_dialog',
        error: msg('printCancelled'),
        timestamp: getTimestamp(),
      };
    }

    // Strategy 1: Web Bluetooth
    if (safeIsWebBluetoothSupported()) {
      try {
        const result = await this.printViaBluetooth(ticketData, options, copies);
        return result;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes(msg('userCancelled'))) {
          return {
            success: false,
            method: 'bluetooth',
            error: msg('userCancelled'),
            timestamp: getTimestamp(),
          };
        }
        // Otherwise fall through to next method
      }
    }

    // Strategy 2: Web Serial
    if (safeIsWebSerialSupported()) {
      try {
        const result = await this.printViaSerial(ticketData, options, copies);
        return result;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes(msg('userCancelled'))) {
          return {
            success: false,
            method: 'serial',
            error: msg('userCancelled'),
            timestamp: getTimestamp(),
          };
        }
        // Fall through to print dialog
      }
    }

    // Strategy 3: window.print() fallback
    try {
      const html = generatePrintHTML(ticketData, resolvedWidth);
      await printViaDialog(html);

      return {
        success: true,
        method: 'print_dialog',
        timestamp: getTimestamp(),
      };
    } catch {
      return {
        success: false,
        method: 'print_dialog',
        error: msg('noPrintMethod'),
        timestamp: getTimestamp(),
      };
    }
  }

  /**
   * Print multiple tickets in batch.
   * Continues printing remaining tickets even if some fail.
   */
  async printBatch(tickets: TicketPrintData[]): Promise<BatchPrintResult> {
    const results: PrintResult[] = [];
    const errors: string[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const ticket of tickets) {
      if (this._cancelled) {
        errors.push(msg('printCancelled'));
        failed += tickets.length - results.length;
        break;
      }

      const result = await this.printTicket(ticket);
      results.push(result);

      if (result.success) {
        succeeded++;
      } else {
        failed++;
        if (result.error) {
          errors.push(`${ticket.ticket.code}: ${result.error}`);
        }
      }
    }

    return {
      total: tickets.length,
      succeeded,
      failed,
      results,
      errors,
    };
  }

  /**
   * Print a test receipt to verify printer connectivity.
   */
  async testPrint(): Promise<void> {
    if (safeIsWebBluetoothSupported() && this.bluetoothPrinter.isConnected()) {
      const paperW = this.paperWidth === '58mm' ? 58 : 80;
      const builder = createReceipt(paperW);
      builder
        .init()
        .align('center')
        .bold(msg('testPrintHeader'))
        .newLine()
        .text(new Date().toLocaleString())
        .newLine()
        .line()
        .text('SmartTicketQR')
        .line()
        .newLine()
        .cut(true);
      await this.bluetoothPrinter.printReceipt(builder);
      return;
    }

    // Fallback: use print dialog with test HTML
    const testData: TicketPrintData = {
      orgName: 'SmartTicketQR',
      event: {
        name: msg('testPrintHeader'),
        type: 'TEST',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
      },
      ticket: {
        code: 'TEST-001',
        type: 'TEST',
        holderName: 'Test User',
        holderEmail: 'test@example.com',
        price: 0,
        currency: 'XOF',
        status: 'VALID',
        issuedAt: new Date().toISOString(),
      },
    };

    const html = generatePrintHTML(testData, this.paperWidth);
    await printViaDialog(html);
  }

  /**
   * Cancel any in-progress print operation.
   */
  cancel(): void {
    this._cancelled = true;
    this.bluetoothPrinter.cancel();
  }

  /**
   * Disconnect the Bluetooth printer if connected.
   */
  async disconnect(): Promise<void> {
    await this.bluetoothPrinter.disconnect();
  }

  // ---- Private: Build ESC/POS buffer from ticket data ----

  /**
   * Build an EscPosBuilder with all ticket receipt commands.
   */
  buildEscPosBuffer(data: TicketPrintData, options?: PrintOptions): EscPosBuilder {
    const w = options?.paperWidth === '58mm' ? 58 : 80;
    const builder = createReceipt(w);

    builder
      .init()
      // Header: Organization name
      .align('center')
      .textSize(data.orgName || 'SmartTicketQR', 2, 2)
      .newLine()
      .text(`[${data.ticket.type.toUpperCase()}]`)
      .doubleLine()
      // Event info
      .align('left')
      .bold(data.event.name)
      .newLine()
      .text(`Date    : ${data.event.startDate}`)
      .text(`Lieu    : ${data.event.location || 'N/A'}`)
      .line()
      // Holder info
      .bold(`Passager: ${data.ticket.holderName}`)
      .text(`Siege   : ${data.ticket.seatNumber || 'N/A'}`)
      .text(`Tel     : ${data.ticket.holderPhone || 'N/A'}`)
      .line()
      // Ticket details
      .text(`Code    : ${data.ticket.code}`)
      .text(`Type    : ${data.ticket.type}`)
      .text(`Statut  : ${data.ticket.status.toUpperCase()}`)
      .text(`Emis le : ${data.ticket.issuedAt}`)
      .line()
      // Price
      .align('center')
      .textSize(`${data.ticket.currency} ${data.ticket.price.toFixed(2)}`, 2, 2)
      .align('left')
      .newLine();

    // QR Code
    const qrPayload = JSON.stringify({
      tc: data.ticket.code,
      e: data.event.name,
      h: data.ticket.holderName,
    });
    builder.align('center').qrCode(qrPayload, w === 58 ? 4 : 6).newLine(2);

    // Footer
    builder
      .line()
      .align('center')
      .text('Ce billet est non transferable.')
      .text("Presentez-le a l'entree.")
      .newLine(2);

    if (options?.autoCut !== false) {
      builder.cut(true);
    }

    return builder;
  }

  // ---- Private: Print strategies ----

  private async printViaBluetooth(
    ticketData: TicketPrintData,
    options: PrintOptions | undefined,
    copies: number,
  ): Promise<PrintResult> {
    if (!this.bluetoothPrinter.isConnected()) {
      await this.bluetoothPrinter.connect();
    }

    const builder = this.buildEscPosBuffer(ticketData, options);
    const data = builder.toBuffer();

    for (let i = 0; i < copies; i++) {
      if (this._cancelled) {
        throw new Error(msg('printCancelled'));
      }
      await this.bluetoothPrinter.send(data);

      if (i < copies - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    return {
      success: true,
      method: 'bluetooth',
      timestamp: getTimestamp(),
    };
  }

  private async printViaSerial(
    ticketData: TicketPrintData,
    options: PrintOptions | undefined,
    copies: number,
  ): Promise<PrintResult> {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) {
      throw new Error(msg('serialNotSupported'));
    }

    const port = await (navigator as unknown as { serial: { requestPort: () => Promise<SerialPort> } }).serial.requestPort();
    await port.open({ baudRate: SERIAL_BAUD_RATE });

    try {
      const writer = port.writable?.getWriter();
      if (!writer) {
        throw new Error(msg('sendFailed'));
      }

      try {
        const builder = this.buildEscPosBuffer(ticketData, options);
        const data = builder.toBuffer();

        for (let i = 0; i < copies; i++) {
          if (this._cancelled) {
            throw new Error(msg('printCancelled'));
          }
          await writer.write(data);

          if (i < copies - 1) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      } finally {
        writer.releaseLock();
      }
    } finally {
      await port.close().catch(() => {});
    }

    return {
      success: true,
      method: 'serial',
      timestamp: getTimestamp(),
    };
  }
}

// ---- Default Export ----

export default ThermalPrintManager;
