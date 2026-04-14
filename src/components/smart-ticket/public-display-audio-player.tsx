'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { convertGoogleDriveUrl } from '@/lib/audio-helper';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Represents a single audio file entry from the audio library.
 * Mirrors the shape returned by the board API (audioLibrary array).
 */
export interface AudioFile {
  id: string;
  slug: string;
  name: string;
  audioUrl: string;
  category: string;
  language: string;
}

/**
 * Maps audio context names to their corresponding slug keys
 * in the organization's audio settings.
 */
export type AudioContextKey =
  | 'departure'
  | 'arrival'
  | 'alert'
  | 'welcome'
  | 'safety';

/** Slug-setting key for each audio context. */
const CONTEXT_SLUG_KEYS: Record<AudioContextKey, string> = {
  departure: 'departureSlug',
  arrival: 'arrivalSlug',
  alert: 'alertSlug',
  welcome: 'welcomeSlug',
  safety: 'safetySlug',
};

/** All audio context keys for iteration. */
const ALL_CONTEXT_KEYS: AudioContextKey[] = [
  'departure',
  'arrival',
  'alert',
  'welcome',
  'safety',
];

/**
 * Return type of the `usePublicAudioPlayer` hook.
 */
export interface PublicAudioPlayerReturn {
  /** Whether audio has been unlocked via user interaction. */
  isUnlocked: boolean;
  /** Whether at least one audio file is currently playing. */
  isPlaying: boolean;
  /** Generic play function by context key. */
  play: (context: AudioContextKey) => Promise<boolean>;
  /** Shortcut: play the departure chime. */
  playDeparture: () => Promise<boolean>;
  /** Shortcut: play the arrival chime. */
  playArrival: () => Promise<boolean>;
  /** Shortcut: play the alert sound. */
  playAlert: () => Promise<boolean>;
  /** Shortcut: play the welcome announcement. */
  playWelcome: () => Promise<boolean>;
  /** Shortcut: play the safety announcement. */
  playSafety: () => Promise<boolean>;
  /** Programmatically attempt to unlock audio (typically done on first click). */
  unlock: () => Promise<boolean>;
  /** Set the master volume (0–1). */
  setVolume: (v: number) => void;
  /** Current master volume (0–1). */
  volume: number;
  /** Stop all currently playing audio. */
  stopAll: () => void;
}

// ── Hook Options ──────────────────────────────────────────────────────────────

