'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Plus,
  Monitor,
  Eye,
  Pencil,
  Trash2,
  Copy,
  Maximize2,
  Minimize2,
  LayoutDashboard,
  List,
  Grid3X3,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  Clock,
  Bus,
  Ticket,
  Users,
  BarChart3,
  ChevronRight,
  Loader2,
  QrCode,
  Layers,
  ScreenShare,
} from 'lucide-react';

import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  DisplayKiosk,
  type DisplayConfig,
} from './display-kiosk';

// ── Types ───────────────────────────────────────────────────────────────────

interface DisplayConfigFull extends DisplayConfig {
  publicUrl?: string;
  isActive: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EventOption {
  id: string;
  name: string;
}

type TemplateType = 'kiosk' | 'compact' | 'full' | 'queue' | 'transport';

// ── Constants ───────────────────────────────────────────────────────────────

const TEMPLATE_OPTIONS: { value: TemplateType; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  {
    value: 'kiosk',
    label: 'Kiosque',
    icon: Monitor,
    color: '#28A745',
    desc: 'Écran plein format, validation cyclique, barre de statistiques',
  },
  {
    value: 'compact',
    label: 'Compact',
    icon: List,
    color: '#007BFF',
    desc: 'Thème clair, liste de validations défilante, lisible de loin',
  },
  {
    value: 'full',
    label: 'Complet',
    icon: LayoutDashboard,
    color: '#FFC107',
    desc: 'Détails événement, flux live, panneau statistiques détaillé',
  },
  {
    value: 'queue',
    label: 'File d\'attente',
    icon: Users,
    color: '#6F42C1',
    desc: 'Compteur de file, position actuelle, temps d\'attente estimé',
  },
  {
    value: 'transport',
    label: 'Transport',
    icon: Bus,
    color: '#0D6EFD',
    desc: 'Tableau de départ, barre de capacité, embarquement en cours',
  },
];

const DEFAULT_FORM: Omit<DisplayConfigFull, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  eventId: null,
  template: 'kiosk',
  cycleInterval: 8,
  accentColor: '#28A745',
  showStats: true,
  showOrganization: true,
  isActive: true,
  isPublic: false,
};

// ── Animation variants ──────────────────────────────────────────────────────

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.05 } },
};

// ── Component ───────────────────────────────────────────────────────────────

