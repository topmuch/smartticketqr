import { Bus, MapPin, AlertTriangle, Volume2, Shield, type LucideIcon } from 'lucide-react';

// ── Category Configuration ────────────────────────────────────────────────────

export type AudioCategory = 'departure' | 'arrival' | 'alert' | 'welcome' | 'safety';

export interface CategoryConfig {
  labelKey: string;
  icon: LucideIcon;
  color: string; // Tailwind color name (used in badge classes)
}

export const CATEGORY_CONFIG: Record<AudioCategory, CategoryConfig> = {
  departure: {
    labelKey: 'audio.departure',
    icon: Bus,
    color: 'emerald',
  },
  arrival: {
    labelKey: 'audio.arrival',
    icon: MapPin,
    color: 'blue',
  },
  alert: {
    labelKey: 'audio.alert',
    icon: AlertTriangle,
    color: 'amber',
  },
  welcome: {
    labelKey: 'audio.welcome',
    icon: Volume2,
    color: 'purple',
  },
  safety: {
    labelKey: 'audio.safety',
    icon: Shield,
    color: 'rose',
  },
};

export const VALID_CATEGORIES: AudioCategory[] = [
  'departure',
  'arrival',
  'alert',
  'welcome',
  'safety',
];

// ── Language Options ──────────────────────────────────────────────────────────

export interface LanguageOption {
  value: string;
  label: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
  { value: 'es', label: 'Español' },
  { value: 'wo', label: 'Wolof' },
];

// ── Slug Validation ───────────────────────────────────────────────────────────

export const SLUG_REGEX = /^[a-z0-9_-]+$/;

// ── URL Helpers ───────────────────────────────────────────────────────────────

/**
 * Converts Google Drive sharing URLs to direct download links.
 * Supports:
 *   - https://drive.google.com/file/d/FILE_ID/...
 *   - https://drive.google.com/open?id=FILE_ID
 *   - https://drive.google.com/uc?id=FILE_ID
 */
export function convertGoogleDriveUrl(url: string): string {
  if (!url) return url;

  // Already a direct download link
  if (url.includes('drive.google.com/uc?export=download')) {
    return url;
  }

  // Pattern: /file/d/FILE_ID/...
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
  }

  // Pattern: open?id=FILE_ID
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch && url.includes('drive.google.com')) {
    return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`;
  }

  return url;
}

/**
 * Validates that a string is a well-formed URL.
 */
export function validateAudioUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Auto-generates a slug from a name string.
 * Converts to lowercase, replaces spaces and special chars with hyphens.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric (except spaces/hyphens)
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens
}
