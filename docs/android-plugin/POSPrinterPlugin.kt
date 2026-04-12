@file:Suppress("TooManyFunctions")

package com.smartticketqr.app.plugins

import android.Manifest
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbManager
import android.util.Base64
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.OutputStream
import java.nio.charset.StandardCharsets
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Capacitor plugin for native ESC/POS printing on Android POS terminals.
 *
 * Kotlin equivalent of [POSPrinterPlugin.java] — more concise but fully functional.
 *
 * ## Supported Hardware
 * - Z92 thermal printers
 * - Sunmi V1 / V2 POS terminals
 * - Xprinter XP-58 / XP-80 series
 * - Epson TM-T88 series
 * - Any ESC/POS-compatible USB thermal printer
 *
 * ## Quick Usage (TypeScript)
 * ```typescript
 * import { registerPlugin } from '@capacitor/core';
 * const POSPrinter = registerPlugin<POSPrinter>('POSPrinter');
 *
 * // Print raw ESC/POS bytes
 * await POSPrinter.print({ data: base64String, options: { density: 7, copies: 1 } });
 *
 * // Check printer status
 * const { connected, model } = await POSPrinter.getStatus();
 *
 * // Self-test
 * await POSPrinter.testPrint();
 * ```
 *
 * @author SmartTicketQR Engineering
 * @since 1.0.0
 * @see POSPrinterPlugin.java — full Java implementation with extensive JSDoc
 */
@CapacitorPlugin(
    name = "POSPrinter",
    permissions = [
        Permission(
            strings = [Manifest.permission.USB_PERMISSION],
            alias = "usb"
        )
    ]
)
class POSPrinterPlugin : Plugin() {

    companion object {
        private const val TAG = "POSPrinterPlugin"
        private const val CHUNK_SIZE = 20
        private const val CHUNK_DELAY_MS = 50L

        /** Known USB Vendor IDs for ESC/POS thermal printers. */
        private val KNOWN_VENDOR_IDS = intArrayOf(
            0x0525, // Sunmi
            0x04B3, // IBM / Posiflex
            0x0FE6, // Xprinter
            0x0483, // STMicroelectronics (Z92)
            0x04E8, // Samsung (Sunmi variants)
        )

        /** Vendor ID → human-readable name. */
        private val VENDOR_NAMES = mapOf(
            0x0525 to "Sunmi POS",
            0x04B3 to "Posiflex",
            0x0FE6 to "Xprinter",
            0x0483 to "Z92 / STM",
            0x04E8 to "Samsung/Sunmi",
        )
    }

    // ------------------------------------------------------------------ //
    //  State                                                              //
    // ------------------------------------------------------------------ //

    private var connectedPrinter: UsbDevice? = null
    private var usbConnection: UsbDeviceConnection? = null
    private var printerOutputStream: OutputStream? = null

    // ------------------------------------------------------------------ //
    //  Lifecycle                                                          //
    // ------------------------------------------------------------------ //

    override fun onDestroy() {
        closeConnection()
        super.onDestroy()
    }

    // ================================================================== //
    //  Plugin Methods                                                     //
    // ================================================================== //

    /**
     * Print ESC/POS data to the connected USB thermal printer.
     *
     * **Parameters:**
     * - `data` (String, required) — Base64-encoded ESC/POS byte sequence
     * - `options` (Object, optional):
     *   - `paperWidth` (Int) — 58 or 80 mm, default 58
     *   - `density` (Int) — 0–15, default 7
     *   - `copies` (Int) — 1–10, default 1
     *   - `autoCut` (Boolean) — default true
     *   - `codePage` (String) — default "UTF-8"
     *
     * **Returns:** `{ success, message, printerModel }`
     *
     * **Error codes:** NO_DATA, DECODE_ERROR, NO_PRINTER, CONNECTION_FAILED,
     * WRITE_ERROR, PAPER_OUT, PRINTER_OFFLINE
     */
    @PluginMethod
    fun print(call: PluginCall) {
        val base64Data = call.getString("data")
            ?.takeIf { it.isNotBlank() }
            ?: run {
                call.reject("Missing or empty 'data' parameter", "NO_DATA")
                return
            }

        val options = call.getObject("options", JSObject())
        val density = options.optInt("density", 7).coerceIn(0, 15)
        val copies = options.optInt("copies", 1).coerceIn(1, 10)
        val autoCut = options.optBoolean("autoCut", true)
        val paperWidth = options.optInt("paperWidth", 58).let {
            if (it in setOf(58, 80)) it else 58
        }

        val escPosBytes = try {
            decodeBase64(base64Data).also {
                require(it.isNotEmpty()) { "Decoded data is empty" }
            }
        } catch (e: Exception) {
            call.reject("Invalid Base64 data: ${e.message}", "DECODE_ERROR")
            return
        }

        Log.i(TAG, "print() — ${escPosBytes.size} bytes, density=$density, copies=$copies, autoCut=$autoCut, paper=${paperWidth}mm")

        if (getPermissionState("usb") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("usb", call, "onUsbPermissionPrint")
            return
        }

        executePrint(call, escPosBytes, copies, autoCut)
    }

