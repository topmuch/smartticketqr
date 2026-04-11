'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  QrCode,
  Eye,
  CheckCircle2,
  XCircle,
  Ban,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  Activity,
  Globe,
  Monitor,
  Wifi,
  Hash,
  HelpCircle,
  Loader2,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

interface FraudAlert {
  id: string;
  ticketId: string | null;
  userId: string | null;
  ruleType: 'multi_scan_rapid' | 'geo_inconsistent' | 'suspicious_ip' | 'device_mismatch' | 'manual';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string | null;
  status: 'flagged' | 'reviewed' | 'dismissed' | 'blocked';
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface FraudAlertsResponse {
  success: boolean;
  data: FraudAlert[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface FraudStats {
  totalAlerts: number;
  alertsInPeriod: number;
  unresolvedAlerts: number;
  last7Days: number;
  last30Days: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byRuleType: Record<string, number>;
}

interface FraudStatsResponse {
  success: boolean;
  data: FraudStats;
}

// ============================================================
// API Helper
// ============================================================

function getApiHeaders() {
  const token = useAuthStore.getState().token;
  const orgId = useOrgStore.getState().currentOrganization?.id;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Organization-Id': orgId || '',
  };
}

// ============================================================
// Constants
// ============================================================

const RULE_TYPE_OPTIONS = [
  { value: 'all', label: 'All Rule Types' },
  { value: 'multi_scan_rapid', label: 'Multi-Scan Rapid' },
  { value: 'geo_inconsistent', label: 'Geo Inconsistent' },
  { value: 'suspicious_ip', label: 'Suspicious IP' },
  { value: 'device_mismatch', label: 'Device Mismatch' },
  { value: 'manual', label: 'Manual' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'blocked', label: 'Blocked' },
];

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All Severities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const RULE_TYPE_LABELS: Record<string, string> = {
  multi_scan_rapid: 'Multi-Scan Rapid',
  geo_inconsistent: 'Geo Inconsistent',
  suspicious_ip: 'Suspicious IP',
  device_mismatch: 'Device Mismatch',
  manual: 'Manual',
};

const SEVERITY_CONFIG: Record<string, { color: string; bgClass: string; textClass: string; borderClass: string }> = {
  low: {
    color: 'slate',
    bgClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
    borderClass: 'border-slate-200 dark:border-slate-700',
  },
  medium: {
    color: 'amber',
    bgClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    borderClass: 'border-amber-200 dark:border-amber-800',
  },
  high: {
    color: 'orange',
    bgClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    borderClass: 'border-orange-200 dark:border-orange-800',
  },
  critical: {
    color: 'red',
    bgClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    borderClass: 'border-red-200 dark:border-red-800',
  },
};

const STATUS_CONFIG: Record<string, { label: string; bgClass: string; borderClass: string; icon: React.ElementType }> = {
  flagged: {
    label: 'Flagged',
    bgClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    borderClass: 'border-amber-200 dark:border-amber-800',
    icon: AlertTriangle,
  },
  reviewed: {
    label: 'Reviewed',
    bgClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    borderClass: 'border-sky-200 dark:border-sky-800',
    icon: Eye,
  },
  dismissed: {
    label: 'Dismissed',
    bgClass: 'bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400',
    borderClass: 'border-slate-200 dark:border-slate-700',
    icon: XCircle,
  },
  blocked: {
    label: 'Blocked',
    bgClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    borderClass: 'border-red-200 dark:border-red-800',
    icon: Ban,
  },
};

const RULE_TYPE_ICONS: Record<string, React.ElementType> = {
  multi_scan_rapid: QrCode,
  geo_inconsistent: Globe,
  suspicious_ip: Wifi,
  device_mismatch: Monitor,
  manual: Hash,
};

// ============================================================
// Sub-components
// ============================================================

function SeverityBadge({ severity }: { severity: string }) {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.low;
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', config.bgClass, config.borderClass)}>
      {severity.toUpperCase()}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.flagged;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn('text-xs font-medium gap-1', config.bgClass, config.borderClass)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function RuleTypeBadge({ ruleType }: { ruleType: string }) {
  const Icon = RULE_TYPE_ICONS[ruleType] || Hash;
  return (
    <Badge variant="outline" className="text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800 gap-1">
      <Icon className="h-3 w-3" />
      {RULE_TYPE_LABELS[ruleType] || ruleType}
    </Badge>
  );
}

function formatRelativeTime(dateStr: string) {
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
}

function parseDetails(details: string | null): Record<string, unknown> | null {
  if (!details) return null;
  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

function extractDetailSummary(details: string | null): string {
  const parsed = parseDetails(details);
  if (!parsed) return details || 'No additional details';

  const parts: string[] = [];
  if (parsed.scanCount) parts.push(`${parsed.scanCount} scans`);
  if (parsed.ip) parts.push(`IP: ${parsed.ip}`);
  if (parsed.device) parts.push(`Device: ${parsed.device}`);
  if (parsed.location) parts.push(`Location: ${parsed.location}`);
  if (parsed.reason) parts.push(parsed.reason as string);
  if (parsed.ticketCode) parts.push(`Ticket: ${parsed.ticketCode}`);
  if (parsed.userAgent) parts.push(`Agent: ${(parsed.userAgent as string).slice(0, 50)}`);

  return parts.length > 0 ? parts.join(' · ') : 'No additional details';
}

// ============================================================
// Stats Skeleton
// ============================================================

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Table Skeleton
// ============================================================

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-4 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Breakdown Mini-Chart
// ============================================================

function BreakdownChart({ title, data, colorMap }: {
  title: string;
  data: Record<string, number>;
  colorMap: Record<string, string>;
}) {
  const entries = Object.entries(data).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const maxVal = entries.length > 0 ? Math.max(...entries.map(([, v]) => v)) : 1;

  if (entries.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground/60">No data</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="space-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-24 truncate">
              {RULE_TYPE_LABELS[key] || STATUS_CONFIG[key]?.label || key}
            </span>
            <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', colorMap[key] || 'bg-emerald-500')}
                initial={{ width: 0 }}
                animate={{ width: `${(value / maxVal) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground w-6 text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function FraudAlertsPage() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // ---- State ----
  const [statusFilter, setStatusFilter] = useState('all');
  const [ruleTypeFilter, setRuleTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<'reviewed' | 'dismissed' | 'blocked'>('reviewed');
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // ---- Fetch Stats ----
  const { data: statsData, isLoading: statsLoading } = useQuery<FraudStatsResponse>({
    queryKey: ['fraud-alerts-stats'],
    queryFn: async () => {
      const res = await fetch('/api/fraud-alerts/stats', { headers: getApiHeaders() });
      if (!res.ok) throw new Error('Failed to fetch fraud stats');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const stats = statsData?.data;

  // ---- Fetch Alerts ----
  const { data: alertsData, isLoading, isFetching, refetch } = useQuery<FraudAlertsResponse>({
    queryKey: ['fraud-alerts', statusFilter, ruleTypeFilter, severityFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (ruleTypeFilter !== 'all') params.set('ruleType', ruleTypeFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);

      const res = await fetch(`/api/fraud-alerts?${params}`, { headers: getApiHeaders() });
      if (!res.ok) throw new Error('Failed to fetch fraud alerts');
      return res.json();
    },
  });

  const alerts = alertsData?.data || [];
  const meta = alertsData?.meta;

  // ---- Update Mutation ----
  const updateMutation = useMutation({
    mutationFn: async ({ id, status: alertStatus }: { id: string; status: string }) => {
      const res = await fetch(`/api/fraud-alerts/${id}`, {
        method: 'PUT',
        headers: getApiHeaders(),
        body: JSON.stringify({ status: alertStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update alert');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Alert status updated');
      queryClient.invalidateQueries({ queryKey: ['fraud-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['fraud-alerts-stats'] });
      setReviewDialogOpen(false);
      setBlockConfirmOpen(false);
      setSelectedAlert(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update alert');
    },
  });

  // ---- Handlers ----
  const handleFilterChange = useCallback((setter: (val: string) => void) => (val: string) => {
    setter(val);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setStatusFilter('all');
    setRuleTypeFilter('all');
    setSeverityFilter('all');
    setPage(1);
  }, []);

  const hasActiveFilters = statusFilter !== 'all' || ruleTypeFilter !== 'all' || severityFilter !== 'all';

  const openReviewDialog = useCallback((alert: FraudAlert, status: 'reviewed' | 'dismissed' | 'blocked') => {
    setSelectedAlert(alert);
    setReviewStatus(status);
    if (status === 'blocked') {
      setBlockConfirmOpen(true);
    } else {
      setReviewDialogOpen(true);
    }
  }, []);

  const handleReviewSubmit = useCallback(() => {
    if (!selectedAlert) return;
    updateMutation.mutate({ id: selectedAlert.id, status: reviewStatus });
  }, [selectedAlert, reviewStatus, updateMutation]);

  const handleBlockConfirm = useCallback(() => {
    if (!selectedAlert) return;
    updateMutation.mutate({ id: selectedAlert.id, status: 'blocked' });
  }, [selectedAlert, updateMutation]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedAlertId((prev) => (prev === id ? null : id));
  }, []);

  const openDetailDialog = useCallback((alert: FraudAlert) => {
    setSelectedAlert(alert);
    setDetailDialogOpen(true);
  }, []);

  // ---- Computed ----
  const severityBreakdownColors: Record<string, string> = {
    low: 'bg-slate-400',
    medium: 'bg-amber-400',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  };

  const ruleTypeBreakdownColors: Record<string, string> = {
    multi_scan_rapid: 'bg-emerald-500',
    geo_inconsistent: 'bg-violet-500',
    suspicious_ip: 'bg-amber-500',
    device_mismatch: 'bg-sky-500',
    manual: 'bg-slate-400',
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-red-500" />
            Fraud Alerts
          </h2>
          <p className="text-muted-foreground">
            Monitor and manage suspicious activity detected by the fraud engine
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Stats Row */}
      {statsLoading ? (
        <StatsSkeleton />
      ) : stats ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-muted-foreground">Total Alerts</p>
                <Activity className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold">{stats.totalAlerts}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.last7Days} in last 7 days
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-muted-foreground">Flagged</p>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats.unresolvedAlerts}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-muted-foreground">Blocked</p>
                <Ban className="h-4 w-4 text-red-500" />
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats.byStatus?.blocked || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Confirmed fraud</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-600">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-muted-foreground">Critical</p>
                <ShieldAlert className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats.bySeverity?.critical || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.last30Days} alerts in 30d
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      {/* Filters + Info Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        {/* Filters Card */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  Filters
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearFilters}>
                    Clear all
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="All statuses" />
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
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Rule Type</label>
                  <Select value={ruleTypeFilter} onValueChange={handleFilterChange(setRuleTypeFilter)}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="All rule types" />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Severity</label>
                  <Select value={severityFilter} onValueChange={handleFilterChange(setSeverityFilter)}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="All severities" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-emerald-50/50 border-emerald-200/50 dark:bg-emerald-950/20 dark:border-emerald-900/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  Fraud Detection
                </p>
                <p className="text-[11px] leading-relaxed text-emerald-700/80 dark:text-emerald-400/80">
                  Alerts are <strong>NEVER auto-blocked</strong> — always flagged for manual review.
                  Configurable thresholds detect:
                </p>
                <ul className="text-[11px] space-y-0.5 text-emerald-700/70 dark:text-emerald-400/70">
                  <li className="flex items-center gap-1.5">
                    <QrCode className="h-3 w-3" />
                    <span><strong>Multi-scan:</strong> Rapid repeated scans</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Globe className="h-3 w-3" />
                    <span><strong>Geo:</strong> Scan far from event location</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Wifi className="h-3 w-3" />
                    <span><strong>IP:</strong> High frequency from same IP</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Monitor className="h-3 w-3" />
                    <span><strong>Device:</strong> Multiple device types on same ticket</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Breakdown Charts */}
      {stats && !statsLoading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-500" />
                Alert Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <BreakdownChart
                  title="By Rule Type"
                  data={stats.byRuleType || {}}
                  colorMap={ruleTypeBreakdownColors}
                />
                <BreakdownChart
                  title="By Severity"
                  data={stats.bySeverity || {}}
                  colorMap={severityBreakdownColors}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Alerts List */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
      >
        {isLoading ? (
          <TableSkeleton />
        ) : alerts.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              {/* Desktop Table */}
              {!isMobile && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4 w-[140px]">Time</TableHead>
                      <TableHead className="w-[160px]">Rule Type</TableHead>
                      <TableHead className="w-[80px]">Severity</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="hidden xl:table-cell w-[100px]">Ticket</TableHead>
                      <TableHead className="hidden xl:table-cell w-[100px]">User</TableHead>
                      <TableHead className="pr-4 w-[120px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {alerts.map((alert, idx) => (
                        <motion.tr
                          key={alert.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.03 }}
                          className={cn(
                            'group border-b transition-colors last:border-b-0',
                            alert.severity === 'critical'
                              ? 'border-l-4 border-l-red-500 bg-red-50/30 dark:bg-red-950/10'
                              : 'border-l-4 border-l-transparent'
                          )}
                        >
                          <TableCell className="pl-4">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              <div>
                                <p className="text-xs">
                                  {format(new Date(alert.createdAt), 'MMM d, HH:mm')}
                                </p>
                                <p className="text-[10px] text-muted-foreground/60">
                                  {formatRelativeTime(alert.createdAt)}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <RuleTypeBadge ruleType={alert.ruleType} />
                          </TableCell>
                          <TableCell>
                            <SeverityBadge severity={alert.severity} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={alert.status} />
                          </TableCell>
                          <TableCell>
                            <p className="text-xs text-muted-foreground max-w-[260px] truncate">
                              {extractDetailSummary(alert.details)}
                            </p>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {alert.ticketId ? (
                              <span className="text-xs font-mono text-muted-foreground truncate block max-w-[90px]">
                                {alert.ticketId.slice(0, 8)}...
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {alert.userId ? (
                              <span className="text-xs font-mono text-muted-foreground truncate block max-w-[90px]">
                                {alert.userId.slice(0, 8)}...
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">—</span>
                            )}
                          </TableCell>
                          <TableCell className="pr-4 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openDetailDialog(alert)}
                                title="View details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {isAdmin && alert.status === 'flagged' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/30"
                                    onClick={() => openReviewDialog(alert, 'reviewed')}
                                    title="Mark reviewed"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-slate-500 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                    onClick={() => openReviewDialog(alert, 'dismissed')}
                                    title="Dismiss"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    onClick={() => openReviewDialog(alert, 'blocked')}
                                    title="Block"
                                  >
                                    <Ban className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              )}

              {/* Mobile Cards */}
              {isMobile && (
                <div className="p-3 space-y-3">
                  <AnimatePresence>
                    {alerts.map((alert, idx) => {
                      const isExpanded = expandedAlertId === alert.id;
                      const parsed = parseDetails(alert.details);
                      return (
                        <motion.div
                          key={alert.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.04 }}
                        >
                          <Card
                            className={cn(
                              'overflow-hidden',
                              alert.severity === 'critical' && 'border-l-4 border-l-red-500'
                            )}
                          >
                            <CardContent className="p-3 space-y-2.5">
                              {/* Top row: badges */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <RuleTypeBadge ruleType={alert.ruleType} />
                                <SeverityBadge severity={alert.severity} />
                                <StatusBadge status={alert.status} />
                              </div>

                              {/* Details summary */}
                              <p className="text-xs text-muted-foreground">
                                {extractDetailSummary(alert.details)}
                              </p>

                              {/* Timestamp */}
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                                <Clock className="h-3 w-3" />
                                <span>{format(new Date(alert.createdAt), 'MMM d, yyyy HH:mm')}</span>
                                <span className="text-muted-foreground/40">
                                  · {formatRelativeTime(alert.createdAt)}
                                </span>
                              </div>

                              {/* IDs row */}
                              <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60 font-mono">
                                {alert.ticketId && (
                                  <span className="flex items-center gap-1">
                                    <QrCode className="h-3 w-3" />
                                    {alert.ticketId.slice(0, 12)}...
                                  </span>
                                )}
                                {alert.userId && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {alert.userId.slice(0, 12)}...
                                  </span>
                                )}
                              </div>

                              {/* Expandable JSON details */}
                              {parsed && Object.keys(parsed).length > 0 && (
                                <div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] px-2 gap-1"
                                    onClick={() => toggleExpanded(alert.id)}
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="h-3 w-3" />
                                        Hide details
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="h-3 w-3" />
                                        Show details
                                      </>
                                    )}
                                  </Button>
                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                      >
                                        <pre className="mt-1.5 p-2.5 rounded-md bg-muted/50 text-[10px] font-mono overflow-x-auto max-h-40 overflow-y-auto leading-relaxed">
                                          {JSON.stringify(parsed, null, 2)}
                                        </pre>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )}

                              {/* Action buttons for mobile */}
                              {isAdmin && alert.status === 'flagged' && (
                                <>
                                  <Separator />
                                  <div className="flex items-center gap-1.5 pt-0.5">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs gap-1 flex-1 text-sky-600 border-sky-200 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-400 dark:hover:bg-sky-950/30"
                                      onClick={() => openReviewDialog(alert, 'reviewed')}
                                    >
                                      <CheckCircle2 className="h-3 w-3" />
                                      Review
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs gap-1 flex-1"
                                      onClick={() => openReviewDialog(alert, 'dismissed')}
                                    >
                                      <XCircle className="h-3 w-3" />
                                      Dismiss
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs gap-1 flex-1 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                                      onClick={() => openReviewDialog(alert, 'blocked')}
                                    >
                                      <Ban className="h-3 w-3" />
                                      Block
                                    </Button>
                                  </div>
                                </>
                              )}

                              {/* View full detail button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] w-full text-muted-foreground"
                                onClick={() => openDetailDialog(alert)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View full details
                              </Button>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}

              {/* Pagination */}
              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {meta.page} of {meta.totalPages} ({meta.total} alerts)
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
                      disabled={page >= meta.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Empty State */
          <Card>
            <CardContent className="py-16">
              <div className="text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <ShieldAlert className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-base font-semibold mb-1">No fraud alerts found</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {hasActiveFilters
                    ? 'No alerts match the current filters. Try adjusting your search criteria.'
                    : 'The fraud detection engine hasn\'t triggered any alerts yet. Alerts will appear here when suspicious activity is detected.'}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                    <Filter className="h-3.5 w-3.5 mr-1.5" />
                    Clear filters
                  </Button>
                )}
                {!hasActiveFilters && (
                  <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground/60">
                    <div className="flex items-center gap-1">
                      <QrCode className="h-3.5 w-3.5" />
                      <span>Multi-scan</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5" />
                      <span>Geo</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Wifi className="h-3.5 w-3.5" />
                      <span>IP</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Monitor className="h-3.5 w-3.5" />
                      <span>Device</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* ============================================================ */}
      {/* Review/Dismiss Dialog */}
      {/* ============================================================ */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewStatus === 'reviewed' && (
                <>
                  <CheckCircle2 className="h-5 w-5 text-sky-500" />
                  Mark as Reviewed
                </>
              )}
              {reviewStatus === 'dismissed' && (
                <>
                  <XCircle className="h-5 w-5 text-slate-400" />
                  Dismiss Alert
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {reviewStatus === 'reviewed'
                ? 'This alert will be marked as reviewed. The ticket remains active.'
                : 'This alert will be dismissed as a false positive.'}
            </DialogDescription>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-3 py-2">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <RuleTypeBadge ruleType={selectedAlert.ruleType} />
                  <SeverityBadge severity={selectedAlert.severity} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {extractDetailSummary(selectedAlert.details)}
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                  Created {format(new Date(selectedAlert.createdAt), 'MMM d, yyyy HH:mm')}
                </p>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={reviewStatus} onValueChange={(val) => setReviewStatus(val as 'reviewed' | 'dismissed' | 'blocked')}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reviewed">
                      <span className="flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 text-sky-500" />
                        Reviewed
                      </span>
                    </SelectItem>
                    <SelectItem value="dismissed">
                      <span className="flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5 text-slate-400" />
                        Dismissed
                      </span>
                    </SelectItem>
                    <SelectItem value="blocked">
                      <span className="flex items-center gap-1.5">
                        <Ban className="h-3.5 w-3.5 text-red-500" />
                        Blocked
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReviewSubmit}
              disabled={updateMutation.isPending}
              className={
                reviewStatus === 'reviewed'
                  ? 'bg-sky-600 hover:bg-sky-700 text-white'
                  : reviewStatus === 'dismissed'
                    ? ''
                    : 'bg-red-600 hover:bg-red-700 text-white'
              }
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {reviewStatus === 'reviewed' && 'Mark Reviewed'}
              {reviewStatus === 'dismissed' && 'Dismiss Alert'}
              {reviewStatus === 'blocked' && 'Block'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Block Confirmation Dialog */}
      {/* ============================================================ */}
      <AlertDialog open={blockConfirmOpen} onOpenChange={setBlockConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-500" />
              Block this alert?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will mark the alert as confirmed fraud and block the associated
              ticket/user. This should only be done after careful review of the evidence.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedAlert && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3 mt-2 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <RuleTypeBadge ruleType={selectedAlert.ruleType} />
                <SeverityBadge severity={selectedAlert.severity} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {extractDetailSummary(selectedAlert.details)}
              </p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlockConfirm}
              disabled={updateMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Confirm Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============================================================ */}
      {/* Detail Dialog */}
      {/* ============================================================ */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-emerald-600" />
              Alert Details
            </DialogTitle>
            <DialogDescription>
              Full fraud alert information and raw data
            </DialogDescription>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              {/* Alert summary */}
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                      Rule Type
                    </p>
                    <RuleTypeBadge ruleType={selectedAlert.ruleType} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                      Severity
                    </p>
                    <SeverityBadge severity={selectedAlert.severity} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                      Status
                    </p>
                    <StatusBadge status={selectedAlert.status} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                      Created
                    </p>
                    <p className="text-xs">
                      {format(new Date(selectedAlert.createdAt), 'MMM d, yyyy HH:mm:ss')}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Associated IDs */}
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Associations
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-14">Ticket:</span>
                      <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                        {selectedAlert.ticketId || 'None'}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-14">User:</span>
                      <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                        {selectedAlert.userId || 'None'}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-14">Alert ID:</span>
                      <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                        {selectedAlert.id}
                      </code>
                    </div>
                  </div>
                </div>

                {/* Review info */}
                {selectedAlert.reviewedBy && (
                  <>
                    <Separator />
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Review Info
                      </p>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-14">Reviewer:</span>
                          <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                            {selectedAlert.reviewedBy}
                          </code>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-14">At:</span>
                          <span>
                            {selectedAlert.reviewedAt
                              ? format(new Date(selectedAlert.reviewedAt), 'MMM d, yyyy HH:mm')
                              : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Raw JSON details */}
                {selectedAlert.details && (
                  <>
                    <Separator />
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
                        <HelpCircle className="h-3 w-3" />
                        Raw Details (JSON)
                      </p>
                      <pre className="p-3 rounded-lg bg-muted/80 text-[11px] font-mono overflow-x-auto max-h-48 overflow-y-auto leading-relaxed border">
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(selectedAlert.details), null, 2);
                          } catch {
                            return selectedAlert.details;
                          }
                        })()}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {selectedAlert && isAdmin && selectedAlert.status === 'flagged' && (
              <div className="flex-1 flex items-center gap-1.5 mr-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs text-sky-600 border-sky-200 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-400"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    openReviewDialog(selectedAlert, 'reviewed');
                  }}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Review
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    openReviewDialog(selectedAlert, 'dismissed');
                  }}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Dismiss
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    openReviewDialog(selectedAlert, 'blocked');
                  }}
                >
                  <Ban className="h-3 w-3 mr-1" />
                  Block
                </Button>
              </div>
            )}
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
