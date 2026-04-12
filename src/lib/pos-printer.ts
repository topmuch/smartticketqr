// ============================================================
// 🖨️ POS PRINTER — Capacitor Plugin Bridge for Native ESC/POS
// ============================================================
// Bridges web code to native Android POS printing via Capacitor.
// Supports Z92, Sunmi, Xprinter, and other ESC/POS-compatible
// thermal printers.
//
// Usage:
//   import { printTicket, isPOSPrinterAvailable } from '@/lib/pos-printer';
//   const result = await printTicket(escposBytes, { paperWidth: 58 });
// ============================================================

import { buildEscPosTicket, type EscPosTicketData, createReceipt } from '@/lib/escpos-commands';

// ---- Types ----

export interface POSPrintOptions {
  paperWidth?: 58 | 80; // mm — default 58
  density?: number; // 0-7 print density
  copies?: number; // default 1
  autoCut?: boolean; // default true
  codePage?: string; // default 'CP850'
}

export interface POSPrintResult {
  success: boolean;
  message: string;
  printerModel?: string;
  error?: string;
}

export interface POSPrinterStatus {
  connected: boolean;
  model?: string;
  paperWidth?: number;
  error?: string;
}

// ---- Capacitor plugin bridge (lazy-loaded) ----

let _capacitor: any = null;
let _isNative: boolean | null = null;
let _pluginRegistered: boolean = false;

/**
 * Attempt to load the Capacitor runtime.
 * Returns null if not available (e.g. running in browser-only mode).
 */
async function loadCapacitor(): Promise<any> {
  if (_capacitor !== null) return _capacitor;

  try {
    _capacitor = await import('@capacitor/core');
    console.log('[POSPrinter] Capacitor core loaded successfully');
    return _capacitor;
  } catch (err) {
    console.warn(
      '[POSPrinter] Capacitor core not available. Running in web-only mode.',
    );
    _capacitor = null;
    return null;
  }
}

/**
 * Check if the app is running inside a Capacitor native shell.
 */
export function isCapacitorNative(): boolean {
  if (_isNative !== null) return _isNative;

  try {
    _isNative =
      typeof window !== 'undefined' &&
      !!(window as any).Capacitor?.isNativePlatform?.();
    console.log(
      `[POSPrinter] Native platform check: ${_isNative ? 'YES' : 'NO'}`,
    );
  } catch {
    _isNative = false;
  }

  return _isNative;
}

/**
 * Ensure the POSPrinter plugin is registered with the Capacitor runtime.
 */
async function ensurePluginRegistered(): Promise<any | null> {
  const cap = await loadCapacitor();
  if (!cap) return null;

  if (!_pluginRegistered) {
    try {
      const { registerPlugin } = cap;
      registerPlugin('POSPrinter');
      _pluginRegistered = true;
      console.log('[POSPrinter] Plugin registered with Capacitor');
    } catch (err) {
      console.error('[POSPrinter] Failed to register plugin:', err);
      return null;
    }
  }

  return cap;
}

/**
 * Get a reference to the registered POSPrinter Capacitor plugin.
 */
async function getPlugin(): Promise<any | null> {
  const cap = await ensurePluginRegistered();
  if (!cap) return null;

  try {
    const { Capacitor } = cap;
    const plugin = Capacitor.isPluginAvailable('POSPrinter')
      ? Capacitor.getPlugin('POSPrinter')
      : null;

    if (plugin) {
      console.log('[POSPrinter] Native POSPrinter plugin resolved');
    } else {
      console.warn('[POSPrinter] Native POSPrinter plugin not available');
    }

    return plugin;
  } catch (err) {
    console.error('[POSPrinter] Error resolving native plugin:', err);
    return null;
  }
}

// ---- Public API ----

/**
 * Check if the native POS printer plugin is available.
 */
export async function isPOSPrinterAvailable(): Promise<boolean> {
  if (!isCapacitorNative()) {
    console.log('[POSPrinter] Not running in native context — printer unavailable');
    return false;
  }

  const plugin = await getPlugin();
  return plugin !== null;
}

/**
 * Send raw ESC/POS bytes to the native printer.
 */