    @PermissionCallback
    private fun onUsbPermissionPrint(call: PluginCall) {
        if (getPermissionState("usb") == com.getcapacitor.PermissionState.GRANTED) {
            val base64 = call.getString("data") ?: return call.reject("Missing data", "NO_DATA")
            val options = call.getObject("options", JSObject())
            val copies = options.optInt("copies", 1).coerceIn(1, 10)
            val autoCut = options.optBoolean("autoCut", true)
            try {
                executePrint(call, decodeBase64(base64), copies, autoCut)
            } catch (e: Exception) {
                call.reject("Invalid Base64: ${e.message}", "DECODE_ERROR")
            }
        } else {
            call.reject("USB permission denied", "PERMISSION_DENIED")
        }
    }

    /**
     * Query the current status of the USB POS printer.
     *
     * **Returns:** `{ connected, model, paperWidth, vendorId, productId }`
     */
    @PluginMethod
    fun getStatus(call: PluginCall) {
        val printer = findPrinter()
        val connected = printer != null && usbConnection != null && printerOutputStream != null

        call.resolve(JSObject().apply {
            put("connected", connected)
            put("model", printer?.let { identifyPrinter(it) })
            put("paperWidth", if (connected) 58 else 0)
            put("vendorId", printer?.vendorId ?: 0)
            put("productId", printer?.productId ?: 0)
        })
    }

    /**
     * Print a built-in test receipt to verify printer connectivity.
     *
     * Generates a receipt with "SmartTicketQR TEST" header, barcode (CODE 128),
     * QR code, timestamp, and paper cut.
     *
     * **Returns:** `{ success, message, printerModel }`
     */
    @PluginMethod
    fun testPrint(call: PluginCall) {
        if (getPermissionState("usb") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("usb", call, "onUsbPermissionTest")
            return
        }
        executeTestPrint(call)
    }

    @PermissionCallback
    private fun onUsbPermissionTest(call: PluginCall) {
        if (getPermissionState("usb") == com.getcapacitor.PermissionState.GRANTED) {
            executeTestPrint(call)
        } else {
            call.reject("USB permission denied", "PERMISSION_DENIED")
        }
    }

    // ================================================================== //
    //  Private — Print Execution                                          //
    // ================================================================== //

    private fun executePrint(call: PluginCall, bytes: ByteArray, copies: Int, autoCut: Boolean) {
        val printer = findPrinter()
            ?: run { call.reject("No ESC/POS printer found", "NO_PRINTER"); return }
        val model = identifyPrinter(printer)

        try {
            openConnection(printer)
        } catch (e: Exception) {
            Log.e(TAG, "USB connection failed", e)
            call.reject("USB connection failed: ${e.message}", "CONNECTION_FAILED")
            return
        }

        try {
            val cutCmd = byteArrayOf(0x1D, 0x56, 0x42, 0x00) // GS V 66 0
            repeat(copies) { i ->
                Log.d(TAG, "Printing copy ${i + 1}/$copies")
                sendBytes(printerOutputStream!!, bytes)
                if (autoCut && i < copies - 1) sendBytes(printerOutputStream!!, cutCmd)
            }
            if (autoCut) sendBytes(printerOutputStream!!, cutCmd)

            // Feed 3 lines
            sendBytes(printerOutputStream!!, byteArrayOf(0x1B, 0x64, 0x03))

            Log.i(TAG, "Print completed — $copies ${if (copies == 1) "copy" else "copies"}")
            call.resolve(JSObject().apply {
                put("success", true)
                put("message", "Printed $copies ${if (copies == 1) "copy" else "copies"}")
                put("printerModel", model)
            })
        } catch (e: PrinterPaperOutException) {
            Log.e(TAG, "Paper out", e)
            call.reject("Printer paper out — reload paper", "PAPER_OUT")
        } catch (e: PrinterOfflineException) {
            Log.e(TAG, "Printer offline", e)
            call.reject("Printer is offline", "PRINTER_OFFLINE")
        } catch (e: Exception) {
            Log.e(TAG, "Write error", e)
            call.reject("Write error: ${e.message}", "WRITE_ERROR")
        }
    }

