'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Loader2,
  Music,
  Globe,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import {
  CATEGORY_CONFIG,
  VALID_CATEGORIES,
  LANGUAGE_OPTIONS,
  generateSlug,
  convertGoogleDriveUrl,
  type AudioCategory,
} from '@/lib/audio-helper';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
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
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  slug: string;
  audioUrl: string;
  category: string;
  language: string;
  isGlobal: boolean;
  isActive: boolean;
}

const EMPTY_FORM: FormData = {
  name: '',
  slug: '',
  audioUrl: '',
  category: 'alert',
  language: 'fr',
  isGlobal: true,
  isActive: true,
};

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

// ── Category Badge ────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  const { t } = useTranslation();
  const config = CATEGORY_CONFIG[category as AudioCategory];
  if (!config) return <Badge variant="secondary">{category}</Badge>;

  const Icon = config.icon;
  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
    blue: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    amber: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    purple: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
    rose: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
  };

  return (
    <Badge variant="outline" className={`gap-1 ${colorClasses[config.color] || ''}`}>
      <Icon className="h-3 w-3" />
      {t(config.labelKey)}
    </Badge>
  );
}

// ── Audio Test Button ─────────────────────────────────────────────────────────

function AudioTestButton({ url }: { url: string }) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const togglePlay = useCallback(() => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }

    const convertedUrl = convertGoogleDriveUrl(url);
    const audio = new Audio(convertedUrl);
    audioRef.current = audio;
    audio.play().then(() => {
      setPlaying(true);
    }).catch(() => {
      toast.error(t('common.error'));
    });
    audio.addEventListener('ended', () => {
      setPlaying(false);
      audioRef.current = null;
    });
  }, [url, playing, t]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={togglePlay}
      title={t('audio.test')}
    >
      {playing ? <Pause className="h-4 w-4 text-amber-500" /> : <Play className="h-4 w-4" />}
    </Button>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        <Music className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{t('audio.noResults')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('audio.noResults')}
      </p>
      <Button className="mt-4 gap-2" onClick={onAdd}>
        <Plus className="h-4 w-4" />
        {t('audio.add')}
      </Button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AudioLibraryPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // ── State ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AudioItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<AudioItem | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [slugEdited, setSlugEdited] = useState(false);

  // ── Fetch data ───────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery<{ data: AudioItem[]; total: number }>({
    queryKey: ['audio-library', categoryFilter],
    queryFn: async () => {
      const params = categoryFilter !== 'all' ? `?category=${categoryFilter}` : '';
      const res = await fetch(`/api/audio-library${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch audio library');
      return res.json();
    },
  });

  const audioFiles = data?.data || [];

  // ── Filtered list ────────────────────────────────────────────────────────
  const filteredFiles = useMemo(() => {
    if (!search.trim()) return audioFiles;
    const q = search.toLowerCase();
    return audioFiles.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.slug.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
    );
  }, [audioFiles, search]);

  // ── Create/Update mutation ───────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (form: FormData) => {
      const isNew = !editingItem;
      const url = isNew ? '/api/audio-library' : `/api/audio-library/${editingItem!.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Request failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(editingItem ? t('common.save') : t('audio.add'));
      queryClient.invalidateQueries({ queryKey: ['audio-library'] });
      setDialogOpen(false);
      setEditingItem(null);
      setFormData(EMPTY_FORM);
      setSlugEdited(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // ── Delete mutation ──────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/audio-library/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Delete failed');
      return res.json();
    },
    onSuccess: () => {
      toast.success(t('common.delete'));
      queryClient.invalidateQueries({ queryKey: ['audio-library'] });
      setDeleteDialogOpen(false);
      setDeletingItem(null);
    },
    onError: () => {
      toast.error(t('common.error'));
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleOpenCreate = useCallback(() => {
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setSlugEdited(false);
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((item: AudioItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      slug: item.slug,
      audioUrl: item.audioUrl,
      category: item.category,
      language: item.language,
      isGlobal: item.isGlobal,
      isActive: item.isActive,
    });
    setSlugEdited(true);
    setDialogOpen(true);
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: slugEdited ? prev.slug : generateSlug(name),
    }));
  }, [slugEdited]);

  const handleSave = useCallback(() => {
    if (!formData.name.trim()) {
      toast.error(t('audio.name') + ' is required');
      return;
    }
    if (!formData.audioUrl.trim()) {
      toast.error(t('audio.url') + ' is required');
      return;
    }
    saveMutation.mutate(formData);
  }, [formData, saveMutation, t]);

  const handleDelete = useCallback(() => {
    if (deletingItem) {
      deleteMutation.mutate(deletingItem.id);
    }
  }, [deletingItem, deleteMutation]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('audio.title')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('audio.title')}
          </p>
        </div>
        <Button className="gap-2" onClick={handleOpenCreate}>
          <Plus className="h-4 w-4" />
          {t('audio.add')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('audio.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
          <Button
            variant={categoryFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            className="shrink-0"
            onClick={() => setCategoryFilter('all')}
          >
            {t('common.all')}
          </Button>
          {VALID_CATEGORIES.map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            const Icon = config.icon;
            return (
              <Button
                key={cat}
                variant={categoryFilter === cat ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => setCategoryFilter(cat)}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t(config.labelKey)}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredFiles.length === 0 ? (
        <EmptyState onAdd={handleOpenCreate} />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('audio.name')}</TableHead>
                  <TableHead>{t('audio.category')}</TableHead>
                  <TableHead>{t('audio.language')}</TableHead>
                  <TableHead className="max-w-[200px]">{t('audio.url')}</TableHead>
                  <TableHead>Global</TableHead>
                  <TableHead>{t('audio.isActive')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFiles.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <CategoryBadge category={item.category} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.language.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground truncate block max-w-[180px]" title={item.audioUrl}>
                        {item.audioUrl}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.isGlobal ? (
                        <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300">
                          <Globe className="h-3 w-3" />
                          Global
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? 'default' : 'secondary'}>
                        {item.isActive ? t('audio.isActive') : t('common.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <AudioTestButton url={item.audioUrl} />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeletingItem(item);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden flex flex-col gap-3">
            {filteredFiles.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-sm truncate">{item.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.slug}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <AudioTestButton url={item.audioUrl} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          setDeletingItem(item);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <CategoryBadge category={item.category} />
                    <Badge variant="secondary">{item.language.toUpperCase()}</Badge>
                    {item.isGlobal && (
                      <Badge variant="outline" className="gap-1">
                        <Globe className="h-3 w-3" />
                        Global
                      </Badge>
                    )}
                    <Badge variant={item.isActive ? 'default' : 'secondary'}>
                      {item.isActive ? t('audio.isActive') : t('common.inactive')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 truncate">{item.audioUrl}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? t('audio.edit') : t('audio.add')}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? t('audio.edit') : t('audio.add')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="audio-name">{t('audio.name')} *</Label>
              <Input
                id="audio-name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t('audio.name')}
              />
            </div>

            {/* Slug */}
            <div className="grid gap-2">
              <Label htmlFor="audio-slug">{t('audio.slug')}</Label>
              <Input
                id="audio-slug"
                value={formData.slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setFormData((prev) => ({ ...prev, slug: e.target.value }));
                }}
                placeholder="my-audio-slug"
              />
              <p className="text-xs text-muted-foreground">
                Auto-generated from name. Edit to customize.
              </p>
            </div>

            {/* Category + Language */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t('audio.category')}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, category: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALID_CATEGORIES.map((cat) => {
                      const config = CATEGORY_CONFIG[cat];
                      return (
                        <SelectItem key={cat} value={cat}>
                          {t(config.labelKey)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>{t('audio.language')}</Label>
                <Select
                  value={formData.language}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, language: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Audio URL */}
            <div className="grid gap-2">
              <Label htmlFor="audio-url">{t('audio.url')} *</Label>
              <Input
                id="audio-url"
                value={formData.audioUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, audioUrl: e.target.value }))}
                placeholder="https://example.com/audio.mp3"
              />
              <p className="text-xs text-muted-foreground">
                💡 {t('audio.driveHint')}
              </p>
            </div>

            {/* Toggles */}
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('audio.isGlobal')}</Label>
                <p className="text-xs text-muted-foreground">Visible to all client organizations</p>
              </div>
              <Switch
                checked={formData.isGlobal}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isGlobal: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>{t('audio.isActive')}</Label>
                <p className="text-xs text-muted-foreground">Enabled for use in boards</p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="gap-2"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('audio.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingItem?.name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
