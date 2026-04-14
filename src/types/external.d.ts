// ============================================================
// Type declarations for external modules without @types packages
// ============================================================

declare module 'jsqr' {
  interface JsQRResult {
    data: string;
    location: {
      topLeftCorner: { x: number; y: number };
      topRightCorner: { x: number; y: number };
      bottomRightCorner: { x: number; y: number };
      bottomLeftCorner: { x: number; y: number };
    };
  }

  export default function jsQR(
    imageData: Uint8ClampedArray,
    width: number,
    height: number,
    options?: { inversionAttempts?: string }
  ): JsQRResult | null;
}

declare module 'socket.io-client' {
  import { EventEmitter } from 'events';

  interface Socket extends EventEmitter {
    id: string;
    connected: boolean;
    disconnected: boolean;
    io: Manager;
    connect(): Socket;
    disconnect(): Socket;
    emit(event: string, ...args: unknown[]): Socket;
    on(event: string, callback: (...args: any[]) => void): Socket;
    off(event: string, callback?: (...args: any[]) => void): Socket;
    once(event: string, callback: (...args: any[]) => void): Socket;
  }

  interface Manager extends EventEmitter {
    connect(): void;
    disconnect(): void;
  }

  interface ConnectOpts {
    query?: Record<string, string>;
    transports?: string[];
    reconnection?: boolean;
    reconnectionAttempts?: number;
    reconnectionDelay?: number;
  }

  function io(uri: string, opts?: ConnectOpts): Socket;
  export { io, Socket, Manager, ConnectOpts };
}

declare module '@capacitor/core' {
  export interface PluginResult {
    ok: boolean;
  }

  export const Capacitor: {
    isNative: boolean;
    platform: string;
  };

  export function registerPlugin<T>(name: string, options?: Record<string, unknown>): T;
}
