'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { convertGoogleDriveUrl } from '@/lib/audio-helper';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AudioPlayerOptions {
  audioUrl?: string;
  autoPlay?: boolean;
  triggerMinutes?: number;
}

interface ScheduleEntry {
  id: string;
  time: string;
  status?: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAudioPlayer(options: AudioPlayerOptions) {
  const { audioUrl, triggerMinutes = 5 } = options;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const announcedRef = useRef<Set<string>>(new Set());
  const unlockedRef = useRef(false);

  // ── Preload audio when URL changes ───────────────────────────────────────
  useEffect(() => {
    if (!audioUrl) {
      audioRef.current = null;
      return;
    }

    const convertedUrl = convertGoogleDriveUrl(audioUrl);
    const audio = new Audio(convertedUrl);
    audio.preload = 'auto';
    audio.volume = volume;

    audio.addEventListener('canplaythrough', () => {
      setIsLoaded(true);
    }, { once: true });

    audio.addEventListener('error', () => {
      console.warn('[AudioPlayer] Failed to load audio:', convertedUrl);
    }, { once: true });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
    });

    audio.load();
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
      setIsLoaded(false);
      setIsPlaying(false);
    };
  }, [audioUrl, volume]);

  // ── Update volume ────────────────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // ── Unlock audio context on first user interaction ───────────────────────
  const unlock = useCallback(() => {
    if (unlockedRef.current || !audioRef.current) return;

    const audio = audioRef.current;
    audio
      .play()
      .then(() => {
        // Immediately pause — this is just to unlock the audio context
        audio.pause();
        audio.currentTime = 0;
        unlockedRef.current = true;
        setIsEnabled(true);
      })
      .catch(() => {
        // Silently fail — audio may not be supported
        console.warn('[AudioPlayer] Could not unlock audio context');
      });
  }, []);

  // ── Attach a one-time click listener for unlocking ────────────────────────
  useEffect(() => {
    if (unlockedRef.current) return;

    const handler = () => {
      unlock();
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
    };

    document.addEventListener('click', handler, { once: true });
    document.addEventListener('touchstart', handler, { once: true });

    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [unlock]);

  // ── Announce method: play audio for a schedule entry ─────────────────────
  const announce = useCallback(
    (entry: ScheduleEntry) => {
      if (!audioRef.current || !audioUrl) return;
      if (!unlockedRef.current) {
        console.warn('[AudioPlayer] Audio not unlocked yet — user interaction required');
        return;
      }
      if (announcedRef.current.has(entry.id)) return;

      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const [h, m] = entry.time.split(':').map(Number);
      const entryMinutes = h * 60 + m;
      const timeToDeparture = entryMinutes - nowMinutes;

      if (timeToDeparture <= triggerMinutes && timeToDeparture > -2) {
        announcedRef.current.add(entry.id);

        const audio = audioRef.current;
        audio.currentTime = 0;
        audio
          .play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            console.warn('[AudioPlayer] Play failed:', err);
            setIsPlaying(false);
          });
      }
    },
    [audioUrl, triggerMinutes]
  );

  // ── Play manually (for test/preview) ─────────────────────────────────────
  const play = useCallback(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    audio.currentTime = 0;
    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        unlockedRef.current = true;
        setIsEnabled(true);
      })
      .catch(() => {
        console.warn('[AudioPlayer] Play failed');
      });
  }, []);

  // ── Stop ─────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  // ── Set volume ───────────────────────────────────────────────────────────
  const handleSetVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolume(clamped);
  }, []);

  return {
    isLoaded,
    isPlaying,
    isEnabled,
    volume,
    setVolume: handleSetVolume,
    announce,
    play,
    stop,
    unlock,
  };
}
