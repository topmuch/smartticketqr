'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Volume2,
  Bus,
  MapPin,
  AlertTriangle,
  Shield,
  Loader2,
  Save,
  Play,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { convertGoogleDriveUrl, CATEGORY_CONFIG, type AudioCategory } from '@/lib/audio-helper';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AudioItem {
  id: string;
  slug: string;
  name: string;
  audioUrl: string;
  category: string;
  language: string;
  isGlobal: boolean;
  isActive: boolean;
}

interface AudioSettingsConfig {
  key: string;
  category: AudioCategory;
  descriptionKey: string;
  icon: React.ElementType;
}

const AUDIO_CONTEXTS: AudioSettingsConfig[] = [
  {
    key: 'departureSlug',
    category: 'departure',
    descriptionKey: 'audio.departure',
    icon: Bus,
  },
  {
    key: 'arrivalSlug',
    category: 'arrival',
    descriptionKey: 'audio.arrival',
    icon: MapPin,
  },
  {
    key: 'alertSlug',
    category: 'alert',
    descriptionKey: 'audio.alert',
    icon: AlertTriangle,
  },
  {
    key: 'welcomeSlug',
    category: 'welcome',
    descriptionKey: 'audio.welcome',
    icon: Volume2,
  },
  {
    key: 'safetySlug',
    category: 'safety',
    descriptionKey: 'audio.safety',
    icon: Shield,
  },
];

// ── Auth Headers ──────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  const token = useAuthStore.getState().token;
  const orgId = useOrgStore.getState().currentOrganization?.id;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(orgId ? { 'X-Organization-Id': orgId } : {}),
  };
}

// ── Preview Button ────────────────────────────────────────────────────────────

function PreviewButton({ audioUrl }: { audioUrl: string }) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const handlePreview = useCallback(() => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const convertedUrl = convertGoogleDriveUrl(audioUrl);
    const audio = new Audio(convertedUrl);
    audioRef.current = audio;
    audio.play().then(() => {
      setPlaying(true);
    }).catch(() => {
      // Silently fail — audio may not be supported
    });

    // Auto-stop after 3 seconds
    timerRef.current = setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      setPlaying(false);
      audioRef.current = null;
    }, 3000);

    audio.addEventListener('ended', () => {
      setPlaying(false);
      audioRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
    });
  }, [audioUrl, playing]);

  if (!audioUrl) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      onClick={handlePreview}
      title={t('audio.preview')}
    >
      {playing ? (
        <Volume2 className="h-4 w-4 text-amber-500 animate-pulse" />
      ) : (
        <Play className="h-4 w-4" />
      )}
    </Button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface AudioSettingsSectionProps {
  organizationId: string;
  currentSettings?: Record<string, unknown>;
  onSaved?: () => void;
}

export default function AudioSettingsSection({
  organizationId,
  currentSettings = {},
  onSaved,
}: AudioSettingsSectionProps) {
  const { t } = useTranslation();

  // Parse current audio settings from org settings
  const parsedAudioSettings = useMemo(() => {
    const settings = currentSettings as Record<string, Record<string, string>>;
    return settings?.audio || {};
  }, [currentSettings]);

  // Local state for audio settings
  const [audioSettings, setAudioSettings] = useState<Record<string, string>>(() => ({
    departureSlug: parsedAudioSettings.departureSlug || '',
    arrivalSlug: parsedAudioSettings.arrivalSlug || '',
    alertSlug: parsedAudioSettings.alertSlug || '',
    welcomeSlug: parsedAudioSettings.welcomeSlug || '',
    safetySlug: parsedAudioSettings.safetySlug || '',
  }));

  // ── Fetch global audio library ────────────────────────────────────────────
  const { data: audioLibraryData, isLoading } = useQuery<{ data: AudioItem[] }>({
    queryKey: ['audio-library-global'],
    queryFn: async () => {
      const res = await fetch('/api/audio-library', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const audioFiles = audioLibraryData?.data || [];

  // ── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      // First fetch current org to get full settings
      const orgRes = await fetch(`/api/organizations/${organizationId}`, {
        headers: getAuthHeaders(),
      });
      if (!orgRes.ok) throw new Error('Failed to fetch organization');
      const org = await orgRes.json();

      // Merge audio settings into existing settings
      const existingSettings = typeof org.settings === 'string'
        ? JSON.parse(org.settings || '{}')
        : org.settings || {};
      existingSettings.audio = audioSettings;

      const res = await fetch(`/api/organizations/${organizationId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ settings: JSON.stringify(existingSettings) }),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      return res.json();
    },
    onSuccess: () => {
      toast.success(t('audio.saved'));
      onSaved?.();
    },
    onError: () => {
      toast.error(t('common.error'));
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleChange = useCallback((key: string, value: string) => {
    setAudioSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(() => {
    saveMutation.mutate();
  }, [saveMutation]);

  // Get audio files filtered by category
  const getFilesForCategory = useCallback(
    (category: AudioCategory) => {
      return audioFiles.filter((f) => f.category === category && f.isGlobal && f.isActive);
    },
    [audioFiles]
  );

  // Find audio by slug for preview
  const findAudioBySlug = useCallback(
    (slug: string) => {
      return audioFiles.find((f) => f.slug === slug);
    },
    [audioFiles]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          {t('audio.settingsTitle')}
        </CardTitle>
        <CardDescription>
          {t('audio.settingsTitle')}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {AUDIO_CONTEXTS.map((ctx) => {
              const Icon = ctx.icon;
              const files = getFilesForCategory(ctx.category);
              const currentSlug = audioSettings[ctx.key] || '';
              const currentAudio = findAudioBySlug(currentSlug);

              return (
                <div key={ctx.key} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">{t(ctx.descriptionKey)}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={currentSlug}
                      onValueChange={(val) => handleChange(ctx.key, val)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t('audio.selectAudio')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          {t('audio.none')}
                        </SelectItem>
                        {files.length === 0 ? (
                          <SelectItem value="__empty__" disabled>
                            —
                          </SelectItem>
                        ) : (
                          files.map((f) => (
                            <SelectItem key={f.slug} value={f.slug}>
                              <span className="flex items-center gap-2">
                                {f.name}
                                <span className="text-xs text-muted-foreground">
                                  ({f.language.toUpperCase()})
                                </span>
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    {currentAudio && (
                      <PreviewButton audioUrl={currentAudio.audioUrl} />
                    )}
                  </div>
                </div>
              );
            })}

            <Separator />

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="gap-2"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t('common.save')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