    private fun executeTestPrint(call: PluginCall) {
        val printer = findPrinter()
            ?: run { call.reject("No ESC/POS printer found", "NO_PRINTER"); return }
        val model = identifyPrinter(printer)

        try {
            openConnection(printer)
            sendBytes(printerOutputStream!!, buildTestReceipt())
            call.resolve(JSObject().apply {
                put("success", true)
                put("message", "Test print complete")
                put("printerModel", model)
            })
        } catch (e: Exception) {
            Log.e(TAG, "Test print failed", e)
            call.reject("Test print failed: ${e.message}", "WRITE_ERROR")
        }
    }

    // ================================================================== //
    //  Private — USB Helpers                                              //
    // ================================================================== //

    /**
     * Scan USB devices for an ESC/POS-compatible printer by matching vendor IDs.
     */
    private fun findPrinter(): UsbDevice? {
        val usbManager = getSystemService(USB_SERVICE) as? UsbManager
            ?: run { Log.w(TAG, "UsbManager unavailable"); return null }

        return usbManager.deviceList.values.firstOrNull { device ->
            device.vendorId in KNOWN_VENDOR_IDS
        }.also { found ->
            if (found != null) {
                Log.d(TAG, "Found printer: VID=0x${found.vendorId.toString(16)} PID=0x${found.productId.toString(16)}")
            } else {
                Log.d(TAG, "No matching printer among ${usbManager.deviceList.size} USB device(s)")
            }
        }
    }

    /**
     * Open (or reuse) a USB connection and obtain the bulk-out output stream.
     */
    private fun openConnection(device: UsbDevice) {
        // Reuse if same device
        if (connectedPrinter?.deviceId == device.deviceId && printerOutputStream != null) {
            Log.d(TAG, "Reusing existing connection")
            return
        }

        closeConnection()
        val usbManager = getSystemService(USB_SERVICE) as UsbManager
        val conn = usbManager.openDevice(device)
            ?: throw SecurityException("USB permission not granted or device unavailable")

        // Find bulk-out endpoint
        val (iface, endpoint) = (0 until device.interfaceCount).mapNotNull { i ->
            val ifc = device.getInterface(i)
            (0 until ifc.endpointCount).mapNotNull { j ->
                val ep = ifc.getEndpoint(j)
                if (ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                    ep.direction == UsbConstants.USB_DIR_OUT
                ) ifc to ep else null
            }.firstOrNull()
        }.firstOrNull() ?: run {
            conn.close()
            throw IllegalStateException("No bulk-out endpoint found on printer")
        }

        require(conn.claimInterface(iface, true)) {
            conn.close()
            "Could not claim USB interface"
        }

        connectedPrinter = device
        usbConnection = conn
        printerOutputStream = conn.openBulkTransferPipe(endpoint)
        Log.i(TAG, "USB connection opened → ${identifyPrinter(device)}")
    }

    private fun closeConnection() {
        try { printerOutputStream?.close() } catch (_: Exception) {}
        try { usbConnection?.close() } catch (_: Exception) {}
        printerOutputStream = null
        usbConnection = null
        connectedPrinter = null
    }

    /**
     * Send bytes to the printer in [CHUNK_SIZE]-byte chunks with [CHUNK_DELAY_MS] pauses.
     */
    private fun sendBytes(out: OutputStream, data: ByteArray) {
        data.asSequence().chunked(CHUNK_SIZE).forEachIndexed { index, chunk ->
            out.write(chunk.toByteArray())
            out.flush()
            if (index < (data.size + CHUNK_SIZE - 1) / CHUNK_SIZE - 1) {
                Thread.sleep(CHUNK_DELAY_MS)
            }
        }
    }

