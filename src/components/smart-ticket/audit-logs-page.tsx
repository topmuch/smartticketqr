'use client';

import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Shield,
  Search,
  Filter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  AlertTriangle,
  Info,
  AlertCircle,
  FileWarning,
  X,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { cn } from '@/lib/utils';

// ==================== Types ====================

interface AuditLogRecord {
  id: string;
  userId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  severity: 'info' | 'warning' | 'critical';
  ipAddress: string | null;
  details: string | Record<string, unknown> | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface AuditLogsResponse {
  data: AuditLogRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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

const ACTION_OPTIONS = [
  'all',
  'LOGIN_FAIL',
  'LOGIN_SUCCESS',
  'PRICE_CHANGE',
  'TICKET_DELETE',
  'EVENT_UPDATE',
  'USER_DEACTIVATE',
  'USER_CREATE',
  'PERMISSION_CHANGE',
  'SUBSCRIPTION_CHANGE',
  'WEBHOOK_RECEIVED',
  'DATA_EXPORT',
  'SETTINGS_UPDATE',
] as const;

const SEVERITY_OPTIONS = ['all', 'info', 'warning', 'critical'] as const;

const PAGE_LIMIT = 25;

// ==================== Sub-components ====================

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { label: string; className: string }> = {
    info: {
      label: 'Info',
      className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
    },
    warning: {
      label: 'Warning',
      className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    },
    critical: {
      label: 'Critical',
      className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
    },
  };
  const c = config[severity] || config.info;
  return (
    <Badge variant="outline" className={cn('text-xs', c.className)}>
      {c.label}
    </Badge>
  );
}

function getActionBadgeConfig(action: string): { className: string; icon: React.ReactNode } {
  const map: Record<string, { className: string; icon: React.ReactNode }> = {
    LOGIN_SUCCESS: {
      className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
      icon: <Shield className="h-3 w-3" />,
    },
    LOGIN_FAIL: {
      className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
      icon: <AlertCircle className="h-3 w-3" />,
    },
    PRICE_CHANGE: {
      className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    TICKET_DELETE: {
      className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
      icon: <FileWarning className="h-3 w-3" />,
    },
    EVENT_UPDATE: {
      className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
      icon: <Info className="h-3 w-3" />,
    },
    USER_DEACTIVATE: {
      className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
      icon: <User className="h-3 w-3" />,
    },
    USER_CREATE: {
      className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
      icon: <User className="h-3 w-3" />,
    },
    PERMISSION_CHANGE: {
      className: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800',
      icon: <Shield className="h-3 w-3" />,
    },
    SUBSCRIPTION_CHANGE: {
      className: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800',
      icon: <Info className="h-3 w-3" />,
    },
    WEBHOOK_RECEIVED: {
      className: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800',
      icon: <Info className="h-3 w-3" />,
    },
    DATA_EXPORT: {
      className: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800',
      icon: <Info className="h-3 w-3" />,
    },
    SETTINGS_UPDATE: {
      className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      icon: <Info className="h-3 w-3" />,
    },
  };
  return (
    map[action] || {
      className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
      icon: <Info className="h-3 w-3" />,
    }
  );
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  }
  return format(date, 'MMM d, HH:mm');
}

function truncateText(text: string | null, maxLen = 80): string {
  if (!text) return '-';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

function ActionBadge({ action }: { action: string }) {
  const config = getActionBadgeConfig(action);
  return (
    <Badge variant="outline" className={cn('text-xs whitespace-nowrap', config.className)}>
      {config.icon}
      <span className="ml-1">{action}</span>
    </Badge>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-32 ml-auto" />
        </div>
      ))}
    </div>
  );
}

// ==================== Main Component ====================