interface UsePublicAudioPlayerOptions {
  /**
   * The list of audio library items fetched by the parent.
   * The hook resolves slugs from `audioSettings` against this list.
   */
  audioFiles: AudioFile[];
  /**
   * Organization audio settings containing slug references.
   * e.g. `{ departureSlug: 'dep-chime-1', alertSlug: 'alert-beep' }`
   */
  audioSettings: Record<string, string | undefined>;
  /** Initial volume (default 0.8). */
  initialVolume?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve a slug to an AudioFile from the library list.
 * Returns `undefined` if the slug is empty or no match is found.
 */
function resolveAudioFile(
  slug: string | undefined,
  audioFiles: AudioFile[]
): AudioFile | undefined {
  if (!slug) return undefined;
  return audioFiles.find((f) => f.slug === slug);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * `usePublicAudioPlayer`
 *
 * A hook designed for the PublicDisplay component that:
 *   1. Resolves audio slugs from org settings to actual audio URLs
 *   2. Preloads `Audio` elements for each context
 *   3. Handles browser autoplay policy (requires first user click)
 *   4. Exposes per-context play functions
 *
 * **Usage** — the parent `PublicDisplay` already fetches `audioSettings` and
 * `audioLibrary` from the board API, so this hook receives them directly without
 * making additional API calls (keeping the public board auth-free).
 */
export function usePublicAudioPlayer(
  options: UsePublicAudioPlayerOptions
): PublicAudioPlayerReturn {
  const { audioFiles, audioSettings, initialVolume = 0.8 } = options;

  // ── Refs ─────────────────────────────────────────────────────────────────

  /** Whether the browser's AudioContext has been unlocked by a user gesture. */
  const unlockedRef = useRef<boolean>(false);

  /** Map from context key → preloaded HTMLAudioElement. */
  const audioMapRef = useRef<Map<AudioContextKey, HTMLAudioElement>>(new Map());

  /** Track which context is currently playing (null = none). */
  const playingContextRef = useRef<AudioContextKey | null>(null);

  /** Direct reference to the currently playing HTMLAudioElement (for quick stop). */
  const playingAudioRef = useRef<HTMLAudioElement | null>(null);

  /** Master volume ref to avoid re-creating play callbacks on volume change. */
  const volumeRef = useRef<number>(initialVolume);

  // ── State ────────────────────────────────────────────────────────────────

  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolumeState] = useState<number>(initialVolume);

  // ── Resolve slugs to AudioFile objects (memoised) ────────────────────────

  const resolvedFiles = useMemo(() => {
    const map: Record<AudioContextKey, AudioFile | undefined> = {
      departure: undefined,
      arrival: undefined,
      alert: undefined,
      welcome: undefined,
      safety: undefined,
    };

    for (const ctx of ALL_CONTEXT_KEYS) {
      const slugKey = CONTEXT_SLUG_KEYS[ctx];
      map[ctx] = resolveAudioFile(audioSettings[slugKey], audioFiles);
    }

    return map;
  }, [audioFiles, audioSettings]);

  // ── Preload audio elements when resolved files change ────────────────────

  useEffect(() => {
    const newMap = new Map<AudioContextKey, HTMLAudioElement>();

    for (const ctx of ALL_CONTEXT_KEYS) {
      const file = resolvedFiles[ctx];
      if (!file?.audioUrl) continue;

      // Reuse existing audio element if URL hasn't changed
      const existing = audioMapRef.current.get(ctx);
      if (existing && existing.src && existing.src.includes(encodeURIComponent(file.audioUrl))) {
        newMap.set(ctx, existing);
        continue;
      }

      const convertedUrl = convertGoogleDriveUrl(file.audioUrl);
      const audio = new Audio(convertedUrl);
      audio.preload = 'auto';
      audio.volume = volumeRef.current;

      audio.addEventListener('canplaythrough', () => {
        // Audio is ready — no state update needed, just silent preloading
      }, { once: true });

      audio.addEventListener('error', () => {
        console.warn(
          `[PublicAudio] Failed to preload audio for "${ctx}": ${convertedUrl}`
        );
      }, { once: true });

      audio.addEventListener('ended', () => {
        if (playingContextRef.current === ctx) {
          playingContextRef.current = null;
          playingAudioRef.current = null;
          setIsPlaying(false);
        }
      });

      // Start loading
      audio.load();
      newMap.set(ctx, audio);
    }

    // Clean up old audio elements that are no longer in the new map
    const oldMap = audioMapRef.current;
    for (const [ctx, audio] of oldMap) {
      if (!newMap.has(ctx)) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load(); // release resources
      }
    }

    audioMapRef.current = newMap;

    return () => {
      for (const audio of newMap.values()) {
        audio.pause();
        audio.removeAttribute('src');
      }
    };
  }, [resolvedFiles]);

  // ── Sync volume to ref + all preloaded elements ──────────────────────────

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    volumeRef.current = clamped;
    setVolumeState(clamped);
    for (const audio of audioMapRef.current.values()) {
      audio.volume = clamped;
    }
  }, []);

  // ── Core play function ───────────────────────────────────────────────────

  const play = useCallback(
    async (context: AudioContextKey): Promise<boolean> => {
      const audio = audioMapRef.current.get(context);
      if (!audio) return false;

      // If audio isn't unlocked, attempt play — browser will reject silently.
      // The unlock listener (set up in PublicAudioOverlay) will handle the
      // actual unlock on the next user gesture.
      if (!unlockedRef.current) {
        try {
          audio.currentTime = 0;
          await audio.play();
          // If we get here, it worked (unlikely without unlock, but handle it)
          unlockedRef.current = true;
          setIsUnlocked(true);
          playingContextRef.current = context;
          setIsPlaying(true);
          return true;
        } catch {
          // Expected — autoplay blocked. Audio will be unlocked on next click.
          return false;
        }
      }

      // Audio is unlocked — play normally
      try {
        // Stop any currently playing audio first
        const currentAudio = playingAudioRef.current;
        if (currentAudio && currentAudio !== audio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }

        audio.currentTime = 0;
        audio.volume = volumeRef.current;
        await audio.play();
        playingContextRef.current = context;
        playingAudioRef.current = audio;
        setIsPlaying(true);
        return true;
      } catch (err) {
        console.warn(`[PublicAudio] Play failed for "${context}":`, err);
        playingContextRef.current = null;
        playingAudioRef.current = null;
        setIsPlaying(false);
        return false;
      }
    },
    [] // volume is read from ref
  );

  // ── Shortcut play functions ──────────────────────────────────────────────

  const playDeparture = useCallback(() => play('departure'), [play]);
  const playArrival = useCallback(() => play('arrival'), [play]);
  const playAlert = useCallback(() => play('alert'), [play]);
  const playWelcome = useCallback(() => play('welcome'), [play]);
  const playSafety = useCallback(() => play('safety'), [play]);

  // ── Stop all ─────────────────────────────────────────────────────────────

  const stopAll = useCallback(() => {
    const currentAudio = playingAudioRef.current;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    playingContextRef.current = null;
    playingAudioRef.current = null;
    setIsPlaying(false);
  }, []);

  // ── Unlock (called on first user gesture) ────────────────────────────────

  const unlock = useCallback(async (): Promise<boolean> => {
    if (unlockedRef.current) return true;

    // Try to play a silent moment on the first available audio element
    // to satisfy the browser's user-gesture requirement.
    const firstAudio = audioMapRef.current.values().next().value;
    if (firstAudio) {
      try {
        firstAudio.currentTime = 0;
        await firstAudio.play();
        firstAudio.pause();
        firstAudio.currentTime = 0;
      } catch {
        // Even if play fails, the act of calling play() inside a user
        // gesture handler may be enough to unlock the audio context on
        // some browsers.
      }
    }

    unlockedRef.current = true;
    setIsUnlocked(true);
    return true;
  }, []);

  return {
    isUnlocked,
    isPlaying,
    play,
    playDeparture,
    playArrival,
    playAlert,
    playWelcome,
    playSafety,
    unlock,
    setVolume,
    volume,
    stopAll,
  };
}

