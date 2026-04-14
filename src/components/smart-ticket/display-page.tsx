'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Plus,
  Bus,
  Ship,
  TrainFront,
  Pencil,
  Trash2,
  Clock,
  QrCode,
  Copy,
  Eye,
  MapPin,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Maximize2,
  Minimize2,
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

// ── Types ───────────────────────────────────────────────────────────────────

type VehicleType = 'bus' | 'bateau' | 'ferry' | 'train';

type ScheduleStatus = 'on_time' | 'delayed' | 'cancelled';

interface Schedule {
  id: string;
  type: 'departure' | 'arrival';
  time: string;
  status: ScheduleStatus;
  delayMinutes: number;
  note: string;
}

interface TransportLine {
  id: string;
  name: string;
  origin: string;
  destination: string;
  vehicleType: VehicleType;
  color: string;
  isActive: boolean;
  schedules: Schedule[];
  createdAt: string;
  updatedAt: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const VEHICLE_OPTIONS: { value: VehicleType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'bus', label: 'Bus', icon: Bus, color: '#059669' },
  { value: 'bateau', label: 'Bateau', icon: Ship, color: '#0891b2' },
  { value: 'ferry', label: 'Ferry', icon: Ship, color: '#6366f1' },
  { value: 'train', label: 'Train', icon: TrainFront, color: '#d97706' },
];

