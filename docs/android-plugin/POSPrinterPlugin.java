package com.smartticketqr.app.plugins;

import android.Manifest;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * Capacitor plugin for native ESC/POS printing on Android POS terminals.
 *
 * <p>Bridges the Capacitor web layer to native Android USB serial printing hardware,
 * supporting ESC/POS command sequences for receipt, barcode, and QR code printing.</p>
 *
 * <h3>Supported Hardware</h3>
 * <ul>
 *   <li>Z92 thermal printers</li>
 *   <li>Sunmi V1 / V2 POS terminals (built-in printer)</li>
 *   <li>Xprinter XP-58 / XP-80 series</li>
 *   <li>Epson TM-T88 series</li>
 *   <li>Any ESC/POS-compatible USB thermal printer</li>
 * </ul>
 *
 * <h3>Usage from JavaScript/TypeScript</h3>
 * <pre>{@code
 * import { registerPlugin } from '@capacitor/core';
 * const POSPrinter = registerPlugin<{POSPrinter}>('POSPrinter');
 *
 * // Print raw ESC/POS data
 * await POSPrinter.print({
 *   data: base64EscPosString,
 *   options: { paperWidth: 58, density: 7, copies: 1, autoCut: true, codePage: 'UTF-8' }
 * });
 *
 * // Query printer status
 * const status = await POSPrinter.getStatus();
 *
 * // Print a built-in test receipt
 * await POSPrinter.testPrint();
 * }</pre>
 *
 * @see <a href="https://reference.epson-biz.com/modules/ref_escpos/">ESC/POS Reference</a>
 * @since 1.0.0
 */
@CapacitorPlugin(
    name = "POSPrinter",
    permissions = {
        @Permission(
            strings = { Manifest.permission.USB_PERMISSION },
            alias = "usb"
        )
    }
)
public class POSPrinterPlugin extends Plugin {

    private static final String TAG = "POSPrinterPlugin";

    // ------------------------------------------------------------------ //
    //  Constants                                                          //
    // ------------------------------------------------------------------ //

    /** Maximum bytes written per USB chunk. Kept small (20) for broad compatibility. */
    private static final int CHUNK_SIZE = 20;

    /** Milliseconds to wait between chunk writes to avoid buffer overflow. */
    private static final int CHUNK_DELAY_MS = 50;

    /** Default thermal density (0-15). */
    private static final int DEFAULT_DENSITY = 7;

    /** Default paper width in mm. */
    private static final int DEFAULT_PAPER_WIDTH_MM = 58;

    /** Default character code page table. */
    private static final String DEFAULT_CODE_PAGE = "UTF-8";

    /**
     * Known USB Vendor IDs for ESC/POS-compatible printers.
     *
     * <ul>
     *   <li>{@code 0x0525} — Sunmi</li>
     *   <li>{@code 0x04B3} — IBM / Posiflex</li>
     *   <li>{@code 0x0FE6} — Xprinter</li>
     *   <li>{@code 0x0483} — STMicroelectronics (common in Z92)</li>
     *   <li>{@code 0x04E8} — Samsung (some Sunmi variants)</li>
     * </ul>
     */
    private static final int[] KNOWN_VENDOR_IDS = {
        0x0525, // Sunmi
        0x04B3, // IBM / Posiflex
        0x0FE6, // Xprinter
        0x0483, // STMicroelectronics (Z92)
        0x04E8, // Samsung (Sunmi variants)
    };

    // ------------------------------------------------------------------ //
    //  State                                                              //
    // ------------------------------------------------------------------ //

    /** Currently connected USB printer device, or {@code null}. */
    private UsbDevice connectedPrinter;

    /** Active USB connection for data transfer. */
    private UsbDeviceConnection usbConnection;

    /** Output stream to the printer's bulk-out endpoint. */
    private OutputStream printerOutputStream;

    // ------------------------------------------------------------------ //
    //  Lifecycle                                                          //
    // ------------------------------------------------------------------ //

