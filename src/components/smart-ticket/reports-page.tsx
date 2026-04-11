'use client';

import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  BarChart3,
  Download,
  FileText,
  FileSpreadsheet,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { cn } from '@/lib/utils';

// ==================== Types ====================

interface EventOption {
  id: string;
  name: string;
  status: string;
}

interface ReportTicket {
  id: string;
  ticketCode: string;
  eventId: string;
  ticketType: string;
  holderName: string;
  holderEmail: string;
  price: number;
  currency: string;
  status: string;
  issuedAt: string;
  event: {
    id: string;
    name: string;
  };
}

interface ReportsResponse {
  data: ReportTicket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface EventsResponse {
  data: EventOption[];
  total: number;
}

// ==================== API Helpers ====================

function getApiHeaders() {
  const token = useAuthStore.getState().token;
  const orgId = useOrgStore.getState().currentOrganization?.id;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Organization-Id': orgId || '',
  };
}

// ==================== Constants ====================

const STATUS_OPTIONS = ['all', 'active', 'used', 'expired', 'cancelled'];
const TICKET_TYPE_OPTIONS = ['all', 'Standard', 'VIP', 'Premium', 'Early Bird'];
const PAGE_LIMIT = 20;

// ==================== Sub-components ====================

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    active: {
      label: 'Active',
      className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    },
    used: {
      label: 'Used',
      className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
    },
    expired: {
      label: 'Expired',
      className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    },
    cancelled: {
      label: 'Cancelled',
      className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
    },
  };
  const c = config[status] || config.active;
  return (
    <Badge variant="outline" className={c.className}>
      {c.label}
    </Badge>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20 ml-auto" />
        </div>
      ))}
    </div>
  );
}

// ==================== Main Component ====================