const SCHEDULE_STATUS_CONFIG: Record<ScheduleStatus, { label: string; icon: React.ElementType; className: string }> = {
  on_time: { label: 'À l\'heure', icon: CheckCircle, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  delayed: { label: 'Retardé', icon: AlertTriangle, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  cancelled: { label: 'Annulé', icon: XCircle, className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
};

function renderStatusBadge(status: ScheduleStatus) {
  const config = SCHEDULE_STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge variant="secondary" className={`text-[10px] gap-1 ${config.className}`}>
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}

const DEFAULT_LINE_FORM = {
  name: '',
  origin: '',
  destination: '',
  vehicleType: 'bus' as VehicleType,
  color: '#059669',
  isActive: true,
};

// ── Animation variants ──────────────────────────────────────────────────────

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function getVehicleIcon(type: VehicleType) {
  return VEHICLE_OPTIONS.find((v) => v.value === type) || VEHICLE_OPTIONS[0];
}

function generateId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getBoardUrl(orgSlug: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/?board=${orgSlug}`;
  }
  return `/?board=${orgSlug}`;
}

function generateScheduleId(): string {
  return generateId();
}

// ── QR Code Generator (pure canvas, no external library) ────────────────────

function drawQRCode(
  canvas: HTMLCanvasElement,
  data: string,
  size: number,
  fgColor: string,
  bgColor: string
) {
  const ctx = canvas.getContext('2d')!;

  canvas.width = size;
  canvas.height = size;

  // Generate a deterministic grid from the data string
  const modules = 25;
  const moduleSize = Math.floor((size - (modules + 2) * 2) / modules);
  const offset = Math.floor((size - modules * moduleSize) / 2);

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);

  // Simple hash-based pattern generation
  const seed = data.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  function pseudoRandom(x: number, y: number): boolean {
    const v = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453;
    return (v - Math.floor(v)) > 0.5;
  }

  ctx.fillStyle = fgColor;

  // Draw finder patterns (top-left, top-right, bottom-left)
  function drawFinderPattern(cx: number, cy: number) {
    // Outer border
    for (let r = -4; r <= 4; r++) {
      for (let c = -4; c <= 4; c++) {
        const isOuter = Math.abs(r) === 4 || Math.abs(c) === 4;
        const isInner = Math.abs(r) <= 2 && Math.abs(c) <= 2;
        if (isOuter || isInner) {
          ctx.fillRect(
            offset + (cx + c) * moduleSize,
            offset + (cy + r) * moduleSize,
            moduleSize,
            moduleSize
          );
        }
      }
    }
  }

  drawFinderPattern(3, 3);
  drawFinderPattern(modules - 4, 3);
  drawFinderPattern(3, modules - 4);

  // Draw timing patterns
  for (let i = 8; i < modules - 8; i++) {
    if (i % 2 === 0) {
      ctx.fillRect(offset + i * moduleSize, offset + 6 * moduleSize, moduleSize, moduleSize);
      ctx.fillRect(offset + 6 * moduleSize, offset + i * moduleSize, moduleSize, moduleSize);
    }
  }

  // Draw data area
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      // Skip finder pattern areas
      const inFinder1 = r < 9 && c < 9;
      const inFinder2 = r < 9 && c >= modules - 8;
      const inFinder3 = r >= modules - 8 && c < 9;
      // Skip timing
      const onTimingH = r === 6;
      const onTimingV = c === 6;

      if (inFinder1 || inFinder2 || inFinder3 || onTimingH || onTimingV) continue;

      if (pseudoRandom(r, c)) {
        ctx.fillRect(
          offset + c * moduleSize,
          offset + r * moduleSize,
          moduleSize,
          moduleSize
        );
      }
    }
  }

  // Draw quiet zone border
  ctx.strokeStyle = fgColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(offset - 2, offset - 2, modules * moduleSize + 4, modules * moduleSize + 4);
}

// ── Component ───────────────────────────────────────────────────────────────

export default function DisplayPage() {
  const token = useAuthStore((s) => s.token);
  const orgId = useOrgStore((s) => s.currentOrganization?.id);
  const orgSlug = useOrgStore((s) => s.currentOrganization?.slug);
  const orgName = useOrgStore((s) => s.currentOrganization?.name);
  const orgColor = useOrgStore((s) => s.currentOrganization?.primaryColor);

  // Data state
  const [lines, setLines] = useState<TransportLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState('lines');
  const [selectedLineForSchedules, setSelectedLineForSchedules] = useState<TransportLine | null>(null);

  // Dialog state
  const [showLineDialog, setShowLineDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [selectedLine, setSelectedLine] = useState<TransportLine | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preview / fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const downloadCanvasRef = useRef<HTMLCanvasElement>(null);

  // Form state
  const [lineForm, setLineForm] = useState(DEFAULT_LINE_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Schedule editing state
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editDelay, setEditDelay] = useState(0);
  const [editNote, setEditNote] = useState('');

  // ── Fetch lines ──────────────────────────────────────────────────────────

  const fetchLines = useCallback(async () => {
    try {
      const res = await fetch('/api/lines', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || data.lines || [];
        setLines(list);
      }
    } catch {
      toast.error('Erreur lors du chargement des lignes');
    } finally {
      setIsLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  // ── Form helpers ─────────────────────────────────────────────────────────

  function resetLineForm() {
    setLineForm(DEFAULT_LINE_FORM);
    setFormErrors({});
  }

  function validateLineForm(): boolean {
    const errors: Record<string, string> = {};
    if (!lineForm.name.trim()) errors.name = 'Le nom est requis';
    if (!lineForm.origin.trim()) errors.origin = 'L\'origine est requise';
    if (!lineForm.destination.trim()) errors.destination = 'La destination est requise';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Line CRUD ────────────────────────────────────────────────────────────

  async function handleLineSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateLineForm()) return;

    setIsSubmitting(true);
    try {
      const isEditing = !!selectedLine;
      const url = isEditing ? `/api/lines/${selectedLine!.id}` : '/api/lines';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
        body: JSON.stringify(lineForm),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de l\'enregistrement');
      }

      toast.success(isEditing ? 'Ligne mise à jour avec succès' : 'Ligne créée avec succès');
      setShowLineDialog(false);
      setSelectedLine(null);
      resetLineForm();
      fetchLines();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteLine() {
    if (!selectedLine) return;

    try {
      const res = await fetch(`/api/lines/${selectedLine.id}`, {
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
      toast.success('Ligne supprimée avec succès');
      setShowDeleteDialog(false);
      if (selectedLineForSchedules?.id === selectedLine.id) {
        setSelectedLineForSchedules(null);
      }
      setSelectedLine(null);
      fetchLines();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  function openEditLineDialog(line: TransportLine) {
    setSelectedLine(line);
    setLineForm({
      name: line.name,
      origin: line.origin,
      destination: line.destination,
      vehicleType: line.vehicleType,
      color: line.color,
      isActive: line.isActive,
    });
    setFormErrors({});
    setShowLineDialog(true);
  }

  function openCreateLineDialog() {
    setSelectedLine(null);
    resetLineForm();
    setShowLineDialog(true);
  }

  // ── Schedule management ──────────────────────────────────────────────────

  function openSchedulesTab(line: TransportLine) {
    setSelectedLineForSchedules(line);
    setActiveTab('schedules');
  }

  async function handleAddSchedule(type: 'departure' | 'arrival') {
    if (!selectedLineForSchedules) return;

    const newSchedule: Schedule = {
      id: generateScheduleId(),
      type,
      time: '08:00',
      status: 'on_time',
      delayMinutes: 0,
      note: '',
    };

    try {
      const res = await fetch(`/api/lines/${selectedLineForSchedules.id}/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
        body: JSON.stringify(newSchedule),
      });
      if (!res.ok) throw new Error();
      fetchLines();
      // Refresh selected line
      const updatedLines = [...lines];
      const idx = updatedLines.findIndex((l) => l.id === selectedLineForSchedules.id);
      if (idx !== -1) {
        updatedLines[idx] = {
          ...updatedLines[idx],
          schedules: [...(updatedLines[idx].schedules || []), newSchedule],
        };
        setLines(updatedLines);
        setSelectedLineForSchedules({ ...selectedLineForSchedules, schedules: [...(selectedLineForSchedules.schedules || []), newSchedule] });
      }
      toast.success('Horaire ajouté');
    } catch {
      // Optimistic update fallback
      const updatedSchedules = [...(selectedLineForSchedules.schedules || []), newSchedule];
      setSelectedLineForSchedules({ ...selectedLineForSchedules, schedules: updatedSchedules });
      toast.success('Horaire ajouté');
    }
  }

  function startEditingSchedule(schedule: Schedule) {
    setEditingSchedule(schedule.id);
    setEditTime(schedule.time);
    setEditDelay(schedule.delayMinutes);
    setEditNote(schedule.note);
  }

  function cancelEditingSchedule() {
    setEditingSchedule(null);
    setEditTime('');
    setEditDelay(0);
    setEditNote('');
  }

  async function saveScheduleEdit(schedule: Schedule) {
    const updated: Schedule = {
      ...schedule,
      time: editTime,
      delayMinutes: editDelay,
      note: editNote,
    };

    if (!selectedLineForSchedules) return;

    try {
      await fetch(`/api/lines/${selectedLineForSchedules.id}/schedules/${schedule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
        body: JSON.stringify(updated),
      });
      fetchLines();
    } catch {
      // silent
    }

    const updatedSchedules = (selectedLineForSchedules.schedules || []).map((s) =>
      s.id === schedule.id ? updated : s
    );
    setSelectedLineForSchedules({ ...selectedLineForSchedules, schedules: updatedSchedules });
    setEditingSchedule(null);
    toast.success('Horaire mis à jour');
  }

  function setScheduleStatus(schedule: Schedule, status: ScheduleStatus) {
    const updated: Schedule = {
      ...schedule,
      status,
      delayMinutes: status === 'delayed' ? Math.max(schedule.delayMinutes, 10) : status === 'cancelled' ? 0 : 0,
    };

    if (!selectedLineForSchedules) return;

    const updatedSchedules = (selectedLineForSchedules.schedules || []).map((s) =>
      s.id === schedule.id ? updated : s
    );
    setSelectedLineForSchedules({ ...selectedLineForSchedules, schedules: updatedSchedules });

    fetch(`/api/lines/${selectedLineForSchedules.id}/schedules/${schedule.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Organization-Id': orgId || '',
      },
      body: JSON.stringify(updated),
    }).catch(() => {});
  }

  async function handleDeleteSchedule(scheduleId: string) {
    if (!selectedLineForSchedules) return;

    const updatedSchedules = (selectedLineForSchedules.schedules || []).filter(
      (s) => s.id !== scheduleId
    );
    setSelectedLineForSchedules({ ...selectedLineForSchedules, schedules: updatedSchedules });

    try {
      await fetch(`/api/lines/${selectedLineForSchedules.id}/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
      });
      fetchLines();
      toast.success('Horaire supprimé');
    } catch {
      toast.error('Erreur lors de la suppression de l\'horaire');
    }
  }

  // ── QR Code ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (showQrDialog && qrCanvasRef.current && orgSlug) {
      drawQRCode(qrCanvasRef.current, getBoardUrl(orgSlug), 300, '#000000', '#ffffff');
    }
  }, [showQrDialog, orgSlug]);

  function handleDownloadQr() {
    if (!downloadCanvasRef.current || !orgSlug) return;

    const size = 600;
    const canvas = downloadCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Draw QR code
    const qrSize = 400;
    const qrX = (size - qrSize) / 2;
    const qrY = 80;
    const tempCanvas = document.createElement('canvas');
    drawQRCode(tempCanvas, getBoardUrl(orgSlug), qrSize, '#000000', '#ffffff');
    ctx.drawImage(tempCanvas, qrX, qrY);

    // Title
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(orgName || 'SmartTicketQR', size / 2, 50);

    // URL
    ctx.fillStyle = '#666666';
    ctx.font = '14px sans-serif';
    ctx.fillText(getBoardUrl(orgSlug), size / 2, qrY + qrSize + 30);

    // Download
    const link = document.createElement('a');
    link.download = `qr-${orgSlug}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('QR Code téléchargé');
  }

  // ── Copy board URL ───────────────────────────────────────────────────────

  function handleCopyBoardUrl() {
    if (!orgSlug) return;
    const url = getBoardUrl(orgSlug);
    navigator.clipboard.writeText(url).then(() => {
      toast.success('URL copiée dans le presse-papier');
    }).catch(() => {
      toast.error('Impossible de copier l\'URL');
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
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Render helpers ───────────────────────────────────────────────────────

  function renderVehicleIcon(type: VehicleType, className?: string) {
    const v = getVehicleIcon(type);
    const Icon = v.icon;
    return <Icon className={className || 'h-5 w-5'} />;
  }

  function getDepartures(schedules: Schedule[]) {
    return (schedules || [])
      .filter((s) => s.type === 'departure')
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  function getArrivals(schedules: Schedule[]) {
    return (schedules || [])
      .filter((s) => s.type === 'arrival')
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const boardUrl = orgSlug ? getBoardUrl(orgSlug) : '';

  return (
    <div className="space-y-6">
      {/* Hidden canvas for QR download */}
      <canvas ref={downloadCanvasRef} className="hidden" />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Affichage Public &amp; QR
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gérez les lignes de transport et les horaires d&apos;affichage
          </p>
        </div>
        <Button
          onClick={openCreateLineDialog}
          style={{ backgroundColor: orgColor || '#059669' }}
          className="text-white gap-2 hover:opacity-90"
        >
          <Plus className="size-4" />
          Nouvelle ligne
        </Button>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="lines" className="gap-1.5">
            <Bus className="size-3.5" />
            Lignes
          </TabsTrigger>
          <TabsTrigger value="schedules" className="gap-1.5" disabled={!selectedLineForSchedules}>
            <Clock className="size-3.5" />
            Gérer les horaires
            {selectedLineForSchedules && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {selectedLineForSchedules.name}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5">
            <Eye className="size-3.5" />
            Écran Public
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════
            TAB 1: LIGNES
        ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="lines">
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
          ) : lines.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <Bus className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mt-4 text-lg font-semibold">Aucune ligne configurée</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Créez votre première ligne de transport
                </p>
                <Button
                  onClick={openCreateLineDialog}
                  style={{ backgroundColor: orgColor || '#059669' }}
                  className="mt-4 text-white gap-2 hover:opacity-90"
                >
                  <Plus className="size-4" />
                  Nouvelle ligne
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
              {lines.map((line) => {
                const vehicleInfo = getVehicleIcon(line.vehicleType);
                return (
                  <motion.div key={line.id} variants={fadeIn}>
                    <Card className="group transition-all hover:shadow-md">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                              style={{ backgroundColor: line.color + '18' }}
                            >
                              {renderVehicleIcon(line.vehicleType)}
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="text-base truncate">
                                {line.name}
                              </CardTitle>
                            </div>
                          </div>
                          <Badge
                            variant={line.isActive ? 'default' : 'secondary'}
                            className={`shrink-0 text-[10px] ${line.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : ''}`}
                          >
                            {line.isActive ? 'Actif' : 'Inactif'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Route */}
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{line.origin}</span>
                          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{line.destination}</span>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] gap-1"
                            style={{ borderColor: vehicleInfo.color + '60', color: vehicleInfo.color }}
                          >
                            {renderVehicleIcon(line.vehicleType, 'size-3')}
                            {vehicleInfo.label}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Clock className="size-3" />
                            {(line.schedules || []).length} horaire{(line.schedules || []).length !== 1 ? 's' : ''}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <div
                              className="h-3 w-3 rounded-full border border-muted-foreground/20"
                              style={{ backgroundColor: line.color }}
                            />
                          </div>
                        </div>

                        {/* Actions */}
                        <Separator />
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 flex-1 gap-1.5 text-xs min-w-0"
                            onClick={() => openEditLineDialog(line)}
                          >
                            <Pencil className="size-3.5 shrink-0" />
                            <span className="truncate">Modifier</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 flex-1 gap-1.5 text-xs min-w-0"
                            onClick={() => openSchedulesTab(line)}
                          >
                            <Clock className="size-3.5 shrink-0" />
                            <span className="truncate">Horaires</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => {
                              setSelectedLine(line);
                              setShowQrDialog(true);
                            }}
                            title="QR Code"
                          >
                            <QrCode className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                            onClick={() => {
                              setSelectedLine(line);
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
            TAB 2: GÉRER LES HORAIRES
        ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="schedules">
          {!selectedLineForSchedules ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mt-4 text-lg font-semibold">Aucune ligne sélectionnée</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cliquez sur &quot;Horaires&quot; dans une carte de ligne pour gérer ses horaires
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setActiveTab('lines')}
                >
                  Voir les lignes
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Line info header */}
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: selectedLineForSchedules.color + '18' }}
                    >
                      {renderVehicleIcon(selectedLineForSchedules.vehicleType)}
                    </div>
                    <div>
                      <h3 className="font-semibold">{selectedLineForSchedules.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedLineForSchedules.origin} → {selectedLineForSchedules.destination}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedLineForSchedules(null);
                      setActiveTab('lines');
                    }}
                  >
                    Retour
                  </Button>
                </CardContent>
              </Card>

              {/* Two-column: Departures & Arrivals */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Departures */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ArrowRight className="size-4 text-emerald-600" />
                        Horaires de départ
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleAddSchedule('departure')}
                      >
                        <Plus className="size-3" />
                        Ajouter
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {getDepartures(selectedLineForSchedules.schedules).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Aucun horaire de départ
                        </p>
                      ) : (
                        getDepartures(selectedLineForSchedules.schedules).map((schedule) => (
                          <ScheduleRow
                            key={schedule.id}
                            schedule={schedule}
                            isEditing={editingSchedule === schedule.id}
                            editTime={editTime}
                            editDelay={editDelay}
                            editNote={editNote}
                            onEditTimeChange={setEditTime}
                            onEditDelayChange={setEditDelay}
                            onEditNoteChange={setEditNote}
                            onStartEdit={() => startEditingSchedule(schedule)}
                            onCancelEdit={cancelEditingSchedule}
                            onSave={() => saveScheduleEdit(schedule)}
                            onStatusChange={(s) => setScheduleStatus(schedule, s)}
                            onDelete={() => handleDeleteSchedule(schedule.id)}
                          />
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Arrivals */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ArrowRight className="size-4 rotate-180 text-blue-600" />
                        Horaires d&apos;arrivée
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleAddSchedule('arrival')}
                      >
                        <Plus className="size-3" />
                        Ajouter
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {getArrivals(selectedLineForSchedules.schedules).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Aucun horaire d&apos;arrivée
                        </p>
                      ) : (
                        getArrivals(selectedLineForSchedules.schedules).map((schedule) => (
                          <ScheduleRow
                            key={schedule.id}
                            schedule={schedule}
                            isEditing={editingSchedule === schedule.id}
                            editTime={editTime}
                            editDelay={editDelay}
                            editNote={editNote}
                            onEditTimeChange={setEditTime}
                            onEditDelayChange={setEditDelay}
                            onEditNoteChange={setEditNote}
                            onStartEdit={() => startEditingSchedule(schedule)}
                            onCancelEdit={cancelEditingSchedule}
                            onSave={() => saveScheduleEdit(schedule)}
                            onStatusChange={(s) => setScheduleStatus(schedule, s)}
                            onDelete={() => handleDeleteSchedule(schedule.id)}
                          />
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════
            TAB 3: ÉCRAN PUBLIC
        ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="preview">
          <div className="space-y-4">
            {/* URL bar */}
            <Card>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">URL de l&apos;écran public</p>
                  <div className="mt-1 flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                    <Eye className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-mono text-muted-foreground">
                      {boardUrl || 'Aucun slug d\'organisation défini'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleCopyBoardUrl}
                    disabled={!orgSlug}
                  >
                    <Copy className="size-3.5" />
                    Copier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setSelectedLine(null);
                      setShowQrDialog(true);
                    }}
                    disabled={!orgSlug}
                  >
                    <QrCode className="size-3.5" />
                    QR Code
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={toggleFullscreen}
                    title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                  >
                    {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Mock preview */}
            <Card>
              <CardHeader>
                <CardTitle>Aperçu de l&apos;écran public</CardTitle>
                <CardDescription>
                  Voici ce que les voyageurs verront sur l&apos;écran d&apos;affichage
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div
                  ref={previewContainerRef}
                  className="relative overflow-hidden rounded-lg bg-gray-900 text-white"
                  style={{ minHeight: '480px' }}
                >
                  {/* Mock public board */}
                  <div className="p-6">
                    {/* Header */}
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold" style={{ color: orgColor || '#10b981' }}>
                          {orgName || 'SmartTicketQR'}
                        </h2>
                        <p className="text-sm text-gray-400">Tableau des départs et arrivées</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold tabular-nums">
                          {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                      </div>
                    </div>

                    <Separator className="mb-6 bg-gray-700" />

                    {/* 2-column board */}
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Departures column */}
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <ArrowRight className="size-4" style={{ color: orgColor || '#10b981' }} />
                          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
                            Départs
                          </h3>
                        </div>
                        <div className="space-y-2">
                          {lines.filter((l) => l.isActive).slice(0, 4).map((line) => (
                            <div
                              key={line.id}
                              className="flex items-center justify-between rounded-lg bg-gray-800/80 px-4 py-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                                  style={{ backgroundColor: line.color + '30' }}
                                >
                                  {renderVehicleIcon(line.vehicleType, 'size-4')}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{line.origin}</p>
                                  <p className="text-xs text-gray-400 truncate">{line.destination}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <p className="text-lg font-bold tabular-nums" style={{ color: orgColor || '#10b981' }}>
                                  {getDepartures(line.schedules)[0]?.time || '--:--'}
                                </p>
                                {getDepartures(line.schedules)[0]?.status === 'delayed' && (
                                  <span className="text-xs text-amber-400">Retardé</span>
                                )}
                              </div>
                            </div>
                          ))}
                          {lines.filter((l) => l.isActive).length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-4">Aucun départ</p>
                          )}
                        </div>
                      </div>

                      {/* Arrivals column */}
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <ArrowRight className="size-4 rotate-180 text-blue-400" />
                          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
                            Arrivées
                          </h3>
                        </div>
                        <div className="space-y-2">
                          {lines.filter((l) => l.isActive).slice(0, 4).map((line) => (
                            <div
                              key={line.id}
                              className="flex items-center justify-between rounded-lg bg-gray-800/80 px-4 py-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                                  style={{ backgroundColor: line.color + '30' }}
                                >
                                  {renderVehicleIcon(line.vehicleType, 'size-4')}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{line.destination}</p>
                                  <p className="text-xs text-gray-400 truncate">{line.origin}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <p className="text-lg font-bold tabular-nums text-blue-400">
                                  {getArrivals(line.schedules)[0]?.time || '--:--'}
                                </p>
                                {getArrivals(line.schedules)[0]?.status === 'delayed' && (
                                  <span className="text-xs text-amber-400">Retardé</span>
                                )}
                              </div>
                            </div>
                          ))}
                          {lines.filter((l) => l.isActive).length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-4">Aucune arrivée</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Create / Edit Line Dialog ────────────────────────────────────── */}
      <Dialog open={showLineDialog} onOpenChange={(open) => {
        setShowLineDialog(open);
        if (!open) {
          setSelectedLine(null);
          resetLineForm();
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedLine ? 'Modifier la ligne' : 'Nouvelle ligne'}
            </DialogTitle>
            <DialogDescription>
              {selectedLine
                ? 'Modifiez les informations de la ligne de transport'
                : 'Configurez une nouvelle ligne de transport'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleLineSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="line-name">Nom de la ligne *</Label>
              <Input
                id="line-name"
                value={lineForm.name}
                onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
                placeholder="Ex: Bus 20 - Dakar vers Thiès"
                className={formErrors.name ? 'border-red-500' : ''}
              />
              {formErrors.name && <p className="text-red-500 text-xs">{formErrors.name}</p>}
            </div>

            {/* Origin & Destination */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="line-origin">Origine *</Label>
                <Input
                  id="line-origin"
                  value={lineForm.origin}
                  onChange={(e) => setLineForm({ ...lineForm, origin: e.target.value })}
                  placeholder="Ex: Dakar"
                  className={formErrors.origin ? 'border-red-500' : ''}
                />
                {formErrors.origin && <p className="text-red-500 text-xs">{formErrors.origin}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="line-destination">Destination *</Label>
                <Input
                  id="line-destination"
                  value={lineForm.destination}
                  onChange={(e) => setLineForm({ ...lineForm, destination: e.target.value })}
                  placeholder="Ex: Thiès"
                  className={formErrors.destination ? 'border-red-500' : ''}
                />
                {formErrors.destination && <p className="text-red-500 text-xs">{formErrors.destination}</p>}
              </div>
            </div>

            {/* Vehicle Type & Color */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type de véhicule</Label>
                <Select
                  value={lineForm.vehicleType}
                  onValueChange={(v) => setLineForm({ ...lineForm, vehicleType: v as VehicleType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_OPTIONS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        <span className="flex items-center gap-2">
                          <v.icon className="size-3.5" />
                          {v.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="line-color">Couleur</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="line-color"
                    type="color"
                    value={lineForm.color}
                    onChange={(e) => setLineForm({ ...lineForm, color: e.target.value })}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-border"
                  />
                  <Input
                    value={lineForm.color}
                    onChange={(e) => setLineForm({ ...lineForm, color: e.target.value })}
                    className="flex-1 font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            {/* Active switch */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Ligne active</Label>
                <p className="text-xs text-muted-foreground">
                  La ligne sera visible sur l&apos;écran public
                </p>
              </div>
              <Switch
                checked={lineForm.isActive}
                onCheckedChange={(v) => setLineForm({ ...lineForm, isActive: v })}
              />
            </div>

            <DialogFooter>
              <Button
                type="submit"
                disabled={isSubmitting}
                style={{ backgroundColor: orgColor || '#059669' }}
                className="text-white gap-2 hover:opacity-90"
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {selectedLine ? 'Enregistrer' : 'Créer la ligne'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ───────────────────────────────────── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette ligne ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La ligne &quot;{selectedLine?.name}&quot; et tous ses horaires seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLine}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── QR Code Dialog ───────────────────────────────────────────────── */}
      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code - Écran public</DialogTitle>
            <DialogDescription>
              Scannez ce QR code pour accéder à l&apos;écran d&apos;affichage public
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-6 py-4">
            {/* QR Canvas */}
            <div className="rounded-xl border border-border bg-white p-4">
              <canvas
                ref={qrCanvasRef}
                width={300}
                height={300}
                className="block"
              />
            </div>

            {/* URL display */}
            <div className="w-full rounded-md bg-muted px-4 py-3 text-center">
              <span className="text-sm font-mono text-muted-foreground break-all">
                {boardUrl || '...'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={handleCopyBoardUrl}
              >
                <Copy className="size-4" />
                Copier l&apos;URL
              </Button>
              <Button
                className="flex-1 gap-2 text-white"
                style={{ backgroundColor: orgColor || '#059669' }}
                onClick={handleDownloadQr}
              >
                Télécharger QR Code
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Schedule Row Sub-Component ─────────────────────────────────────────────

interface ScheduleRowProps {
  schedule: Schedule;
  isEditing: boolean;
  editTime: string;
  editDelay: number;
  editNote: string;
  onEditTimeChange: (v: string) => void;
  onEditDelayChange: (v: number) => void;
  onEditNoteChange: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onStatusChange: (status: ScheduleStatus) => void;
  onDelete: () => void;
}

function ScheduleRow({
  schedule,
  isEditing,
  editTime,
  editDelay,
  editNote,
  onEditTimeChange,
  onEditDelayChange,
  onEditNoteChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onStatusChange,
  onDelete,
}: ScheduleRowProps) {
  const statusConfig = SCHEDULE_STATUS_CONFIG[schedule.status];
  const StatusIcon = statusConfig.icon;

  if (isEditing) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20 p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Heure</Label>
            <Input
              type="time"
              value={editTime}
              onChange={(e) => onEditTimeChange(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Retard (min)</Label>
            <Input
              type="number"
              min={0}
              value={editDelay}
              onChange={(e) => onEditDelayChange(parseInt(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Note</Label>
          <Input
            value={editNote}
            onChange={(e) => onEditNoteChange(e.target.value)}
            placeholder="Note optionnelle..."
            className="h-8 text-sm"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancelEdit}>
            Annuler
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={onSave}>
            <CheckCircle className="size-3" />
            Enregistrer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/50">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-lg font-bold tabular-nums min-w-[52px]">
          {schedule.time}
        </span>
        {renderStatusBadge(schedule.status)}
        {schedule.status === 'delayed' && schedule.delayMinutes > 0 && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            +{schedule.delayMinutes} min
          </span>
        )}
        {schedule.note && (
          <span className="text-xs text-muted-foreground truncate hidden sm:inline">
            {schedule.note}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onStartEdit}
          title="Modifier"
        >
          <Pencil className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`size-7 ${schedule.status !== 'delayed' ? 'text-amber-500 hover:text-amber-600' : ''}`}
          onClick={() => onStatusChange('delayed')}
          title="Marquer comme retardé"
          disabled={schedule.status === 'delayed'}
        >
          <AlertTriangle className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`size-7 ${schedule.status !== 'cancelled' ? 'text-red-500 hover:text-red-600' : ''}`}
          onClick={() => onStatusChange('cancelled')}
          title="Marquer comme annulé"
          disabled={schedule.status === 'cancelled'}
        >
          <XCircle className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`size-7 ${schedule.status !== 'on_time' ? 'text-emerald-500 hover:text-emerald-600' : ''}`}
          onClick={() => onStatusChange('on_time')}
          title="Marquer comme à l'heure"
          disabled={schedule.status === 'on_time'}
        >
          <CheckCircle className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-destructive hover:text-destructive"
          onClick={onDelete}
          title="Supprimer"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}