    /**
     * Decode Base64 string to byte array with validation.
     */
    private fun decodeBase64(base64: String): ByteArray =
        Base64.decode(base64, Base64.NO_WRAP).also {
            require(it.isNotEmpty() || base64.isEmpty()) { "Base64 input does not decode to any bytes" }
        }

    private fun identifyPrinter(device: UsbDevice): String =
        VENDOR_NAMES[device.vendorId]
            ?: "Unknown (VID 0x${device.vendorId.toString(16)} PID 0x${device.productId.toString(16)})"

    // ================================================================== //
    //  Private — ESC/POS Receipt Builder                                  //
    // ================================================================== //

    /**
     * Build a self-test receipt with header, barcode, QR code, and cut command.
     */
    private fun buildTestReceipt(): ByteArray {
        val buf = EscPosBuffer()

        // Initialize
        buf.cmd(0x1B, 0x40)           // ESC @ — Initialize printer

        // Header (double-size, centered)
        buf.cmd(0x1B, 0x61, 0x01)     // ESC a 1 — Center
        buf.cmd(0x1D, 0x21, 0x11)     // GS ! — Double height + width
        buf.text("SmartTicketQR TEST\n")
        buf.cmd(0x1D, 0x21, 0x00)     // Normal size
        buf.text("\n================================\n")

        // Info block (left-aligned)
        buf.cmd(0x1B, 0x61, 0x00)     // ESC a 0 — Left
        buf.text("Printer Status: OK\n")
        buf.text("Model: ${connectedPrinter?.let { identifyPrinter(it) } ?: "Unknown"}\n")
        buf.text("Time: ${SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())}\n")
        buf.text("Plugin: POSPrinter v1.0 (Kotlin)\n")
        buf.text("--------------------------------\n\n")

        // CODE 128 barcode — "TEST-001"
        buf.cmd(0x1D, 0x68, 0x50)     // GS h 80 — Height 80 dots
        buf.cmd(0x1D, 0x77, 0x02)     // GS w 2 — Width module 2
        buf.cmd(0x1D, 0x48, 0x02)     // GS H 2 — HRI below
        buf.cmd(0x1D, 0x6B, 0x49)     // GS k 73 — CODE 128
        val barcode = "TEST-001".toByteArray(StandardCharsets.US_ASCII)
        buf.write(barcode.size.toByte())
        buf.write(barcode)
        buf.text("\n\n")

        // QR code — "https://smartticketqr.com"
        val qr = "https://smartticketqr.com".toByteArray(StandardCharsets.UTF_8)
        buf.cmd(0x1D, 0x28, 0x6B, (qr.size + 3).toByte(), 0x00, 0x31, 0x50, 0x30) // Model select
        buf.cmd(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31)                   // Error correction M
        buf.cmd(0x1D, 0x28, 0x6B, (qr.size + 3).toByte(), 0x00, 0x31, 0x50, 0x30) // Store data
        buf.write(qr)
        buf.cmd(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30)                   // Print QR
        buf.text("\n\n")

        // Footer & cut
        buf.cmd(0x1B, 0x61, 0x01)     // Center
        buf.text("--- End of Test ---\n\n")
        buf.cmd(0x1D, 0x56, 0x42, 0x00) // GS V 66 0 — Full cut
        buf.cmd(0x1B, 0x64, 0x03)     // Feed 3 lines

        return buf.toByteArray()
    }

    // ================================================================== //
    //  Inner Helpers                                                      //
    // ================================================================== //

    /** Fluent byte buffer for building ESC/POS commands. */
    private class EscPosBuffer {
        private val out = java.io.ByteArrayOutputStream()

        fun cmd(vararg bytes: Int) = bytes.forEach { out.write(it) }
        fun text(s: String) = out.write(s.toByteArray(StandardCharsets.UTF_8))
        fun write(b: ByteArray) = out.write(b)
        fun write(b: Byte) = out.write(b.toInt())
        fun toByteArray(): ByteArray = out.toByteArray()
    }

    /** Sentinel for paper-out errors. */
    private class PrinterPaperOutException(msg: String) : Exception(msg)

    /** Sentinel for offline / disconnected printer. */
    private class PrinterOfflineException(msg: String) : Exception(msg)
}