export async function printESCPOS(
  data: Uint8Array,
  options?: POSPrintOptions,
): Promise<POSPrintResult> {
  const opts: POSPrintOptions = {
    paperWidth: options?.paperWidth ?? 58,
    density: options?.density ?? 5,
    copies: options?.copies ?? 1,
    autoCut: options?.autoCut ?? true,
    codePage: options?.codePage ?? 'CP850',
  };

  console.log(
    `[POSPrinter] printESCPOS called — ${data.length} bytes, ` +
      `paperWidth=${opts.paperWidth}mm, density=${opts.density}, ` +
      `copies=${opts.copies}, autoCut=${opts.autoCut}`,
  );

  if (!isCapacitorNative()) {
    const msg =
      'Cannot print: not running inside a Capacitor native app. ' +
      'Use a web fallback (Bluetooth / print dialog) for browser-based printing.';
    console.warn(`[POSPrinter] ${msg}`);
    return { success: false, message: msg, error: 'CAPACITOR_NOT_NATIVE' };
  }

  const plugin = await getPlugin();

  if (!plugin) {
    const msg =
      'Native POSPrinter plugin not available. Ensure the native plugin ' +
      'is installed (npx cap sync) and the POS hardware is connected.';
    console.error(`[POSPrinter] ${msg}`);
    return { success: false, message: msg, error: 'PLUGIN_NOT_AVAILABLE' };
  }

  try {
    const base64Data = uint8ArrayToBase64(data);

    console.log(
      `[POSPrinter] Invoking native print — base64 length=${base64Data.length}`,
    );

    const result = await plugin.print({
      data: base64Data,
      options: opts,
    });

    console.log(`[POSPrinter] Native result:`, result);

    return {
      success: result?.success ?? true,
      message: result?.message ?? 'Print job sent',
      printerModel: result?.printerModel,
      error: result?.error,
    };
  } catch (err: any) {
    const errorMsg =
      err?.message ?? (typeof err === 'string' ? err : 'Unknown print error');
    console.error(`[POSPrinter] Print error: ${errorMsg}`, err);
    return {
      success: false,
      message: `Print failed: ${errorMsg}`,
      error: errorMsg,
    };
  }
}

/**
 * Print a ticket from an EscPosBuilder output (Uint8Array buffer).
 */
export async function printTicket(
  builderOutput: Uint8Array,
  options?: POSPrintOptions,
): Promise<POSPrintResult> {
  console.log(
    `[POSPrinter] printTicket called — buffer size=${builderOutput.length} bytes`,
  );

  if (!(builderOutput instanceof Uint8Array)) {
    return {
      success: false,
      message: 'Invalid input: builderOutput must be a Uint8Array',
      error: 'INVALID_INPUT',
    };
  }

  if (builderOutput.length === 0) {
    return {
      success: false,
      message: 'Empty print buffer — nothing to print',
      error: 'EMPTY_BUFFER',
    };
  }

  return printESCPOS(builderOutput, options);
}

/**
 * Print a ticket from structured ticket data.
 */
export async function printTicketFromData(
  ticket: EscPosTicketData,
  options?: POSPrintOptions,
): Promise<POSPrintResult> {
  console.log(
    `[POSPrinter] printTicketFromData — code=${ticket.ticketCode}, ` +
      `event="${ticket.eventName}"`,
  );

  const buffer = buildEscPosTicket(ticket);
  return printTicket(buffer, options);
}

/**
 * Query the current status of the connected POS printer.
 */
export async function getPrinterStatus(): Promise<POSPrinterStatus> {
  console.log('[POSPrinter] getPrinterStatus called');

  if (!isCapacitorNative()) {
    return { connected: false, error: 'CAPACITOR_NOT_NATIVE' };
  }

  const plugin = await getPlugin();

  if (!plugin) {
    return { connected: false, error: 'PLUGIN_NOT_AVAILABLE' };
  }

  try {
    const status = await plugin.getStatus();
    console.log('[POSPrinter] Printer status:', status);

    return {
      connected: status?.connected ?? false,
      model: status?.model,
      paperWidth: status?.paperWidth,
      error: status?.error,
    };
  } catch (err: any) {
    const errorMsg = err?.message ?? 'Failed to query printer status';
    console.error(`[POSPrinter] Status error: ${errorMsg}`, err);
    return { connected: false, error: errorMsg };
  }
}

/**
 * Print a test page to verify printer connectivity and configuration.
 */
export async function testPrint(): Promise<POSPrintResult> {
  console.log('[POSPrinter] testPrint called');

  const builder = createReceipt(58);
  builder
    .init()
    .align('center')
    .textSize('TEST PRINT', 2, 2)
    .newLine()
    .doubleLine()
    .textSize('SmartTicketQR', 1, 1)
    .bold('POS Printer OK')
    .newLine()
    .line()
    .text(new Date().toISOString())
    .newLine(2)
    .cut(true);

  return printESCPOS(builder.toBuffer(), { paperWidth: 58 });
}

// ---- Utility helpers ----

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa !== 'undefined') {
    return btoa(binary);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

/**
 * Reset the internal Capacitor cache (useful for testing).
 */
export function _reset(): void {
  _capacitor = null;
  _isNative = null;
  _pluginRegistered = false;
  console.log('[POSPrinter] Internal cache reset');
}
