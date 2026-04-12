'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Ticket,
  User,
  Mail,
  Phone,
  Car,
  CreditCard,
  Tag,
  Gift,
  Package,
  Plus,
  Minus,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  QrCode,
  Copy,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';

// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════

const VEHICLE_TYPES = [
  { value: 'berline', label: 'Berline', emoji: '\uD83D\uDE97' },
  { value: '4x4', label: '4\u00D74', emoji: '\uD83D\uDE99' },
  { value: 'minibus', label: 'Minibus', emoji: '\uD83D\uDE90' },
  { value: 'utilitaire', label: 'Utilitaire', emoji: '\uD83D\uDEFB' },
  { value: 'moto', label: 'Moto', emoji: '\uD83C\uDFCD\uFE0F' },
];

const VEHICLE_SLUGS = ['voiture', 'vehicule', 'vehicle', 'moto'];

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA';
}

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface FareType {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  priceModifier: number;
  requiresProof: boolean;
  proofLabel: string;
  maxPerBooking: number;
}

interface TicketExtra {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  pricingType: string;
  basePrice: number;
  requiresDetails: boolean;
  detailLabel: string;
  maxPerTicket: number;
}

interface EventOption {
  id: string;
  name: string;
  type: string;
  price: number;
  currency: string;
  startDate: string;
  endDate: string;
  location: string | null;
  status: string;
}

interface PricingResult {
  basePrice: number;
  fareModifier: number;
  fareTypeName: string;
  fareTypeEmoji: string;
  modifiedPrice: number;
  extras: Array<{
    id: string;
    name: string;
    slug: string;
    emoji: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    details: string;
  }>;
  extrasTotal: number;
  subtotal: number;
  promo: {
    code: string;
    type: string;
    value: number;
    discount: number;
  } | null;
  total: number;
  currency: string;
}

interface TicketPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultEventId?: string;
}

// ═══════════════════════════════════════════════════════════
// API Helper
// ═══════════════════════════════════════════════════════════

function getAuthHeaders(): HeadersInit {
  const token = useAuthStore.getState().token;
  const orgId = useOrgStore.getState().currentOrganization?.id;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'X-Organization-Id': orgId || '',
  };
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...options?.headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// ═══════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════

