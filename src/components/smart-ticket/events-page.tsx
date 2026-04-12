'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  MapPin,
  Calendar,
  DollarSign,
  Users,
  Bus,
  Ship,
  Music,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Tickets,
  TrendingUp,
  CalendarDays,
  Loader2,
  X,
} from 'lucide-react';

import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { useAppStore } from '@/store/app-store';
import { usePermissions, useCanAny, type Permission } from '@/hooks/use-permissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

// ── Types ───────────────────────────────────────────────────────────────────

interface EventItem {
  id: string;
  name: string;
  type: string;
  description: string | null;
  location: string | null;
  startDate: string;
  endDate: string;
  totalTickets: number;
  soldTickets: number;
  price: number;
  currency: string;
  status: string;
  image?: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  _count?: { tickets: number };
  user?: { id: string; name: string; email: string };
}

interface EventsResponse {
  data: EventItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface EventFormData {
  name: string;
  type: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  totalTickets: number;
  price: number;
  currency: string;
  status: string;
}

type EventType = 'all' | 'event' | 'bus' | 'boat' | 'ferry';
type EventStatus = 'all' | 'active' | 'paused' | 'completed' | 'cancelled';

// ── Constants ───────────────────────────────────────────────────────────────

const EVENT_TYPE_OPTIONS = [
  { value: 'event', label: 'Event' },
  { value: 'bus', label: 'Bus' },
  { value: 'boat', label: 'Boat' },
  { value: 'ferry', label: 'Ferry' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'XOF', label: 'XOF (CFA)' },
  { value: 'XAF', label: 'XAF (CFA)' },
  { value: 'GBP', label: 'GBP (£)' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const INITIAL_FORM: EventFormData = {
  name: '',
  type: 'event',
  description: '',
  location: '',
  startDate: '',
  endDate: '',
  totalTickets: 100,
  price: 0,
  currency: 'USD',
  status: 'active',
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

// ── Helpers ─────────────────────────────────────────────────────────────────

function getTypeIcon(type: string) {
  switch (type) {
    case 'bus':
      return <Bus className="size-4" />;
    case 'boat':
    case 'ferry':
      return <Ship className="size-4" />;
    default:
      return <Music className="size-4" />;
  }
}

function getTypeLabel(type: string) {
  return EVENT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'paused':
      return 'secondary';
    case 'completed':
      return 'outline';
    case 'cancelled':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'bg-emerald-500 text-white';
    case 'paused':
      return 'bg-amber-500 text-white';
    case 'completed':
      return 'bg-zinc-400 text-white';
    case 'cancelled':
      return 'bg-red-500 text-white';
    default:
      return 'bg-zinc-400 text-white';
  }
}

function getCurrencySymbol(currency: string) {
  const map: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    XOF: 'CFA',
    XAF: 'CFA',
  };
  return map[currency] ?? currency;
}

function formatDate(dateStr: string) {
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string) {
  try {
    return format(new Date(dateStr), 'MMM d, yyyy HH:mm');
  } catch {
    return dateStr;
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function EventsPage() {
  const token = useAuthStore((s) => s.token);
  const orgId = useOrgStore((s) => s.currentOrganization?.id);

  // Filter state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<EventType>('all');
  const [statusFilter, setStatusFilter] = useState<EventStatus>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeLimitInfo, setUpgradeLimitInfo] = useState({ limit: 0, label: 'événements' });
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  // Form state
  const [formData, setFormData] = useState<EventFormData>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof EventFormData, string>>>({});

  const queryClient = useQueryClient();

  // ── API calls ────────────────────────────────────────────────────────────

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search.trim()) params.set('search', search.trim());
    params.set('page', String(page));
    params.set('limit', String(pageSize));
    return `/api/events?${params.toString()}`;
  }, [typeFilter, statusFilter, search, page, pageSize]);