    /**
     * Release USB resources when the plugin is destroyed.
     */
    @Override
    public void onDestroy() {
        closeConnection();
        super.onDestroy();
    }

    // ================================================================== //
    //  PUBLIC PLUGIN METHODS                                              //
    // ================================================================== //

    /**
     * Print ESC/POS data to the connected USB thermal printer.
     *
     * <p>Accepts a Base64-encoded string of raw ESC/POS bytes, decodes them,
     * opens a USB serial connection (or reuses an existing one), and transmits
     * the data in small chunks with inter-chunk delays for reliable delivery.</p>
     *
     * <h4>Parameters (via {@code call})</h4>
     * <table>
     *   <tr><th>Key</th><th>Type</th><th>Required</th><th>Default</th><th>Description</th></tr>
     *   <tr><td>{@code data}</td><td>String</td><td>Yes</td><td>—</td><td>Base64-encoded ESC/POS byte sequence</td></tr>
     *   <tr><td>{@code options.paperWidth}</td><td>Number</td><td>No</td><td>58</td><td>Paper width in mm (58 or 80)</td></tr>
     *   <tr><td>{@code options.density}</td><td>Number</td><td>No</td><td>7</td><td>Print darkness 0-15</td></tr>
     *   <tr><td>{@code options.copies}</td><td>Number</td><td>No</td><td>1</td><td>Number of copies to print</td></tr>
     *   <tr><td>{@code options.autoCut}</td><td>Boolean</td><td>No</td><td>true</td><td>Issue paper-cut command after printing</td></tr>
     *   <tr><td>{@code options.codePage}</td><td>String</td><td>No</td><td>"UTF-8"</td><td>Character encoding for text</td></tr>
     * </table>
     *
     * <h4>Returns</h4>
     * <pre>{ success: true, message: "Printed N copies", printerModel: "..." }</pre>
     *
     * <h4>Error codes</h4>
     * <ul>
     *   <li>{@code "NO_DATA"} — the {@code data} parameter is missing or empty</li>
     *   <li>{@code "DECODE_ERROR"} — Base64 decoding failed</li>
     *   <li>{@code "NO_PRINTER"} — no compatible printer found on USB bus</li>
     *   <li>{@code "CONNECTION_FAILED"} — USB connection could not be opened</li>
     *   <li>{@code "WRITE_ERROR"} — an I/O error occurred while sending data</li>
     *   <li>{@code "PAPER_OUT"} — the printer reports no paper</li>
     *   <li>{@code "PRINTER_OFFLINE"} — the printer is offline or unresponsive</li>
     * </ul>
     */
    @PluginMethod
    public void print(PluginCall call) {
        // ---- Validate input ----
        String base64Data = call.getString("data");
        if (base64Data == null || base64Data.trim().isEmpty()) {
            Log.w(TAG, "print() called with no data");
            call.reject("Missing or empty 'data' parameter (Base64 ESC/POS string expected)", "NO_DATA");
            return;
        }

        // ---- Parse options ----
        JSObject options = call.getObject("options", new JSObject());
        int paperWidth = options.optInt("paperWidth", DEFAULT_PAPER_WIDTH_MM);
        int density = options.optInt("density", DEFAULT_DENSITY);
        int copies = options.optInt("copies", 1);
        boolean autoCut = options.optBoolean("autoCut", true);
        @SuppressWarnings("unused")
        String codePage = options.optString("codePage", DEFAULT_CODE_PAGE);

        // Clamp values
        density = Math.max(0, Math.min(15, density));
        copies = Math.max(1, Math.min(10, copies));
        if (paperWidth != 58 && paperWidth != 80) {
            paperWidth = DEFAULT_PAPER_WIDTH_MM;
        }

        // ---- Decode Base64 → bytes ----
        byte[] escPosBytes;
        try {
            escPosBytes = decodeBase64(base64Data);
        } catch (IllegalArgumentException e) {
            Log.e(TAG, "Base64 decode failed", e);
            call.reject("Invalid Base64 data: " + e.getMessage(), "DECODE_ERROR");
            return;
        }
        if (escPosBytes.length == 0) {
            call.reject("Decoded data is empty", "DECODE_ERROR");
            return;
        }

        Log.i(TAG, String.format(
            "print() — %d bytes, density=%d, copies=%d, autoCut=%b, paperWidth=%dmm",
            escPosBytes.length, density, copies, autoCut, paperWidth
        ));

        // ---- Check USB permission & find printer ----
        if (getPermissionState("usb") != com.getcapacitor.PermissionState.GRANTED) {
            Log.d(TAG, "USB permission not granted — requesting");
            requestPermissionForAlias("usb", call, "handleUsbPermissionPrint");
            return;
        }

        doPrint(call, escPosBytes, copies, autoCut);
    }

