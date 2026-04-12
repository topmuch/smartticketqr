# SmartTicketQR — Thermal Printer Setup Guide

> Comprehensive guide for configuring thermal printers (58mm / 80mm) with SmartTicketQR.

---

## Table of Contents

1. [Overview](#overview)
2. [Windows Setup (PC Guichet)](#windows-setup-pc-guichet)
3. [Android Setup (Tablette / Phone)](#android-setup-tablette--phone)
4. [Paper Size Configuration](#paper-size-configuration)
5. [Browser Print Settings (window.print() Fallback)](#browser-print-settings-windowprint-fallback)
6. [QZ Tray — Silent Printing Alternative](#qz-tray--silent-printing-alternative)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### Supported Printers

SmartTicketQR works with any **ESC/POS-compatible** thermal receipt printer. Common models include:

| Brand | Models | Paper Width | Notes |
|---|---|---|---|
| **Zebra** | ZD410, ZD420, ZD620 | 58mm / 80mm | USB, Bluetooth, Wi-Fi |
| **Xprinter** | XP-58IIH, XP-80C, XP-350B | 58mm / 80mm | Budget USB/Bluetooth |
| **Epson** | TM-T20III, TM-T88VI | 80mm | USB, Ethernet |
| **Sunmi** | V1, V2 Pro (built-in) | 58mm | Android POS integrated |
| **Z92** | Z92 (built-in) | 58mm | Android POS integrated |
| **Goojprt** | PT-210, Q58 | 58mm | Bluetooth portable |
| **MTP-II / MTP-3** | Various | 58mm | Bluetooth portable |

### Printing Methods

SmartTicketQR supports **four** printing strategies, used in automatic fallback order:

```
1. Web Bluetooth  →  Direct BLE connection, raw ESC/POS bytes
2. Web Serial     →  USB/serial connection, raw ESC/POS bytes
3. window.print() →  Browser print dialog with thermal-optimized HTML
4. Capacitor Native →  Android APK direct printer access (POS terminals)
```

| Method | Platform | Connection | ESC/POS | Dialog |
|---|---|---|---|---|
| **Web Bluetooth** | Android, ChromeOS, Linux, Win | BLE | Yes | No |
| **Web Serial** | Chrome/Edge (desktop) | USB | Yes | No |
| **window.print()** | All | Any system printer | No (HTML) | Yes |
| **Capacitor Native** | Android APK | Internal/USB | Yes | No |

### How the Print Fallback Works

The `ThermalPrintManager` class (in `src/lib/thermal-printer.ts`) tries each method in order:

```typescript
// Automatic fallback chain:
// 1. Try Web Bluetooth (raw ESC/POS via BLE)
// 2. Try Web Serial (raw ESC/POS via USB)
// 3. Fall back to window.print() (HTML receipt in hidden iframe)

const manager = new ThermalPrintManager('80mm');
const result = await manager.printTicket(ticketData);
// result.method = 'bluetooth' | 'serial' | 'print_dialog'
```

---

## Windows Setup (PC Guichet)

### Step 1: Connect the Printer

1. Plug the USB cable into the PC.
2. Power on the printer.
3. Windows will auto-detect and may install a generic driver.

### Step 2: Install "Generic / Text Only" Driver

For raw ESC/POS printing via Web Serial, you **must** use a generic driver that does not add formatting:

1. Open **Settings** > **Devices** > **Printers & scanners**.
2. Click **"Add a printer or scanner"**.
3. If the printer appears, click it, then click **"Manage"** > **"Printer Properties"**.
4. On the **Advanced** tab, click **"New Driver..."**.
5. Select **"Generic"** from the manufacturer list.
6. Select **"Generic / Text Only"** from the printer list.
7. Click **Next** and finish installation.

> **Why this matters:** The standard printer drivers (from Epson, Xprinter, etc.) render text through their own graphics pipeline, which adds margins, rescales fonts, and corrupts ESC/POS byte sequences. The "Generic / Text Only" driver passes raw bytes directly to the printer.

### Step 3: Configure Paper Size

Create a **custom paper size** matching your thermal roll:

#### For 58mm paper:

1. **Control Panel** > **Hardware and Sound** > **Devices and Printers**
2. Right-click the printer > **Printing Preferences**
3. Click **"Document Properties"** (or **"Paper/Quality"** tab)
4. Click **"Custom..."** next to the paper size dropdown
5. Set:
   - **Name:** `58mm Thermal`
   - **Width:** `58.00 mm`
   - **Height:** `2100.00 mm` (long roll — set a large value)
6. Click **Save** and set margins to **0 mm** on all sides

#### For 80mm paper:

Same steps, but set:
   - **Name:** `80mm Thermal`
   - **Width:** `80.00 mm`
   - **Height:** `2100.00 mm`

### Step 4: Printer Properties (Advanced Settings)

In **Printer Properties** > **General** > **Preferences**:

| Setting | Value |
|---|---|
| Paper Size | `58mm Thermal` or `80mm Thermal` (custom) |
| Source | `Automatically Select` |
| Orientation | `Portrait` |
| Print Quality | `Normal` or `High` |
| **Top Margin** | `0 mm` |
| **Bottom Margin** | `0 mm` |
| **Left Margin** | `0 mm` |
| **Right Margin** | `0 mm` |

> **Tip:** Disable "Shrink to Fit" or "Fit to printable area" in the printer preferences. This option causes the receipt to be scaled down, creating white margins.

---

## Browser Print Settings (window.print() Fallback)

When using the browser print dialog (the default on Windows PCs), configure Chrome settings for optimal thermal output:

### Chrome Print Dialog Settings

When `Ctrl+P` (or the SmartTicketQR print button) triggers the print dialog:

1. **Destination:** Select your thermal printer
2. **Margins:** Select **"None"**
3. **Headers and Footers:** **Uncheck** (disable)
4. **Background Graphics:** **Uncheck** (not needed for thermal)
5. **Scale:** Set to **"100"** (Custom) — do NOT use "Default" or "Fit to page"
6. **Pages:** "All" (default)
7. **Layout:** Portrait
8. **Color:** Black and White (or Mono)
9. **Paper Size:** Select your custom `58mm Thermal` or `80mm Thermal`

### Chrome Flags for Print Optimization

Set these Chrome policies to avoid prompts and defaults:

```json
// Windows Registry or Chrome policy JSON
{
  "printing": {
    "default_printer_selection": "MOST_RECENTLY_USED",
    "print_header_footer": false,
    "background_graphics_enabled": false
  }
}
```

### CSS @page Rules Used by SmartTicketQR

The thermal print stylesheets (`thermal-print.css`, `ticket-thermal.css`) enforce zero margins via CSS:

```css
@media print {
  @page {
    size: 58mm auto;   /* or 80mm auto */
    margin: 0;
  }

  html, body {
    margin: 0 !important;
    padding: 0 !important;
  }
}
```

The `generatePrintHTML()` function in `thermal-printer.ts` also injects `@page { margin: 0 }` into the print iframe.

---

## Android Setup (Tablette / Phone)

### Method 1: Web Bluetooth (Recommended)

SmartTicketQR uses the **Web Bluetooth API** to pair with Bluetooth thermal printers directly from Chrome.

#### Requirements

- **Chrome 56+** (or Edge, Opera with Web Bluetooth support)
- **HTTPS** required (Web Bluetooth will not work on HTTP)
- Bluetooth must be enabled on the device
- Printer must be in **pairing mode** (usually indicated by a blinking LED)

#### Pairing Guide

1. Open **Settings** > **Bluetooth** on your Android device.
2. Put the thermal printer in pairing mode (press and hold the pairing button).
3. When the printer appears, tap it to pair. Accept the PIN (usually `0000` or `1234`).
4. Open SmartTicketQR in Chrome.
5. Click the **Print** button on a ticket.
6. Chrome will show a **device picker** — select your printer.
7. The receipt is sent as raw ESC/POS bytes via BLE.

#### BLE Configuration in Code

The Bluetooth printer uses these UUIDs (defined in `src/lib/thermal-printer.ts`):

```typescript
const BLE_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const BLE_CHARACTERISTIC_UUID = '00002af0-0000-1000-8000-00805f9b34fb';
const BLE_MTU = 20; // Standard BLE packet size (bytes)
```

> **Note:** Data is sent in 20-byte chunks with a 50ms delay between packets to prevent buffer overflow on the printer.

### Method 2: RawBT Printer Driver App (Fallback)

If Web Bluetooth is unavailable or unreliable, use the **RawBT** app as a bridge:

1. **Install RawBT** from the Google Play Store:
   - [RawBT on Google Play](https://play.google.com/store/apps/details?id=ru.rawbt_printer_driver)
2. Pair your Bluetooth printer in Android Settings first.
3. Open RawBT and select the paired printer.
4. RawBT registers a custom URI scheme: `rawbt:base64,<ESC_POS_BYTES>`
5. SmartTicketQR encodes receipts using this scheme via `buildRawBTUri()` in `escpos-commands.ts`:

```typescript
import { buildEscPosTicket, buildRawBTUri } from '@/lib/escpos-commands';

// Build ESC/POS bytes from ticket data
const buffer = buildEscPosTicket(ticketData);

// Create RawBT URI
const rawbtUrl = buildRawBTUri(buffer);
// e.g., "rawbt:base64,GxGA..."

// Open the URI — RawBT app handles printing
window.location.href = rawbtUrl;
```

### Method 3: Capacitor Native (Android APK)

For POS terminals (Z92, Sunmi, Xprinter with Android), build a native APK using Capacitor. See [INSTALL_ANDROID_POS.md](./INSTALL_ANDROID_POS.md) for the full build guide.

---

## Paper Size Configuration

### Reference Table

| Paper Width | Total Width | Printable Width | Chars/Line (8pt mono) | Chars/Line (default) |
|---|---|---|---|---|
| **58mm** | 58.0 mm | ~48 mm | ~38 chars | **32 chars** |
| **80mm** | 80.0 mm | ~72 mm | ~57 chars | **48 chars** |

### Code Constants

These are defined in `src/lib/escpos-commands.ts`:

```typescript
export const PAPER_58MM = 32; // Characters per line for 58mm paper
export const PAPER_80MM = 48; // Characters per line for 80mm paper
```

### Setting Custom Paper Size in Windows (Step-by-Step)

#### Option A: Print Server Properties

1. Open **Control Panel** > **Hardware and Sound** > **Devices and Printers**
2. Click **"Print server properties"** in the top toolbar
3. Go to the **"Forms"** tab
4. Check **"Create a new form"**
5. Fill in:
   - **Form name:** `58mm Thermal`
   - **Width:** `2.28 in` (58 mm)
   - **Height:** `82.68 in` (2100 mm)
   - **Unprintable margins:** All `0.00 in`
6. Click **"Save Form"**
7. Repeat for 80mm: Width `3.15 in` (80 mm)

#### Option B: Direct Printer Preferences

1. Right-click the printer > **Printing Preferences**
2. Click **"Document Properties"**
3. Select **"PostScript Custom Options"** or **"Paper Size"**
4. Enter custom dimensions: `58mm` × `2100mm`
5. Set all margins to `0`

### QR Code Sizing

QR codes are sized differently based on paper width:

```typescript
// In buildEscPosBuffer():
// 58mm → module size 4, 80mm → module size 6
builder.qrCode(qrPayload, w === 58 ? 4 : 6);
```

| Paper Width | QR Module Size | Approx. QR Width |
|---|---|---|
| 58mm | 4 dots | ~100px (~26mm) |
| 80mm | 6 dots | ~150px (~39mm) |

---

## QZ Tray — Silent Printing Alternative

For high-volume ticket offices where the browser print dialog must be suppressed, install **QZ Tray**:

### What is QZ Tray?

QZ Tray is a Java-based print agent that enables **silent printing** (no dialog) from web applications. It communicates with the browser via WebSocket.

### Installation

1. Download from [qz.io](https://qz.io/)
2. Install Java 8+ if not already present
3. Run the QZ Tray installer
4. Start QZ Tray (it runs as a system tray application)

### Configuration for SmartTicketQR

```javascript
// Connect to QZ Tray
const qz = qz.websocket.connect();

// Print raw ESC/POS data silently
qz.printers.find('Generic / Text Only').then(function(printer) {
  const config = qz.configs.create(printer, {
    bounds: { width: 58, height: 0 },   // 58mm paper
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    encoding: 'CP850',
    density: 5
  });

  const data = [
    '\x1B\x40',           // ESC @ — Initialize printer
    '\x1B\x61\x01',       // ESC a 1 — Center alignment
    'SmartTicketQR\n',
    '\x1B\x45\x01TEST\n', // ESC E 1 — Bold on
    '\x1B\x45\x00',       // ESC E 0 — Bold off
    '\x1D\x56\x00'        // GS V 0 — Full paper cut
  ];

  qz.print(config, data);
});
```

### Certificate Signing (HTTPS)

QZ Tray requires a signed certificate for WebSocket connections. For development, use the default self-signed cert. For production:

1. Generate a CSR from QZ Tray
2. Sign it with your organization's CA
3. Import the signed cert into QZ Tray

---

## Troubleshooting

### White Margins on Printed Receipts

**Symptoms:** Receipt has blank white space on the left, right, or bottom edges.

**Causes & Solutions:**

| Cause | Solution |
|---|---|
| Browser margins not set to 0 | In Chrome print dialog: **Margins → None** |
| Custom paper size not set | Create `58mm Thermal` form in Print Server Properties |
| "Shrink to fit" enabled | Set Scale to **100%** in print dialog |
| Printer driver adding margins | Switch to "Generic / Text Only" driver |
| @page CSS not applied | Ensure `@page { margin: 0; size: 58mm auto; }` is in your print stylesheet |

**Quick fix in Chrome:**
```
Ctrl+P → More settings → Margins: None → Scale: Custom → 100
```

### Print is Too Small or Too Large

| Cause | Solution |
|---|---|
| Scale not 100% | Print dialog → Scale → Custom → **100** |
| Wrong paper size selected | Select `58mm Thermal` or `80mm Thermal` |
| DPI mismatch | Set printer DPI to **203** (standard thermal) |

### QR Code is Blurry or Unreadable

| Cause | Solution |
|---|---|
| Low-DPI printer | Ensure printer is **203 DPI** (standard for receipt printers). 300 DPI is better. |
| QR module size too small | Increase module size: `builder.qrCode(data, 6)` for 58mm, `builder.qrCode(data, 8)` for 80mm |
| Browser scaling | Set zoom to 100% before printing |
| Wrong code page | Set CP850: `builder.setEncoding('CP850')` |

### Bluetooth Not Connecting

| Cause | Solution |
|---|---|
| Printer not in pairing mode | Hold the pairing button until LED blinks |
| Already paired but not connected | Unpair in Android Settings, then re-pair |
| Web Bluetooth not supported | Use Chrome 56+ on Android, or use RawBT fallback |
| Wrong BLE UUID | Some printers use custom service UUIDs. Check your printer's documentation |
| Connection timeout | The MTU is 20 bytes — large receipts may time out. Reduce batch size or use USB |

**Debugging:**
```javascript
// Check Web Bluetooth support
console.log('Web Bluetooth:', navigator.bluetooth ? 'Supported' : 'Not supported');

// Check device connection
const device = await navigator.bluetooth.requestDevice({
  filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }]
});
console.log('Device:', device.name, device.id);
```

### Characters Are Garbled (Wrong Encoding)

**Symptoms:** French accents (é, è, ê, ç) print as random symbols or boxes.

**Cause:** Printer code page does not match the encoded output.

**Solution:** SmartTicketQR defaults to **CP850** (Code Page 850) which supports French/Western European characters:

```typescript
// In EscPosBuilder:
builder.setEncoding('CP850');  // Sends ESC t 17 (0x11)

// CP850 character mapping (from escpos-commands.ts):
// é=0x82, è=0x8A, ê=0x88, ç=0x87, à=0x85, ù=0x97, etc.
```

| Character | CP850 Hex | Character | CP850 Hex |
|---|---|---|---|
| é | `0x82` | è | `0x8A` |
| ê | `0x88` | ë | `0x89` |
| à | `0x85` | â | `0x83` |
| ç | `0x87` | ù | `0x97` |
| ô | `0x93` | î | `0x8E` |
| É | `0x90` | Ç | `0x80` |
| € | `0xE1` | œ | `0x9C` |

### Printer Does Not Cut Paper

| Cause | Solution |
|---|---|
| Auto-cut disabled | Enable: `builder.cut(true)` (partial) or `builder.cut(false)` (full) |
| Printer model has no cutter | Some budget models (like XP-58IIH) lack auto-cutters |
| Cut command not sent | Verify ESC/POS bytes end with `1D 56 00` (full) or `1D 56 01` (partial) |

### Print Head Errors / Blank Lines

| Cause | Solution |
|---|---|
| Print head dirty | Clean with isopropyl alcohol and a cotton swab |
| Paper misaligned | Re-seat the paper roll, ensure it's feeding straight |
| Heat setting too low | Increase density: `builder.setDensity(7)` |
| Low battery (portable printers) | Charge the printer |

---

## Quick Reference: Print Method Decision Tree

```
Are you on a Windows PC (Guichet)?
├── YES → Use window.print() with "Generic / Text Only" driver
│         (or QZ Tray for silent printing)
│
└── NO → Are you on an Android POS terminal (Z92, Sunmi)?
         ├── YES → Build native APK with Capacitor (see INSTALL_ANDROID_POS.md)
         │
         └── NO → Are you on Android (phone/tablet)?
                  ├── YES → Use Web Bluetooth (Chrome 56+)
                  │         Fallback: RawBT app
                  │
                  └── NO → Use window.print() with thermal CSS
```

---

## File Reference

| File | Purpose |
|---|---|
| `src/lib/thermal-printer.ts` | Print manager with Bluetooth/Serial/Dialog strategies |
| `src/lib/escpos-commands.ts` | ESC/POS command builder, QR codes, barcodes, encoding |
| `src/lib/pos-printer.ts` | Capacitor native POS printer bridge |
| `src/components/smart-ticket/thermal-print-button.tsx` | Print button + dialog UI component |
| `src/styles/thermal-print.css` | Thermal print CSS utilities |
| `src/styles/ticket-thermal.css` | Ticket-specific thermal print styles |
| `capacitor.config.json` | Capacitor configuration for native builds |
