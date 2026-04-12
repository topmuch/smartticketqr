'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Plus,
  Search,
  QrCode,
  Download,
  Send,
  Edit,
  Trash2,
  Copy,
  Ticket,
  ChevronLeft,
  ChevronRight,
  Loader2,
  DollarSign,
  AlertTriangle,
  X,
  MessageCircle,
  ClipboardCopy,
  Printer,
} from 'lucide-react';

import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import ThermalPrintButton from '@/components/smart-ticket/thermal-print-button';
import TicketPurchaseDialog from '@/components/smart-ticket/ticket-purchase-dialog';
import { buildWhatsAppLink, generateTicketTextMessage } from '@/lib/whatsapp-service';

// ==================== Types ====================

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

interface TicketItem {
  id: string;
  eventId: string;
  ticketCode: string;
  ticketType: string;
  holderName: string;
  holderEmail: string;
  holderPhone: string | null;
  seatNumber: string | null;
  price: number;
  currency: string;
  status: string;
  issuedAt: string;
  expiresAt: string | null;
  createdAt: string;
  event: {
    id: string;
    name: string;
    type: string;
    startDate: string;
    endDate: string;
    location: string | null;
  };
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface TicketDetail extends TicketItem {
  event: {
    id: string;
    name: string;
    type: string;
    description: string | null;
    location: string | null;
    startDate: string;
    endDate: string;
    price: number;
    currency: string;
  };
  scans: Array<{
    id: string;
    result: string;
    createdAt: string;
    user: { name: string };
  }>;
  transactions: Array<{
    id: string;
    amount: number;
    status: string;
    paymentMethod: string;
    description: string | null;
    createdAt: string;
  }>;
}

interface TicketsResponse {
  data: TicketItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface EventsResponse {
  data: EventOption[];
  total: number;
}

// ==================== API Helpers ====================

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

// ==================== QR Code Utility ====================

function generateQRDataString(ticketCode: string, eventId: string): string {
  const payload = JSON.stringify({
    tc: ticketCode,
    ei: eventId,
    ts: Date.now(),
  });
  return Buffer.from(payload).toString('base64url');
}

async function generateQRImage(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

// ==================== PDF Ticket Generation ====================

async function generateTicketPDF(ticket: TicketDetail, qrDataUrl: string): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [200, 90],
  });

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 200, 90, 'F');

  // Accent stripe on left
  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, 6, 90, 'F');

  // Header - "SmartTicketQR" branding
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(24, 24, 27);
  doc.text('SmartTicketQR', 12, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('www.smartticketqr.com', 12, 20);

  // Ticket type badge
  doc.setFillColor(24, 24, 27);
  doc.roundedRect(12, 24, 40, 6, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(ticket.ticketType.toUpperCase(), 14, 28);

  // Event details section
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('EVENT', 12, 38);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(24, 24, 27);
  const eventName = doc.splitTextToSize(ticket.event.name, 60);
  doc.text(eventName, 12, 43);

  // Date & Location
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);

  const eventDate = ticket.event.startDate
    ? format(new Date(ticket.event.startDate), 'MMM dd, yyyy HH:mm')
    : 'TBA';
  const location = ticket.event.location || 'TBA';
  doc.text(`${eventDate}  |  ${location}`, 12, 52);

  // Dashed separator
  doc.setDrawColor(200, 200, 200);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(12, 55, 120, 55);
  doc.setLineDashPattern([], 0);

  // Holder information
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('ATTENDEE', 12, 61);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(24, 24, 27);
  doc.text(ticket.holderName, 12, 66);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(ticket.holderEmail, 12, 71);
  if (ticket.seatNumber) {
    doc.text(`Seat: ${ticket.seatNumber}`, 12, 76);
  }

  // Ticket code
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(24, 24, 27);
  doc.text(ticket.ticketCode, 12, 84);

  // QR Code
  doc.addImage(qrDataUrl, 'PNG', 130, 8, 55, 55);

  // Price
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(24, 24, 27);
  doc.text(`${ticket.currency} ${ticket.price.toFixed(2)}`, 140, 75);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(160, 160, 160);
  doc.text('This ticket is non-transferable. Valid ID may be required at entry.', 12, 88);

  // Save
  doc.save(`ticket-${ticket.ticketCode}.pdf`);
}

// ==================== Status Badge ====================

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
    used: { label: 'Used', className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800' },
    expired: { label: 'Expired', className: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700' },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800' },
  };
  const c = config[status] || config.active;
  return (
    <Badge variant="outline" className={c.className}>
      {c.label}
    </Badge>
  );
}

// ==================== Ticket Type Badge ====================

function TicketTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; className: string }> = {
    VIP: { label: 'VIP', className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
    Standard: { label: 'Standard', className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
    'One-way': { label: 'One-way', className: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800' },
    'Round-trip': { label: 'Round-trip', className: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800' },
  };
  const c = config[type] || config.Standard;
  return (
    <Badge variant="outline" className={c.className}>
      {c.label}
    </Badge>
  );
}

// ==================== Stat Card Skeleton ====================

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-14" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Table Skeleton ====================

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24 ml-auto" />
        </div>
      ))}
    </div>
  );
}

// ==================== Main Component ====================

export default function TicketsPage() {
  const queryClient = useQueryClient();
  const { token } = useAuthStore();

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseDefaultEventId, setPurchaseDefaultEventId] = useState<string | undefined>();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [thermalPrintOpen, setThermalPrintOpen] = useState(false);

  // Selected ticket
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<TicketDetail | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Create form
  const [createForm, setCreateForm] = useState({
    eventId: '',
    ticketType: 'Standard',
    holderName: '',
    holderEmail: '',
    holderPhone: '',
    seatNumber: '',
    price: '',
    currency: 'USD',
    fareTypeId: '',
    extras: [] as Array<{ extraId: string; quantity: number; details: string }>,
    promoCode: '',
  });

  // Bulk form
  const [bulkForm, setBulkForm] = useState({
    eventId: '',
    count: 10,
    ticketType: 'Standard',
    price: '',
  });
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkGenerating, setBulkGenerating] = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState({
    holderName: '',
    holderEmail: '',
    holderPhone: '',
    seatNumber: '',
    ticketType: 'Standard',
  });

  // ==================== Queries ====================

  const { data: eventsData } = useQuery<EventsResponse>({
    queryKey: ['events-list-all'],
    queryFn: () => apiFetch<EventsResponse>('/api/events?limit=1000'),
    enabled: !!token,
  });

  const { data: ticketsData, isLoading } = useQuery<TicketsResponse>({
    queryKey: ['tickets', page, limit, eventFilter, statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (eventFilter && eventFilter !== 'all') params.set('eventId', eventFilter);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);
      return apiFetch<TicketsResponse>(`/api/tickets?${params.toString()}`);
    },
    enabled: !!token,
  });

  const { data: ticketDetail, isLoading: detailLoading } = useQuery<{
    ticket: TicketDetail;
  }>({
    queryKey: ['ticket-detail', selectedTicket?.id],
    queryFn: () => apiFetch<{ ticket: TicketDetail }>(`/api/tickets/${selectedTicket!.id}`),
    enabled: !!selectedTicket && qrOpen,
  });

  // ==================== Mutations ====================

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) =>
      apiFetch('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          eventId: data.eventId,
          ticketType: data.ticketType,
          holderName: data.holderName,
          holderEmail: data.holderEmail,
          holderPhone: data.holderPhone,
          seatNumber: data.seatNumber,
          price: data.price ? parseFloat(data.price) : undefined,
          currency: data.currency,
          fareTypeId: data.fareTypeId || undefined,
          extras: data.extras.length > 0 ? data.extras : undefined,
          promoCode: data.promoCode || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Ticket created successfully');
      setCreateOpen(false);
      resetCreateForm();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create ticket');
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (data: { eventId: string; count: number; ticketType: string; price?: number }) =>
      apiFetch('/api/tickets/bulk', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onMutate: () => {
      setBulkGenerating(true);
      setBulkProgress(10);
    },
    onSuccess: (res) => {
      const r = res as { count?: number; tickets?: unknown[] };
      setBulkProgress(100);
      setTimeout(() => {
        setBulkGenerating(false);
        setBulkProgress(0);
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
        toast.success(`${r.count || r.tickets?.length || 0} tickets generated successfully`);
        setBulkOpen(false);
        setBulkForm({ eventId: '', count: 10, ticketType: 'Standard', price: '' });
      }, 600);
    },
    onError: (err: Error) => {
      setBulkGenerating(false);
      setBulkProgress(0);
      toast.error(err.message || 'Failed to generate tickets');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editForm }) =>
      apiFetch(`/api/tickets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Ticket updated successfully');
      setEditOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update ticket');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/tickets/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Ticket cancelled successfully');
      setCancelOpen(false);
      setSelectedTicket(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to cancel ticket');
    },
  });

  // ==================== Handlers ====================

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
    },
    [handleSearch],
  );

  const resetCreateForm = useCallback(() => {
    setCreateForm({
      eventId: '',
      ticketType: 'Standard',
      holderName: '',
      holderEmail: '',
      holderPhone: '',
      seatNumber: '',
      price: '',
      currency: 'USD',
      fareTypeId: '',
      extras: [],
      promoCode: '',
    });
  }, []);

  const handleEventSelectForCreate = useCallback(
    (eventId: string) => {
      const event = eventsData?.data.find((e) => e.id === eventId);
      setCreateForm((prev) => ({
        ...prev,
        eventId,
        price: event ? String(event.price) : '',
        currency: event?.currency || 'USD',
      }));
    },
    [eventsData],
  );

  const handleCreateSubmit = useCallback(() => {
    if (!createForm.eventId || !createForm.holderName || !createForm.holderEmail) {
      toast.error('Event, holder name, and holder email are required');
      return;
    }
    createMutation.mutate(createForm);
  }, [createForm, createMutation]);

  const handleBulkSubmit = useCallback(() => {
    if (!bulkForm.eventId) {
      toast.error('Please select an event');
      return;
    }
    if (bulkForm.count < 1 || bulkForm.count > 1000) {
      toast.error('Number of tickets must be between 1 and 1000');
      return;
    }
    bulkMutation.mutate({
      eventId: bulkForm.eventId,
      count: bulkForm.count,
      ticketType: bulkForm.ticketType,
      price: bulkForm.price ? parseFloat(bulkForm.price) : undefined,
    });
  }, [bulkForm, bulkMutation]);

  const handleViewQR = useCallback(
    (ticket: TicketItem) => {
      setSelectedTicket(ticket);
      setQrOpen(true);
    },
    [],
  );

  const handleEditOpen = useCallback((ticket: TicketItem) => {
    setSelectedTicket(ticket);
    setEditForm({
      holderName: ticket.holderName,
      holderEmail: ticket.holderEmail,
      holderPhone: ticket.holderPhone || '',
      seatNumber: ticket.seatNumber || '',
      ticketType: ticket.ticketType,
    });
    setEditOpen(true);
  }, []);

  const handleEditSubmit = useCallback(() => {
    if (!selectedTicket) return;
    updateMutation.mutate({ id: selectedTicket.id, data: editForm });
  }, [selectedTicket, editForm, updateMutation]);

  const handleCancelOpen = useCallback((ticket: TicketItem) => {
    setSelectedTicket(ticket);
    setCancelOpen(true);
  }, []);

  const handleCancelConfirm = useCallback(() => {
    if (!selectedTicket) return;
    cancelMutation.mutate(selectedTicket.id);
  }, [selectedTicket, cancelMutation]);

  const handleCopyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      toast.success('Ticket code copied to clipboard');
    });
  }, []);

  const handleDownloadQR = useCallback(async () => {
    if (!qrDataUrl || !selectedTicket) return;
    const link = document.createElement('a');
    link.download = `qr-${selectedTicket.ticketCode}.png`;
    link.href = qrDataUrl;
    link.click();
  }, [qrDataUrl, selectedTicket]);

  const handleDownloadPDF = useCallback(async () => {
    if (!selectedDetail || !qrDataUrl) return;
    try {
      await generateTicketPDF(selectedDetail, qrDataUrl);
      toast.success('PDF ticket downloaded');
    } catch {
      toast.error('Failed to generate PDF');
    }
  }, [selectedDetail, qrDataUrl]);

  // Generate QR when detail loads
  React.useEffect(() => {
    if (ticketDetail?.ticket && qrOpen) {
      const t = ticketDetail.ticket;
      setSelectedDetail(t);
      const qrStr = generateQRDataString(t.ticketCode, t.eventId);
      generateQRImage(qrStr).then(setQrDataUrl);
    }
  }, [ticketDetail, qrOpen]);

  // WhatsApp send handler
  const handleSendWhatsApp = useCallback(() => {
    if (!selectedDetail || !selectedTicket) return;
    const t = selectedDetail;
    const org = useOrgStore.getState().currentOrganization;
    const orgSlug = org?.slug || 'demo';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const publicUrl = `${baseUrl}/ticket?code=${t.ticketCode}&org=${orgSlug}`;

    if (t.holderPhone) {
      const waResult = buildWhatsAppLink({
        phone: t.holderPhone,
        holderName: t.holderName,
        eventName: t.event.name,
        eventDate: t.event.startDate ? format(new Date(t.event.startDate), 'dd/MM/yyyy HH:mm') : 'TBA',
        eventLocation: t.event.location || undefined,
        ticketCode: t.ticketCode,
        ticketType: t.ticketType,
        publicUrl,
        orgName: org?.name,
      });
      window.open(waResult.url, '_blank');
      toast.success('WhatsApp message opened', { description: `Sending ticket to ${t.holderPhone}` });
    } else {
      // No phone - copy message to clipboard
      const msg = generateTicketTextMessage({
        holderName: t.holderName,
        eventName: t.event.name,
        eventDate: t.event.startDate ? format(new Date(t.event.startDate), 'dd/MM/yyyy HH:mm') : 'TBA',
        ticketCode: t.ticketCode,
        ticketType: t.ticketType,
        publicUrl,
        orgName: org?.name,
      });
      navigator.clipboard.writeText(msg);
      toast.success('Ticket message copied to clipboard', { description: 'No phone number on file for WhatsApp' });
    }
  }, [selectedDetail, selectedTicket]);

  // Reset filters
  const handleResetFilters = useCallback(() => {
    setSearch('');
    setSearchInput('');
    setEventFilter('all');
    setStatusFilter('all');
    setPage(1);
  }, []);

  // ==================== Computed Values ====================

  const tickets = ticketsData?.data || [];
  const totalTickets = ticketsData?.total || 0;
  const totalPages = ticketsData?.totalPages || 1;
  const events = eventsData?.data || [];

  // Calculate stats from current tickets data
  const stats = useMemo(() => {
    const activeCount = tickets.filter((t) => t.status === 'active').length;
    const usedCount = tickets.filter((t) => t.status === 'used').length;
    const revenue = tickets.reduce((sum, t) => sum + t.price, 0);
    return { activeCount, usedCount, revenue };
  }, [tickets]);

  // ==================== Render ====================

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Ticket className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Please log in to manage tickets</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ==================== Header ==================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ticket Management</h1>
          <p className="text-muted-foreground">Create, manage, and distribute tickets for your events</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Bulk Generate</span>
          </Button>
          <Button onClick={() => { setPurchaseDefaultEventId(undefined); setPurchaseOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Vendre un Billet</span>
          </Button>
        </div>
      </div>

      {/* ==================== Stats Cards ==================== */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Total Tickets</p>
                  <p className="text-2xl font-bold">{totalTickets.toLocaleString()}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <Ticket className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.activeCount}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950">
                  <Ticket className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Used</p>
                  <p className="text-2xl font-bold text-sky-600">{stats.usedCount}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-950">
                  <QrCode className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold">
                    ${stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950">
                  <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== Filters ==================== */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {/* Search */}
            <div className="flex-1 min-w-0">
              <Label htmlFor="ticket-search" className="mb-1.5 text-xs text-muted-foreground">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ticket-search"
                  placeholder="Search by code, name, or email..."
                  className="pl-9"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
            </div>

            {/* Event Filter */}
            <div className="w-full sm:w-48">
              <Label className="mb-1.5 text-xs text-muted-foreground">Event</Label>
              <Select value={eventFilter} onValueChange={(v) => { setEventFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-40">
              <Label className="mb-1.5 text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSearch}>
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Search</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ==================== Tickets Table ==================== */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="sticky top-0 bg-background z-10">
                  <TableHead className="min-w-[160px]">Ticket Code</TableHead>
                  <TableHead className="min-w-[150px]">Event</TableHead>
                  <TableHead className="min-w-[130px]">Holder</TableHead>
                  <TableHead className="min-w-[90px]">Type</TableHead>
                  <TableHead className="min-w-[80px]">Price</TableHead>
                  <TableHead className="min-w-[90px]">Status</TableHead>
                  <TableHead className="min-w-[100px]">Created</TableHead>
                  <TableHead className="text-right min-w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <TableSkeleton />
                    </TableCell>
                  </TableRow>
                ) : tickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Ticket className="h-8 w-8" />
                        <p>No tickets found</p>
                        <p className="text-xs">Try adjusting your filters or create a new ticket</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      {/* Ticket Code */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                            {ticket.ticketCode}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => handleCopyCode(ticket.ticketCode)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>

                      {/* Event Name */}
                      <TableCell>
                        <div className="max-w-[150px] truncate font-medium">
                          {ticket.event.name}
                        </div>
                      </TableCell>

                      {/* Holder Name */}
                      <TableCell>
                        <div className="max-w-[130px] truncate">
                          <div className="font-medium text-sm">{ticket.holderName}</div>
                          <div className="text-xs text-muted-foreground truncate">{ticket.holderEmail}</div>
                        </div>
                      </TableCell>

                      {/* Type */}
                      <TableCell>
                        <TicketTypeBadge type={ticket.ticketType} />
                      </TableCell>

                      {/* Price */}
                      <TableCell>
                        <span className="font-medium">
                          {ticket.currency} {ticket.price.toFixed(2)}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <StatusBadge status={ticket.status} />
                      </TableCell>

                      {/* Created */}
                      <TableCell className="text-muted-foreground text-xs">
                        {format(new Date(ticket.createdAt), 'MMM dd, yyyy')}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="View QR Code"
                            onClick={() => handleViewQR(ticket)}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Download PDF"
                            onClick={() => handleViewQR(ticket)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <ThermalPrintButton
                            ticket={{
                              id: ticket.id,
                              ticketCode: ticket.ticketCode,
                              ticketType: ticket.ticketType,
                              holderName: ticket.holderName,
                              holderEmail: ticket.holderEmail,
                              holderPhone: ticket.holderPhone,
                              seatNumber: ticket.seatNumber,
                              price: ticket.price,
                              currency: ticket.currency,
                              status: ticket.status,
                              issuedAt: ticket.issuedAt,
                              event: ticket.event,
                            }}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          />
                          {ticket.holderPhone && ticket.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                              title="Send via WhatsApp"
                              onClick={() => { setSelectedTicket(ticket); setQrOpen(true); }}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Edit Ticket"
                            onClick={() => handleEditOpen(ticket)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {ticket.status !== 'cancelled' && ticket.status !== 'used' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                              title="Cancel Ticket"
                              onClick={() => handleCancelOpen(ticket)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* ==================== Pagination ==================== */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1}&#x2013;{Math.min(page * limit, totalTickets)} of{' '}
                {totalTickets} tickets
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === page ? 'default' : 'outline'}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==================== Create Ticket Dialog ==================== */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau Ticket</DialogTitle>
            <DialogDescription>Créez un ticket avec tarif, options et code promo.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Event Select */}
            <div className="grid gap-2">
              <Label htmlFor="create-event">
                Événement <span className="text-red-500">*</span>
              </Label>
              <Select
                value={createForm.eventId}
                onValueChange={handleEventSelectForCreate}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un événement" />
                </SelectTrigger>
                <SelectContent>
                  {events.filter((e) => e.status === 'active').map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} ({e.currency} {e.price.toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fare Type Selection */}
            <FareTypeSelector
              eventId={createForm.eventId}
              selectedFareTypeId={createForm.fareTypeId || ''}
              onSelect={(fareTypeId) => {
                setCreateForm((prev) => ({ ...prev, fareTypeId }));
              }}
            />

            {/* Holder Info Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="create-name">Nom <span className="text-red-500">*</span></Label>
                <Input id="create-name" placeholder="Nom complet" value={createForm.holderName}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, holderName: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-email">Email <span className="text-red-500">*</span></Label>
                <Input id="create-email" type="email" placeholder="Adresse email" value={createForm.holderEmail}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, holderEmail: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="create-phone">Téléphone</Label>
                <Input id="create-phone" type="tel" placeholder="+221 7X XXX XX XX" value={createForm.holderPhone}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, holderPhone: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-seat">Siège</Label>
                <Input id="create-seat" placeholder="A-12" value={createForm.seatNumber}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, seatNumber: e.target.value }))} />
              </div>
            </div>

            {/* Extras Toggle */}
            <ExtrasSelector
              eventId={createForm.eventId}
              selectedExtras={createForm.extras || []}
              onChange={(extras) => setCreateForm((prev) => ({ ...prev, extras }))}
            />

            {/* Promo Code */}
            <PromoCodeInput
              eventId={createForm.eventId}
              onApply={(promoCode) => setCreateForm((prev) => ({ ...prev, promoCode }))}
            />

            {/* Price Summary */}
            <PricingSummary
              eventId={createForm.eventId}
              fareTypeId={createForm.fareTypeId || ''}
              extras={createForm.extras || []}
              promoCode={createForm.promoCode || ''}
              basePriceOverride={createForm.price ? parseFloat(createForm.price) : undefined}
              currency={createForm.currency}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>
              Annuler
            </Button>
            <Button onClick={handleCreateSubmit} disabled={createMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer le Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Ticket Purchase Dialog (New Engine) ==================== */}
      <TicketPurchaseDialog
        open={purchaseOpen}
        onOpenChange={(open) => { setPurchaseOpen(open); if (!open) setPurchaseDefaultEventId(undefined); }}
        onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['tickets'] }); queryClient.invalidateQueries({ queryKey: ['events-list-all'] }); }}
        defaultEventId={purchaseDefaultEventId}
      />

      {/* ==================== Bulk Generate Dialog ==================== */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Generate Tickets</DialogTitle>
            <DialogDescription>
              Quickly generate multiple tickets for an event. Tickets will be auto-assigned with sequential attendee numbers.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Event Select */}
            <div className="grid gap-2">
              <Label>
                Event <span className="text-red-500">*</span>
              </Label>
              <Select
                value={bulkForm.eventId}
                onValueChange={(v) => {
                  const ev = events.find((e) => e.id === v);
                  setBulkForm((prev) => ({
                    ...prev,
                    eventId: v,
                    price: ev ? String(ev.price) : prev.price,
                  }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  {events.filter((e) => e.status === 'active').map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Number of tickets */}
            <div className="grid gap-2">
              <Label htmlFor="bulk-count">
                Number of Tickets <span className="text-red-500">*</span>
              </Label>
              <Input
                id="bulk-count"
                type="number"
                min={1}
                max={1000}
                value={bulkForm.count}
                onChange={(e) =>
                  setBulkForm((prev) => ({
                    ...prev,
                    count: Math.min(1000, Math.max(1, parseInt(e.target.value) || 1)),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">Minimum 1, maximum 1000 tickets</p>
            </div>

            {/* Default Ticket Type */}
            <div className="grid gap-2">
              <Label>Default Ticket Type</Label>
              <Select
                value={bulkForm.ticketType}
                onValueChange={(v) => setBulkForm((prev) => ({ ...prev, ticketType: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIP">VIP</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="One-way">One-way</SelectItem>
                  <SelectItem value="Round-trip">Round-trip</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Default Price */}
            <div className="grid gap-2">
              <Label htmlFor="bulk-price">Default Price (optional)</Label>
              <Input
                id="bulk-price"
                type="number"
                step="0.01"
                placeholder="Auto from event"
                value={bulkForm.price}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, price: e.target.value }))}
              />
            </div>

            {/* Progress indicator */}
            {bulkGenerating && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Generating tickets...</span>
                  <span className="font-medium">{bulkProgress}%</span>
                </div>
                <Progress value={bulkProgress} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkGenerating}>
              Cancel
            </Button>
            <Button onClick={handleBulkSubmit} disabled={bulkGenerating || bulkMutation.isPending}>
              {bulkMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Generate Tickets
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== QR Code Viewer Dialog ==================== */}
      <Dialog open={qrOpen} onOpenChange={(open) => { setQrOpen(open); if (!open) { setSelectedTicket(null); setSelectedDetail(null); setQrDataUrl(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ticket QR Code</DialogTitle>
            <DialogDescription>Scan this QR code at the event entrance</DialogDescription>
          </DialogHeader>

          {detailLoading || !selectedDetail ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading ticket details...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-xl border shadow-sm">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Ticket QR Code"
                      className="w-56 h-56"
                    />
                  ) : (
                    <Skeleton className="w-56 h-56" />
                  )}
                </div>
              </div>

              {/* Ticket Details */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{selectedDetail.event.name}</span>
                  <StatusBadge status={selectedDetail.status} />
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-background px-2 py-0.5 rounded border">
                    {selectedDetail.ticketCode}
                  </code>
                  <TicketTypeBadge type={selectedDetail.ticketType} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Attendee</span>
                    <p className="font-medium">{selectedDetail.holderName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email</span>
                    <p className="font-medium text-sm truncate">{selectedDetail.holderEmail}</p>
                  </div>
                  {selectedDetail.seatNumber && (
                    <div>
                      <span className="text-muted-foreground">Seat</span>
                      <p className="font-medium">{selectedDetail.seatNumber}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Price</span>
                    <p className="font-medium">
                      {selectedDetail.currency} {selectedDetail.price.toFixed(2)}
                    </p>
                  </div>
                </div>
                {selectedDetail.event.location && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Location: </span>
                    <span>{selectedDetail.event.location}</span>
                  </div>
                )}
                {selectedDetail.event.startDate && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Date: </span>
                    <span>{format(new Date(selectedDetail.event.startDate), 'MMM dd, yyyy HH:mm')}</span>
                  </div>
                )}
              </div>

              {/* Scan History */}
              {selectedDetail.scans && selectedDetail.scans.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Scan History</h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {selectedDetail.scans.map((scan) => (
                      <div
                        key={scan.id}
                        className="flex items-center justify-between text-xs bg-muted/50 rounded px-3 py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              scan.result === 'valid' ? 'default' : 'destructive'
                            }
                            className="text-[10px] px-1.5 py-0"
                          >
                            {scan.result}
                          </Badge>
                          <span>by {scan.user.name}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {format(new Date(scan.createdAt), 'MMM dd HH:mm')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleDownloadQR}
              disabled={!qrDataUrl}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Download QR
            </Button>
            <Button
              onClick={handleDownloadPDF}
              disabled={!selectedDetail || !qrDataUrl}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Download PDF Ticket
            </Button>
            {selectedDetail && (
              <ThermalPrintButton
                ticket={{
                  id: selectedDetail.id,
                  ticketCode: selectedDetail.ticketCode,
                  ticketType: selectedDetail.ticketType,
                  holderName: selectedDetail.holderName,
                  holderEmail: selectedDetail.holderEmail,
                  holderPhone: selectedDetail.holderPhone,
                  seatNumber: selectedDetail.seatNumber,
                  price: selectedDetail.price,
                  currency: selectedDetail.currency,
                  status: selectedDetail.status,
                  issuedAt: selectedDetail.issuedAt,
                  event: selectedDetail.event,
                }}
                variant="outline"
                size="default"
                className="w-full sm:w-auto"
                qrDataUrl={qrDataUrl}
              />
            )}
            <Button
              onClick={handleSendWhatsApp}
              disabled={!selectedDetail}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Edit Ticket Dialog ==================== */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Ticket</DialogTitle>
            <DialogDescription>
              Update ticket information. Used tickets cannot be modified.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Code:</span>
                <code className="text-xs font-mono">{selectedTicket?.ticketCode}</code>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">Event:</span>
                <span className="text-xs font-medium">{selectedTicket?.event.name}</span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>
                Holder Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={editForm.holderName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, holderName: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label>
                Holder Email <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                value={editForm.holderEmail}
                onChange={(e) => setEditForm((prev) => ({ ...prev, holderEmail: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={editForm.holderPhone}
                onChange={(e) => setEditForm((prev) => ({ ...prev, holderPhone: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label>Seat Number</Label>
              <Input
                value={editForm.seatNumber}
                onChange={(e) => setEditForm((prev) => ({ ...prev, seatNumber: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label>Ticket Type</Label>
              <Select
                value={editForm.ticketType}
                onValueChange={(v) => setEditForm((prev) => ({ ...prev, ticketType: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIP">VIP</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="One-way">One-way</SelectItem>
                  <SelectItem value="Round-trip">Round-trip</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSubmit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Cancel Ticket Dialog ==================== */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Cancel Ticket</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The ticket will be marked as cancelled and a refund transaction will be created.
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="font-medium text-sm">You are about to cancel:</span>
              </div>
              <div className="ml-6 space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Code: </span>
                  <code className="font-mono text-xs">{selectedTicket.ticketCode}</code>
                </p>
                <p>
                  <span className="text-muted-foreground">Event: </span>
                  {selectedTicket.event.name}
                </p>
                <p>
                  <span className="text-muted-foreground">Holder: </span>
                  {selectedTicket.holderName}
                </p>
                <p>
                  <span className="text-muted-foreground">Price: </span>
                  {selectedTicket.currency} {selectedTicket.price.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep Ticket</Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Trash2 className="h-4 w-4" />
              Cancel Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Sub-components: Fare Type, Extras, Promo, Pricing
// ============================================================

function FareTypeSelector({ eventId, selectedFareTypeId, onSelect }: {
  eventId: string;
  selectedFareTypeId: string;
  onSelect: (id: string) => void;
}) {
  const { data: fareTypesData } = useQuery<{ data: Array<{ id: string; slug: string; name: string; emoji: string; priceModifier: number; requiresProof: boolean; proofLabel: string; ageMin: number | null; ageMax: number | null }> }>({
    queryKey: ['fare-types'],
    queryFn: () => apiFetch('/api/fare-types'),
    enabled: !!eventId,
  });

  const fareTypes = fareTypesData?.data || [];

  if (!eventId || fareTypes.length === 0) return null;

  return (
    <div className="grid gap-2">
      <Label>Type de Tarif</Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {fareTypes.map((ft) => {
          const isSelected = selectedFareTypeId === ft.id;
          const modifierPercent = Math.round((ft.priceModifier - 1) * 100);
          return (
            <button
              key={ft.id}
              type="button"
              onClick={() => onSelect(isSelected ? '' : ft.id)}
              className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 text-center transition-all ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                  : 'border-border hover:border-emerald-300 hover:bg-muted/30'
              }`}
            >
              <span className="text-xl">{ft.emoji}</span>
              <span className="text-xs font-medium leading-tight">{ft.name}</span>
              <span className={`text-[10px] font-semibold ${modifierPercent < 0 ? 'text-emerald-600' : modifierPercent > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                {modifierPercent === 0 ? 'Plein tarif' : modifierPercent > 0 ? `+${modifierPercent}%` : `${modifierPercent}%`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExtrasSelector({ eventId, selectedExtras, onChange }: {
  eventId: string;
  selectedExtras: Array<{ extraId: string; quantity: number; details: string }>;
  onChange: (extras: Array<{ extraId: string; quantity: number; details: string }>) => void;
}) {
  const { data: extrasData } = useQuery<{ data: Array<{ id: string; slug: string; name: string; emoji: string; pricingType: string; basePrice: number; requiresDetails: boolean; detailLabel: string; maxPerTicket: number }> }>({
    queryKey: ['ticket-extras'],
    queryFn: () => apiFetch('/api/ticket-extras'),
    enabled: !!eventId,
  });

  const extras = extrasData?.data || [];

  if (!eventId || extras.length === 0) return null;

  const toggleExtra = (extraId: string) => {
    const exists = selectedExtras.find((e) => e.extraId === extraId);
    if (exists) {
      onChange(selectedExtras.filter((e) => e.extraId !== extraId));
    } else {
      onChange([...selectedExtras, { extraId, quantity: 1, details: '' }]);
    }
  };

  const updateQuantity = (extraId: string, qty: number) => {
    onChange(selectedExtras.map((e) => e.extraId === extraId ? { ...e, quantity: Math.max(1, qty) } : e));
  };

  const updateDetails = (extraId: string, details: string) => {
    onChange(selectedExtras.map((e) => e.extraId === extraId ? { ...e, details } : e));
  };

  const fmtFCFA = (n: number) => n.toLocaleString('fr-FR') + ' FCFA';

  return (
    <div className="grid gap-2">
      <Label>Options Supplémentaires</Label>
      <div className="space-y-2">
        {extras.map((extra) => {
          const selected = selectedExtras.find((e) => e.extraId === extra.id);
          return (
            <div key={extra.id} className={`rounded-lg border p-3 transition-all ${selected ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-border'}`}>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleExtra(extra.id)}
                  className="flex items-center gap-2 text-left"
                >
                  <span className="text-lg">{extra.emoji}</span>
                  <div>
                    <p className="text-sm font-medium">{extra.name}</p>
                    <p className="text-xs text-muted-foreground">{fmtFCFA(extra.basePrice)}</p>
                  </div>
                </button>
                {selected && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(extra.id, selected.quantity - 1)}
                    >
                      -
                    </Button>
                    <span className="text-sm font-semibold w-6 text-center">{selected.quantity}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(extra.id, selected.quantity + 1)}
                    >
                      +
                    </Button>
                  </div>
                )}
              </div>
              {selected && extra.requiresDetails && (
                <Input
                  className="mt-2 h-8 text-xs"
                  placeholder={extra.detailLabel || 'Détails...'}
                  value={selected.details}
                  onChange={(e) => updateDetails(extra.id, e.target.value)}
                />
              )}
              {selected && (
                <p className="text-xs text-emerald-600 font-medium mt-1">
                  Sous-total: {fmtFCFA(extra.basePrice * selected.quantity)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PromoCodeInput({ eventId, onApply }: {
  eventId: string;
  onApply: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');

  const checkPromo = useCallback(async () => {
    if (!code.trim() || !eventId) return;
    setStatus('checking');
    try {
      const res = await fetch('/api/pricing/calculate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ eventId, promoCode: code }),
      });
      const data = await res.json();
      if (data.promo) {
        setStatus('valid');
        onApply(code.trim());
      } else {
        setStatus('invalid');
      }
    } catch {
      setStatus('invalid');
    }
  }, [code, eventId, onApply]);

  if (!eventId) return null;

  return (
    <div className="grid gap-2">
      <Label>Code Promo</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="BIENVENUE10"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setStatus('idle'); }}
            className={`font-mono text-sm uppercase ${status === 'valid' ? 'border-emerald-500' : status === 'invalid' ? 'border-red-500' : ''}`}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={checkPromo}
          disabled={!code.trim() || status === 'checking'}
        >
          {status === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Appliquer'}
        </Button>
      </div>
      {status === 'valid' && <p className="text-xs text-emerald-600 font-medium">✅ Code promo appliqué</p>}
      {status === 'invalid' && <p className="text-xs text-red-500">❌ Code invalide ou expiré</p>}
    </div>
  );
}

function PricingSummary({ eventId, fareTypeId, extras, promoCode, basePriceOverride, currency }: {
  eventId: string;
  fareTypeId: string;
  extras: Array<{ extraId: string; quantity: number; details: string }>;
  promoCode: string;
  basePriceOverride?: number;
  currency: string;
}) {
  const { data: pricing } = useQuery<{
    basePrice: number;
    modifiedPrice: number;
    extrasTotal: number;
    subtotal: number;
    promo: { code: string; type: string; value: number; discount: number } | null;
    total: number;
    currency: string;
  }>({
    queryKey: ['pricing', eventId, fareTypeId, extras, promoCode],
    queryFn: () =>
      apiFetch('/api/pricing/calculate', {
        method: 'POST',
        body: JSON.stringify({ eventId, fareTypeId: fareTypeId || undefined, extras, promoCode: promoCode || undefined }),
      }),
    enabled: !!eventId,
  });

  if (!eventId || !pricing) return null;

  const hasExtras = pricing.extrasTotal > 0;
  const hasPromo = !!pricing.promo;
  const hasFare = pricing.basePrice !== pricing.modifiedPrice;
  const hasBreakdown = hasExtras || hasPromo || hasFare;

  if (!hasBreakdown) {
    return (
      <div className="rounded-lg bg-muted/50 border p-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-lg font-bold">{pricing.currency} {pricing.total.toLocaleString()}</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Récapitulatif</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Prix de base</span>
          <span>{pricing.currency} {pricing.basePrice.toLocaleString()}</span>
        </div>
        {hasFare && (
          <div className="flex justify-between text-emerald-600">
            <span>Tarif appliqué</span>
            <span>= {pricing.currency} {pricing.modifiedPrice.toLocaleString()}</span>
          </div>
        )}
        {hasExtras && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Options</span>
            <span>+ {pricing.currency} {pricing.extrasTotal.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between text-muted-foreground">
          <span>Sous-total</span>
          <span>{pricing.currency} {pricing.subtotal.toLocaleString()}</span>
        </div>
        {hasPromo && (
          <div className="flex justify-between text-amber-600">
            <span>🎁 Promo {pricing.promo!.code} ({pricing.promo!.type === 'percent' ? `${pricing.promo!.value}%` : `${pricing.promo!.value} FCFA`})</span>
            <span>- {pricing.currency} {pricing.promo!.discount.toLocaleString()}</span>
          </div>
        )}
        <div className="border-t pt-1 mt-1 flex justify-between font-bold text-base">
          <span>TOTAL</span>
          <span className="text-emerald-600">{pricing.currency} {pricing.total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
