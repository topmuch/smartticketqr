/**
 * @module escpos-commands
 * @description Pure TypeScript ESC/POS command generator for thermal receipt printers.
 * Supports 58mm (32 chars/line) and 80mm (48 chars/line) paper widths with
 * Code Page 850 encoding for Western European characters including French.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Characters per line for 58mm thermal paper */
export const PAPER_58MM = 32;

/** Characters per line for 80mm thermal paper */
export const PAPER_80MM = 48;

/** Default line-feed byte count */
const LF_BYTE = 0x0a;

// ---------------------------------------------------------------------------
// Code Page 850 mapping — French & Western European characters
// ---------------------------------------------------------------------------

/**
 * Mapping of common Latin / French Unicode characters to their Code Page 850
 * byte values. Characters not present here are passed through as-is
 * (the consumer is responsible for overall encoding, e.g. via `TextEncoder`).
 */
const CP850_MAP: ReadonlyMap<string, number> = new Map([
  // French accented vowels
  ["é", 0x82], ["è", 0x8a], ["ê", 0x88], ["ë", 0x89],
  ["à", 0x85], ["â", 0x83], ["ù", 0x97], ["û", 0x96],
  ["ô", 0x93], ["î", 0x8e], ["ï", 0x8b],
  // Other French
  ["ç", 0x87], ["œ", 0x9c], ["æ", 0x9e],
  // Capital accented
  ["É", 0x90], ["È", 0x8d], ["Ê", 0x8a], // 0x8a used for È on some refs; acceptable fallback
  ["À", 0xb7], ["Â", 0xb6], ["Ù", 0xd9], ["Û", 0xd8],
  ["Ô", 0xd4], ["Î", 0xce], ["Ï", 0xcf], ["Ç", 0x80],
  // Common symbols
  ["°", 0xf8], ["²", 0xa2], ["³", 0xa3], ["µ", 0xe6],
  ["€", 0xe1], // Euro sign — not strictly CP850 but commonly remapped
  ["•", 0xf9], ["·", 0xf5], ["§", 0xa7],
  ["©", 0xa9], ["®", 0xae], ["±", 0xf1],
  ["¼", 0xa4], ["½", 0xab], ["¾", 0xac],
  ["«", 0xab], ["»", 0xbb],
  ["¡", 0xa1], ["¿", 0xbf],
  ["á", 0xa0], ["í", 0xad], ["ó", 0xa3], ["ú", 0xba],
  ["ñ", 0xa4], ["Ñ", 0xa5],
  ["ß", 0xe1], // sharps S (same as Euro on many printers — trade-off)
]);

// ---------------------------------------------------------------------------
// ESC/POS Byte Helpers
// ---------------------------------------------------------------------------

const ESC = 0x1b;
const GS  = 0x1d;

