'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ── Stores & Auth ───────────────────────────────────────────────────────────
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import RoleGate from '@/components/smart-ticket/role-gate';

// ── shadcn/ui ───────────────────────────────────────────────────────────────
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

// ── Icons ───────────────────────────────────────────────────────────────────
import {
  Plus,
  Trash2,
  Loader2,
  Ticket,
  Gift,
  Tag,
  ArrowUpDown,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Percent,
  Banknote,
  Scale,
  Package,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface FareType {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  priceModifier: number;
  requiresProof: boolean;
  proofLabel: string | null;
  ageMin: number | null;
  ageMax: number | null;
  maxPerBooking: number;
  maxScans: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TicketExtra {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  pricingType: 'fixed' | 'per_unit' | 'per_kg';
  basePrice: number;
  requiresDetails: boolean;
  detailLabel: string | null;
  maxPerTicket: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PromoCode {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minTickets: number;
  validFrom: string;
  validUntil: string;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Form Data Types ─────────────────────────────────────────────────────────

interface FareTypeFormData {
  slug: string;
  name: string;
  emoji: string;
  priceModifier: number;
  requiresProof: boolean;
  proofLabel: string;
  ageMin: string;
  ageMax: string;
  maxPerBooking: string;
  maxScans: string;
}

interface TicketExtraFormData {
  slug: string;
  name: string;
  emoji: string;
  pricingType: string;
  basePrice: string;
  requiresDetails: boolean;
  detailLabel: string;
  maxPerTicket: string;
}

interface PromoCodeFormData {
  code: string;
  type: string;
  value: string;
  minTickets: string;
  validFrom: string;
  validUntil: string;
  maxUses: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const PRICING_TYPE_OPTIONS = [
  { value: 'fixed', label: 'Prix fixe', description: 'Montant fixe par ajout' },
  { value: 'per_unit', label: 'Par unité', description: 'Prix par unité supplémentaire' },
  { value: 'per_kg', label: 'Par kg', description: 'Prix par kilogramme' },
];

const PROMO_TYPE_OPTIONS = [
  { value: 'percentage', label: 'Pourcentage (%)', icon: <Percent className="size-4" /> },
  { value: 'fixed', label: 'Montant fixe (FCFA)', icon: <Banknote className="size-4" /> },
];

const EMOJI_SUGGESTIONS = ['🎫', '🧒', '👴', '🎓', '♿', '👨‍👩‍👧‍👦', '🪖', '🏥', '🧳', '📦', '🌟', '🛡️', '🎪', '🎵', '🎯', '💎'];

// ── Helpers ─────────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  const token = useAuthStore.getState().token;
  const orgId = useOrgStore.getState().currentOrganization?.id;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'X-Organization-Id': orgId || '',
  };
}

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FCFA';
}

function formatPriceModifier(modifier: number): { text: string; color: string } {
  if (modifier === 1) return { text: 'Plein tarif', color: 'text-foreground' };
  if (modifier < 1) {
    const pct = Math.round((1 - modifier) * 100);
    return { text: `-${pct}%`, color: 'text-emerald-600 dark:text-emerald-400' };
  }
  const pct = Math.round((modifier - 1) * 100);
  return { text: `+${pct}%`, color: 'text-amber-600 dark:text-amber-400' };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function getStatusBadge(isActive: boolean) {
  return (
    <Badge
      variant="outline"
      className={
        isActive
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
          : 'border-muted bg-muted/50 text-muted-foreground'
      }
    >
      {isActive ? <CheckCircle2 className="mr-1 size-3" /> : <AlertCircle className="mr-1 size-3" />}
      {isActive ? 'Actif' : 'Inactif'}
    </Badge>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export default function TicketingConfigPage() {
  return (
    <RoleGate permission="settings.edit" redirectTo="dashboard">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Configuration Tarification
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gérez les types de tarif, options supplémentaires et codes promo pour vos événements
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="fare-types" className="w-full">
          <TabsList className="w-full sm:w-auto overflow-x-auto">
            <TabsTrigger value="fare-types" className="gap-1.5">
              <Tag className="size-3.5" />
              Types de Tarif
            </TabsTrigger>
            <TabsTrigger value="ticket-extras" className="gap-1.5">
              <Package className="size-3.5" />
              Options Supplémentaires
            </TabsTrigger>
            <TabsTrigger value="promo-codes" className="gap-1.5">
              <Gift className="size-3.5" />
              Codes Promo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fare-types" className="mt-6">
            <FareTypesTab />
          </TabsContent>

          <TabsContent value="ticket-extras" className="mt-6">
            <TicketExtrasTab />
          </TabsContent>

          <TabsContent value="promo-codes" className="mt-6">
            <PromoCodesTab />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGate>
  );
}

// ── Fare Types Tab ──────────────────────────────────────────────────────────

const INITIAL_FARE_FORM: FareTypeFormData = {
  slug: '',
  name: '',
  emoji: '🎫',
  priceModifier: 1,
  requiresProof: false,
  proofLabel: '',
  ageMin: '',
  ageMax: '',
  maxPerBooking: '10',
  maxScans: '1',
};

function FareTypesTab() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState<FareTypeFormData>(INITIAL_FARE_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FareTypeFormData, string>>>({});

  // ── Query
  const { data: fareTypes = [], isLoading, isError } = useQuery<FareType[]>({
    queryKey: ['fare-types'],
    queryFn: async () => {
      const res = await fetch('/api/fare-types', { headers: getAuthHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch fare types');
      }
      const json = await res.json();
      return json.data as FareType[];
    },
  });

  // ── Create Mutation
  const createMutation = useMutation({
    mutationFn: async (data: FareTypeFormData) => {
      const body = {
        slug: data.slug,
        name: data.name,
        emoji: data.emoji,
        priceModifier: data.priceModifier,
        requiresProof: data.requiresProof,
        proofLabel: data.proofLabel || null,
        ageMin: data.ageMin ? parseInt(data.ageMin, 10) : null,
        ageMax: data.ageMax ? parseInt(data.ageMax, 10) : null,
        maxPerBooking: parseInt(data.maxPerBooking, 10) || 10,
        maxScans: parseInt(data.maxScans, 10) || 1,
      };
      const res = await fetch('/api/fare-types', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create fare type');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fare-types'] });
      toast.success('Type de tarif créé avec succès');
      setShowCreateDialog(false);
      setFormData(INITIAL_FARE_FORM);
      setFormErrors({});
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ── Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/fare-types/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete fare type');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fare-types'] });
      toast.success('Type de tarif supprimé');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ── Toggle Active Mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/fare-types/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update fare type');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fare-types'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ── Validation
  function validateForm(data: FareTypeFormData): boolean {
    const errors: Partial<Record<keyof FareTypeFormData, string>> = {};
    if (!data.name.trim()) errors.name = 'Le nom est requis';
    if (!data.slug.trim()) errors.slug = 'Le slug est requis';
    if (data.priceModifier < 0) errors.priceModifier = 'Le modificateur doit être ≥ 0';
    if (data.maxPerBooking && parseInt(data.maxPerBooking, 10) < 1) errors.maxPerBooking = 'Minimum 1';
    if (data.maxScans && (parseInt(data.maxScans, 10) < 1 || parseInt(data.maxScans, 10) > 10)) errors.maxScans = 'Entre 1 et 10';
    if (data.requiresProof && !data.proofLabel.trim()) errors.proofLabel = 'Le libellé de justification est requis';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validateForm(formData)) {
      createMutation.mutate(formData);
    }
  }

  function updateField<K extends keyof FareTypeFormData>(key: K, value: FareTypeFormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Auto-generate slug from name
    if (key === 'name') {
      setFormData((prev) => ({ ...prev, slug: slugify(value as string) }));
    }
  }

  // ── Render
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
            <Tag className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Types de Tarif</h2>
            <p className="text-xs text-muted-foreground">
              {fareTypes.length} type{fareTypes.length !== 1 ? 's' : ''} configuré{fareTypes.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setFormData(INITIAL_FARE_FORM);
            setFormErrors({});
            setShowCreateDialog(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          <Plus className="size-4" />
          Ajouter
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : isError ? (
        <ErrorState message="Impossible de charger les types de tarif" />
      ) : fareTypes.length === 0 ? (
        <EmptyState
          icon={<Tag className="size-10 text-muted-foreground/40" />}
          title="Aucun type de tarif"
          description="Créez votre premier type de tarif pour commencer."
          actionLabel="Ajouter un type de tarif"
          onAction={() => setShowCreateDialog(true)}
        />
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="space-y-3 lg:hidden">
            {fareTypes.map((ft) => {
              const pm = formatPriceModifier(ft.priceModifier);
              return (
                <Card key={ft.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{ft.emoji}</span>
                      <div>
                        <p className="font-medium">{ft.name}</p>
                        <p className="text-xs text-muted-foreground">{ft.slug}</p>
                      </div>
                    </div>
                    {getStatusBadge(ft.isActive)}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Modificateur</p>
                      <p className={`font-semibold ${pm.color}`}>{pm.text}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Justification</p>
                      <p className="font-medium">{ft.requiresProof ? `Oui — ${ft.proofLabel || '—'}` : 'Non'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tranche d&apos;âge</p>
                      <p className="font-medium">
                        {ft.ageMin ?? 0}–{ft.ageMax ?? 99} ans
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Max/réservation</p>
                      <p className="font-medium">{ft.maxPerBooking}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Scans max</p>
                      <p className="font-medium">{ft.maxScans} {ft.maxScans > 1 ? '(aller-retour)' : '(simple)'}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <Switch
                      checked={ft.isActive}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: ft.id, isActive: checked })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-8 gap-1"
                      onClick={() => deleteMutation.mutate(ft.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="size-3.5" />
                      Supprimer
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop Table */}
          <Card className="hidden lg:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Emoji</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="text-center">
                      <ArrowUpDown className="inline size-3 mr-1" />
                      Prix
                    </TableHead>
                    <TableHead>Justification</TableHead>
                    <TableHead>Tranche d&apos;âge</TableHead>
                    <TableHead className="text-center">Max/résa</TableHead>
                    <TableHead className="text-center">Scans max</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fareTypes.map((ft) => {
                    const pm = formatPriceModifier(ft.priceModifier);
                    return (
                      <TableRow key={ft.id}>
                        <TableCell className="text-center text-xl">{ft.emoji}</TableCell>
                        <TableCell className="font-medium">{ft.name}</TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{ft.slug}</code>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-semibold ${pm.color}`}>{pm.text}</span>
                        </TableCell>
                        <TableCell>
                          {ft.requiresProof ? (
                            <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                              Oui — {ft.proofLabel}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Non</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {ft.ageMin ?? 0}–{ft.ageMax ?? 99} ans
                        </TableCell>
                        <TableCell className="text-center font-medium">{ft.maxPerBooking}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={ft.maxScans > 1 ? 'outline' : 'secondary'} className={ft.maxScans > 1 ? 'border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-400' : ''}>
                            {ft.maxScans}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{getStatusBadge(ft.isActive)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Switch
                              checked={ft.isActive}
                              onCheckedChange={(checked) =>
                                toggleMutation.mutate({ id: ft.id, isActive: checked })
                              }
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive h-8 w-8 p-0"
                              onClick={() => deleteMutation.mutate(ft.id)}
                              disabled={deleteMutation.isPending}
                            >
                              {deleteMutation.isPending ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          setFormData(INITIAL_FARE_FORM);
          setFormErrors({});
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau Type de Tarif</DialogTitle>
            <DialogDescription>
              Créez une catégorie de tarif (enfant, étudiant, senior, etc.)
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Emoji Picker */}
            <div className="space-y-2">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_SUGGESTIONS.slice(0, 8).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => updateField('emoji', e)}
                    className={`rounded-lg border-2 p-1.5 text-lg transition-all ${
                      formData.emoji === e
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                        : 'border-transparent hover:border-muted-foreground/30'
                    }`}
                  >
                    {e}
                  </button>
                ))}
                <div className="flex items-center">
                  <Input
                    type="text"
                    maxLength={2}
                    value={formData.emoji}
                    onChange={(e) => updateField('emoji', e.target.value)}
                    className="w-12 h-10 text-center text-lg p-0"
                    placeholder="🎫"
                  />
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="fare-name">Nom *</Label>
              <Input
                id="fare-name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Ex: Enfant, Étudiant, Senior"
                className={formErrors.name ? 'border-red-500' : ''}
              />
              {formErrors.name && <p className="text-red-500 text-xs">{formErrors.name}</p>}
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="fare-slug">Slug *</Label>
              <Input
                id="fare-slug"
                value={formData.slug}
                onChange={(e) => updateField('slug', e.target.value)}
                placeholder="enfant"
                className={`font-mono text-sm ${formErrors.slug ? 'border-red-500' : ''}`}
              />
              {formErrors.slug && <p className="text-red-500 text-xs">{formErrors.slug}</p>}
            </div>

            {/* Price Modifier */}
            <div className="space-y-2">
              <Label htmlFor="fare-price-modifier">
                Modificateur de prix *
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateField('priceModifier', 0.5)}
                  className={formData.priceModifier === 0.5 ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950' : ''}
                >
                  <Percent className="size-3 mr-1" />
                  -50%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateField('priceModifier', 1)}
                  className={formData.priceModifier === 1 ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950' : ''}
                >
                  100%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateField('priceModifier', 2)}
                  className={formData.priceModifier === 2 ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950' : ''}
                >
                  <Percent className="size-3 mr-1" />
                  +100%
                </Button>
              </div>
              <Input
                id="fare-price-modifier"
                type="number"
                step="0.01"
                min="0"
                value={formData.priceModifier}
                onChange={(e) => updateField('priceModifier', parseFloat(e.target.value) || 1)}
                placeholder="1.00 = plein tarif"
                className={formErrors.priceModifier ? 'border-red-500' : ''}
              />
              <p className="text-xs text-muted-foreground">
                0.80 = -20%, 1.00 = plein tarif, 1.50 = +50%
              </p>
              {formErrors.priceModifier && <p className="text-red-500 text-xs">{formErrors.priceModifier}</p>}
            </div>

            {/* Age Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fare-age-min">Âge minimum</Label>
                <Input
                  id="fare-age-min"
                  type="number"
                  min="0"
                  max="99"
                  value={formData.ageMin}
                  onChange={(e) => updateField('ageMin', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fare-age-max">Âge maximum</Label>
                <Input
                  id="fare-age-max"
                  type="number"
                  min="0"
                  max="99"
                  value={formData.ageMax}
                  onChange={(e) => updateField('ageMax', e.target.value)}
                  placeholder="99"
                />
              </div>
            </div>

            {/* Max Per Booking */}
            <div className="space-y-2">
              <Label htmlFor="fare-max-booking">Maximum par réservation</Label>
              <Input
                id="fare-max-booking"
                type="number"
                min="1"
                max="100"
                value={formData.maxPerBooking}
                onChange={(e) => updateField('maxPerBooking', e.target.value)}
                placeholder="10"
                className={formErrors.maxPerBooking ? 'border-red-500' : ''}
              />
              {formErrors.maxPerBooking && <p className="text-red-500 text-xs">{formErrors.maxPerBooking}</p>}
            </div>

            {/* Max Scans */}
            <div className="space-y-2">
              <Label htmlFor="fare-max-scans">Nombre de scans max</Label>
              <Input
                id="fare-max-scans"
                type="number"
                min="1"
                max="10"
                value={formData.maxScans}
                onChange={(e) => updateField('maxScans', e.target.value)}
                placeholder="1"
                className={formErrors.maxScans ? 'border-red-500' : ''}
              />
              <p className="text-xs text-muted-foreground">
                1 = billet simple, 2 = aller-retour
              </p>
              {formErrors.maxScans && <p className="text-red-500 text-xs">{formErrors.maxScans}</p>}
            </div>

            {/* Requires Proof */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Nécessite une justification</p>
                <p className="text-xs text-muted-foreground">Ex: carte étudiant, passeport</p>
              </div>
              <Switch
                checked={formData.requiresProof}
                onCheckedChange={(checked) => updateField('requiresProof', checked)}
              />
            </div>

            {formData.requiresProof && (
              <div className="space-y-2">
                <Label htmlFor="fare-proof-label">Libellé de la justification *</Label>
                <Input
                  id="fare-proof-label"
                  value={formData.proofLabel}
                  onChange={(e) => updateField('proofLabel', e.target.value)}
                  placeholder="Ex: Carte d'étudiant"
                  className={formErrors.proofLabel ? 'border-red-500' : ''}
                />
                {formErrors.proofLabel && <p className="text-red-500 text-xs">{formErrors.proofLabel}</p>}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Ticket Extras Tab ───────────────────────────────────────────────────────

const INITIAL_EXTRA_FORM: TicketExtraFormData = {
  slug: '',
  name: '',
  emoji: '📦',
  pricingType: 'fixed',
  basePrice: '0',
  requiresDetails: false,
  detailLabel: '',
  maxPerTicket: '1',
};

function TicketExtrasTab() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState<TicketExtraFormData>(INITIAL_EXTRA_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof TicketExtraFormData, string>>>({});

  // ── Query
  const { data: extras = [], isLoading, isError } = useQuery<TicketExtra[]>({
    queryKey: ['ticket-extras'],
    queryFn: async () => {
      const res = await fetch('/api/ticket-extras', { headers: getAuthHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch ticket extras');
      }
      const json = await res.json();
      return json.data as TicketExtra[];
    },
  });

  // ── Create Mutation
  const createMutation = useMutation({
    mutationFn: async (data: TicketExtraFormData) => {
      const body = {
        slug: data.slug,
        name: data.name,
        emoji: data.emoji,
        pricingType: data.pricingType,
        basePrice: parseFloat(data.basePrice) || 0,
        requiresDetails: data.requiresDetails,
        detailLabel: data.detailLabel || null,
        maxPerTicket: parseInt(data.maxPerTicket, 10) || 1,
      };
      const res = await fetch('/api/ticket-extras', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create ticket extra');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-extras'] });
      toast.success('Option supplémentaire créée avec succès');
      setShowCreateDialog(false);
      setFormData(INITIAL_EXTRA_FORM);
      setFormErrors({});
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ── Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ticket-extras/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete ticket extra');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-extras'] });
      toast.success('Option supprimée');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ── Toggle Active Mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/ticket-extras/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update ticket extra');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-extras'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ── Validation
  function validateForm(data: TicketExtraFormData): boolean {
    const errors: Partial<Record<keyof TicketExtraFormData, string>> = {};
    if (!data.name.trim()) errors.name = 'Le nom est requis';
    if (!data.slug.trim()) errors.slug = 'Le slug est requis';
    if (data.basePrice && parseFloat(data.basePrice) < 0) errors.basePrice = 'Le prix doit être ≥ 0';
    if (data.maxPerTicket && parseInt(data.maxPerTicket, 10) < 1) errors.maxPerTicket = 'Minimum 1';
    if (data.requiresDetails && !data.detailLabel.trim()) errors.detailLabel = 'Le libellé du détail est requis';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validateForm(formData)) {
      createMutation.mutate(formData);
    }
  }

  function updateField<K extends keyof TicketExtraFormData>(key: K, value: TicketExtraFormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (key === 'name') {
      setFormData((prev) => ({ ...prev, slug: slugify(value as string) }));
    }
  }

  function getPricingTypeLabel(type: string): string {
    const opt = PRICING_TYPE_OPTIONS.find((o) => o.value === type);
    return opt?.label ?? type;
  }

  function getPricingTypeIcon(type: string) {
    switch (type) {
      case 'fixed':
        return <Banknote className="size-3.5" />;
      case 'per_unit':
        return <Package className="size-3.5" />;
      case 'per_kg':
        return <Scale className="size-3.5" />;
      default:
        return null;
    }
  }

  // ── Render
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
            <Package className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Options Supplémentaires</h2>
            <p className="text-xs text-muted-foreground">
              {extras.length} option{extras.length !== 1 ? 's' : ''} configurée{extras.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setFormData(INITIAL_EXTRA_FORM);
            setFormErrors({});
            setShowCreateDialog(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          <Plus className="size-4" />
          Ajouter
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : isError ? (
        <ErrorState message="Impossible de charger les options supplémentaires" />
      ) : extras.length === 0 ? (
        <EmptyState
          icon={<Package className="size-10 text-muted-foreground/40" />}
          title="Aucune option supplémentaire"
          description="Ajoutez des options payantes comme les bagages, assurances, etc."
          actionLabel="Ajouter une option"
          onAction={() => setShowCreateDialog(true)}
        />
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="space-y-3 lg:hidden">
            {extras.map((extra) => (
              <Card key={extra.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{extra.emoji}</span>
                    <div>
                      <p className="font-medium">{extra.name}</p>
                      <p className="text-xs text-muted-foreground">{extra.slug}</p>
                    </div>
                  </div>
                  {getStatusBadge(extra.isActive)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Type de prix</p>
                    <p className="font-medium flex items-center gap-1">
                      {getPricingTypeIcon(extra.pricingType)}
                      {getPricingTypeLabel(extra.pricingType)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Prix de base</p>
                    <p className="font-medium text-emerald-600 dark:text-emerald-400">
                      {formatFCFA(extra.basePrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Détails requis</p>
                    <p className="font-medium">
                      {extra.requiresDetails ? `Oui — ${extra.detailLabel || '—'}` : 'Non'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Max/billet</p>
                    <p className="font-medium">{extra.maxPerTicket}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <Switch
                    checked={extra.isActive}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: extra.id, isActive: checked })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive h-8 gap-1"
                    onClick={() => deleteMutation.mutate(extra.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="size-3.5" />
                    Supprimer
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop Table */}
          <Card className="hidden lg:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Emoji</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Type de prix</TableHead>
                    <TableHead className="text-right">Prix de base</TableHead>
                    <TableHead>Détails requis</TableHead>
                    <TableHead className="text-center">Max/billet</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extras.map((extra) => (
                    <TableRow key={extra.id}>
                      <TableCell className="text-center text-xl">{extra.emoji}</TableCell>
                      <TableCell className="font-medium">{extra.name}</TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{extra.slug}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {getPricingTypeIcon(extra.pricingType)}
                          {getPricingTypeLabel(extra.pricingType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {formatFCFA(extra.basePrice)}
                      </TableCell>
                      <TableCell>
                        {extra.requiresDetails ? (
                          <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                            {extra.detailLabel}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Non</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium">{extra.maxPerTicket}</TableCell>
                      <TableCell className="text-center">{getStatusBadge(extra.isActive)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={extra.isActive}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({ id: extra.id, isActive: checked })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive h-8 w-8 p-0"
                            onClick={() => deleteMutation.mutate(extra.id)}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          setFormData(INITIAL_EXTRA_FORM);
          setFormErrors({});
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle Option Supplémentaire</DialogTitle>
            <DialogDescription>
              Ajoutez un supplément payant (bagages, assurance, siège premium, etc.)
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Emoji Picker */}
            <div className="space-y-2">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_SUGGESTIONS.slice(8, 16).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => updateField('emoji', e)}
                    className={`rounded-lg border-2 p-1.5 text-lg transition-all ${
                      formData.emoji === e
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                        : 'border-transparent hover:border-muted-foreground/30'
                    }`}
                  >
                    {e}
                  </button>
                ))}
                <div className="flex items-center">
                  <Input
                    type="text"
                    maxLength={2}
                    value={formData.emoji}
                    onChange={(e) => updateField('emoji', e.target.value)}
                    className="w-12 h-10 text-center text-lg p-0"
                    placeholder="📦"
                  />
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="extra-name">Nom *</Label>
              <Input
                id="extra-name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Ex: Bagage supplémentaire, Assurance voyage"
                className={formErrors.name ? 'border-red-500' : ''}
              />
              {formErrors.name && <p className="text-red-500 text-xs">{formErrors.name}</p>}
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="extra-slug">Slug *</Label>
              <Input
                id="extra-slug"
                value={formData.slug}
                onChange={(e) => updateField('slug', e.target.value)}
                placeholder="bagage-supplementaire"
                className={`font-mono text-sm ${formErrors.slug ? 'border-red-500' : ''}`}
              />
              {formErrors.slug && <p className="text-red-500 text-xs">{formErrors.slug}</p>}
            </div>

            {/* Pricing Type */}
            <div className="space-y-2">
              <Label>Type de tarification</Label>
              <Select value={formData.pricingType} onValueChange={(v) => updateField('pricingType', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <span>{opt.label}</span>
                        <span className="text-muted-foreground text-xs">— {opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Base Price */}
            <div className="space-y-2">
              <Label htmlFor="extra-price">Prix de base (FCFA)</Label>
              <Input
                id="extra-price"
                type="number"
                min="0"
                step="100"
                value={formData.basePrice}
                onChange={(e) => updateField('basePrice', e.target.value)}
                placeholder="5000"
                className={formErrors.basePrice ? 'border-red-500' : ''}
              />
              <p className="text-xs text-muted-foreground">
                {formData.pricingType === 'per_kg'
                  ? 'Prix par kilogramme'
                  : formData.pricingType === 'per_unit'
                    ? 'Prix par unité'
                    : 'Montant fixe par ajout'}
              </p>
              {formErrors.basePrice && <p className="text-red-500 text-xs">{formErrors.basePrice}</p>}
            </div>

            {/* Max Per Ticket */}
            <div className="space-y-2">
              <Label htmlFor="extra-max-ticket">Maximum par billet</Label>
              <Input
                id="extra-max-ticket"
                type="number"
                min="1"
                max="100"
                value={formData.maxPerTicket}
                onChange={(e) => updateField('maxPerTicket', e.target.value)}
                placeholder="1"
                className={formErrors.maxPerTicket ? 'border-red-500' : ''}
              />
              {formErrors.maxPerTicket && <p className="text-red-500 text-xs">{formErrors.maxPerTicket}</p>}
            </div>

            {/* Requires Details */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Détails requis</p>
                <p className="text-xs text-muted-foreground">Demander une info supplémentaire (poids, description…)</p>
              </div>
              <Switch
                checked={formData.requiresDetails}
                onCheckedChange={(checked) => updateField('requiresDetails', checked)}
              />
            </div>

            {formData.requiresDetails && (
              <div className="space-y-2">
                <Label htmlFor="extra-detail-label">Libellé du détail *</Label>
                <Input
                  id="extra-detail-label"
                  value={formData.detailLabel}
                  onChange={(e) => updateField('detailLabel', e.target.value)}
                  placeholder="Ex: Poids du bagage (kg)"
                  className={formErrors.detailLabel ? 'border-red-500' : ''}
                />
                {formErrors.detailLabel && <p className="text-red-500 text-xs">{formErrors.detailLabel}</p>}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Promo Codes Tab ─────────────────────────────────────────────────────────

const INITIAL_PROMO_FORM: PromoCodeFormData = {
  code: '',
  type: 'percentage',
  value: '',
  minTickets: '1',
  validFrom: '',
  validUntil: '',
  maxUses: '',
};

function PromoCodesTab() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState<PromoCodeFormData>(INITIAL_PROMO_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof PromoCodeFormData, string>>>({});

  // ── Query
  const { data: promoCodes = [], isLoading, isError } = useQuery<PromoCode[]>({
    queryKey: ['promo-codes'],
    queryFn: async () => {
      const res = await fetch('/api/promo-codes', { headers: getAuthHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch promo codes');
      }
      const json = await res.json();
      return json.data as PromoCode[];
    },
  });

  // ── Create Mutation
  const createMutation = useMutation({
    mutationFn: async (data: PromoCodeFormData) => {
      const body = {
        code: data.code.toUpperCase().trim(),
        type: data.type,
        value: parseFloat(data.value) || 0,
        minTickets: parseInt(data.minTickets, 10) || 1,
        validFrom: data.validFrom ? new Date(data.validFrom).toISOString() : new Date().toISOString(),
        validUntil: data.validUntil ? new Date(data.validUntil).toISOString() : null,
        maxUses: data.maxUses ? parseInt(data.maxUses, 10) : null,
      };
      const res = await fetch('/api/promo-codes', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create promo code');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      toast.success('Code promo créé avec succès');
      setShowCreateDialog(false);
      setFormData(INITIAL_PROMO_FORM);
      setFormErrors({});
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ── Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/promo-codes/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete promo code');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      toast.success('Code promo supprimé');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ── Toggle Active Mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/promo-codes/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update promo code');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ── Validation
  function validateForm(data: PromoCodeFormData): boolean {
    const errors: Partial<Record<keyof PromoCodeFormData, string>> = {};
    if (!data.code.trim()) errors.code = 'Le code est requis';
    if (!data.value || parseFloat(data.value) <= 0) errors.value = 'La valeur doit être > 0';
    if (data.type === 'percentage' && parseFloat(data.value) > 100) {
      errors.value = 'Le pourcentage ne peut pas dépasser 100%';
    }
    if (data.validFrom && data.validUntil && data.validFrom >= data.validUntil) {
      errors.validUntil = 'La date de fin doit être après la date de début';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validateForm(formData)) {
      createMutation.mutate(formData);
    }
  }

  function updateField<K extends keyof PromoCodeFormData>(key: K, value: PromoCodeFormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function getPromoValueDisplay(code: PromoCode): string {
    if (code.type === 'percentage') {
      return `-${code.value}%`;
    }
    return `-${formatFCFA(code.value)}`;
  }

  function isPromoExpired(code: PromoCode): boolean {
    if (!code.validUntil) return false;
    return new Date(code.validUntil) < new Date();
  }

  function isPromoNotStarted(code: PromoCode): boolean {
    if (!code.validFrom) return false;
    return new Date(code.validFrom) > new Date();
  }

  function getPromoStatusBadge(code: PromoCode) {
    if (isPromoExpired(code)) {
      return (
        <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400">
          <AlertCircle className="mr-1 size-3" />
          Expiré
        </Badge>
      );
    }
    if (isPromoNotStarted(code)) {
      return (
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400">
          <Calendar className="mr-1 size-3" />
          À venir
        </Badge>
      );
    }
    return getStatusBadge(code.isActive);
  }

  function getUsageProgress(code: PromoCode): number {
    if (!code.maxUses) return 0;
    return Math.min((code.usedCount / code.maxUses) * 100, 100);
  }

  // ── Render
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
            <Gift className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Codes Promo</h2>
            <p className="text-xs text-muted-foreground">
              {promoCodes.length} code{promoCodes.length !== 1 ? 's' : ''} promo{promoCodes.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setFormData(INITIAL_PROMO_FORM);
            setFormErrors({});
            setShowCreateDialog(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          <Plus className="size-4" />
          Créer un code
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : isError ? (
        <ErrorState message="Impossible de charger les codes promo" />
      ) : promoCodes.length === 0 ? (
        <EmptyState
          icon={<Gift className="size-10 text-muted-foreground/40" />}
          title="Aucun code promo"
          description="Créez votre premier code promo pour attirer plus de clients."
          actionLabel="Créer un code promo"
          onAction={() => setShowCreateDialog(true)}
        />
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="space-y-3 lg:hidden">
            {promoCodes.map((promo) => {
              const progress = getUsageProgress(promo);
              return (
                <Card key={promo.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-lg font-bold tracking-wider">{promo.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {promo.type === 'percentage' ? (
                          <span className="flex items-center gap-1"><Percent className="size-3" /> Pourcentage</span>
                        ) : (
                          <span className="flex items-center gap-1"><Banknote className="size-3" /> Montant fixe</span>
                        )}
                      </p>
                    </div>
                    {getPromoStatusBadge(promo)}
                  </div>

                  <div className="mt-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                      {getPromoValueDisplay(promo)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Min. {promo.minTickets} billet{promo.minTickets > 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Usage progress */}
                  {promo.maxUses && (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Utilisation</span>
                        <span className="font-medium">
                          {promo.usedCount} / {promo.maxUses}
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      {progress >= 90 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          ⚠️ Presque épuisé
                        </p>
                      )}
                    </div>
                  )}

                  {/* Validity */}
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {formatDate(promo.validFrom)}
                    </span>
                    <span>→</span>
                    <span>{promo.validUntil ? formatDate(promo.validUntil) : 'Illimité'}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <Switch
                      checked={promo.isActive && !isPromoExpired(promo)}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: promo.id, isActive: checked })
                      }
                      disabled={isPromoExpired(promo)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-8 gap-1"
                      onClick={() => deleteMutation.mutate(promo.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="size-3.5" />
                      Supprimer
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop Table */}
          <Card className="hidden lg:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Valeur</TableHead>
                    <TableHead>Min. billets</TableHead>
                    <TableHead>Utilisation</TableHead>
                    <TableHead>Période de validité</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promoCodes.map((promo) => {
                    const progress = getUsageProgress(promo);
                    return (
                      <TableRow key={promo.id}>
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-1 text-sm font-bold tracking-wider">
                            {promo.code}
                          </code>
                        </TableCell>
                        <TableCell>
                          {promo.type === 'percentage' ? (
                            <Badge variant="outline" className="gap-1">
                              <Percent className="size-3" />
                              %
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <Banknote className="size-3" />
                              FCFA
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {getPromoValueDisplay(promo)}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{promo.minTickets}</TableCell>
                        <TableCell>
                          {promo.maxUses ? (
                            <div className="space-y-1 min-w-[120px]">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{promo.usedCount}/{promo.maxUses}</span>
                                <span className="font-medium">{Math.round(progress)}%</span>
                              </div>
                              <Progress value={progress} className="h-1.5" />
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {promo.usedCount} utilisé{promo.usedCount > 1 ? 's' : ''} (∞)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            <p className="flex items-center gap-1">
                              <Calendar className="size-3 text-muted-foreground" />
                              {formatDate(promo.validFrom)}
                            </p>
                            <p className="text-muted-foreground">
                              → {promo.validUntil ? formatDate(promo.validUntil) : 'Illimité'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{getPromoStatusBadge(promo)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Switch
                              checked={promo.isActive && !isPromoExpired(promo)}
                              onCheckedChange={(checked) =>
                                toggleMutation.mutate({ id: promo.id, isActive: checked })
                              }
                              disabled={isPromoExpired(promo)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive h-8 w-8 p-0"
                              onClick={() => deleteMutation.mutate(promo.id)}
                              disabled={deleteMutation.isPending}
                            >
                              {deleteMutation.isPending ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          setFormData(INITIAL_PROMO_FORM);
          setFormErrors({});
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau Code Promo</DialogTitle>
            <DialogDescription>
              Créez un code de réduction pour vos clients
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Code */}
            <div className="space-y-2">
              <Label htmlFor="promo-code">Code *</Label>
              <div className="flex gap-2">
                <Input
                  id="promo-code"
                  value={formData.code}
                  onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                  placeholder="PROMO2025"
                  className={`font-mono text-lg tracking-wider uppercase ${formErrors.code ? 'border-red-500' : ''}`}
                  maxLength={20}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => updateField('code', Math.random().toString(36).substring(2, 8).toUpperCase())}
                >
                  <Ticket className="size-3.5 mr-1" />
                  Aléatoire
                </Button>
              </div>
              {formErrors.code && <p className="text-red-500 text-xs">{formErrors.code}</p>}
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label>Type de réduction</Label>
              <div className="grid grid-cols-2 gap-3">
                {PROMO_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField('type', opt.value)}
                    className={`flex items-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-all text-left ${
                      formData.type === opt.value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Value */}
            <div className="space-y-2">
              <Label htmlFor="promo-value">
                Valeur{formData.type === 'percentage' ? ' (%)' : ' (FCFA)'} *
              </Label>
              <Input
                id="promo-value"
                type="number"
                min="0"
                max={formData.type === 'percentage' ? 100 : undefined}
                step={formData.type === 'percentage' ? 1 : 100}
                value={formData.value}
                onChange={(e) => updateField('value', e.target.value)}
                placeholder={formData.type === 'percentage' ? '15' : '5000'}
                className={formErrors.value ? 'border-red-500' : ''}
              />
              {formData.type === 'percentage' && (
                <p className="text-xs text-muted-foreground">
                  Ex: 15 pour une réduction de 15%
                </p>
              )}
              {formErrors.value && <p className="text-red-500 text-xs">{formErrors.value}</p>}
            </div>

            {/* Min Tickets */}
            <div className="space-y-2">
              <Label htmlFor="promo-min-tickets">Minimum de billets requis</Label>
              <Input
                id="promo-min-tickets"
                type="number"
                min="1"
                value={formData.minTickets}
                onChange={(e) => updateField('minTickets', e.target.value)}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground">
                Nombre minimum de billets pour appliquer ce code
              </p>
            </div>

            {/* Validity Period */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="promo-valid-from">Date de début</Label>
                <Input
                  id="promo-valid-from"
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => updateField('validFrom', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Défaut: immédiat</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="promo-valid-until">Date de fin</Label>
                <Input
                  id="promo-valid-until"
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => updateField('validUntil', e.target.value)}
                  className={formErrors.validUntil ? 'border-red-500' : ''}
                />
                {formErrors.validUntil && <p className="text-red-500 text-xs">{formErrors.validUntil}</p>}
                <p className="text-xs text-muted-foreground">Vide = illimité</p>
              </div>
            </div>

            {/* Max Uses */}
            <div className="space-y-2">
              <Label htmlFor="promo-max-uses">Nombre maximum d&apos;utilisations</Label>
              <Input
                id="promo-max-uses"
                type="number"
                min="1"
                value={formData.maxUses}
                onChange={(e) => updateField('maxUses', e.target.value)}
                placeholder="Illimité"
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide pour un nombre illimité d&apos;utilisations
              </p>
            </div>

            {/* Preview */}
            {formData.code && formData.value && parseFloat(formData.value) > 0 && (
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 p-4">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">Aperçu du code</p>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 font-mono font-bold tracking-wider">
                    {formData.code.toUpperCase()}
                  </div>
                  <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    {formData.type === 'percentage'
                      ? `-${formData.value}%`
                      : `-${formatFCFA(parseFloat(formData.value))}`}
                  </span>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Shared Sub-Components ───────────────────────────────────────────────────

function LoadingSkeleton({ rows }: { rows: number }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-3">
          <AlertCircle className="size-6 text-red-600 dark:text-red-400" />
        </div>
        <p className="text-lg font-medium">Erreur</p>
        <p className="text-sm text-muted-foreground mt-1">{message}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          {icon}
        </div>
        <p className="text-lg font-medium">{title}</p>
        <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">{description}</p>
        <Button
          onClick={onAction}
          className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          <Plus className="size-4" />
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
