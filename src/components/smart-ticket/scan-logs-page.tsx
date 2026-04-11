'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  MapPin,
  Filter,
  Download,
  RefreshCw,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';

// ==================== Types ====================

interface ScanLogEntry {
  id: string;
  ticketId: string;
  eventId: string;
  operatorId: string;
  operatorName: string;
  scannedAt: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  deviceUA: string | null;
  isSynced: boolean;
  geoAlert: boolean;
  geoDistance: number | null;
  ticket: { id: string; ticketCode: string; holderName: string; ticketType: string };
  event: { id: string; name: string; type: string };
}

interface ScanLogsResponse {
  data: ScanLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function getApiHeaders() {
  const token = useAuthStore.getState().token;
  const orgId = useOrgStore.getState().currentOrganization?.id;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Organization-Id': orgId || '',
  };
}

// ==================== Status Helpers ====================

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'valid':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'used':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'expired':
      return <Clock className="h-4 w-4 text-zinc-500" />;
    default:
      return <XCircle className="h-4 w-4 text-red-500" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    valid: { label: 'Valid', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    used: { label: 'Used', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    expired: { label: 'Expired', className: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
    invalid: { label: 'Invalid', className: 'bg-red-100 text-red-700 border-red-200' },
  };
  const c = config[status] || config.valid;
  return <Badge variant="outline" className={`text-xs ${c.className}`}>{c.label}</Badge>;
}

// ==================== Main Component ====================

export default function ScanLogsPage() {
  const { token } = useAuthStore();
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');

  const { data, isLoading, refetch } = useQuery<ScanLogsResponse>({
    queryKey: ['scan-logs', page, limit, statusFilter, startDate],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (startDate) params.set('startDate', new Date(startDate).toISOString());
      const res = await fetch(`/api/scan-logs?${params}`, { headers: getApiHeaders() });
      if (!res.ok) throw new Error('Failed to fetch scan logs');
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  const handleExportCSV = useCallback(() => {
    if (!data?.data.length) {
      toast.error('No data to export');
      return;
    }
    const headers = ['Time', 'Status', 'Operator', 'Ticket Code', 'Holder', 'Event', 'Geo Alert', 'Distance'];
    const rows = data.data.map((log) => [
      new Date(log.scannedAt).toLocaleString(),
      log.status,
      log.operatorName,
      log.ticket.ticketCode,
      log.ticket.holderName,
      log.event.name,
      log.geoAlert ? 'YES' : 'No',
      log.geoDistance ? `${Math.round(log.geoDistance)}m` : '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scan-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  }, [data]);

  const logs = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  // Stats
  const validCount = logs.filter((l) => l.status === 'valid').length;
  const usedCount = logs.filter((l) => l.status === 'used').length;
  const geoAlertCount = logs.filter((l) => l.geoAlert).length;

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Please log in to view scan logs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-emerald-500" />
            Scan Logs
          </h2>
          <p className="text-muted-foreground">Detailed audit trail with geolocation data</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Scans</p>
            <p className="text-2xl font-bold">{total.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Valid</p>
            <p className="text-2xl font-bold text-emerald-600">{validCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Already Used</p>
            <p className="text-2xl font-bold text-amber-600">{usedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Geo Alerts</p>
            <p className="text-2xl font-bold text-red-600">{geoAlertCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-40">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                <Filter className="h-3 w-3" />
                Status
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="valid">Valid</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="invalid">Invalid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-44">
              <div className="text-xs text-muted-foreground mb-1.5">From Date</div>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="sticky top-0 bg-background z-10">
                  <TableHead className="min-w-[140px]">Time</TableHead>
                  <TableHead className="min-w-[80px]">Status</TableHead>
                  <TableHead className="min-w-[120px]">Operator</TableHead>
                  <TableHead className="min-w-[140px]">Ticket Code</TableHead>
                  <TableHead className="min-w-[120px]">Holder</TableHead>
                  <TableHead className="min-w-[140px]">Event</TableHead>
                  <TableHead className="min-w-[80px]">Geo</TableHead>
                  <TableHead className="min-w-[60px]">Sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="space-y-2 p-4">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <Skeleton key={i} className="h-8 w-full" />
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ClipboardList className="h-8 w-8" />
                        <p>No scan logs found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className={log.geoAlert ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                      <TableCell className="text-xs">
                        <div>{format(new Date(log.scannedAt), 'MMM dd, HH:mm:ss')}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <StatusIcon status={log.status} />
                          <StatusBadge status={log.status} />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium">{log.operatorName}</TableCell>
                      <TableCell>
                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                          {log.ticket.ticketCode}
                        </code>
                      </TableCell>
                      <TableCell className="text-xs">{log.ticket.holderName}</TableCell>
                      <TableCell className="text-xs max-w-[140px] truncate">{log.event.name}</TableCell>
                      <TableCell>
                        {log.geoAlert ? (
                          <Badge variant="destructive" className="text-[10px]">
                            <MapPin className="h-2.5 w-2.5 mr-0.5" />
                            {log.geoDistance ? `${Math.round(log.geoDistance)}m` : 'Alert'}
                          </Badge>
                        ) : log.geoDistance != null ? (
                          <span className="text-xs text-muted-foreground">{Math.round(log.geoDistance)}m</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={log.isSynced ? 'outline' : 'destructive'}
                          className="text-[10px]"
                        >
                          {log.isSynced ? 'Synced' : 'Pending'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <span className="px-3 text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