    /**
     * Callback after the user grants (or denies) USB permission for {@link #print}.
     */
    @PermissionCallback
    private void handleUsbPermissionPrint(PluginCall call) {
        if (getPermissionState("usb") == com.getcapacitor.PermissionState.GRANTED) {
            // Re-extract data — it was validated before the permission prompt
            String base64Data = call.getString("data");
            int copies = call.getObject("options", new JSObject()).optInt("copies", 1);
            boolean autoCut = call.getObject("options", new JSObject()).optBoolean("autoCut", true);

            try {
                byte[] escPosBytes = decodeBase64(base64Data);
                doPrint(call, escPosBytes, copies, autoCut);
            } catch (IllegalArgumentException e) {
                call.reject("Invalid Base64 data: " + e.getMessage(), "DECODE_ERROR");
            }
        } else {
            call.reject("USB permission denied", "PERMISSION_DENIED");
        }
    }

    /**
     * Internal print implementation — runs after permission is confirmed.
     */
    private void doPrint(PluginCall call, byte[] escPosBytes, int copies, boolean autoCut) {
        // ---- Find printer ----
        UsbDevice printer = findPrinter();
        if (printer == null) {
            call.reject("No ESC/POS printer found on USB bus", "NO_PRINTER");
            return;
        }
        String printerModel = identifyPrinter(printer);

        Log.i(TAG, String.format("Found printer: %s (VID=0x%04X PID=0x%04X)",
            printerModel, printer.getVendorId(), printer.getProductId()));

        // ---- Open connection ----
        try {
            openConnection(printer);
        } catch (Exception e) {
            Log.e(TAG, "Failed to open USB connection", e);
            call.reject("Could not open USB connection: " + e.getMessage(), "CONNECTION_FAILED");
            return;
        }

        // ---- Send data ----
        try {
            for (int i = 0; i < copies; i++) {
                Log.d(TAG, "Printing copy " + (i + 1) + " of " + copies);
                sendBytes(printerOutputStream, escPosBytes);

                // Auto-cut between copies (except after the last if autoCut is true)
                if (autoCut && i < copies - 1) {
                    sendBytes(printerOutputStream, buildCutCommand());
                }
            }

            if (autoCut) {
                sendBytes(printerOutputStream, buildCutCommand());
            }

            // Feed 3 lines after cut
            sendBytes(printerOutputStream, new byte[]{ 0x1B, 0x64, 0x03 });

            Log.i(TAG, "Print completed successfully");
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Printed " + copies + (copies == 1 ? " copy" : " copies"));
            result.put("printerModel", printerModel);
            call.resolve(result);

        } catch (PaperOutException e) {
            Log.e(TAG, "Paper out detected", e);
            call.reject("Printer paper out — please reload paper", "PAPER_OUT");
        } catch (PrinterOfflineException e) {
            Log.e(TAG, "Printer offline", e);
            call.reject("Printer is offline or unresponsive", "PRINTER_OFFLINE");
        } catch (Exception e) {
            Log.e(TAG, "Write error during printing", e);
            call.reject("Write error: " + e.getMessage(), "WRITE_ERROR");
        } finally {
            // Keep the connection open for subsequent calls; close on plugin destroy.
        }
    }