export default function TicketPurchaseDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultEventId,
}: TicketPurchaseDialogProps) {
  const queryClient = useQueryClient();

  // ── Form State ──────────────────────────────────────────
  const [eventId, setEventId] = useState(defaultEventId || '');
  const [fareTypeId, setFareTypeId] = useState('');
  const [holderName, setHolderName] = useState('');
  const [holderEmail, setHolderEmail] = useState('');
  const [holderPhone, setHolderPhone] = useState('');
  const [idProofNumber, setIdProofNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [extrasMap, setExtrasMap] = useState<Record<string, { quantity: number; details: string }>>({});
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);

  // ── UI State ────────────────────────────────────────────
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<{
    ticketCode: string;
    qrData: string;
    eventName: string;
    total: number;
    currency: string;
  } | null>(null);

  // ── Debounced pricing ───────────────────────────────────
  const pricingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Form Reset ──────────────────────────────────────────
  const resetForm = useCallback(() => {
    setEventId(defaultEventId || '');
    setFareTypeId('');
    setHolderName('');
    setHolderEmail('');
    setHolderPhone('');
    setIdProofNumber('');
    setVehicleType('');
    setVehiclePlate('');
    setExtrasMap({});
    setPromoCode('');
    setPromoApplied(false);
    setShowSuccess(false);
    setCreatedTicket(null);
  }, [defaultEventId]);

  // ── Handle dialog open with default event ─────────────
  const handleDialogOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen && defaultEventId) {
        setEventId(defaultEventId);
      }
      if (!newOpen) {
        resetForm();
      }
      onOpenChange(newOpen);
    },
    [defaultEventId, onOpenChange, resetForm]
  );

  // ── Queries ─────────────────────────────────────────────
  const { data: eventsData, isLoading: eventsLoading } = useQuery<{ data: EventOption[] }>({
    queryKey: ['events-purchase'],
    queryFn: () => apiFetch('/api/events?limit=1000&status=active'),
    enabled: open,
  });

  const { data: fareTypesData, isLoading: fareTypesLoading } = useQuery<{ data: FareType[] }>({
    queryKey: ['fare-types-purchase'],
    queryFn: () => apiFetch('/api/fare-types?active=true'),
    enabled: open,
  });

  const { data: extrasData, isLoading: extrasLoading } = useQuery<{ data: TicketExtra[] }>({
    queryKey: ['ticket-extras-purchase'],
    queryFn: () => apiFetch('/api/ticket-extras?active=true'),
    enabled: open,
  });

  // ── Derived Data ────────────────────────────────────────
  const events = useMemo(() => eventsData?.data || [], [eventsData]);
  const fareTypes = useMemo(() => fareTypesData?.data || [], [fareTypesData]);
  const ticketExtras = useMemo(() => extrasData?.data || [], [extrasData]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === eventId),
    [events, eventId]
  );

  const selectedFareType = useMemo(
    () => fareTypes.find((f) => f.id === fareTypeId),
    [fareTypes, fareTypeId]
  );

  const isVehicleExtraActive = useMemo(
    () =>
      ticketExtras.some(
        (ext) =>
          VEHICLE_SLUGS.some((s) => ext.slug.toLowerCase().includes(s)) &&
          extrasMap[ext.id]?.quantity > 0
      ),
    [ticketExtras, extrasMap]
  );

  // ── Price Calculation Query ─────────────────────────────
  const extrasPayload = useMemo(() => {
    return Object.entries(extrasMap)
      .filter(([, val]) => val.quantity > 0)
      .map(([extraId, val]) => ({
        extraId,
        quantity: val.quantity,
        details: val.details,
      }));
  }, [extrasMap]);

  const pricingQueryKey = useMemo(
    () => ['pricing-calculate', eventId, fareTypeId, JSON.stringify(extrasPayload), promoApplied ? promoCode : ''],
    [eventId, fareTypeId, extrasPayload, promoApplied, promoCode]
  );

  const [debouncedPricingKey, setDebouncedPricingKey] = useState(pricingQueryKey);

  useEffect(() => {
    if (pricingTimerRef.current) clearTimeout(pricingTimerRef.current);
    pricingTimerRef.current = setTimeout(() => {
      setDebouncedPricingKey([...pricingQueryKey]);
    }, 500);
    return () => {
      if (pricingTimerRef.current) clearTimeout(pricingTimerRef.current);
    };
  }, [pricingQueryKey]);

  const {
    data: pricingData,
    isLoading: pricingLoading,
  } = useQuery<PricingResult>({
    queryKey: debouncedPricingKey,
    queryFn: () =>
      apiFetch('/api/pricing/calculate', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          fareTypeId: fareTypeId || undefined,
          extras: extrasPayload.length > 0 ? extrasPayload : undefined,
          promoCode: promoApplied ? promoCode : undefined,
        }),
      }),
    enabled: open && !!eventId,
  });

  // ── Promo Code Handler ──────────────────────────────────
  const handleApplyPromo = useCallback(() => {
    if (!promoCode.trim()) {
      setPromoApplied(false);
      return;
    }
    // Force recalculation - promo code validation happens server-side
    setPromoApplied(true);
  }, [promoCode, pricingData]);

  // ── Derive promo error from pricing data ───────────────
  const derivedPromoError = useMemo(() => {
    if (!promoApplied || !promoCode.trim()) return '';
    if (pricingData?.promo) return '';
    if (pricingData && promoApplied && promoCode.trim() && !pricingData.promo) {
      return 'Code promo invalide ou expir\u00E9';
    }
    return '';
  }, [pricingData, promoApplied, promoCode]);

  // ── Extras Handlers ─────────────────────────────────────
  const updateExtraQty = useCallback((extraId: string, delta: number) => {
    setExtrasMap((prev) => {
      const current = prev[extraId]?.quantity || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        const next = { ...prev };
        delete next[extraId];
        return next;
      }
      return { ...prev, [extraId]: { ...prev[extraId], quantity: newQty, details: prev[extraId]?.details || '' } };
    });
  }, []);

  const updateExtraDetails = useCallback((extraId: string, details: string) => {
    setExtrasMap((prev) => ({
      ...prev,
      [extraId]: { ...prev[extraId], quantity: prev[extraId]?.quantity || 1, details },
    }));
  }, []);

  // ── Ticket Creation Mutation ────────────────────────────
  const createTicketMutation = useMutation({
    mutationFn: () =>
      apiFetch<{
        ticket: { ticketCode: string };
        transaction: { id: string };
        qrData: string;
        pricing: { total: number; currency: string };
      }>('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          holderName,
          holderEmail,
          holderPhone: holderPhone || undefined,
          fareTypeId: fareTypeId || undefined,
          extras: extrasPayload.length > 0 ? extrasPayload : undefined,
          promoCode: promoApplied ? promoCode : undefined,
          vehicleType: isVehicleExtraActive ? vehicleType : undefined,
          vehiclePlate: isVehicleExtraActive ? vehiclePlate : undefined,
          idProofNumber: selectedFareType?.requiresProof ? idProofNumber : undefined,
        }),
      }),
    onSuccess: (data) => {
      setShowSuccess(true);
      setCreatedTicket({
        ticketCode: data.ticket.ticketCode,
        qrData: data.qrData,
        eventName: selectedEvent?.name || 'Event',
        total: data.pricing.total,
        currency: data.pricing.currency,
      });
      toast.success('Billet cr\u00E9\u00E9 avec succ\u00E8s !', {
        description: `Code: ${data.ticket.ticketCode}`,
      });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || '\u00C9chec de la cr\u00E9ation du billet');
    },
  });

  // ── Submit Handler ──────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (!eventId) {
      toast.error('Veuillez s\u00E9lectionner un \u00E9v\u00E9nement');
      return;
    }
    if (!holderName.trim()) {
      toast.error('Le nom du passager est requis');
      return;
    }
    if (!holderEmail.trim() || !holderEmail.includes('@')) {
      toast.error('L\'email du passager est requis');
      return;
    }
    if (selectedFareType?.requiresProof && !idProofNumber.trim()) {
      toast.error(`${selectedFareType.proofLabel || 'Num\u00E9ro de pi\u00E8ce justificative'} est requis`);
      return;
    }
    if (isVehicleExtraActive && !vehiclePlate.trim()) {
      toast.error('La plaque d\'immatriculation est requise');
      return;
    }
    createTicketMutation.mutate();
  }, [
    eventId,
    holderName,
    holderEmail,
    selectedFareType,
    idProofNumber,
    isVehicleExtraActive,
    vehiclePlate,
    createTicketMutation,
  ]);

  // ── Copy Ticket Code ────────────────────────────────────
  const handleCopyCode = useCallback(() => {
    if (createdTicket) {
      navigator.clipboard.writeText(createdTicket.ticketCode).then(() => {
        toast.success('Code copi\u00E9 dans le presse-papiers');
      });
    }
  }, [createdTicket]);

  // ── Fare Modifier Display ───────────────────────────────
  const fareModifierDisplay = useMemo(() => {
    if (!selectedFareType) return '';
    const mod = selectedFareType.priceModifier;
    if (mod === 1) return '';
    if (mod < 1) return `${Math.round((mod - 1) * 100)}%)`;
    return `\u00D7${mod}`;
  }, [selectedFareType]);

  const isLoading = eventsLoading || fareTypesLoading || extrasLoading;

  // ═══════════════════════════════════════════════════════
  // Render - Success State
  // ═══════════════════════════════════════════════════════

  if (showSuccess && createdTicket) {
    return (
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Billet vendu avec succ\u00E8s !</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {createdTicket.eventName}
              </p>
            </div>

            <Card className="w-full border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Code billet</span>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-1 rounded text-emerald-700 dark:text-emerald-300">
                      {createdTicket.ticketCode}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleCopyCode}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Montant</span>
                  <span className="text-lg font-bold text-emerald-600">
                    {formatFCFA(createdTicket.total)}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center gap-2 justify-center pt-1">
                  <QrCode className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">QR Data pr\u00EAt pour impression</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  resetForm();
                }}
              >
                Vendre un autre
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  resetForm();
                  onOpenChange(false);
                }}
              >
                Terminer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Render - Form State
  // ═══════════════════════════════════════════════════════

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-emerald-600" />
            Vendre un billet
          </DialogTitle>
          <DialogDescription>
            Remplissez les informations pour \u00E9mettre un nouveau billet
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── Event Selection ──────────────────────── */}
            <div className="space-y-2">
              <Label htmlFor="purchase-event" className="flex items-center gap-1.5">
                <Ticket className="h-3.5 w-3.5" />
                \u00C9v\u00E9nement <span className="text-red-500">*</span>
              </Label>
              <Select value={eventId} onValueChange={(v) => { setEventId(v); setShowSuccess(false); }}>
                <SelectTrigger id="purchase-event" className="w-full">
                  <SelectValue placeholder="S\u00E9lectionner un \u00E9v\u00E9nement" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {events.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Aucun \u00E9v\u00E9nement actif
                    </div>
                  ) : (
                    events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        <span className="flex items-center gap-2">
                          <span className="truncate max-w-[200px]">{e.name}</span>
                          <Badge variant="secondary" className="text-xs ml-auto shrink-0">
                            {formatFCFA(e.price)}
                          </Badge>
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* ── Fare Type Selection ──────────────────── */}
            <div className="space-y-2">
              <Label htmlFor="purchase-fare" className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Tarif
              </Label>
              <Select value={fareTypeId} onValueChange={(v) => setFareTypeId(v)}>
                <SelectTrigger id="purchase-fare" className="w-full">
                  <SelectValue placeholder="Standard" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="">
                    <span className="flex items-center gap-2">
                      <span>\uD83C\uDFAB</span>
                      <span>Standard</span>
                    </span>
                  </SelectItem>
                  {fareTypes.map((ft) => (
                    <SelectItem key={ft.id} value={ft.id}>
                      <span className="flex items-center gap-2">
                        <span>{ft.emoji}</span>
                        <span>{ft.name}</span>
                        {ft.priceModifier !== 1 && (
                          <Badge
                            variant="secondary"
                            className={`text-xs ml-1 ${
                              ft.priceModifier < 1
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {ft.priceModifier < 1
                              ? `${Math.round((ft.priceModifier - 1) * 100)}%`
                              : `\u00D7${ft.priceModifier}`}
                          </Badge>
                        )}
                        {ft.requiresProof && (
                          <Badge variant="outline" className="text-xs">
                            Pi\u00E8ce requise
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── ID Proof (conditional) ───────────────── */}
            {selectedFareType?.requiresProof && (
              <div className="space-y-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
                <Label
                  htmlFor="purchase-id-proof"
                  className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  {selectedFareType.proofLabel || 'Num\u00E9ro de pi\u00E8ce justificative'} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="purchase-id-proof"
                  value={idProofNumber}
                  onChange={(e) => setIdProofNumber(e.target.value)}
                  placeholder={selectedFareType.proofLabel || 'Ex: N\u00B0 carte \u00E9tudiant'}
                  className="border-amber-300 dark:border-amber-700"
                />
              </div>
            )}

            <Separator />

            {/* ── Passenger Info ───────────────────────── */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Informations passager
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="purchase-name" className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Nom complet <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="purchase-name"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    placeholder="Jean Dupont"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase-email" className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="purchase-email"
                    type="email"
                    value={holderEmail}
                    onChange={(e) => setHolderEmail(e.target.value)}
                    placeholder="jean@exemple.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase-phone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  T\u00E9l\u00E9phone
                </Label>
                <Input
                  id="purchase-phone"
                  type="tel"
                  value={holderPhone}
                  onChange={(e) => setHolderPhone(e.target.value)}
                  placeholder="+221 77 123 45 67"
                />
              </div>
            </div>

            {/* ── Vehicle Info (conditional) ───────────── */}
            {isVehicleExtraActive && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Car className="h-3.5 w-3.5" />
                    Informations v\u00E9hicule
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Type de v\u00E9hicule</Label>
                      <Select value={vehicleType} onValueChange={setVehicleType}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="S\u00E9lectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {VEHICLE_TYPES.map((vt) => (
                            <SelectItem key={vt.value} value={vt.value}>
                              <span className="flex items-center gap-2">
                                <span>{vt.emoji}</span>
                                <span>{vt.label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purchase-plate">
                        Plaque d&apos;immatriculation
                      </Label>
                      <Input
                        id="purchase-plate"
                        value={vehiclePlate}
                        onChange={(e) => setVehiclePlate(e.target.value)}
                        placeholder="DK-1234-AB"
                        className="uppercase"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* ── Extras Selection ─────────────────────── */}
            {ticketExtras.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  Options suppl\u00E9mentaires
                </h4>
                <div className="space-y-2">
                  {ticketExtras.map((ext) => {
                    const qty = extrasMap[ext.id]?.quantity || 0;
                    return (
                      <div
                        key={ext.id}
                        className={`rounded-lg border p-3 transition-colors ${
                          qty > 0
                            ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'
                            : 'border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-lg shrink-0">{ext.emoji}</span>
                            <div className="min-w-0">
                              <span className="text-sm font-medium truncate block">
                                {ext.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatFCFA(ext.basePrice)}/unit\u00E9
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              disabled={qty === 0}
                              onClick={() => updateExtraQty(ext.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">
                              {qty}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              disabled={qty >= ext.maxPerTicket}
                              onClick={() => updateExtraQty(ext.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Detail input when requiresDetails */}
                        {ext.requiresDetails && qty > 0 && (
                          <div className="mt-2 space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {ext.detailLabel || 'D\u00E9tails'}
                            </Label>
                            <Input
                              value={extrasMap[ext.id]?.details || ''}
                              onChange={(e) => updateExtraDetails(ext.id, e.target.value)}
                              placeholder={ext.detailLabel || 'D\u00E9tails...'}
                              className="h-8 text-sm"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* ── Promo Code ───────────────────────────── */}
            <div className="space-y-2">
              <Label htmlFor="purchase-promo" className="flex items-center gap-1.5">
                <Gift className="h-3.5 w-3.5" />
                Code promo
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="purchase-promo"
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value.toUpperCase());
                      setPromoApplied(false);
                    }}
                    placeholder="NOEL2026"
                    className="pl-9 uppercase"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleApplyPromo}
                  disabled={!promoCode.trim()}
                  className="shrink-0"
                >
                  Appliquer
                </Button>
              </div>
              {derivedPromoError && (
                <div className="flex items-center gap-1.5 text-xs text-red-500">
                  <XCircle className="h-3.5 w-3.5" />
                  {derivedPromoError}
                </div>
              )}
              {pricingData?.promo && promoApplied && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Code promo appliqu\u00E9 :{' '}
                  {pricingData.promo.type === 'percent'
                    ? `-${pricingData.promo.value}%`
                    : `-${formatFCFA(pricingData.promo.value)}`}
                  {' = '}
                  {formatFCFA(pricingData.promo.discount)} de r\u00E9duction
                </div>
              )}
            </div>

            <Separator />

            {/* ── Price Summary ────────────────────────── */}
            {eventId && pricingData && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  R\u00E9capitulatif
                </h4>
                <Card className="border-emerald-200 dark:border-emerald-800">
                  <CardContent className="p-4 space-y-2 text-sm">
                    {/* Base price */}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Prix de base</span>
                      <span>{formatFCFA(pricingData.basePrice)}</span>
                    </div>

                    {/* Fare modifier */}
                    {pricingData.fareModifier !== 1 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>
                          {pricingData.fareTypeEmoji} {pricingData.fareTypeName}
                          {fareModifierDisplay && (
                            <span className="text-xs ml-1">({fareModifierDisplay})</span>
                          )}
                        </span>
                        <span>{formatFCFA(pricingData.modifiedPrice)}</span>
                      </div>
                    )}

                    {/* Extras breakdown */}
                    {pricingData.extras.length > 0 && (
                      <>
                        <div className="flex justify-between font-medium">
                          <span className="flex items-center gap-1">
                            <Package className="h-3.5 w-3.5" />
                            Options
                          </span>
                          <span>{formatFCFA(pricingData.extrasTotal)}</span>
                        </div>
                        <div className="ml-4 space-y-1 text-xs text-muted-foreground">
                          {pricingData.extras.map((ext) => (
                            <div key={ext.id} className="flex justify-between">
                              <span>
                                {ext.emoji} {ext.name} &times;{ext.quantity}
                                {ext.details && ` (${ext.details})`}
                              </span>
                              <span>{formatFCFA(ext.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Subtotal */}
                    <Separator />
                    <div className="flex justify-between">
                      <span>Sous-total</span>
                      <span>{formatFCFA(pricingData.subtotal)}</span>
                    </div>

                    {/* Promo discount */}
                    {pricingData.promo && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span className="flex items-center gap-1">
                          <Gift className="h-3.5 w-3.5" />
                          R\u00E9duction ({pricingData.promo.code})
                        </span>
                        <span>-{formatFCFA(pricingData.promo.discount)}</span>
                      </div>
                    )}

                    {/* Total */}
                    <Separator />
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>TOTAL</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatFCFA(pricingData.total)}
                      </span>
                    </div>

                    {/* Loading indicator */}
                    {pricingLoading && (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Calcul en cours...
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── Submit Button ────────────────────────── */}
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  onOpenChange(false);
                }}
                className="sm:mr-auto"
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={createTicketMutation.isPending || !eventId}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 min-w-[160px]"
              >
                {createTicketMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Vente en cours...
                  </>
                ) : (
                  <>
                    <Ticket className="h-4 w-4" />
                    Vendre le billet
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