  const {
    data: eventsData,
    isLoading,
    isError,
  } = useQuery<EventsResponse>({
    queryKey: ['events', typeFilter, statusFilter, search, page, pageSize],
    queryFn: async () => {
      const res = await fetch(buildUrl(), {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch events');
      }
      return res.json();
    },
    placeholderData: (prev) => prev,
  });

  const createMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create event');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event created successfully');
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: Error & { needsUpgrade?: boolean; limit?: number }) => {
      if (error.needsUpgrade) {
        setShowCreateDialog(false);
        resetForm();
        setUpgradeLimitInfo({ limit: error.limit || 0, label: 'événements' });
        setShowUpgradeDialog(true);
      } else {
        toast.error(error.message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EventFormData> }) => {
      const res = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update event');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event updated successfully');
      setShowEditDialog(false);
      setSelectedEvent(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete event');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event deleted successfully');
      setShowDeleteDialog(false);
      setSelectedEvent(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // ── Computed values ──────────────────────────────────────────────────────

  const events = eventsData?.data ?? [];
  const totalPages = eventsData?.totalPages ?? 1;

  const stats = useMemo(() => {
    const allEvents = eventsData?.data ?? [];
    return {
      total: eventsData?.total ?? 0,
      active: allEvents.filter((e) => e.status === 'active').length,
      totalTickets: allEvents.reduce((sum, e) => sum + (e._count?.tickets ?? e.soldTickets ?? 0), 0),
      totalRevenue: allEvents.reduce((sum, e) => {
        const sold = e._count?.tickets ?? e.soldTickets ?? 0;
        return sum + sold * e.price;
      }, 0),
    };
  }, [eventsData]);

  // ── Form helpers ─────────────────────────────────────────────────────────

  function resetForm() {
    setFormData(INITIAL_FORM);
    setFormErrors({});
  }

  function validateForm(data: EventFormData): boolean {
    const errors: Partial<Record<keyof EventFormData, string>> = {};
    if (!data.name.trim()) errors.name = 'Name is required';
    if (!data.startDate) errors.startDate = 'Start date is required';
    if (!data.endDate) errors.endDate = 'End date is required';
    if (data.startDate && data.endDate && data.startDate >= data.endDate) {
      errors.endDate = 'End date must be after start date';
    }
    if (data.price < 0) errors.price = 'Price must be >= 0';
    if (data.totalTickets < 1) errors.totalTickets = 'Must have at least 1 ticket';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validateForm(formData)) {
      createMutation.mutate(formData);
    }
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEvent) return;
    if (validateForm(formData)) {
      updateMutation.mutate({ id: selectedEvent.id, data: formData });
    }
  }

  function openEditDialog(event: EventItem) {
    setSelectedEvent(event);
    setFormData({
      name: event.name,
      type: event.type,
      description: event.description ?? '',
      location: event.location ?? '',
      startDate: format(new Date(event.startDate), "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(event.endDate), "yyyy-MM-dd'T'HH:mm"),
      totalTickets: event.totalTickets,
      price: event.price,
      currency: event.currency,
      status: event.status,
    });
    setFormErrors({});
    setShowEditDialog(true);
  }

  function openDeleteDialog(event: EventItem) {
    setSelectedEvent(event);
    setShowDeleteDialog(true);
  }

  function openViewDialog(event: EventItem) {
    setSelectedEvent(event);
    setShowViewDialog(true);
  }

  // Reset page on filter changes
  function handleTypeFilterChange(value: string) {
    setTypeFilter(value as EventType);
    setPage(1);
  }
  function handleStatusFilterChange(value: string) {
    setStatusFilter(value as EventStatus);
    setPage(1);
  }
  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Events & Transport
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your events, bus routes, and ferry services
          </p>
        </div>
        {useCanAny(['events.create' as Permission, 'events.edit' as Permission]) && (
          <Button
            onClick={() => {
              resetForm();
              setShowCreateDialog(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <Plus className="size-4" />
            Create Event
          </Button>
        )}
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <CalendarDays className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats.total}</div>
            )}
            <p className="text-muted-foreground text-xs">All types combined</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <TrendingUp className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-emerald-600">
                {stats.active}
              </div>
            )}
            <p className="text-muted-foreground text-xs">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Tickets className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {stats.totalTickets.toLocaleString()}
              </div>
            )}
            <p className="text-muted-foreground text-xs">Sold across all events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                ${stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            )}
            <p className="text-muted-foreground text-xs">Estimated total</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Type Tabs */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Tabs
                value={typeFilter}
                onValueChange={handleTypeFilterChange}
                className="w-full sm:w-auto"
              >
                <TabsList className="w-full sm:w-auto overflow-x-auto">
                  <TabsTrigger value="all" className="gap-1.5">
                    <Filter className="size-3.5" />
                    All
                  </TabsTrigger>
                  <TabsTrigger value="event" className="gap-1.5">
                    <Music className="size-3.5" />
                    Events
                  </TabsTrigger>
                  <TabsTrigger value="bus" className="gap-1.5">
                    <Bus className="size-3.5" />
                    Bus
                  </TabsTrigger>
                  <TabsTrigger value="boat" className="gap-1.5">
                    <Ship className="size-3.5" />
                    Boat
                  </TabsTrigger>
                  <TabsTrigger value="ferry" className="gap-1.5">
                    <Ship className="size-3.5" />
                    Ferry
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex gap-2 items-center">
                {/* Status Select */}
                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>

                {/* Search */}
                <div className="relative flex-1 min-w-0">
                  <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                  <Input
                    placeholder="Search events..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9"
                  />
                  {search && (
                    <button
                      onClick={() => handleSearchChange('')}
                      className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Events Grid / Table ─────────────────────────────────────────── */}
      {isLoading && events.length === 0 ? (
        <LoadingGrid />
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-red-500 mb-4">
              <X className="size-12" />
            </div>
            <p className="text-lg font-medium">Failed to load events</p>
            <p className="text-muted-foreground text-sm">Please try again later</p>
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <EmptyState onCreate={() => setShowCreateDialog(true)} search={search} />
      ) : (
        <>
          {/* Mobile: Card Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onEdit={openEditDialog}
                onDelete={openDeleteDialog}
                onView={openViewDialog}
              />
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden lg:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[280px]">Event</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Tickets</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <EventTableRow
                        key={event.id}
                        event={event}
                        onEdit={openEditDialog}
                        onDelete={openDeleteDialog}
                        onView={openViewDialog}
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* ── Pagination ─────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              totalItems={eventsData?.total ?? 0}
            />
          )}
        </>
      )}

      {/* ── Create Event Dialog ─────────────────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
            <DialogDescription>
              Fill in the details to create a new event or transport service
            </DialogDescription>
          </DialogHeader>
          <EventForm
            formData={formData}
            formErrors={formErrors}
            onChange={(data) => setFormData(data)}
            onSubmit={handleCreateSubmit}
            isLoading={createMutation.isPending}
            submitLabel="Create Event"
          />
        </DialogContent>
      </Dialog>

      {/* ── Edit Event Dialog ───────────────────────────────────────────── */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) {
          setSelectedEvent(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>
              Update the event or transport service details
            </DialogDescription>
          </DialogHeader>
          <EventForm
            formData={formData}
            formErrors={formErrors}
            onChange={(data) => setFormData(data)}
            onSubmit={handleEditSubmit}
            isLoading={updateMutation.isPending}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>

      {/* ── View Event Dialog ───────────────────────────────────────────── */}
      <Dialog open={showViewDialog} onOpenChange={(open) => {
        setShowViewDialog(open);
        if (!open) setSelectedEvent(null);
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getTypeIcon(selectedEvent.type)}
                  {selectedEvent.name}
                </DialogTitle>
                <DialogDescription>
                  {getTypeLabel(selectedEvent.type)} • {selectedEvent.location ?? 'No location'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(selectedEvent.status)}>
                    {selectedEvent.status.charAt(0).toUpperCase() + selectedEvent.status.slice(1)}
                  </Badge>
                </div>

                {selectedEvent.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedEvent.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> Location
                    </p>
                    <p className="font-medium">{selectedEvent.location ?? 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="size-3.5" /> Start
                    </p>
                    <p className="font-medium">{formatDateTime(selectedEvent.startDate)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="size-3.5" /> End
                    </p>
                    <p className="font-medium">{formatDateTime(selectedEvent.endDate)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1.5">
                      <DollarSign className="size-3.5" /> Price
                    </p>
                    <p className="font-medium">
                      {getCurrencySymbol(selectedEvent.currency)}{selectedEvent.price.toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1.5">
                      <Tickets className="size-3.5" /> Sold
                    </p>
                    <p className="font-medium">
                      {selectedEvent._count?.tickets ?? selectedEvent.soldTickets} / {selectedEvent.totalTickets}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1.5">
                      <Users className="size-3.5" /> Created
                    </p>
                    <p className="font-medium">{formatDate(selectedEvent.createdAt)}</p>
                  </div>
                </div>

                {(selectedEvent._count?.tickets ?? selectedEvent.soldTickets) > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Ticket Sales Progress</p>
                    <Progress
                      value={
                        ((selectedEvent._count?.tickets ?? selectedEvent.soldTickets) / selectedEvent.totalTickets) * 100
                      }
                    />
                    <p className="text-muted-foreground text-xs">
                      {((selectedEvent._count?.tickets ?? selectedEvent.soldTickets) / selectedEvent.totalTickets * 100).toFixed(1)}% sold
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Upgrade Dialog ────────────────────────────────────────────── */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Limite d&apos;événements atteinte</DialogTitle>
            <DialogDescription>
              Votre plan actuel permet {upgradeLimitInfo.limit} {upgradeLimitInfo.label}. Passez à un plan supérieur pour en créer davantage.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Fermer
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                setShowUpgradeDialog(false);
                useAppStore.getState().setCurrentPage('billing');
              }}
            >
              Mettre à niveau
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────────────── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{selectedEvent?.name}&rdquo;? This will cancel the event and mark all associated tickets. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDeleteDialog(false);
                setSelectedEvent(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedEvent) deleteMutation.mutate(selectedEvent.id);
              }}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Sub-Components ──────────────────────────────────────────────────────────

function EventForm({
  formData,
  formErrors,
  onChange,
  onSubmit,
  isLoading,
  submitLabel,
}: {
  formData: EventFormData;
  formErrors: Partial<Record<keyof EventFormData, string>>;
  onChange: (data: EventFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  submitLabel: string;
}) {
  const update = (field: keyof EventFormData, value: string | number) => {
    onChange({ ...formData, [field]: value });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Enter event name"
          className={formErrors.name ? 'border-red-500' : ''}
        />
        {formErrors.name && (
          <p className="text-red-500 text-xs">{formErrors.name}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select value={formData.type} onValueChange={(v) => update('type', v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(v) => update('status', v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Describe the event..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          value={formData.location}
          onChange={(e) => update('location', e.target.value)}
          placeholder="Event venue or route"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date *</Label>
          <Input
            id="startDate"
            type="datetime-local"
            value={formData.startDate}
            onChange={(e) => update('startDate', e.target.value)}
            className={formErrors.startDate ? 'border-red-500' : ''}
          />
          {formErrors.startDate && (
            <p className="text-red-500 text-xs">{formErrors.startDate}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date *</Label>
          <Input
            id="endDate"
            type="datetime-local"
            value={formData.endDate}
            onChange={(e) => update('endDate', e.target.value)}
            className={formErrors.endDate ? 'border-red-500' : ''}
          />
          {formErrors.endDate && (
            <p className="text-red-500 text-xs">{formErrors.endDate}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="totalTickets">Total Tickets</Label>
          <Input
            id="totalTickets"
            type="number"
            min={1}
            value={formData.totalTickets}
            onChange={(e) => update('totalTickets', parseInt(e.target.value) || 0)}
            className={formErrors.totalTickets ? 'border-red-500' : ''}
          />
          {formErrors.totalTickets && (
            <p className="text-red-500 text-xs">{formErrors.totalTickets}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Price</Label>
          <Input
            id="price"
            type="number"
            min={0}
            step="0.01"
            value={formData.price}
            onChange={(e) => update('price', parseFloat(e.target.value) || 0)}
            className={formErrors.price ? 'border-red-500' : ''}
          />
          {formErrors.price && (
            <p className="text-red-500 text-xs">{formErrors.price}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="currency">Currency</Label>
        <Select value={formData.currency} onValueChange={(v) => update('currency', v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          {isLoading && <Loader2 className="size-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EventCard({
  event,
  onEdit,
  onDelete,
  onView,
}: {
  event: EventItem;
  onEdit: (e: EventItem) => void;
  onDelete: (e: EventItem) => void;
  onView: (e: EventItem) => void;
}) {
  const sold = event._count?.tickets ?? event.soldTickets;
  const progressPercent = event.totalTickets > 0
    ? (sold / event.totalTickets) * 100
    : 0;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {getTypeIcon(event.type)}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold truncate">
                {event.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusColor(event.status)} variant="secondary">
                  {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                </Badge>
                <span className="text-muted-foreground text-xs">{getTypeLabel(event.type)}</span>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(event)}>
                <Eye className="mr-2 size-4" /> View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(event)}>
                <Edit className="mr-2 size-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(event)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 size-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {event.location && (
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}
        <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <Calendar className="size-3.5 shrink-0" />
          <span>{formatDate(event.startDate)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <DollarSign className="size-3.5" />
            {getCurrencySymbol(event.currency)}{event.price.toLocaleString()}
          </div>
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Users className="size-3.5" />
            {sold} sold
          </div>
        </div>

        {/* Ticket progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tickets</span>
            <span className="font-medium">{sold} / {event.totalTickets}</span>
          </div>
          <Progress value={progressPercent} />
        </div>

        {/* Quick revenue */}
        <div className="text-muted-foreground flex items-center justify-between border-t pt-2 text-xs">
          <span>Revenue</span>
          <span className="font-medium text-foreground">
            {getCurrencySymbol(event.currency)}{(sold * event.price).toLocaleString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function EventTableRow({
  event,
  onEdit,
  onDelete,
  onView,
}: {
  event: EventItem;
  onEdit: (e: EventItem) => void;
  onDelete: (e: EventItem) => void;
  onView: (e: EventItem) => void;
}) {
  const sold = event._count?.tickets ?? event.soldTickets;
  const progressPercent = event.totalTickets > 0
    ? (sold / event.totalTickets) * 100
    : 0;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {getTypeIcon(event.type)}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate max-w-[200px]">{event.name}</p>
            <p className="text-muted-foreground text-xs">
              {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="gap-1">
          {getTypeIcon(event.type)}
          {getTypeLabel(event.type)}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate max-w-[150px]">{event.location ?? 'N/A'}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">{formatDate(event.startDate)}</div>
      </TableCell>
      <TableCell className="text-right">
        <span className="font-medium">
          {getCurrencySymbol(event.currency)}{event.price.toLocaleString()}
        </span>
      </TableCell>
      <TableCell>
        <div className="space-y-1 min-w-[120px]">
          <div className="flex items-center justify-between text-xs">
            <span>{sold} / {event.totalTickets}</span>
            <span className="text-muted-foreground">{progressPercent.toFixed(0)}%</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      </TableCell>
      <TableCell>
        <Badge className={getStatusColor(event.status)} variant="secondary">
          {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onView(event)}>
            <Eye className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onEdit(event)}>
            <Edit className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => onDelete(event)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function EmptyState({ onCreate, search }: { onCreate: () => void; search: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-muted flex size-16 items-center justify-center rounded-full mb-4">
          <CalendarDays className="text-muted-foreground size-8" />
        </div>
        <h3 className="text-lg font-semibold">No Events Found</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          {search || 'all' ? 'Try adjusting your search or filters to find what you\'re looking for.' : 'Get started by creating your first event or transport service.'}
        </p>
        {!search && (
          <Button
            onClick={onCreate}
            className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <Plus className="size-4" />
            Create your first event
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-2 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const pages = useMemo(() => {
    const items: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      items.push(1);
      if (page > 3) items.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) items.push(i);
      if (page < totalPages - 2) items.push('...');
      items.push(totalPages);
    }
    return items;
  }, [page, totalPages]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground text-sm">
        Showing {Math.min((page - 1) * pageSize + 1, totalItems)}&ndash;
        {Math.min(page * pageSize, totalItems)} of {totalItems} events
      </p>

      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="w-[80px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((s) => (
              <SelectItem key={s} value={String(s)} className="text-xs">
                {s} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
          </Button>
          {pages.map((p, i) =>
            p === '...' ? (
              <span key={`dots-${i}`} className="px-1 text-muted-foreground text-sm">
                ...
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? 'default' : 'outline'}
                size="icon"
                className="size-8"
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            )
          )}
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