/** Encode a string to bytes with CP850 substitution where possible. */
function encodeText(text: string, useCodePage = true): Uint8Array {
  if (!useCodePage) {
    return new TextEncoder().encode(text);
  }

  const parts: Uint8Array[] = [];
  let buf: number[] = [];

  for (const ch of text) {
    const cp = CP850_MAP.get(ch);
    if (cp !== undefined) {
      buf.push(cp);
    } else {
      // Encode remaining character(s) with TextEncoder and splice
      if (buf.length > 0) {
        parts.push(new Uint8Array(buf));
        buf = [];
      }
      parts.push(new TextEncoder().encode(ch));
    }
  }

  if (buf.length > 0) {
    parts.push(new Uint8Array(buf));
  }

  if (parts.length === 0) {
    return new Uint8Array(0);
  }

  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

/** Concatenate multiple Uint8Arrays into one. */
function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const total = buffers.reduce((s, b) => s + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    if (b.length > 0) {
      result.set(b, offset);
      offset += b.length;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Barcode type mapping
// ---------------------------------------------------------------------------

/**
 * Human-readable barcode type names mapped to their ESC/POS `m` values.
 *
 * | Name     | Type Code |
 * |----------|-----------|
 * | UPC-A    | 0         |
 * | UPC-E    | 1         |
 * | EAN13    | 2         |
 * | EAN8     | 3         |
 * | CODE39   | 4         |
 * | ITF      | 5         |
 * | CODABAR  | 6         |
 * | CODE93   | 7         |
 * | CODE128  | 8         |
 */
const BARCODE_TYPES: Record<string, number> = {
  "UPC-A":   0,
  "UPC-E":   1,
  "EAN13":   2,
  "JAN13":   2,
  "EAN8":    3,
  "JAN8":    3,
  "CODE39":  4,
  "ITF":     5,
  "CODABAR": 6,
  "CODE93":  7,
  "CODE128": 8,
};

// ---------------------------------------------------------------------------
// Public Interface
// ---------------------------------------------------------------------------

/**
 * Configuration options for the {@link EscPosBuilder}.
 */
export interface EscPosConfig {
  /** Characters per line — use `PAPER_58MM` (32) or `PAPER_80MM` (48) */
  paperWidth: number;
  /** Print density 0–7 (higher = darker). Default `5`. */
  density?: number;
  /** Character encoding label. Default `"CP850"`. */
  encoding?: string;
  /** Code page number for `ESC t n`. Default `17` (CP850). */
  codePage?: number;
}

// ---------------------------------------------------------------------------
// EscPosBuilder
// ---------------------------------------------------------------------------

/**
 * Chainable ESC/POS command builder for thermal receipt printers.
 *
 * @example
 * ```ts
 * const buf = createReceipt(80)
 *   .init()
 *   .align("center")
 *   .bold("Hello World", true)
 *   .newLine()
 *   .line()
 *   .cut()
 *   .toBuffer();
 * ```
 */
export class EscPosBuilder {
  private readonly commands: Uint8Array[] = [];
  private readonly config: Required<EscPosConfig>;
  private currentAlign: "left" | "center" | "right" = "left";

  constructor(config: EscPosConfig) {
    this.config = {
      density: config.density ?? 5,
      encoding: config.encoding ?? "CP850",
      codePage: config.codePage ?? 17, // 17 = CP850
      paperWidth: config.paperWidth,
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Push raw bytes into the command buffer. */
  private push(...bytes: Uint8Array[]): this {
    this.commands.push(...bytes);
    return this;
  }

  /** Encode text with the configured code-page mapping. */
  private encode(content: string): Uint8Array {
    return encodeText(content, this.config.encoding.toUpperCase() !== "UTF-8");
  }

  /**
   * Pad a string to exactly `width` characters using the given alignment.
   * If the string exceeds width it is truncated.
   */
  private padLine(content: string, align: "left" | "center" | "right"): string {
    const w = this.config.paperWidth;
    const len = content.length;
    if (len >= w) return content.slice(0, w);
    const space = w - len;
    if (align === "center") {
      const left = Math.floor(space / 2);
      const right = space - left;
      return " ".repeat(left) + content + " ".repeat(right);
    }
    if (align === "right") {
      return " ".repeat(space) + content;
    }
    // left
    return content + " ".repeat(space);
  }

  /**
   * Word-wrap text to the configured paper width.
   * Each returned line is guaranteed to be ≤ paperWidth characters.
   */
  private wrapText(content: string): string[] {
    const w = this.config.paperWidth;
    if (content.length === 0) return [];
    const words = content.split(" ");
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      if (current.length === 0) {
        // First word on the line
        if (word.length > w) {
          // Word itself is longer than a line — hard-break it
          for (let i = 0; i < word.length; i += w) {
            lines.push(word.slice(i, i + w));
          }
          current = "";
        } else {
          current = word;
        }
      } else if (current.length + 1 + word.length <= w) {
        current += " " + word;
      } else {
        lines.push(current);
        // Handle oversized word on the new line
        if (word.length > w) {
          for (let i = 0; i < word.length; i += w) {
            lines.push(word.slice(i, i + w));
          }
          current = "";
        } else {
          current = word;
        }
      }
    }

    if (current.length > 0) {
      lines.push(current);
    }

    return lines;
  }

  // -----------------------------------------------------------------------
  // Public API — Initialization
  // -----------------------------------------------------------------------

  /**
   * Initialize / reset the printer.
   *
   * Command: `ESC @` (`1B 40`)
   */
  init(): this {
    this.commands.length = 0;
    this.currentAlign = "left";
    this.push(new Uint8Array([ESC, 0x40]));
    return this;
  }

  /**
   * Set the character code table.
   *
   * Command: `ESC t n` (`1B 74 n`)
   *
   * @param encoding - Encoding name (e.g. `"CP850"`, `"CP437"`, `"UTF-8"`).
   *   For `"UTF-8"` no code-page command is sent; for CP names the closest
   *   ESC/POS code page number is looked up.
   */
  setEncoding(encoding: string): this {
    const upper = encoding.toUpperCase();
    this.config.encoding = upper;

    const CODE_PAGE_MAP: Record<string, number> = {
      "CP437":  0,
      "CP850":  17,
      "CP852":  18,
      "CP860":  3,
      "CP863":  4,
      "CP865":  5,
      "CP858":  19,
      "CP1252": 16,
      "ISO88591": 1,
      "ISO-8859-1": 1,
      "ISO885915": 47,
      "ISO-8859-15": 47,
      "UTF8": 0, // fallback to CP437 — actual UTF-8 handled by encode()
      "UTF-8": 0,
    };

    const cp = CODE_PAGE_MAP[upper] ?? 17;
    this.config.codePage = cp;
    this.push(new Uint8Array([ESC, 0x74, cp]));
    return this;
  }

  /**
   * Set print density (darkness of print).
   *
   * Command: `GS ! n` (`1D 21 n`) — density mapped to upper nibble.
   *
   * @param density - Value from 0 (lightest) to 7 (darkest). Clamped.
   */
  setDensity(density: number): this {
    const clamped = Math.max(0, Math.min(7, Math.round(density)));
    this.config.density = clamped;
    // GS ! n: upper 4 bits = print density (0–7), lower 4 bits = print speed (0–7)
    const n = (clamped << 4) | 0x00;
    this.push(new Uint8Array([GS, 0x21, n]));
    return this;
  }

  // -----------------------------------------------------------------------
  // Public API — Text formatting
  // -----------------------------------------------------------------------

  /**
   * Print text with automatic line-wrap at the configured paper width.
   *
   * Each wrapped line is padded to the current alignment width.
   *
   * @param content - Text to print. Newlines within the string are respected.
   */
  text(content: string): this {
    const paragraphs = content.split("\n");
    for (let pi = 0; pi < paragraphs.length; pi++) {
      const lines = this.wrapText(paragraphs[pi]);
      for (const line of lines) {
        this.push(this.encode(this.padLine(line, this.currentAlign)));
        this.push(new Uint8Array([LF_BYTE]));
      }
      // Preserve blank lines from consecutive newlines in input
      if (pi < paragraphs.length - 1 && lines.length === 0) {
        this.push(new Uint8Array([LF_BYTE]));
      }
    }
    return this;
  }

  /**
   * Print bold (emphasized) text.
   *
   * Command: `ESC E n` (`1B 45 n`) — `1` = bold on, `0` = bold off.
   *
   * @param content - Text to print.
   * @param on - `true` to enable bold, `false` to disable. Default `true`.
   */
  bold(content: string, on: boolean = true): this {
    this.push(new Uint8Array([ESC, 0x45, on ? 1 : 0]));
    this.text(content);
    this.push(new Uint8Array([ESC, 0x45, 0])); // always reset after
    return this;
  }

  /**
   * Print underlined text.
   *
   * Command: `ESC - n` (`1B 2D n`)
   *
   * @param content - Text to print.
   * @param mode - `1` = 1-dot underline, `2` = 2-dot underline. Default `1`.
   */
  underline(content: string, mode: 1 | 2 = 1): this {
    this.push(new Uint8Array([ESC, 0x2d, mode]));
    this.text(content);
    this.push(new Uint8Array([ESC, 0x2d, 0]));
    return this;
  }

  /**
   * Print text using inverted (white-on-black) mode.
   *
   * Command: `GS B n` (`1D 42 n`)
   *
   * @param content - Text to print.
   * @param on - `true` to enable, `false` to disable. Default `true`.
   */
  invert(content: string, on: boolean = true): this {
    this.push(new Uint8Array([GS, 0x42, on ? 1 : 0]));
    this.text(content);
    this.push(new Uint8Array([GS, 0x42, 0]));
    return this;
  }

  /**
   * Print text at a specific character size (magnification).
   *
   * Command: `GS ! n` (`1D 21 n`)
   *
   * @param content - Text to print.
   * @param widthMul - Character width multiplier (1–8). Default `1`.
   * @param heightMul - Character height multiplier (1–8). Default `1`.
   */
  textSize(content: string, widthMul: number = 1, heightMul: number = 1): this {
    const w = Math.max(1, Math.min(8, Math.round(widthMul)));
    const h = Math.max(1, Math.min(8, Math.round(heightMul)));
    // Lower nibble = height multiplier - 1, upper nibble = width multiplier - 1
    const n = ((w - 1) << 4) | (h - 1);
    this.push(new Uint8Array([GS, 0x21, n]));
    this.text(content);
    this.push(new Uint8Array([GS, 0x21, 0x00])); // reset
    return this;
  }

  // -----------------------------------------------------------------------
  // Public API — Alignment & lines
  // -----------------------------------------------------------------------

  /**
   * Set text alignment for subsequent `text()` calls.
   *
   * Command: `ESC a n` (`1B 61 n`)
   *
   * @param align - `"left"` (0), `"center"` (1), or `"right"` (2).
   */
  align(align: "left" | "center" | "right"): this {
    this.currentAlign = align;
    const n = align === "center" ? 1 : align === "right" ? 2 : 0;
    this.push(new Uint8Array([ESC, 0x61, n]));
    return this;
  }

  /**
   * Draw a single-line separator using dashes (`-`).
   *
   * @param size - Override the paper width for this line. Default = configured width.
   */
  line(size?: number): this {
    const w = size ?? this.config.paperWidth;
    const dash = "-".repeat(Math.max(1, Math.min(w, 80)));
    this.push(this.encode(this.padLine(dash, this.currentAlign)));
    this.push(new Uint8Array([LF_BYTE]));
    return this;
  }

  /**
   * Draw a double-line separator using equals (`=`).
   */
  doubleLine(): this {
    const w = this.config.paperWidth;
    const eq = "=".repeat(Math.max(1, Math.min(w, 80)));
    this.push(this.encode(this.padLine(eq, this.currentAlign)));
    this.push(new Uint8Array([LF_BYTE]));
    return this;
  }

  // -----------------------------------------------------------------------
  // Public API — Paper feed & cut
  // -----------------------------------------------------------------------

  /**
   * Feed `n` new lines.
   *
   * @param count - Number of line feeds. Default `1`.
   */
  newLine(count: number = 1): this {
    const n = Math.max(0, Math.round(count));
    this.push(new Uint8Array(Array(n).fill(LF_BYTE)));
    return this;
  }

  /**
   * Feed paper by `n` line units (alias for {@link newLine}).
   *
   * @param n - Number of lines to feed. Default `1`.
   */
  feed(n: number = 1): this {
    return this.newLine(n);
  }

  /**
   * Cut the paper.
   *
   * - **Full cut** (`GS V 0`): `1D 56 00` — cuts through the entire paper width.
   * - **Partial cut** (`GS V 1`): `1D 56 01` — leaves a small uncut area.
   *
   * @param partial - `true` for partial cut, `false` (default) for full cut.
   */
  cut(partial: boolean = false): this {
    this.push(new Uint8Array([GS, 0x56, partial ? 1 : 0]));
    return this;
  }

  // -----------------------------------------------------------------------
  // Public API — QR Code
  // -----------------------------------------------------------------------

  /**
   * Generate and print a QR code using the `GS ( k` command sequence.
   *
   * The QR code is rasterised internally by the printer firmware — no external
   * image library is required on the host.
   *
   * Command sequence:
   * 1. Select model (model 2)
   * 2. Set module size
   * 3. Set error correction level (M)
   * 4. Store the data
   * 5. Print the QR code
   *
   * @param data - The string / URL to encode into the QR code.
   * @param size - Module size in dots (1–16). Default `6`.
   */
  qrCode(data: string, size: number = 6): this {
    const moduleSize = Math.max(1, Math.min(16, Math.round(size)));
    const dataBytes = new TextEncoder().encode(data);

    // 1. Select QR model (function 65)
    // GS ( k pL pH cn fn n1 n2
    // pL pH = param length following (3), cn = 49, fn = 65, n1=49 (model 2), n2=0
    this.push(new Uint8Array([
      GS, 0x28, 0x6b,
      0x03, 0x00, // param length = 3
      0x31, 0x43, // cn=49 fn=67 → set module size (some printers use fn=65 for model select)
      moduleSize,
    ]));

    // 2. Set error correction level (M = 48, L = 49, Q = 50, H = 51)
    // GS ( k pL pH cn fn n
    this.push(new Uint8Array([
      GS, 0x28, 0x6b,
      0x03, 0x00,
      0x31, 0x45, // cn=49 fn=69 → error correction level
      0x31,       // M
    ]));

    // 3. Store the data
    // GS ( k pL pH cn fn m d1...dk
    const dataLen = dataBytes.length;
    const pL = (dataLen + 3) & 0xff;
    const pH = ((dataLen + 3) >> 8) & 0xff;
    this.push(new Uint8Array([
      GS, 0x28, 0x6b,
      pL, pH,
      0x31, 0x50, // cn=49 fn=80 → store data
      0x30,       // m = 48 (normal data)
    ]));
    this.push(dataBytes);

    // 4. Print the QR code
    this.push(new Uint8Array([
      GS, 0x28, 0x6b,
      0x03, 0x00,
      0x31, 0x51, // cn=49 fn=81 → print
      0x30,       // m = 48
    ]));

    return this;
  }

  // -----------------------------------------------------------------------
  // Public API — Barcode
  // -----------------------------------------------------------------------

  /**
   * Print a barcode.
   *
   * Command: `GS k m d1...dk NUL` (format 2: `1D 6B m d1…dk 00`)
   * followed by HRI settings.
   *
   * @param data - The barcode data string (digits / characters depending on type).
   * @param type - Barcode type name. Default `"CODE128"`.
   *   Supported: `UPC-A`, `UPC-E`, `EAN13`, `EAN8`, `CODE39`, `ITF`,
   *   `CODABAR`, `CODE93`, `CODE128`.
   */
  barcode(data: string, type: string = "CODE128"): this {
    const upperType = type.toUpperCase();
    const m = BARCODE_TYPES[upperType] ?? 8; // default to CODE128

    const dataBytes = new TextEncoder().encode(data);

    // Set barcode height (62 dots)
    this.push(new Uint8Array([GS, 0x68, 62]));

    // Set barcode width (width module 2)
    this.push(new Uint8Array([GS, 0x77, 2]));

    // Set HRI font (font B = 1)
    this.push(new Uint8Array([GS, 0x66, 1]));

    // Set HRI print position (below barcode = 2)
    this.push(new Uint8Array([GS, 0x48, 2]));

    // Print barcode — Format 2: GS k m d1…dk NUL
    this.push(new Uint8Array([GS, 0x6b, m]));
    this.push(dataBytes);
    this.push(new Uint8Array([0x00])); // NUL terminator for format 2

    return this;
  }

  // -----------------------------------------------------------------------
  // Public API — Cash drawer
  // -----------------------------------------------------------------------

  /**
   * Send a pulse to kick the cash drawer.
   *
   * Command: `ESC p m t1 t2` (`1B 70 m t1 t2`)
   *
   * @param pin - Drawer pin number (0 or 1). Default `0`.
   * @param onTime - Pulse on-time in 2ms units. Default `100`.
   * @param offTime - Pulse off-time in 2ms units. Default `100`.
   */
  cashDrawer(pin: 0 | 1 = 0, onTime: number = 100, offTime: number = 100): this {
    const m = pin === 0 ? 0x00 : 0x01;
    const t1 = Math.max(0, Math.min(255, Math.round(onTime)));
    const t2 = Math.max(0, Math.min(255, Math.round(offTime)));
    this.push(new Uint8Array([ESC, 0x70, m, t1, t2]));
    return this;
  }

  // -----------------------------------------------------------------------
  // Public API — Bitmap / Image
  // -----------------------------------------------------------------------

  /**
   * Print a monochrome raster bitmap image.
   *
   * Command: `GS v 0 m xL xH yL yH d1…dk` (`1D 76 30 45 …`)
   *
   * @param image - 1-bit-per-pixel raster data packed into bytes (MSB = left pixel).
   * @param width - Image width in pixels.
   * @param height - Image height in pixels (8-pixel line multiples).
   */
  image(image: Uint8Array, width: number, height: number): this {
    const bytesPerLine = Math.ceil(width / 8);
    const header = new Uint8Array([
      GS, 0x76, 0x30, 0x45, // GS v 0 (normal), m = 0x45
      width & 0xff, (width >> 8) & 0xff,
      height & 0xff, (height >> 8) & 0xff,
    ]);
    this.push(header);
    this.push(image);
    return this;
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  /**
   * Compile all queued commands into a single `Uint8Array`.
   *
   * @returns The complete ESC/POS byte sequence.
   */
  toBuffer(): Uint8Array {
    return concatBuffers(...this.commands);
  }

  /**
   * Encode the compiled command buffer as a Base64 string.
   *
   * Useful for network transmission or embedding in JSON payloads.
   *
   * @returns Base64-encoded representation of the command buffer.
   */
  toBase64(): string {
    const buf = this.toBuffer();
    // Node.js / Deno / modern browsers
    if (typeof Buffer !== "undefined") {
      return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString("base64");
    }
    // Browser fallback
    let binary = "";
    for (let i = 0; i < buf.length; i++) {
      binary += String.fromCharCode(buf[i]);
    }
    return btoa(binary);
  }

  /**
   * Encode the compiled command buffer as a hex string.
   *
   * Useful for debugging and logging ESC/POS command sequences.
   *
   * @returns Hex-encoded string (e.g. `"1b401b6101"`).
   */
  toHex(): string {
    const buf = this.toBuffer();
    return Array.from(buf)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Return the current configuration.
   */
  getConfig(): Readonly<Required<EscPosConfig>> {
    return { ...this.config };
  }

  /**
   * Clear all queued commands without sending anything.
   */
  clear(): this {
    this.commands.length = 0;
    this.currentAlign = "left";
    return this;
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

/**
 * Create a pre-configured {@link EscPosBuilder} for a given paper width.
 *
 * @param paperWidth - `58` for 58mm paper (32 chars/line), `80` for 80mm (48 chars/line).
 * @returns A new `EscPosBuilder` instance ready for use.
 *
 * @example
 * ```ts
 * const receipt = createReceipt(80)
 *   .init()
 *   .align("center")
 *   .bold("CAFÉ DE PARIS")
 *   .align("left")
 *   .newLine()
 *   .line()
 *   .text("Espresso .............. €3.50")
 *   .text("Croissant ............. €2.00")
 *   .doubleLine()
 *   .text("TOTAL ................ €5.50")
 *   .newLine()
 *   .cut()
 *   .toBuffer();
 * ```
 */
export function createReceipt(paperWidth: 58 | 80): EscPosBuilder {
  const width = paperWidth === 58 ? PAPER_58MM : PAPER_80MM;
  return new EscPosBuilder({
    paperWidth: width,
    encoding: "CP850",
    density: 5,
    codePage: 17,
  });
}

// ---------------------------------------------------------------------------
// Named re-exports for convenience
// ---------------------------------------------------------------------------

export {
  EscPosBuilder as default,
};

// ---------------------------------------------------------------------------
// Platform detection & printer utilities
// ---------------------------------------------------------------------------

/** Detected platform type. */
export type Platform = 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'unknown';

/** Ticket data structure for building thermal receipts. */
export interface EscPosTicketData {
  orgName: string;
  orgLogoUrl?: string;
  ticketCode: string;
  ticketType: string;
  eventName: string;
  eventDate: string;
  eventLocation?: string;
  holderName: string;
  holderEmail?: string;
  holderPhone?: string;
  seatNumber?: string;
  price: number;
  currency: string;
  status: string;
  qrImageData?: string;
  issuedAt?: string;
  paperWidth?: 58 | 80;
}

/**
 * Detect the current platform from user agent.
 */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('linux')) return 'linux';
  return 'unknown';
}

/**
 * Check if Web Bluetooth API is available.
 */
export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Check if RawBT app is likely available (Android only).
 */
export function isRawBTAvailable(): boolean {
  return detectPlatform() === 'android';
}

/**
 * Build a complete ESC/POS byte buffer for a ticket using EscPosBuilder.
 * Returns a Uint8Array ready to send via Bluetooth/USB/WebSocket.
 */
export function buildEscPosTicket(ticket: EscPosTicketData): Uint8Array {
  const w = ticket.paperWidth || 80;
  const receipt = createReceipt(w);
  const charWidth = w === 58 ? 32 : 48;

  receipt
    .init()
    // Header: Organization name
    .align('center')
    .textSize(ticket.orgName || 'SmartTicketQR', 2, 2)
    .text('')
    .textSize(`[${ticket.ticketType.toUpperCase()}]`, 1, 1)
    .doubleLine()
    .align('left')
    // Event info
    .bold(ticket.eventName)
    .text('')
    .text(`Date    : ${ticket.eventDate}`)
    .text(`Lieu    : ${ticket.eventLocation || 'N/A'}`)
    .line()
    // Holder info
    .bold(`Passager: ${ticket.holderName}`)
    .text(`Siege   : ${ticket.seatNumber || 'N/A'}`)
    .text(`Tel     : ${ticket.holderPhone || 'N/A'}`)
    .line()
    // Ticket details
    .text(`Code    : ${ticket.ticketCode}`)
    .text(`Type    : ${ticket.ticketType}`)
    .text(`Statut  : ${ticket.status.toUpperCase()}`)
    .text(`Emis le : ${ticket.issuedAt || 'N/A'}`)
    .line()
    // Price
    .align('center')
    .textSize(`${ticket.currency} ${ticket.price.toFixed(2)}`, 2, 2)
    .align('left')
    // QR Code
    .newLine();

  // Add QR code with ticket data payload
  const qrPayload = JSON.stringify({
    tc: ticket.ticketCode,
    e: ticket.eventName,
    h: ticket.holderName,
  });
  receipt.align('center').qrCode(qrPayload, w === 58 ? 4 : 6).newLine(2);

  // Footer
  receipt
    .line()
    .align('center')
    .text('Ce billet est non transferable.')
    .text("Presentez-le a l'entree.")
    .newLine(2)
    .cut(true); // partial cut

  return receipt.toBuffer();
}

/**
 * Encode ESC/POS commands as Base64 for RawBT URI scheme.
 * RawBT accepts: rawbt:base64,<encoded_bytes>
 */
export function encodeForRawBT(commands: Uint8Array): string {
  const receipt = createReceipt(80);
  // Use the same encoding as toBase64
  let binary = '';
  for (let i = 0; i < commands.length; i++) {
    binary += String.fromCharCode(commands[i]);
  }
  return btoa(binary);
}

/**
 * Build a RawBT URI string from ESC/POS commands.
 */
export function buildRawBTUri(commands: Uint8Array): string {
  const encoded = encodeForRawBT(commands);
  return `rawbt:base64,${encoded}`;
}