// ── Overlay Component ─────────────────────────────────────────────────────────

interface PublicAudioOverlayProps {
  /** Hook return value from `usePublicAudioPlayer`. */
  player: PublicAudioPlayerReturn;
  /** Whether any audio files are configured at all. */
  hasAudio: boolean;
  /** Optional accent colour from the org's theme. */
  accentColor?: string;
}

/**
 * `PublicAudioOverlay`
 *
 * Renders a subtle overlay banner when audio is locked (not yet unlocked via
 * user interaction). Once unlocked, it renders nothing (or a tiny speaker icon).
 *
 * Place this component **inside** the PublicDisplay render tree so that
 * document-level click listeners are properly attached.
 */
export function PublicAudioOverlay({
  player,
  hasAudio,
  accentColor,
}: PublicAudioOverlayProps) {
  const { isUnlocked, isPlaying, volume, setVolume, unlock, stopAll } = player;

  // ── Auto-attach unlock listener on mount ─────────────────────────────────
  useEffect(() => {
    if (isUnlocked || !hasAudio) return;

    function handleFirstInteraction() {
      unlock();
      // One-time listeners
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    }

    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });
    document.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [isUnlocked, hasAudio, unlock]);

  // ── Don't render if no audio is configured ───────────────────────────────
  if (!hasAudio) return null;

  // ── Unlocked: show a minimal volume toggle ───────────────────────────────
  if (isUnlocked) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isPlaying) {
            stopAll();
          } else {
            setVolume(volume > 0 ? 0 : 0.8);
          }
        }}
        className="fixed bottom-3 right-3 z-50 flex items-center justify-center rounded-full p-2
                   bg-white/10 backdrop-blur-sm text-white/60 hover:text-white hover:bg-white/20
                   transition-all duration-200 shadow-lg"
        title={isPlaying ? 'Arrêter le son' : volume > 0 ? 'Couper le son' : 'Activer le son'}
        aria-label={isPlaying ? 'Stop audio' : volume > 0 ? 'Mute' : 'Unmute'}
      >
        {volume > 0 ? (
          <Volume2 className={`h-4 w-4 ${isPlaying ? 'text-emerald-400' : ''}`} />
        ) : (
          <VolumeX className="h-4 w-4" />
        )}
      </button>
    );
  }

  // ── Locked: show a subtle activation banner ──────────────────────────────
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5
                    rounded-full bg-black/60 backdrop-blur-md px-4 py-2.5
                    shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500
                    cursor-pointer select-none"
         onClick={(e) => {
           e.stopPropagation();
           unlock();
         }}
         role="button"
         tabIndex={0}
         aria-label="Cliquer pour activer le son"
    >
      {/* Animated speaker icon */}
      <span className="relative flex items-center justify-center">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-30"
          style={{ backgroundColor: accentColor || '#10b981' }}
        />
        <span
          className="relative flex items-center justify-center rounded-full p-1.5"
          style={{ backgroundColor: (accentColor || '#10b981') + '20' }}
        >
          <Volume2
            className="h-4 w-4"
            style={{ color: accentColor || '#10b981' }}
          />
        </span>
      </span>

      <span className="text-sm font-medium text-white/80 whitespace-nowrap">
        Cliquez pour activer le son
      </span>
    </div>
  );
}