export default function AuditLogsPage() {
  const { token } = useAuthStore();

  // Filter state
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Applied filters (for query key stability)
  const [appliedFilters, setAppliedFilters] = useState({
    action: 'all',
    severity: 'all',
    startDate: '',
    endDate: '',
  });

  // Pagination
  const [page, setPage] = useState(1);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);

  // ==================== Queries ====================

  const { data: logsData, isLoading } = useQuery<AuditLogsResponse>({
    queryKey: ['audit-logs', appliedFilters, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT),
      });
      if (appliedFilters.action && appliedFilters.action !== 'all') {
        params.set('action', appliedFilters.action);
      }
      if (appliedFilters.severity && appliedFilters.severity !== 'all') {
        params.set('severity', appliedFilters.severity);
      }
      if (appliedFilters.startDate) params.set('from', appliedFilters.startDate);
      if (appliedFilters.endDate) params.set('to', appliedFilters.endDate);

      const res = await fetch(`/api/audit-logs?${params.toString()}`, {
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      return res.json();
    },
    enabled: !!token,
  });

  // ==================== Handlers ====================

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({
      action: actionFilter,
      severity: severityFilter,
      startDate,
      endDate,
    });
    setPage(1);
  }, [actionFilter, severityFilter, startDate, endDate]);

  const handleResetFilters = useCallback(() => {
    setActionFilter('all');
    setSeverityFilter('all');
    setStartDate('');
    setEndDate('');
    setAppliedFilters({
      action: 'all',
      severity: 'all',
      startDate: '',
      endDate: '',
    });
    setPage(1);
  }, []);

  const handleViewDetails = useCallback((log: AuditLogRecord) => {
    setSelectedLog(log);
    setDetailOpen(true);
  }, []);

  // ==================== Computed ====================

  const logs = logsData?.data || [];
  const totalLogs = logsData?.pagination?.total || 0;
  const totalPages = logsData?.pagination?.totalPages || 1;

  const hasActiveFilters =
    appliedFilters.action !== 'all' ||
    appliedFilters.severity !== 'all' ||
    appliedFilters.startDate !== '' ||
    appliedFilters.endDate !== '';

  // ==================== Render ====================

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Please log in to view audit logs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ==================== Header ==================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-7 w-7 text-red-500" />
              Security Audit Logs
            </h1>
            <p className="text-muted-foreground">
              Track security events, access patterns, and system changes
            </p>
          </div>
        </div>
        {!isLoading && (
          <Badge variant="secondary" className="text-sm self-start sm:self-auto">
            {totalLogs} log {totalLogs === 1 ? 'entry' : 'entries'}
          </Badge>
        )}
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
            {/* Action Select */}
            <div className="space-y-1.5">
              <Label className="text-xs">Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt === 'all'
                        ? 'All Actions'
                        : opt
                            .replace(/_/g, ' ')
                            .toLowerCase()
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Severity Select */}
            <div className="space-y-1.5">
              <Label className="text-xs">Severity</Label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Severities" />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt === 'all'
                        ? 'All Severities'
                        : opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-3">
            <Button size="sm" onClick={handleApplyFilters}>
              <Search className="h-4 w-4 mr-1.5" />
              Apply Filters
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ==================== Data Table ==================== */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="sticky top-0 bg-background z-10">
                  <TableHead className="min-w-[150px]">Timestamp</TableHead>
                  <TableHead className="min-w-[130px]">User</TableHead>
                  <TableHead className="min-w-[160px]">Action</TableHead>
                  <TableHead className="min-w-[120px] hidden sm:table-cell">Target</TableHead>
                  <TableHead className="min-w-[90px]">Severity</TableHead>
                  <TableHead className="min-w-[120px] hidden md:table-cell">IP Address</TableHead>
                  <TableHead className="min-w-[200px]">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <TableSkeleton />
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Shield className="h-10 w-10" />
                        <div>
                          <p className="text-sm font-medium">No audit logs found for this period</p>
                          <p className="text-xs mt-1">
                            {hasActiveFilters
                              ? 'Try adjusting your date range or filters'
                              : 'Audit log entries will appear here as security events occur'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      {/* Timestamp */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              {formatTimestamp(log.createdAt)}
                            </p>
                            <p className="text-[10px] text-muted-foreground/70 hidden sm:block">
                              {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* User */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium truncate max-w-[100px] sm:max-w-[140px]">
                              {log.user?.name || 'System'}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[100px] sm:max-w-[140px]">
                              {log.user?.email || ''}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Action */}
                      <TableCell>
                        <ActionBadge action={log.action} />
                      </TableCell>

                      {/* Target */}
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground max-w-[110px] truncate block">
                          {log.targetType || '-'}
                        </span>
                      </TableCell>

                      {/* Severity */}
                      <TableCell>
                        <SeverityBadge severity={log.severity} />
                      </TableCell>

                      {/* IP Address */}
                      <TableCell className="hidden md:table-cell">
                        <span className="text-xs text-muted-foreground font-mono">
                          {log.ipAddress || '-'}
                        </span>
                      </TableCell>

                      {/* Details */}
                      <TableCell>
                        {log.details ? (() => {
                          const detailsStr = typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2);
                          return detailsStr.length > 80 ? (
                            <button
                              onClick={() => handleViewDetails(log)}
                              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-left"
                            >
                              {truncateText(detailsStr, 80)}
                            </button>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {truncateText(detailsStr)}
                            </span>
                          );
                        })() : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
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
                Page {page} of {totalPages} &middot; {totalLogs} log {totalLogs === 1 ? 'entry' : 'entries'}
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

      {/* ==================== Detail Dialog ==================== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Details</DialogTitle>
            <DialogDescription>
              Full details for audit log entry
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              {/* Timestamp & Severity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Timestamp</Label>
                  <p className="text-sm font-medium mt-0.5">
                    {format(new Date(selectedLog.createdAt), 'MMM d, yyyy HH:mm:ss')}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Severity</Label>
                  <div className="mt-0.5">
                    <SeverityBadge severity={selectedLog.severity} />
                  </div>
                </div>
              </div>

              {/* User */}
              <div>
                <Label className="text-xs text-muted-foreground">User</Label>
                <p className="text-sm font-medium mt-0.5">
                  {selectedLog.user?.name || 'System'}
                  {selectedLog.user?.email && (
                    <span className="text-muted-foreground ml-1">
                      ({selectedLog.user.email})
                    </span>
                  )}
                </p>
              </div>

              {/* Action */}
              <div>
                <Label className="text-xs text-muted-foreground">Action</Label>
                <div className="mt-0.5">
                  <ActionBadge action={selectedLog.action} />
                </div>
              </div>

              {/* Target */}
              {selectedLog.targetType && (
                <div>
                  <Label className="text-xs text-muted-foreground">Target</Label>
                  <p className="text-sm font-medium mt-0.5">
                    {selectedLog.targetType}{selectedLog.targetId ? ` (${selectedLog.targetId})` : ''}
                  </p>
                </div>
              )}

              {/* IP Address */}
              {selectedLog.ipAddress && (
                <div>
                  <Label className="text-xs text-muted-foreground">IP Address</Label>
                  <p className="text-sm font-mono text-muted-foreground mt-0.5">
                    {selectedLog.ipAddress}
                  </p>
                </div>
              )}

              {/* Details */}
              {selectedLog.details && (
                <div>
                  <Label className="text-xs text-muted-foreground">Details</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    <pre className="text-sm whitespace-pre-wrap break-words font-mono">
                      {typeof selectedLog.details === 'string'
                        ? selectedLog.details
                        : JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
