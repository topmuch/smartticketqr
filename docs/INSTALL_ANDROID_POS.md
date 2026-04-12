# SmartTicketQR — Android POS Terminal Deployment Guide

> Step-by-step guide for building and deploying SmartTicketQR as a native Android APK on POS terminals (Z92, Sunmi, Xprinter, and other ESC/POS-compatible devices).

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step-by-Step Build Process](#step-by-step-build-process)
3. [Signing the APK](#signing-the-apk)
4. [Installing on Z92 POS Terminal](#installing-on-z92-pos-terminal)
5. [Testing the Printer](#testing-the-printer)
6. [ESC/POS Commands Reference](#escpos-commands-reference)
7. [Common Issues & Solutions](#common-issues--solutions)

---

## Prerequisites

### Required Software

| Tool | Version | Purpose |
|---|---|---|
| **Node.js** | 18+ | Build the Next.js static export |
| **npm** or **bun** | Latest | Package management |
| **Android Studio** | 2023.1+ | Build and sign the APK |
| **JDK** | 17 | Java compiler for Gradle/Android |
| **Capacitor CLI** | 5+ | Bridge between web and native |

### Hardware Requirements

| Item | Requirement |
|---|---|
| Development PC | 8 GB RAM, 20 GB free disk space |
| POS Terminal | Android 7.0+ (API 24+), USB port or built-in printer |
| USB Cable | For ADB deployment and debugging |

### Supported POS Terminals

| Terminal | Android Version | Built-in Printer | Notes |
|---|---|---|---|
| **Z92** | 7.1+ | 58mm thermal | Built-in ESC/POS printer, USB, Wi-Fi |
| **Sunmi V1/V2 Pro** | 7.1+ | 58mm thermal | Built-in printer, NFC, barcode scanner |
| **Sunmi T2/T2 Lite** | 9.0+ | 80mm thermal | Larger screen, faster printer |
| **Xprinter Android** | Varies | 58mm / 80mm | Connects via USB or Bluetooth |
| **Any Android + USB printer** | 7.0+ | External | Uses Capacitor USB serial plugin |

---

## Step-by-Step Build Process

### Step 1: Install Capacitor Dependencies

```bash
# Install Capacitor core and CLI
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android
```

### Step 2: Initialize Capacitor

```bash
# Initialize Capacitor (if not already done)
npx cap init com.smartticketqr.app SmartTicketQR --web-dir out
```

This creates `capacitor.config.json` in your project root. The existing configuration:

```json
{
  "appId": "com.smartticketqr.app",
  "appName": "SmartTicketQR",
  "webDir": "out",
  "server": {
    "androidScheme": "https"
  },
  "plugins": {
    "POSPrinter": {
      "defaultPaperWidth": 58,
      "defaultDensity": 5,
      "autoCut": true,
      "codePage": "CP850"
    }
  }
}
```

### Step 3: Configure Next.js for Static Export

Modify `next.config.ts` to output a fully static build:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",        // Static HTML export (required for Capacitor)
  trailingSlash: true,      // Required for Capacitor routing
  images: {
    unoptimized: true,      // Static export cannot optimize images
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
```

> **Important:** When `output: "export"` is set, Next.js API routes (`/api/*`) are **not included** in the build. The Android app must call the remote API server directly. Make sure your API base URL is configured as an environment variable.

### Step 4: Build the Next.js Static Export

```bash
# Set the API server URL (your production or staging server)
NEXT_PUBLIC_API_URL=https://api.smartticketqr.com \
  npm run build
```

This generates the static files in the `out/` directory.

### Step 5: Add the Android Platform

```bash
# Add Android platform (creates the android/ directory)
npx cap add android
```

### Step 6: Sync Web Assets to Android

```bash
# Copy the built web assets into the Android project
npx cap sync android
```

This copies everything from `out/` into `android/app/src/main/assets/public/`.

### Step 7: Copy the POS Printer Plugin

Copy the native POS printer Java plugin into the Android project:

```bash
# Create the plugin directory
mkdir -p android/app/src/main/java/com/smartticketqr/app/plugins

# Copy POSPrinterPlugin.java
# (This file bridges the web POS printer calls to the native Android USB printer)
```

The plugin Java file should be placed at:

```
android/app/src/main/java/com/smartticketqr/app/plugins/POSPrinterPlugin.java
```

Example plugin structure:

```java
package com.smartticketqr.app.plugins;

import android.util.Base64;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "POSPrinter",
    permissions = {
        @Permission(
            strings = { "android.permission.USB_PERMISSION" },
            alias = "usb"
        )
    }
)
public class POSPrinterPlugin extends Plugin {
    private static final String TAG = "POSPrinter";

    @PluginMethod()
    public void print(PluginCall call) {
        String base64Data = call.getString("data");
        JSObject options = call.getObject("options");

        if (base64Data == null) {
            call.reject("No data provided");
            return;
        }

        try {
            byte[] escposBytes = Base64.decode(base64Data, Base64.DEFAULT);

            // Send to POS printer via USB serial
            // Implementation depends on the specific POS terminal SDK
            boolean success = sendToPrinter(escposBytes, options);

            JSObject result = new JSObject();
            result.put("success", success);
            result.put("printerModel", getPrinterModel());
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Print failed", e);
            call.reject("Print failed: " + e.getMessage());
        }
    }

    @PluginMethod()
    public void getStatus(PluginCall call) {
        JSObject status = new JSObject();
        status.put("connected", isPrinterConnected());
        status.put("model", getPrinterModel());
        status.put("paperWidth", 58);
        call.resolve(status);
    }

    // --- Native printer implementation (terminal-specific) ---

    private native boolean sendToPrinter(byte[] data, JSObject options);
    private native boolean isPrinterConnected();
    private native String getPrinterModel();
}
```

### Step 8: Register the Plugin in MainActivity

Edit `android/app/src/main/java/com/smartticketqr/app/MainActivity.java`:

```java
package com.smartticketqr.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.smartticketqr.app.plugins.POSPrinterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(POSPrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```

### Step 9: Update Android Manifest Permissions

Edit `android/app/src/main/AndroidManifest.xml` and add:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- POS Printer permissions -->
    <uses-permission android:name="android.permission.USB_PERMISSION" />
    <uses-permission android:name="android.permission.BLUETOOTH" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
    <uses-feature android:name="android.hardware.usb.host" />

    <!-- Network permissions for API calls -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:usesCleartextTraffic="true"
        android:theme="@style/AppTheme.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:screenOrientation="portrait"
            android:launchMode="singleTask"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>
</manifest>
```

### Step 10: Build the APK

#### Option A: Build with Android Studio (Recommended)

```bash
# Open in Android Studio
npx cap open android
```

Then in Android Studio:
1. **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**
2. The unsigned APK is generated at:
   `android/app/build/outputs/apk/debug/app-debug.apk`

#### Option B: Build with Gradle CLI

```bash
cd android

# Debug build
./gradlew assembleDebug

# The APK is at: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Signing the APK

### Step 1: Generate a Keystore

```bash
keytool -genkeypair \
  -v \
  -keystore smartticketqr-release.keystore \
  -alias smartticketqr \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD
```

### Step 2: Configure Signing in Gradle

Edit `android/app/build.gradle`:

```groovy
android {
    signingConfigs {
        release {
            storeFile file('../../smartticketqr-release.keystore')
            storePassword System.getenv("KEYSTORE_PASSWORD") ?: "YOUR_STORE_PASSWORD"
            keyAlias "smartticketqr"
            keyPassword System.getenv("KEY_PASSWORD") ?: "YOUR_KEY_PASSWORD"
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.release
        }
    }
}
```

### Step 3: Build the Signed Release APK

```bash
cd android

# Build release APK
./gradlew assembleRelease

# Output: android/app/build/outputs/apk/release/app-release.apk
```

### Step 4: Verify the APK

```bash
# Verify the APK is signed
apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk

# Check APK contents
aapt dump badging android/app/build/outputs/apk/release/app-release.apk
```

---

## Installing on Z92 POS Terminal

### Step 1: Enable USB Debugging

1. On the Z92, go to **Settings** > **About Tablet**.
2. Tap **"Build Number"** 7 times to enable Developer Options.
3. Go to **Settings** > **Developer Options**.
4. Enable **USB Debugging**.
5. Enable **Install via USB** (if present).

### Step 2: Connect via ADB

```bash
# Connect the Z92 to your PC via USB cable
# Verify the device is detected
adb devices

# You should see something like:
# List of devices attached
# 1234567890ABCDEF    device
```

### Step 3: Install the APK

```bash
# Install the APK
adb install -r android/app/build/outputs/apk/release/app-release.apk

# Or for debug builds:
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Step 4: Launch the App

```bash
# Launch SmartTicketQR
adb shell am start -n com.smartticketqr.app/.MainActivity

# Or tap the app icon on the Z92 home screen
```

### Step 5: Verify Installation

```bash
# Check the app is installed
adb shell pm list packages | grep smartticketqr

# View logcat for debugging
adb logcat | grep -i "POSPrinter\|SmartTicket"
```

### Sunmi-Specific Notes

For Sunmi V1/V2 Pro terminals, add the Sunmi printer SDK:

```groovy
// android/app/build.gradle
dependencies {
    implementation 'com.sunmi:printerlibrary:1.0.8'
}
```

```java
// Use Sunmi's InnerPrinter API
import com.sunmi.peripheral.printer.InnerPrinterManager;
import com.sunmi.peripheral.printer.SunmiPrinterService;
```

### Z92-Specific Notes

Z92 terminals use a standard USB HID interface. The printer communicates via:

```java
// Z92 uses USB serial at 9600 baud
import android.hardware.usb.UsbManager;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
```

---

## Testing the Printer

### Built-in Test Print Function

SmartTicketQR includes a test print function accessible from the app. It sends a diagnostic receipt via the native POS printer plugin:

```typescript
// From src/lib/pos-printer.ts:
import { testPrint } from '@/lib/pos-printer';

// Runs the test print
const result = await testPrint();
// Expected output:
// === TEST D'IMPRIMANTE ===
// SmartTicketQR
// POS Printer OK
// ----------------
// 2025-01-15T10:30:00.000Z
```

### Manual ESC/POS Test (via ADB)

Send raw ESC/POS bytes directly to the printer for testing:

```bash
# Send a simple test pattern via ADB shell
adb shell "echo -ne '\x1B\x40\x1B\x61\x01SMARTTICKETQR\x0A\x1D\x56\x00' > /dev/ttyS0"

# Or test the printer service:
adb shell am broadcast -a com.smartticketqr.PRINT_TEST
```

### Verifying the Complete Print Pipeline

```
1. Open SmartTicketQR on the POS terminal
2. Go to Settings > Printer > Test Print
3. Expected: A receipt prints with:
   - "TEST D'IMPRIMANTE" header (centered, bold)
   - Organization name
   - Date/time stamp
   - Dashed separator
   - Paper cut
4. If nothing prints, check:
   - USB cable is connected
   - Printer has paper and is powered on
   - ADB logcat shows POSPrinter logs
```

### Using the Web API Test Endpoint

If the POS terminal can reach your API server:

```bash
# Trigger a test ticket from the API
curl -X POST https://api.smartticketqr.com/api/tickets/print \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": "test-001",
    "test": true
  }'
```

---

## ESC/POS Commands Reference

Quick reference for the ESC/POS commands used by SmartTicketQR. Full implementation is in `src/lib/escpos-commands.ts`.

### Initialization & Settings

| Command | Hex | Description |
|---|---|---|
| **ESC @** | `1B 40` | Initialize printer (reset to defaults) |
| **ESC t n** | `1B 74 n` | Select character code table |
| **GS ! n** | `1D 21 n` | Set character size + print density |

#### Code Page Selection (ESC t n)

| n (hex) | Code Page | Use Case |
|---|---|---|
| `0x00` | CP437 | Default US/English |
| `0x01` | ISO 8859-1 | Western European |
| `0x11` (17) | **CP850** | **French/Western European (default for SmartTicketQR)** |
| `0x12` (18) | CP852 | Eastern European |
| `0x03` | CP860 | Portuguese |
| `0x04` | CP863 | French Canadian |
| `0x2F` (47) | ISO 8859-15 | Western European with Euro sign |

### Text Formatting

| Command | Hex | Description |
|---|---|---|
| **ESC a n** | `1B 61 n` | Set justification alignment |
| **ESC E n** | `1B 45 n` | Bold on/off (`n=1` on, `n=0` off) |
| **ESC - n** | `1B 2D n` | Underline on/off (`n=1` single, `n=2` double) |
| **GS B n** | `1D 42 n` | Reverse (white-on-black) on/off |
| **GS ! n** | `1D 21 n` | Character size (upper nibble = width, lower = height) |

#### Alignment Values (ESC a n)

| n | Alignment |
|---|---|
| `0x00` | Left |
| `0x01` | Center |
| `0x02` | Right |

#### Character Size (GS ! n)

The byte `n` is split into two nibbles:

```
n = (widthMultiplier - 1) << 4 | (heightMultiplier - 1)

Example: 2x2 size → n = (2-1)<<4 | (2-1) = 0x11
Example: 1x2 size → n = (1-1)<<4 | (2-1) = 0x01
Example: 3x1 size → n = (3-1)<<4 | (1-1) = 0x20
```

### Print Density (GS ! n — upper nibble)

```
density 0 (lightest):  n = 0x00
density 1:             n = 0x10
density 2:             n = 0x20
density 3:             n = 0x30
density 4:             n = 0x40
density 5 (default):   n = 0x50
density 6:             n = 0x60
density 7 (darkest):   n = 0x70
```

### Paper Feed & Cut

| Command | Hex | Description |
|---|---|---|
| **LF** | `0x0A` | Print and line feed |
| **ESC d n** | `1B 64 n` | Print and feed n lines |
| **GS V m** | `1D 56 m` | Cut paper |
| **GS V m n** | `1D 56 m n` | Cut paper with feed |

#### Paper Cut Modes (GS V m)

| m | Cut Type | Hex |
|---|---|---|
| `0` | Full cut (through entire width) | `1D 56 00` |
| `1` | Partial cut (leaves small tab) | `1D 56 01` |

### QR Code Commands (GS ( k)

QR codes are generated by the printer firmware — no external image library needed. SmartTicketQR uses this 4-step sequence:

| Step | Function | Hex Sequence | Description |
|---|---|---|---|
| 1 | Set module size | `GS ( k 03 00 31 43 n` | Set QR module size (1–16 dots) |
| 2 | Set error correction | `GS ( k 03 00 31 45 n` | Set EC level (48=L, 49=M, 50=Q, 51=H) |
| 3 | Store data | `GS ( k pL pH 31 50 30 d1...dk` | Store the QR data bytes |
| 4 | Print | `GS ( k 03 00 31 51 30` | Execute QR code print |

**Error Correction Levels:**

| Level | Value | Error Recovery |
|---|---|---|
| L | `0x30` (48) | ~7% of codewords |
| M | `0x31` (49) | ~15% of codewords (default) |
| Q | `0x32` (50) | ~25% of codewords |
| H | `0x33` (51) | ~30% of codewords |

### Barcode Commands (GS k)

| Command | Hex | Description |
|---|---|---|
| **GS h n** | `1D 68 n` | Set barcode height (n dots, default 162) |
| **GS w n** | `1D 77 n` | Set barcode module width (1–6, default 3) |
| **GS f n** | `1D 66 n` | Set HRI font (0=A, 1=B) |
| **GS H n** | `1D 48 n` | Set HRI position (0=not printed, 1=above, 2=below, 3=both) |
| **GS k m d1...dk NUL** | `1D 6B m d1...dk 00` | Print barcode (Format 2) |

#### Barcode Types

| Type | m Value | Data Format |
|---|---|---|
| UPC-A | `0x00` | 11–12 digits |
| UPC-E | `0x01` | 6–8 digits |
| EAN13 / JAN13 | `0x02` | 12–13 digits |
| EAN8 / JAN8 | `0x03` | 7–8 digits |
| CODE39 | `0x04` | Alphanumeric + special |
| ITF | `0x05` | Even number of digits |
| CODABAR | `0x06` | Digits + special chars |
| CODE93 | `0x07` | ASCII subset |
| CODE128 | `0x08` | Full ASCII (default) |

### Cash Drawer

| Command | Hex | Description |
|---|---|---|
| **ESC p m t1 t2** | `1B 70 m t1 t2` | Kick cash drawer pulse |

- `m`: Pin number (0 or 1)
- `t1`: Pulse on-time (×2ms, default 100)
- `t2`: Pulse off-time (×2ms, default 100)

### Complete Receipt Example

```typescript
import { createReceipt } from '@/lib/escpos-commands';

const buf = createReceipt(80)        // 80mm paper (48 chars/line)
  .init()                            // 1B 40 — Initialize
  .setEncoding('CP850')              // 1B 74 11 — Set code page 850
  .setDensity(5)                     // 1D 21 50 — Medium density
  .align('center')                   // 1B 61 01 — Center align
  .textSize('CAFÉ DE PARIS', 2, 2)   // 1D 21 11 — Double size
  .newLine()                         // 0A — Line feed
  .doubleLine()                      // ================================
  .align('left')                     // 1B 61 00 — Left align
  .bold('Table 12')                  // 1B 45 01 + text + 1B 45 00
  .newLine()
  .text('Espresso .............. 3.50')
  .text('Croissant ............. 2.00')
  .text('Jus d\'orange ........... 4.00')
  .line()                            // --------------------------------
  .bold('TOTAL .................. 9.50')
  .newLine(2)                        // 0A 0A
  .qrCode('https://smartticketqr.com/t/ABC123', 6)  // GS ( k sequence
  .newLine(2)
  .line()
  .align('center')
  .text('Merci de votre visite !')
  .newLine(2)
  .cut(true)                         // 1D 56 01 — Partial cut
  .toBuffer();                       // Returns Uint8Array
```

---

## Common Issues & Solutions

### APK Build Fails

| Error | Solution |
|---|---|
| `Next.js static export missing` | Ensure `output: "export"` is set in `next.config.ts` and `npm run build` completes successfully |
| `Gradle sync failed` | Check JDK 17 is installed: `java -version`. Set `JAVA_HOME` in `android/gradle.properties` |
| `Capacitor sync error` | Run `npx cap sync android` again. Delete `android/` and `npx cap add android` if corrupted |
| `Duplicate class` error | Run `./gradlew clean` then rebuild |

### Printer Not Detected on POS Terminal

| Cause | Solution |
|---|---|
| USB permissions not granted | Add `android.hardware.usb.host` feature and request USB permission at runtime |
| Wrong USB interface | Some printers expose multiple USB interfaces. Try all available endpoints |
| Printer not powered on | Check the printer power cable and LED indicator |
| Driver conflict | Some POS terminals require specific printer SDK (Sunmi SDK for Sunmi devices) |

### Print Output Is Garbled

| Cause | Solution |
|---|---|
| Wrong baud rate | Default is 9600. Check printer documentation for correct rate |
| Code page mismatch | Ensure CP850 is set: `ESC t 17` (`0x1B 0x74 0x11`) |
| Buffer overflow | Add delays between write chunks (50ms for BLE, 20ms for USB) |
| UTF-8 sent as raw | SmartTicketQR encodes to CP850 automatically via `encodeText()` in `escpos-commands.ts` |

### App Crashes on Launch

| Cause | Solution |
|---|---|
| Missing `androidScheme: "https"` | Add to `capacitor.config.json` — required for Capacitor 5+ |
| ProGuard stripping classes | Disable minification: `minifyEnabled false` in `build.gradle` |
| Missing native libraries | Run `npx cap sync android` to copy all web assets |
| API URL not configured | Set `NEXT_PUBLIC_API_URL` before building the static export |

### App Shows Blank Screen

| Cause | Solution |
|---|---|
| Static export missing `out/` directory | Run `npm run build` before `npx cap sync` |
| Route not found | Ensure `trailingSlash: true` in `next.config.ts` |
| JavaScript error | Check `adb logcat` for WebView console errors |
| Network issue | POS terminal cannot reach the API server. Check Wi-Fi/ethernet |

### Sunmi Printer Specific Issues

```java
// Sunmi requires initialization before printing:
InnerPrinterManager.getInstance().doPrinterInit(context);

// Check printer status:
int status = InnerPrinterManager.getInstance().getPrinterStatus();
// 0 = normal, others indicate errors (paper out, overheating, etc.)
```

### ADB Commands Quick Reference

```bash
# List connected devices
adb devices

# Install APK
adb install -r app-release.apk

# Uninstall app
adb uninstall com.smartticketqr.app

# View app logs
adb logcat | grep -E "POSPrinter|Capacitor|WebView"

# Clear app data
adb shell pm clear com.smartticketqr.app

# Force stop app
adb shell am force-stop com.smartticketqr.app

# Take screenshot
adb shell screencap /sdcard/screenshot.png
adb pull /sdcard/screenshot.png

# Copy files to device
adb push local_file /sdcard/

# Open developer options
adb shell am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS
```

---

## File Reference

| File | Purpose |
|---|---|
| `capacitor.config.json` | Capacitor configuration (appId, webDir, plugins) |
| `next.config.ts` | Next.js build config (must set `output: "export"`) |
| `src/lib/pos-printer.ts` | Capacitor native POS printer bridge (TypeScript) |
| `src/lib/escpos-commands.ts` | ESC/POS command builder, encoding, QR/barcode |
| `src/lib/thermal-printer.ts` | Print manager with Bluetooth/Serial/Dialog strategies |
| `android/app/src/main/java/.../POSPrinterPlugin.java` | Native Android printer plugin |
| `android/app/src/main/java/.../MainActivity.java` | App entry point (plugin registration) |
| `android/app/src/main/AndroidManifest.xml` | Permissions and activity declarations |