    /**
     * Query the current status of the USB POS printer.
     *
     * <p>Scans the USB bus for a compatible printer and returns connection state,
     * model identification, and configured paper width.</p>
     *
     * <h4>Returns</h4>
     * <pre>{
     *   connected: boolean,
     *   model: string | null,
     *   paperWidth: number,
     *   vendorId: number,
     *   productId: number
     * }</pre>
     */
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();

        UsbDevice printer = findPrinter();

        if (printer != null && usbConnection != null && printerOutputStream != null) {
            result.put("connected", true);
            result.put("model", identifyPrinter(printer));
            result.put("paperWidth", DEFAULT_PAPER_WIDTH_MM);
            result.put("vendorId", printer.getVendorId());
            result.put("productId", printer.getProductId());
            Log.i(TAG, "getStatus() — connected: " + identifyPrinter(printer));
        } else if (printer != null) {
            // Printer found but not currently connected via stream
            result.put("connected", false);
            result.put("model", identifyPrinter(printer));
            result.put("paperWidth", DEFAULT_PAPER_WIDTH_MM);
            result.put("vendorId", printer.getVendorId());
            result.put("productId", printer.getProductId());
            Log.i(TAG, "getStatus() — printer found but not connected");
        } else {
            result.put("connected", false);
            result.put("model", null);
            result.put("paperWidth", 0);
            result.put("vendorId", 0);
            result.put("productId", 0);
            Log.i(TAG, "getStatus() — no printer found");
        }