export default function DisplayPage() {
  const token = useAuthStore((s) => s.token);
  const orgId = useOrgStore((s) => s.currentOrganization?.id);
  const orgName = useOrgStore((s) => s.currentOrganization?.name);
  const orgColor = useOrgStore((s) => s.currentOrganization?.primaryColor);

  // Data state
  const [configs, setConfigs] = useState<DisplayConfigFull[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEventsLoading, setIsEventsLoading] = useState(true);

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<DisplayConfigFull | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preview state
  const [previewEventId, setPreviewEventId] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<TemplateType>('kiosk');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Fetch configs ────────────────────────────────────────────────────────

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/display/config', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || data.configs || [];
        setConfigs(list);
      }
    } catch {
      toast.error('Erreur lors du chargement des configurations');
    } finally {
      setIsLoading(false);
    }
  }, [token, orgId]);

  // ── Fetch events ─────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events?limit=100', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || [];
        setEvents(list.map((e: { id: string; name: string }) => ({ id: e.id, name: e.name })));
      }
    } catch {
      // silent
    } finally {
      setIsEventsLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    fetchConfigs();
    fetchEvents();
  }, [fetchConfigs, fetchEvents]);

  // ── Form helpers ─────────────────────────────────────────────────────────

  function resetForm() {
    setFormData(DEFAULT_FORM);
    setFormErrors({});
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Le nom est requis';
    if (formData.cycleInterval < 3 || formData.cycleInterval > 30) {
      errors.cycleInterval = 'L\'intervalle doit être entre 3 et 30 secondes';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── CRUD operations ──────────────────────────────────────────────────────

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/display/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de la création');
      }
      toast.success('Écran créé avec succès');
      setShowCreateDialog(false);
      resetForm();
      fetchConfigs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConfig || !validateForm()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/display/config/${selectedConfig.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de la modification');
      }
      toast.success('Écran mis à jour avec succès');
      setShowCreateDialog(false);
      setSelectedConfig(null);
      resetForm();
      fetchConfigs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selectedConfig) return;

    try {
      const res = await fetch(`/api/display/config/${selectedConfig.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de la suppression');
      }
      toast.success('Écran supprimé avec succès');
      setShowDeleteDialog(false);
      setSelectedConfig(null);
      fetchConfigs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  // ── Open edit dialog ─────────────────────────────────────────────────────

  function openEditDialog(config: DisplayConfigFull) {
    setSelectedConfig(config);
    setFormData({
      name: config.name,
      eventId: config.eventId,
      template: config.template,
      cycleInterval: config.cycleInterval,
      accentColor: config.accentColor,
      showStats: config.showStats,
      showOrganization: config.showOrganization,
      isActive: config.isActive,
      isPublic: config.isPublic,
    });
    setFormErrors({});
    setShowCreateDialog(true);
  }

  // ── Copy link ────────────────────────────────────────────────────────────

  function handleCopyLink(config: DisplayConfigFull) {
    const url = `${window.location.origin}/display?configId=${config.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Lien copié dans le presse-papier');
    }).catch(() => {
      toast.error('Impossible de copier le lien');
    });
  }

  // ── Fullscreen toggle ────────────────────────────────────────────────────

  function toggleFullscreen() {
    if (!previewContainerRef.current) return;
    if (!document.fullscreenElement) {
      previewContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {
        toast.error('Impossible de passer en plein écran');
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  }

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Get template info ────────────────────────────────────────────────────

  function getTemplateInfo(template: TemplateType) {
    return TEMPLATE_OPTIONS.find((t) => t.value === template) || TEMPLATE_OPTIONS[0];
  }

  function getTemplateIcon(template: TemplateType) {
    const info = getTemplateInfo(template);
    const Icon = info.icon;
    return <Icon className="h-4 w-4" />;
  }

  function getEventName(eventId: string | null): string {
    if (!eventId) return '—';
    return events.find((e) => e.id === eventId)?.name || eventId;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Écrans dynamiques
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gérez les écrans d&apos;affichage pour vos événements et transports
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setSelectedConfig(null);
            setShowCreateDialog(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          <Plus className="size-4" />
          Nouvel écran
        </Button>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="screens" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="screens" className="gap-1.5">
            <ScreenShare className="size-3.5" />
            Écrans
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5">
            <Eye className="size-3.5" />
            Aperçu en direct
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <Grid3X3 className="size-3.5" />
            Modèles
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════
            TAB 1: ÉCRANS
        ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="screens">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : configs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <Monitor className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mt-4 text-lg font-semibold">Aucun écran configuré</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Créez votre premier écran d&apos;affichage dynamique
                </p>
                <Button
                  onClick={() => {
                    resetForm();
                    setSelectedConfig(null);
                    setShowCreateDialog(true);
                  }}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  <Plus className="size-4" />
                  Nouvel écran
                </Button>
              </CardContent>
            </Card>
          ) : (
            <motion.div
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              variants={stagger}
              initial="initial"
              animate="animate"
            >
              {configs.map((config) => {
                const templateInfo = getTemplateInfo(config.template);
                return (
                  <motion.div key={config.id} variants={fadeIn}>
                    <Card className="group transition-all hover:shadow-md">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                              style={{ backgroundColor: templateInfo.color + '15' }}
                            >
                              {(() => {
                                const Icon = templateInfo.icon;
                                return <Icon className="h-5 w-5" style={{ color: templateInfo.color }} />;
                              })()}
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="text-base truncate">
                                {config.name}
                              </CardTitle>
                              <CardDescription className="truncate">
                                {getEventName(config.eventId)}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge
                              variant={config.isActive ? 'default' : 'secondary'}
                              className={`text-[10px] ${config.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : ''}`}
                            >
                              {config.isActive ? 'Actif' : 'Inactif'}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Badges row */}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Layers className="size-3" />
                            {templateInfo.label}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Clock className="size-3" />
                            {config.cycleInterval}s
                          </Badge>
                          {config.isPublic && (
                            <Badge variant="outline" className="text-[10px] gap-1 border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">
                              <Eye className="size-3" />
                              Public
                            </Badge>
                          )}
                          {!config.isPublic && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              Verrouillé
                            </Badge>
                          )}
                        </div>

                        {/* Color indicator */}
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full border border-muted-foreground/20"
                            style={{ backgroundColor: config.accentColor }}
                          />
                          <span className="text-xs text-muted-foreground">
                            Couleur d&apos;accent : {config.accentColor}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <Separator />
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 flex-1 gap-1.5 text-xs"
                            onClick={() => openEditDialog(config)}
                          >
                            <Pencil className="size-3.5" />
                            Modifier
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 flex-1 gap-1.5 text-xs"
                            onClick={() => {
                              setSelectedConfig(config);
                              setPreviewEventId(config.eventId || '');
                              setPreviewTemplate(config.template);
                              setShowPreviewDialog(true);
                            }}
                          >
                            <Eye className="size-3.5" />
                            Aperçu
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => handleCopyLink(config)}
                            title="Copier le lien public"
                          >
                            <Copy className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                            onClick={() => {
                              setSelectedConfig(config);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════
            TAB 2: APERÇU EN DIRECT
        ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Aperçu en direct</CardTitle>
                  <CardDescription>
                    Testez l&apos;affichage en temps réel avant de le déployer
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={previewTemplate}
                    onValueChange={(v) => setPreviewTemplate(v as TemplateType)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Modèle" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <span className="flex items-center gap-2">
                            <t.icon className="size-3.5" />
                            {t.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={previewEventId}
                    onValueChange={setPreviewEventId}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Sélectionner un événement" />
                    </SelectTrigger>
                    <SelectContent>
                      {isEventsLoading ? (
                        <SelectItem value="_loading" disabled>
                          Chargement...
                        </SelectItem>
                      ) : events.length === 0 ? (
                        <SelectItem value="_empty" disabled>
                          Aucun événement
                        </SelectItem>
                      ) : (
                        events.map((ev) => (
                          <SelectItem key={ev.id} value={ev.id}>
                            {ev.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={toggleFullscreen}
                    title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="size-4" />
                    ) : (
                      <Maximize2 className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div
                ref={previewContainerRef}
                className="relative overflow-hidden rounded-lg"
                style={{ height: '600px' }}
              >
                <DisplayKiosk
                  config={{
                    eventId: previewEventId || null,
                    template: previewTemplate,
                    cycleInterval: 5,
                    accentColor: '#28A745',
                    showStats: true,
                    showOrganization: true,
                  }}
                  organization={{
                    name: orgName || 'SmartTicketQR',
                    primaryColor: orgColor || '#28A745',
                  }}
                  eventId={previewEventId}
                  className="h-full w-full [&>*]:h-full [&>*]:w-full"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════
            TAB 3: MODÈLES
        ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="templates">
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold">Modèles d&apos;affichage</h2>
              <p className="text-sm text-muted-foreground">
                Choisissez le modèle adapté à votre contexte d&apos;utilisation
              </p>
            </div>
            <motion.div
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              variants={stagger}
              initial="initial"
              animate="animate"
            >
              {TEMPLATE_OPTIONS.map((tpl) => (
                <motion.div key={tpl.value} variants={fadeIn}>
                  <Card className="group h-full overflow-hidden transition-all hover:shadow-md">
                    {/* Thumbnail preview */}
                    <div
                      className="relative flex h-40 items-center justify-center"
                      style={{
                        background: tpl.value === 'compact'
                          ? 'linear-gradient(135deg, #f8fafc, #e2e8f0)'
                          : `linear-gradient(135deg, ${tpl.color}20, ${tpl.color}08)`,
                      }}
                    >
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-2xl transition-transform group-hover:scale-110"
                        style={{ backgroundColor: tpl.color + '25' }}
                      >
                        <tpl.icon className="h-8 w-8" style={{ color: tpl.color }} />
                      </div>
                      {/* Decorative elements */}
                      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between opacity-60">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" style={{ color: tpl.color }} />
                          <div className="h-2 w-16 rounded-full" style={{ backgroundColor: tpl.color + '30' }} />
                        </div>
                        <div className="flex items-center gap-1">
                          <XCircle className="h-3 w-3 text-red-400" />
                          <div className="h-2 w-8 rounded-full bg-red-400/30" />
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-semibold">{tpl.label}</h3>
                        <Badge variant="outline" className="text-[10px]">
                          {tpl.value}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {tpl.desc}
                      </p>
                      <Button
                        className="mt-4 w-full gap-2 text-white"
                        style={{ backgroundColor: tpl.color }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '0.85';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '1';
                        }}
                        onClick={() => {
                          setPreviewTemplate(tpl.value);
                          setShowPreviewDialog(true);
                        }}
                      >
                        <Eye className="size-4" />
                        Utiliser ce modèle
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Create / Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          setSelectedConfig(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedConfig ? 'Modifier l\'écran' : 'Nouvel écran'}
            </DialogTitle>
            <DialogDescription>
              {selectedConfig
                ? 'Modifiez les paramètres de l\'écran d\'affichage'
                : 'Configurez un nouvel écran d\'affichage dynamique'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={selectedConfig ? handleEditSubmit : handleCreateSubmit}
            className="space-y-4"
          >
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="display-name">Nom de l&apos;écran *</Label>
              <Input
                id="display-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Écran Entrée Principale"
                className={formErrors.name ? 'border-red-500' : ''}
              />
              {formErrors.name && (
                <p className="text-red-500 text-xs">{formErrors.name}</p>
              )}
            </div>

            {/* Event + Template */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Événement</Label>
                <Select
                  value={formData.eventId || '_none'}
                  onValueChange={(v) =>
                    setFormData({ ...formData, eventId: v === '_none' ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Aucun</SelectItem>
                    {events.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Modèle</Label>
                <Select
                  value={formData.template}
                  onValueChange={(v) =>
                    setFormData({ ...formData, template: v as TemplateType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">
                          <t.icon className="size-3.5" />
                          {t.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cycle Interval + Color */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cycle-interval">
                  Intervalle de cycle ({formData.cycleInterval}s)
                </Label>
                <Input
                  id="cycle-interval"
                  type="range"
                  min={3}
                  max={30}
                  value={formData.cycleInterval}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cycleInterval: parseInt(e.target.value) || 5,
                    })
                  }
                  className={formErrors.cycleInterval ? 'border-red-500' : ''}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>3s</span>
                  <span>30s</span>
                </div>
                {formErrors.cycleInterval && (
                  <p className="text-red-500 text-xs">{formErrors.cycleInterval}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="accent-color">Couleur d&apos;accent</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="accent-color"
                    type="color"
                    value={formData.accentColor}
                    onChange={(e) =>
                      setFormData({ ...formData, accentColor: e.target.value })
                    }
                    className="h-10 w-14 cursor-pointer rounded-lg border border-border"
                  />
                  <Input
                    value={formData.accentColor}
                    onChange={(e) =>
                      setFormData({ ...formData, accentColor: e.target.value })
                    }
                    className="flex-1 font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            {/* Switches */}
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">Afficher les statistiques</Label>
                  <p className="text-xs text-muted-foreground">
                    Barre de stats en bas de l&apos;écran
                  </p>
                </div>
                <Switch
                  checked={formData.showStats}
                  onCheckedChange={(v) =>
                    setFormData({ ...formData, showStats: v })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">Afficher l&apos;organisation</Label>
                  <p className="text-xs text-muted-foreground">
                    Logo et nom de l&apos;organisation
                  </p>
                </div>
                <Switch
                  checked={formData.showOrganization}
                  onCheckedChange={(v) =>
                    setFormData({ ...formData, showOrganization: v })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">Accès public</Label>
                  <p className="text-xs text-muted-foreground">
                    Accessible via URL publique sans authentification
                  </p>
                </div>
                <Switch
                  checked={formData.isPublic}
                  onCheckedChange={(v) =>
                    setFormData({ ...formData, isPublic: v })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {selectedConfig ? 'Enregistrer' : 'Créer l\'écran'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ──────────────────────────────────────────── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l&apos;écran</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l&apos;écran &ldquo;{selectedConfig?.name}&rdquo; ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDeleteDialog(false);
                setSelectedConfig(null);
              }}
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Preview Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Aperçu de l&apos;écran</DialogTitle>
                <DialogDescription>
                  {selectedConfig?.name || `Modèle ${getTemplateInfo(previewTemplate).label}`}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={previewTemplate}
                  onValueChange={(v) => setPreviewTemplate(v as TemplateType)}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">
                          <t.icon className="size-3.5" />
                          {t.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden mt-4">
            <DisplayKiosk
              config={{
                eventId: previewEventId || null,
                template: previewTemplate,
                cycleInterval: 5,
                accentColor: '#28A745',
                showStats: true,
                showOrganization: true,
              }}
              organization={{
                name: orgName || 'SmartTicketQR',
                primaryColor: orgColor || '#28A745',
              }}
              eventId={previewEventId}
              className="h-full w-full [&>*]:h-full [&>*]:w-full"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
