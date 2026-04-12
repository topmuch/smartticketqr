'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ClipboardList,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Shield,
  PlusCircle,
  Pencil,
  Trash2,
  QrCode,
  MonitorUp,
  MonitorDown,
  Activity,
  LogIn,
  LogOut,
  Settings,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';

interface ActivityLogRecord {
  id: string;
  userId: string | null;
  action: string;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface ActivityLogsResponse {
  data: ActivityLogRecord[];
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

function getActionConfig(action: string): { label: string; color: string; icon: React.ReactNode } {
  if (action.includes('login') || action.includes('auth')) {
    return {
      label: 'Login',
      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      icon: <LogIn className="h-3 w-3" />,
    };
  }
  if (action.includes('logout')) {
    return {
      label: 'Logout',
      color: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border-gray-200 dark:border-gray-700',
      icon: <LogOut className="h-3 w-3" />,
    };
  }
  if (action.includes('create') || action.includes('add')) {
    return {
      label: 'Create',
      color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800',
      icon: <PlusCircle className="h-3 w-3" />,
    };
  }
  if (action.includes('update') || action.includes('edit') || action.includes('modify')) {
    return {
      label: 'Update',
      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      icon: <Pencil className="h-3 w-3" />,
    };
  }
  if (action.includes('delete') || action.includes('deactivate') || action.includes('cancel')) {
    return {
      label: 'Delete',
      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
      icon: <Trash2 className="h-3 w-3" />,
    };
  }
  if (action.includes('scan') || action.includes('validate')) {
    return {
      label: 'Scan',
      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      icon: <QrCode className="h-3 w-3" />,
    };
  }
  if (action.includes('export')) {
    return {
      label: 'Export',
      color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800',
      icon: <MonitorUp className="h-3 w-3" />,
    };
  }
  if (action.includes('import')) {
    return {
      label: 'Import',
      color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      icon: <MonitorDown className="h-3 w-3" />,
    };
  }
  if (action.includes('setting') || action.includes('config')) {
    return {
      label: 'Settings',
      color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 border-pink-200 dark:border-pink-800',
      icon: <Settings className="h-3 w-3" />,
    };
  }
  // Default
  return {
    label: action.split('.').pop() || action,
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border-gray-200 dark:border-gray-700',
    icon: <Activity className="h-3 w-3" />,
  };
}

const ACTION_OPTIONS = [
  'all',
  'login',
  'logout',
  'create',
  'update',
  'delete',
  'scan',
  'export',
  'import',
];

export default function ActivityLogsPage() {
  const [actionFilter, setActionFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch activity logs
  const { data: logsData, isLoading, refetch, isFetching } = useQuery<ActivityLogsResponse>({
    queryKey: ['activity-logs', actionFilter, startDate, endDate, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (actionFilter !== 'all') {
        params.set('action', actionFilter);
      }
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/activity-logs?${params}`, {
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch activity logs');
      return res.json();
    },
    refetchInterval: autoRefresh ? 60000 : false,
  });

  // Manual refresh handler
  const handleManualRefresh = useCallback(() => {
    refetch();
    setLastRefresh(new Date());
    toast.success('Activity logs refreshed');
  }, [refetch]);

  const handleFilterChange = (setter: (val: string) => void) => (val: string) => {
    setter(val);
    setPage(1);
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return format(date, 'MMM d, yyyy');
  };

  const truncateDetails = (details: string | null, maxLen = 80) => {
    if (!details) return '-';
    return details.length > maxLen ? details.slice(0, maxLen) + '...' : details;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-purple-500" />
            Activity Logs
          </h2>
          <p className="text-muted-foreground">Monitor user actions and system events</p>
        </div>
        <div className="flex items-center gap-2">
          {autoRefresh && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Last: {format(lastRefresh, 'HH:mm:ss')}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${autoRefresh ? 'animate-spin' : ''} transition-all`} style={autoRefresh ? { animationDuration: '3s' } : {}} />
            <span className="hidden sm:inline">{autoRefresh ? 'Auto' : 'Manual'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filters
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Action Type</Label>
                <Select value={actionFilter} onValueChange={handleFilterChange(setActionFilter)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt === 'all'
                          ? 'All Actions'
                          : opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleFilterChange(setStartDate)(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleFilterChange(setEndDate)(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 flex items-end">
                {(actionFilter !== 'all' || startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setActionFilter('all');
                      setStartDate('');
                      setEndDate('');
                      setPage(1);
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-16" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : logsData && logsData.data.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4 w-[140px] sm:w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[120px] sm:w-[160px]">User</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                    <TableHead className="hidden sm:table-cell">Details</TableHead>
                    <TableHead className="hidden md:table-cell w-[120px]">IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsData.data.map((log) => {
                    const actionConf = getActionConfig(log.action);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <div>
                              <p className="text-xs sm:text-sm">
                                {format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}
                              </p>
                              <p className="text-[10px] text-muted-foreground/70">
                                {formatRelativeTime(log.createdAt)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
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
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${actionConf.color}`}>
                            {actionConf.icon}
                            <span className="ml-1">{actionConf.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <p className="text-sm text-muted-foreground max-w-[300px] truncate" title={log.details || undefined}>
                            {truncateDetails(log.details)}
                          </p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-mono">
                          {log.ipAddress || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {logsData.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {logsData.page} of {logsData.totalPages} ({logsData.total} logs)
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= logsData.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No activity logs found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(actionFilter !== 'all' || startDate || endDate)
                  ? 'Try adjusting your filters'
                  : 'Activity will appear here as users interact with the system'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