export default function ReportsPage() {
  const { token } = useAuthStore();

  // Filter state
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ticketTypeFilter, setTicketTypeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Pagination
  const [page, setPage] = useState(1);

  // Applied filters (for query key stability)
  const [appliedFilters, setAppliedFilters] = useState({
    event: 'all',
    status: 'all',
    ticketType: 'all',
    startDate: '',
    endDate: '',
    search: '',
  });

  // ==================== Queries ====================

  const { data: eventsData } = useQuery<EventsResponse>({
    queryKey: ['events-list-reports'],
    queryFn: async () => {
      const res = await fetch('/api/events?limit=100', {
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch events');
      return res.json();
    },
    enabled: !!token,
  });

  const { data: reportsData, isLoading } = useQuery<ReportsResponse>({
    queryKey: ['reports', appliedFilters, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT),
      });
      if (appliedFilters.event && appliedFilters.event !== 'all') {
        params.set('event', appliedFilters.event);
      }
      if (appliedFilters.status && appliedFilters.status !== 'all') {
        params.set('status', appliedFilters.status);
      }
      if (appliedFilters.ticketType && appliedFilters.ticketType !== 'all') {
        params.set('type', appliedFilters.ticketType);
      }
      if (appliedFilters.startDate) params.set('from', appliedFilters.startDate);
      if (appliedFilters.endDate) params.set('to', appliedFilters.endDate);
      if (appliedFilters.search) params.set('search', appliedFilters.search);

      const res = await fetch(`/api/reports/tickets?${params.toString()}`, {
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch reports');
      return res.json();
    },
    enabled: !!token,
  });

  // ==================== Handlers ====================

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({
      event: eventFilter,
      status: statusFilter,
      ticketType: ticketTypeFilter,
      startDate,
      endDate,
      search: searchInput,
    });
    setPage(1);
  }, [eventFilter, statusFilter, ticketTypeFilter, startDate, endDate, searchInput]);

  const handleResetFilters = useCallback(() => {
    setEventFilter('all');
    setStatusFilter('all');
    setTicketTypeFilter('all');
    setStartDate('');
    setEndDate('');
    setSearch('');
    setSearchInput('');
    setAppliedFilters({
      event: 'all',
      status: 'all',
      ticketType: 'all',
      startDate: '',
      endDate: '',
      search: '',
    });
    setPage(1);
  }, []);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleApplyFilters();
    },
    [handleApplyFilters],
  );

  const buildExportUrl = useCallback(
    (format: 'csv' | 'pdf') => {
      const params = new URLSearchParams();
      if (appliedFilters.event && appliedFilters.event !== 'all') {
        params.set('event', appliedFilters.event);
      }
      if (appliedFilters.status && appliedFilters.status !== 'all') {
        params.set('status', appliedFilters.status);
      }
      if (appliedFilters.ticketType && appliedFilters.ticketType !== 'all') {
        params.set('type', appliedFilters.ticketType);
      }
      if (appliedFilters.startDate) params.set('from', appliedFilters.startDate);
      if (appliedFilters.endDate) params.set('to', appliedFilters.endDate);
      if (appliedFilters.search) params.set('search', appliedFilters.search);

      return `/api/reports/export-${format}?${params.toString()}`;
    },
    [appliedFilters],
  );

  const handleExportCSV = useCallback(() => {
    try {
      const url = buildExportUrl('csv');
      window.open(url, '_blank');
      toast.success('Exporting CSV report...');
    } catch {
      toast.error('Failed to export CSV');
    }
  }, [buildExportUrl]);

  const handleExportPDF = useCallback(async () => {
    try {
      const url = buildExportUrl('pdf');
      const headers = getApiHeaders();
      const res = await fetch(url, { headers });
      if (!res.ok) {
        toast.error('Failed to export PDF');
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `ticket-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success('PDF report downloaded');
    } catch {
      toast.error('Failed to export PDF');
    }
  }, [buildExportUrl]);

  // ==================== Computed ====================

  const events = eventsData?.data || [];
  const tickets = reportsData?.data || [];
  const totalTickets = reportsData?.pagination?.total || 0;
  const totalPages = reportsData?.pagination?.totalPages || 1;
  const from = totalTickets === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const to = Math.min(page * PAGE_LIMIT, totalTickets);

  const hasActiveFilters =
    appliedFilters.event !== 'all' ||
    appliedFilters.status !== 'all' ||
    appliedFilters.ticketType !== 'all' ||
    appliedFilters.startDate !== '' ||
    appliedFilters.endDate !== '' ||
    appliedFilters.search !== '';

  // ==================== Render ====================

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Please log in to view reports</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ==================== Header ==================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-emerald-500" />
            Reports &amp; Analytics
          </h1>
          <p className="text-muted-foreground">
            Generate detailed ticket reports with filtering and export options
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ==================== Filters ==================== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-xs ml-1">
                Active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Event Select */}
            <div className="space-y-1.5">
              <Label className="text-xs">Event</Label>
              <Select value={eventFilter} onValueChange={setEventFilter}>
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

            {/* Status Select */}
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt === 'all' ? 'All Statuses' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ticket Type Select */}
            <div className="space-y-1.5">
              <Label className="text-xs">Ticket Type</Label>
              <Select value={ticketTypeFilter} onValueChange={setTicketTypeFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt === 'all' ? 'All Types' : opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-1.5">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Name or ticket code..."
                  className="pl-9"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
            </div>
          </div>

          {/* Date Range + Actions Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            {/* Start Date */}
            <div className="space-y-1.5">
              <Label className="text-xs">From Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <Label className="text-xs">To Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Spacer on large screens */}
            <div className="hidden lg:block" />

            {/* Action Buttons */}
            <div className="flex items-end gap-2">
              <Button size="sm" onClick={handleApplyFilters} className="flex-1 sm:flex-none">
                <Search className="h-4 w-4 mr-1.5" />
                Apply Filters
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                disabled={!hasActiveFilters}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ==================== Data Table ==================== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Ticket Reports</CardTitle>
            {!isLoading && totalTickets > 0 && (
              <p className="text-sm text-muted-foreground">
                Showing {from}&ndash;{to} of {totalTickets} tickets
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="sticky top-0 bg-background z-10">
                  <TableHead className="min-w-[140px]">Ticket Code</TableHead>
                  <TableHead className="min-w-[140px]">Event</TableHead>
                  <TableHead className="min-w-[130px]">Holder Name</TableHead>
                  <TableHead className="min-w-[160px] hidden sm:table-cell">Email</TableHead>
                  <TableHead className="min-w-[100px]">Type</TableHead>
                  <TableHead className="min-w-[90px]">Price</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="min-w-[110px]">Issued Date</TableHead>
                  <TableHead className="text-right min-w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <TableSkeleton />
                    </TableCell>
                  </TableRow>
                ) : tickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <BarChart3 className="h-10 w-10" />
                        <div>
                          <p className="text-sm font-medium">No tickets found</p>
                          <p className="text-xs mt-1">
                            {hasActiveFilters
                              ? 'Try adjusting your filters to see more results'
                              : 'Ticket data will appear here once tickets are generated'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      {/* Ticket Code */}
                      <TableCell>
                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                          {ticket.ticketCode}
                        </code>
                      </TableCell>

                      {/* Event */}
                      <TableCell>
                        <span className="font-medium text-sm max-w-[130px] truncate block">
                          {ticket.event.name}
                        </span>
                      </TableCell>

                      {/* Holder Name */}
                      <TableCell>
                        <span className="text-sm">{ticket.holderName}</span>
                      </TableCell>

                      {/* Email */}
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground max-w-[150px] truncate block">
                          {ticket.holderEmail}
                        </span>
                      </TableCell>

                      {/* Ticket Type */}
                      <TableCell>
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {ticket.ticketType}
                        </Badge>
                      </TableCell>

                      {/* Price */}
                      <TableCell>
                        <span className="text-sm font-medium">
                          {ticket.currency} {ticket.price.toFixed(2)}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <StatusBadge status={ticket.status} />
                      </TableCell>

                      {/* Issued Date */}
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(ticket.issuedAt), 'MMM d, yyyy')}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="View Details">
                          <Eye className="h-4 w-4" />
                        </Button>
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
                Page {page} of {totalPages} &middot; {totalTickets} tickets total
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
    </div>
  );
}