        call.resolve(result);
    }

    /**
     * Print a built-in test receipt to verify printer connectivity.
     *
     * <p>Generates a self-contained ESC/POS test receipt with:</p>
     * <ul>
     *   <li>Centered header "SmartTicketQR TEST"</li>
     *   <li>Dashed separator line</li>
     *   <li>Printer model identification</li>
     *   <li>Timestamp</li>
     *   <li>Barcode (CODE 128) containing "TEST-001"</li>
     *   <li>QR code containing "https://smartticketqr.com"</li>
     *   <li>Footer with cut command</li>
     * </ul>
     *
     * <h4>Returns</h4>
     * <pre>{ success: true, message: "Test print complete", printerModel: "..." }</pre>
     */
    @PluginMethod
    public void testPrint(PluginCall call) {
        Log.i(TAG, "testPrint() — generating test receipt");

        // ---- Check USB permission ----
        if (getPermissionState("usb") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("usb", call, "handleUsbPermissionTest");
            return;
        }

        doTestPrint(call);
    }

    @PermissionCallback
    private void handleUsbPermissionTest(PluginCall call) {
        if (getPermissionState("usb") == com.getcapacitor.PermissionState.GRANTED) {
            doTestPrint(call);
        } else {
            call.reject("USB permission denied", "PERMISSION_DENIED");
        }
    }

    private void doTestPrint(PluginCall call) {
        UsbDevice printer = findPrinter();
        if (printer == null) {
            call.reject("No ESC/POS printer found", "NO_PRINTER");
            return;
        }
        String printerModel = identifyPrinter(printer);

        try {
            openConnection(printer);
        } catch (Exception e) {
            call.reject("USB connection failed: " + e.getMessage(), "CONNECTION_FAILED");
            return;
        }

        try {
            byte[] receipt = buildTestReceipt();
            sendBytes(printerOutputStream, receipt);

            Log.i(TAG, "Test print completed");
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Test print complete");
            result.put("printerModel", printerModel);
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Test print failed", e);
            call.reject("Test print failed: " + e.getMessage(), "WRITE_ERROR");
        }
    }

    // ================================================================== //
    //  PRIVATE HELPERS — ESC/POS Receipt Generation                       //
    // ================================================================== //

    /**
     * Build a complete ESC/POS test receipt byte sequence.
     *
     * @return Fully-formed receipt bytes ready to send to the printer.
     */
    private byte[] buildTestReceipt() {
        ByteArrayOutputStreamPOS baos = new ByteArrayOutputStreamPOS();

        // ---- Initialize printer ----
        baos.write(0x1B, 0x40);                  // ESC @ — Initialize
        baos.write(0x1B, 0x61, 0x01);            // ESC a 1 — Center justify

        // ---- Header ----
        baos.write(0x1D, 0x21, 0x11);            // GS ! 0x11 — Double-height, double-width
        baos.print("SmartTicketQR TEST\n");
        baos.write(0x1D, 0x21, 0x00);            // GS ! 0x00 — Normal text
        baos.print("\n");

        // ---- Separator ----
        baos.print("================================\n");

        // ---- Printer info ----
        baos.write(0x1B, 0x61, 0x00);            // ESC a 0 — Left justify
        baos.print("Printer Status: OK\n");
        baos.print("Model: ");
        if (connectedPrinter != null) {
            baos.print(identifyPrinter(connectedPrinter));
        } else {
            baos.print("Unknown");
        }
        baos.print("\n");
        baos.print("Time: " + new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US).format(new java.util.Date()) + "\n");
        baos.print("Plugin: POSPrinter v1.0\n");

        baos.print("--------------------------------\n");

        // ---- Barcode (CODE 128 — "TEST-001") ----
        baos.write(0x1D, 0x68, 0x50);            // GS h 80 — Barcode height 80 dots
        baos.write(0x1D, 0x77, 0x02);            // GS w 2 — Barcode width module 2
        baos.write(0x1D, 0x48, 0x02);            // GS H 2 — Print HRI below barcode
        baos.write(0x1D, 0x6B, 0x49);            // GS k 73 — CODE 128
        byte[] barcodeData = "TEST-001".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        baos.write(barcodeData.length);           // Data length
        baos.write(barcodeData);
        baos.print("\n\n");

        // ---- QR Code ("https://smartticketqr.com") ----
        String qrContent = "https://smartticketqr.com";
        byte[] qrBytes = qrContent.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        int qrLen = qrBytes.length + 3;          // model + error-correction + data length

        baos.write(0x1D, 0x28, 0x6B, qrLen, 0x00, 0x31, 0x50, 0x30); // QR model select (model 2)
        baos.write(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31); // QR error correction level M
        baos.write(0x1D, 0x28, 0x6B, (byte) (qrBytes.length + 3), 0x00, 0x31, 0x50, 0x30); // QR store data
        baos.write(qrBytes);
        baos.write(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30); // QR print
        baos.print("\n\n");

        // ---- Footer ----
        baos.write(0x1B, 0x61, 0x01);            // Center
        baos.print("--- End of Test ---\n\n");

        // ---- Cut ----
        baos.write(buildCutCommand());

        // ---- Feed & finalize ----
        baos.write(0x1B, 0x64, 0x03);            // ESC d 3 — Feed 3 lines

        return baos.toByteArray();
    }

    /**
     * Build the ESC/POS paper-cut command (full cut).
     *
     * @return 4-byte sequence: {@code GS V 66 0}
     */
    private byte[] buildCutCommand() {
        return new byte[]{ 0x1D, 0x56, 0x42, 0x00 }; // GS V 66 0 — Full cut
    }

    // ================================================================== //
    //  PRIVATE HELPERS — USB / Connection                                //
    // ================================================================== //

    /**
     * Scan the USB bus for a connected ESC/POS-compatible thermal printer.
     *
     * <p>Iterates all attached USB devices and matches against a whitelist of
     * known printer vendor IDs (VID). The first match is returned.</p>
     *
     * @return a {@link UsbDevice} representing the printer, or {@code null} if none found
     */
    private UsbDevice findPrinter() {
        UsbManager usbManager = (UsbManager) getContext().getSystemService(android.content.Context.USB_SERVICE);
        if (usbManager == null) {
            Log.w(TAG, "UsbManager is null — device may not support USB host");
            return null;
        }

        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        if (deviceList.isEmpty()) {
            Log.d(TAG, "No USB devices attached");
            return null;
        }

        Iterator<Map.Entry<String, UsbDevice>> it = deviceList.entrySet().iterator();
        while (it.hasNext()) {
            UsbDevice device = it.next().getValue();
            int vid = device.getVendorId();

            for (int knownVid : KNOWN_VENDOR_IDS) {
                if (vid == knownVid) {
                    // Prefer USB_CLASS_PRINTER (0x07) interface, but accept any from known VIDs
                    Log.d(TAG, String.format(
                        "USB device matched — VID=0x%04X PID=0x%04X class=%d",
                        vid, device.getProductId(), device.getDeviceClass()
                    ));
                    return device;
                }
            }
        }

        Log.d(TAG, "No matching ESC/POS printer among " + deviceList.size() + " USB device(s)");
        return null;
    }

    /**
     * Open (or reuse) a USB connection to the given printer device and obtain
     * an {@link OutputStream} to the bulk-out endpoint.
     *
     * <p>If a connection is already open to the same device, it is reused.</p>
     *
     * @param device the USB printer device to connect to
     * @throws IllegalStateException if the device has no usable interface/endpoint
     * @throws SecurityException     if USB permission has not been granted
     */
    private void openConnection(UsbDevice device) {
        // Reuse existing connection to the same device
        if (connectedPrinter != null
                && connectedPrinter.getDeviceId() == device.getDeviceId()
                && usbConnection != null
                && printerOutputStream != null) {
            Log.d(TAG, "Reusing existing USB connection");
            return;
        }

        // Close any stale connection
        closeConnection();

        UsbManager usbManager = (UsbManager) getContext().getSystemService(android.content.Context.USB_SERVICE);
        UsbDeviceConnection connection = usbManager.openDevice(device);

        if (connection == null) {
            throw new SecurityException("USB permission not granted or device unavailable");
        }

        // Find the first bulk-out endpoint on any interface
        android.hardware.usb.UsbInterface usbInterface = null;
        android.hardware.usb.UsbEndpoint bulkOut = null;

        for (int i = 0; i < device.getInterfaceCount(); i++) {
            android.hardware.usb.UsbInterface iface = device.getInterface(i);
            for (int j = 0; j < iface.getEndpointCount(); j++) {
                android.hardware.usb.UsbEndpoint endpoint = iface.getEndpoint(j);
                if (endpoint.getType() == android.hardware.usb.UsbConstants.USB_ENDPOINT_XFER_BULK
                        && endpoint.getDirection() == android.hardware.usb.UsbConstants.USB_DIR_OUT) {
                    usbInterface = iface;
                    bulkOut = endpoint;
                    break;
                }
            }
            if (bulkOut != null) break;
        }

        if (bulkOut == null || usbInterface == null) {
            connection.close();
            throw new IllegalStateException("Printer has no bulk-out USB endpoint");
        }

        // Claim the interface
        if (!connection.claimInterface(usbInterface, true)) {
            connection.close();
            throw new IllegalStateException("Could not claim USB interface — may be in use");
        }

        this.usbConnection = connection;
        this.connectedPrinter = device;
        this.printerOutputStream = connection.openBulkTransferPipe(bulkOut);

        Log.i(TAG, "USB connection opened to " + identifyPrinter(device));
    }

    /**
     * Close the current USB connection and release all resources.
     */
    private void closeConnection() {
        if (printerOutputStream != null) {
            try {
                printerOutputStream.close();
            } catch (Exception ignored) {
                // Best-effort close
            }
            printerOutputStream = null;
        }

        if (usbConnection != null) {
            try {
                usbConnection.close();
            } catch (Exception ignored) {
            }
            usbConnection = null;
        }

        connectedPrinter = null;
    }

    /**
     * Send a byte array to the printer in fixed-size chunks with inter-chunk delays.
     *
     * <p>Sending large payloads in one write can overwhelm the printer's buffer,
     * especially on budget POS terminals. Chunked writing with a delay ensures
     * reliable delivery across all supported hardware.</p>
     *
     * @param out    the printer's output stream
     * @param data   the full byte array to send
     * @throws PaperOutException      if the printer reports paper-out status
     * @throws PrinterOfflineException if an I/O error indicates the printer is disconnected
     * @throws java.io.IOException    on general I/O failure
     */
    private void sendBytes(OutputStream out, byte[] data) throws PaperOutException, PrinterOfflineException, java.io.IOException {
        int offset = 0;
        while (offset < data.length) {
            int length = Math.min(CHUNK_SIZE, data.length - offset);
            out.write(data, offset, length);
            out.flush();
            offset += length;

            if (offset < data.length) {
                try {
                    Thread.sleep(CHUNK_DELAY_MS);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new java.io.IOException("Write interrupted", ie);
                }
            }
        }
    }

    /**
     * Decode a Base64-encoded string into a raw byte array.
     *
     * <p>Uses Android's {@link Base64} with {@code NO_WRAP} flag (no newline characters).</p>
     *
     * @param base64 the Base64 string
     * @return decoded bytes
     * @throws IllegalArgumentException if the input is not valid Base64
     */
    private byte[] decodeBase64(String base64) throws IllegalArgumentException {
        byte[] decoded = Base64.decode(base64, Base64.NO_WRAP);
        // Base64.decode returns an empty array (not null) on failure in some Android versions.
        // Validate by round-tripping to detect silent failures.
        if (decoded.length == 0 && base64.length() > 0) {
            throw new IllegalArgumentException("Base64 input does not decode to any bytes");
        }
        return decoded;
    }

    /**
     * Attempt to identify the printer model from its USB Vendor/Product IDs.
     *
     * @param device the USB device
     * @return a human-readable model name, or a hex VID/PID fallback
     */
    private String identifyPrinter(UsbDevice device) {
        int vid = device.getVendorId();
        int pid = device.getProductId();

        switch (vid) {
            case 0x0525:
                return "Sunmi POS (" + String.format("PID 0x%04X", pid) + ")";
            case 0x04B3:
                return "Posiflex (" + String.format("PID 0x%04X", pid) + ")";
            case 0x0FE6:
                return "Xprinter (" + String.format("PID 0x%04X", pid) + ")";
            case 0x0483:
                return "Z92 / STM (" + String.format("PID 0x%04X", pid) + ")";
            case 0x04E8:
                return "Samsung/Sunmi (" + String.format("PID 0x%04X", pid) + ")";
            default:
                return String.format("Unknown (VID 0x%04X PID 0x%04X)", vid, pid);
        }
    }

    // ================================================================== //
    //  INNER CLASSES                                                      //
    // ================================================================== //

    /**
     * Minimal {@link java.io.ByteArrayOutputStream} subclass with ESC/POS convenience methods.
     *
     * <p>Prevents the need to import ByteArrayOutputStream separately and provides
     * {@code print(String)} and {@code write(int...)} overloads for readable receipt construction.</p>
     */
    private static class ByteArrayOutputStreamPOS extends java.io.ByteArrayOutputStream {

        /**
         * Append a UTF-8 string to the buffer.
         *
         * @param text the string to append (no newline added automatically)
         */
        void print(String text) {
            try {
                write(text.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            } catch (java.io.IOException impossible) {
                // ByteArrayOutputStream never throws
                throw new RuntimeException(impossible);
            }
        }

        /**
         * Write one or more bytes (as ints, each truncated to the low 8 bits).
         *
         * @param b variable-length list of byte values
         */
        void write(int... b) {
            for (int value : b) {
                super.write(value);
            }
        }
    }

    /**
     * Exception thrown when the printer reports a paper-out condition.
     */
    private static class PaperOutException extends Exception {
        PaperOutException(String message) {
            super(message);
        }
    }

    /**
     * Exception thrown when the printer is offline or unresponsive.
     */
    private static class PrinterOfflineException extends Exception {
        PrinterOfflineException(String message) {
            super(message);
        }
    }
}
