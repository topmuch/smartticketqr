'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Plus,
  Trash2,
  RefreshCw,
  Filter,
  Clock,
  MessageSquare,
  Mail,
  Phone,
  Send,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ArrowRightLeft,
  Pencil,
  X,
  Info,
  Shield,
  Timer,
  Activity,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { cn } from '@/lib/utils';

// ==================== Types ====================

interface AutomationRule {
  id: string;
  triggerEvent: string;
  channel: 'whatsapp' | 'sms' | 'email';
  templateId: string | null;
  delayMinutes: number;
  fallbackChannel: string | null;
  isActive: boolean;
  createdAt: string;
}

interface AutomationLog {
  id: string;
  ruleId: string;
  triggerEvent: string;
  channel: string;
  recipient: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  errorMessage: string | null;
  attempts: number;
  createdAt: string;
  sentAt: string | null;
}

interface AutomationLogsResponse {
  data: AutomationLog[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface RuleFormData {
  triggerEvent: string;
  channel: string;
  templateId: string;
  delayMinutes: number;
  fallbackChannel: string;
}

// ==================== Constants ====================

const TRIGGER_EVENTS = [
  { value: 'ticket_created', label: 'Ticket Created', description: 'When a new ticket is generated' },
  { value: 'ticket_reminder', label: 'Ticket Reminder', description: 'Scheduled reminder before event' },
  { value: 'scan_failed', label: 'Scan Failed', description: 'When a QR code scan fails' },
  { value: 'ticket_validated', label: 'Ticket Validated', description: 'When a ticket is successfully validated' },
];

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp', icon: Phone },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
  { value: 'email', label: 'Email', icon: Mail },
];

const TRIGGER_EVENT_COLORS: Record<string, string> = {
  ticket_created: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  ticket_reminder: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  scan_failed: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  ticket_validated: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
};

const LOG_STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  sent: {
    label: 'Sent',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
    icon: CheckCircle2,
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    icon: Clock,
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    icon: XCircle,
  },
  skipped: {
    label: 'Skipped',
    className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
    icon: MinusCircle,
  },
};

const EMPTY_FORM: RuleFormData = {
  triggerEvent: '',
  channel: '',
  templateId: '',
  delayMinutes: 0,
  fallbackChannel: '',
};

// ==================== Helpers ====================

function getApiHeaders() {
  const token = useAuthStore.getState().token;
  const orgId = useOrgStore.getState().currentOrganization?.id;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Organization-Id': orgId || '',
  };
}

function getTriggerLabel(value: string): string {
  return TRIGGER_EVENTS.find((t) => t.value === value)?.label || value;
}

function getChannelIcon(channel: string, className?: string) {
  const found = CHANNELS.find((c) => c.value === channel);
  if (!found) return null;
  const Icon = found.icon;
  return <Icon className={cn('h-4 w-4', className)} />;
}

function getChannelLabel(channel: string): string {
  return CHANNELS.find((c) => c.value === channel)?.label || channel;
}

// ==================== Animation Variants ====================

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

// ==================== Sub-Components ====================

function TriggerEventBadge({ event }: { event: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] px-1.5 py-0 whitespace-nowrap', TRIGGER_EVENT_COLORS[event] || '')}
    >
      {getTriggerLabel(event)}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = LOG_STATUS_CONFIG[status];
  if (!config) {
    return <Badge variant="outline">{status}</Badge>;
  }
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn('text-xs gap-1', config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function StatsCard({
  icon: Icon,
  label,
  value,
  color,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.3, delay }}
    >
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', color)}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function RuleCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LogsTableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

// ==================== Main Component ====================

export default function AutomationPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState('rules');

  // ---- Dialog States ----
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState<RuleFormData>({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState<RuleFormData>({ ...EMPTY_FORM });

  // Logs filter states
  const [logStatusFilter, setLogStatusFilter] = useState('all');
  const [logChannelFilter, setLogChannelFilter] = useState('all');
  const [logTriggerFilter, setLogTriggerFilter] = useState('all');
  const [logPage, setLogPage] = useState(1);

  // ==================== Queries ====================

  const { data: rules = [], isLoading: rulesLoading } = useQuery<AutomationRule[]>({
    queryKey: ['automation-rules'],
    queryFn: async () => {
      const res = await fetch('/api/automation-rules', {
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch automation rules');
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    },
  });

  const { data: allLogs = [], isLoading: logsStatsLoading } = useQuery<AutomationLog[]>({
    queryKey: ['automation-logs-stats'],
    queryFn: async () => {
      const res = await fetch('/api/automation-logs?limit=1', {
        headers: getApiHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    },
  });

  // For stats we fetch a larger sample (or the API might return totals)
  const { data: logsStatsData } = useQuery<{ sent: number; failed: number }>({
    queryKey: ['automation-logs-stats-summary'],
    queryFn: async () => {
      // We fetch sent and failed counts by making two small calls
      const [sentRes, failedRes] = await Promise.all([
        fetch('/api/automation-logs?status=sent&limit=1', { headers: getApiHeaders() }),
        fetch('/api/automation-logs?status=failed&limit=1', { headers: getApiHeaders() }),
      ]);
      const sentJson = await sentRes.json().catch(() => ({}));
      const failedJson = await failedRes.json().catch(() => ({}));
      return {
        sent: sentJson.meta?.total ?? Array.isArray(sentJson) ? sentJson.length : 0,
        failed: failedJson.meta?.total ?? Array.isArray(failedJson) ? failedJson.length : 0,
      };
    },
  });

  const { data: logsResponse, isLoading: logsLoading, isFetching: logsFetching } = useQuery<AutomationLogsResponse>({
    queryKey: ['automation-logs', logStatusFilter, logChannelFilter, logTriggerFilter, logPage],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(logPage), limit: '20' });
      if (logStatusFilter !== 'all') params.set('status', logStatusFilter);
      if (logChannelFilter !== 'all') params.set('channel', logChannelFilter);
      if (logTriggerFilter !== 'all') params.set('triggerEvent', logTriggerFilter);

      const res = await fetch(`/api/automation-logs?${params}`, {
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch automation logs');
      return res.json();
    },
    enabled: activeTab === 'logs',
  });

  // ==================== Mutations ====================

  const createMutation = useMutation({
    mutationFn: async (data: RuleFormData) => {
      const body: Record<string, unknown> = {
        triggerEvent: data.triggerEvent,
        channel: data.channel,
        delayMinutes: Number(data.delayMinutes) || 0,
      };
      if (data.templateId) body.templateId = data.templateId;
      if (data.fallbackChannel) body.fallbackChannel = data.fallbackChannel;

      const res = await fetch('/api/automation-rules', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create automation rule');
      }
      return res.json();
    },
    onSuccess: () => {
      setShowCreateDialog(false);
      setCreateForm({ ...EMPTY_FORM });
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Automation rule created successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create automation rule');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RuleFormData }) => {
      const body: Record<string, unknown> = {
        triggerEvent: data.triggerEvent,
        channel: data.channel,
        delayMinutes: Number(data.delayMinutes) || 0,
      };
      if (data.templateId) body.templateId = data.templateId;
      if (data.fallbackChannel) body.fallbackChannel = data.fallbackChannel;

      const res = await fetch(`/api/automation-rules/${id}`, {
        method: 'PUT',
        headers: getApiHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update automation rule');
      }
      return res.json();
    },
    onSuccess: () => {
      setShowEditDialog(false);
      setSelectedRule(null);
      setEditForm({ ...EMPTY_FORM });
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Automation rule updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update automation rule');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/automation-rules/${id}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete automation rule');
      }
      return res.json();
    },
    onSuccess: () => {
      setShowDeleteDialog(false);
      setSelectedRule(null);
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Automation rule deleted');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete automation rule');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/automation-rules/${id}`, {
        method: 'PUT',
        headers: getApiHeaders(),
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle rule');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Rule status updated');
    },
    onError: () => {
      toast.error('Failed to toggle rule');
    },
  });

  // ==================== Form Helpers ====================

  const openCreateDialog = useCallback(() => {
    setCreateForm({ ...EMPTY_FORM });
    setShowCreateDialog(true);
  }, []);

  const openEditDialog = useCallback((rule: AutomationRule) => {
    setSelectedRule(rule);
    setEditForm({
      triggerEvent: rule.triggerEvent,
      channel: rule.channel,
      templateId: rule.templateId || '',
      delayMinutes: rule.delayMinutes,
      fallbackChannel: rule.fallbackChannel || '',
    });
    setShowEditDialog(true);
  }, []);

  const openDeleteDialog = useCallback((rule: AutomationRule) => {
    setSelectedRule(rule);
    setShowDeleteDialog(true);
  }, []);

  const handleLogFilterChange = useCallback((setter: (val: string) => void) => (val: string) => {
    setter(val);
    setLogPage(1);
  }, []);

  const clearLogFilters = useCallback(() => {
    setLogStatusFilter('all');
    setLogChannelFilter('all');
    setLogTriggerFilter('all');
    setLogPage(1);
  }, []);

  // ==================== Computed ====================

  const activeRules = rules.filter((r) => r.isActive);
  const sentCount = logsStatsData?.sent ?? 0;
  const failedCount = logsStatsData?.failed ?? 0;

  const logs = logsResponse?.data || [];
  const logMeta = logsResponse?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const hasActiveLogFilters = logStatusFilter !== 'all' || logChannelFilter !== 'all' || logTriggerFilter !== 'all';

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            Automation
          </h1>
          <p className="text-muted-foreground">
            Manage notification rules and monitor delivery logs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
              queryClient.invalidateQueries({ queryKey: ['automation-logs'] });
              queryClient.invalidateQueries({ queryKey: ['automation-logs-stats'] });
              queryClient.invalidateQueries({ queryKey: ['automation-logs-stats-summary'] });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          {isAdmin && (
            <Button
              onClick={openCreateDialog}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          )}
        </div>
      </div>

      {/* Fallback Info Card */}
      <motion.div
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.3 }}
      >
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-emerald-800 dark:text-emerald-200">Fallback Channel Logic</p>
                <p className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                  If the primary channel fails, messages automatically fall back to the secondary channel
                  (e.g., WhatsApp → SMS → Email). Set a fallback channel when creating a rule to ensure
                  delivery reliability.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard
          icon={Zap}
          label="Total Rules"
          value={rules.length}
          color="bg-emerald-600"
          delay={0}
        />
        <StatsCard
          icon={Activity}
          label="Active Rules"
          value={activeRules.length}
          color="bg-teal-600"
          delay={0.05}
        />
        <StatsCard
          icon={CheckCircle2}
          label="Sent"
          value={sentCount}
          color="bg-emerald-600"
          delay={0.1}
        />
        <StatsCard
          icon={XCircle}
          label="Failed"
          value={failedCount}
          color="bg-red-600"
          delay={0.15}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="rules" className="gap-1.5">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Rules</span>
            {rules.length > 0 && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-[10px] ml-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
              >
                {rules.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Logs</span>
          </TabsTrigger>
        </TabsList>

        {/* ============ Rules Tab ============ */}
        <TabsContent value="rules" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {rulesLoading ? (
              <>
                <RuleCardSkeleton />
                <RuleCardSkeleton />
                <RuleCardSkeleton />
              </>
            ) : rules.length === 0 ? (
              <div className="col-span-full">
                <Card>
                  <CardContent className="text-center py-16">
                    <Zap className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-sm font-medium text-muted-foreground">No automation rules</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Create your first rule to start automating notifications
                    </p>
                    {isAdmin && (
                      <Button
                        onClick={openCreateDialog}
                        variant="outline"
                        size="sm"
                        className="mt-4"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Create Rule
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {rules.map((rule, idx) => (
                  <motion.div
                    key={rule.id}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    transition={{ duration: 0.25, delay: idx * 0.03 }}
                    layout
                  >
                    <Card className="relative overflow-hidden">
                      {/* Active status bar */}
                      <div
                        className={cn(
                          'absolute top-0 left-0 right-0 h-1',
                          rule.isActive
                            ? 'bg-emerald-500'
                            : 'bg-gray-300 dark:bg-gray-600'
                        )}
                      />
                      <CardContent className="p-4 pt-5 space-y-3">
                        {/* Trigger Event + Status Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <TriggerEventBadge event={rule.triggerEvent} />
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-2 py-0 shrink-0',
                              rule.isActive
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700'
                            )}
                          >
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>

                        {/* Channel + Delay */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            {getChannelIcon(rule.channel, 'text-emerald-600 dark:text-emerald-400')}
                            {getChannelLabel(rule.channel)}
                          </div>

                          {rule.delayMinutes > 0 && (
                            <>
                              <Separator orientation="vertical" className="h-4" />
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Timer className="h-3 w-3" />
                                {rule.delayMinutes} min delay
                              </div>
                            </>
                          )}
                        </div>

                        {/* Fallback Channel */}
                        {rule.fallbackChannel && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <ArrowRightLeft className="h-3 w-3" />
                            <span>Fallback: {getChannelLabel(rule.fallbackChannel)}</span>
                          </div>
                        )}

                        {/* Meta + Actions */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(rule.createdAt), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {isAdmin && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => openEditDialog(rule)}
                                  title="Edit rule"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                  onClick={() => openDeleteDialog(rule)}
                                  title="Delete rule"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            {isAdmin ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                                disabled={toggleMutation.isPending}
                                title={rule.isActive ? 'Deactivate' : 'Activate'}
                              >
                                <Switch
                                  checked={rule.isActive}
                                  className="pointer-events-none scale-75"
                                  onCheckedChange={() => {}}
                                />
                              </Button>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                Read-only
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </TabsContent>

        {/* ============ Logs Tab ============ */}
        <TabsContent value="logs" className="space-y-4 mt-6">
          {/* Filter Row */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  Filters
                  {hasActiveLogFilters && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      Active
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Status Filter */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select value={logStatusFilter} onValueChange={handleLogFilterChange(setLogStatusFilter)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="skipped">Skipped</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Channel Filter */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Channel</Label>
                    <Select value={logChannelFilter} onValueChange={handleLogFilterChange(setLogChannelFilter)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Channels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Channels</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Trigger Event Filter */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Trigger Event</Label>
                    <Select value={logTriggerFilter} onValueChange={handleLogFilterChange(setLogTriggerFilter)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Events" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Events</SelectItem>
                        {TRIGGER_EVENTS.map((te) => (
                          <SelectItem key={te.value} value={te.value}>
                            {te.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {hasActiveLogFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-fit text-xs"
                    onClick={clearLogFilters}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Clear filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Logs Table */}
          <Card>
            <CardContent className="p-0">
              {logsLoading ? (
                <LogsTableSkeleton />
              ) : logs.length === 0 ? (
                <div className="text-center py-16">
                  <Clock className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-sm font-medium text-muted-foreground">No automation logs found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasActiveLogFilters
                      ? 'Try adjusting your filters'
                      : 'Automation logs will appear here as messages are processed'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block">
                    <div className="max-h-[500px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="sticky top-0 bg-background z-10">
                            <TableHead className="pl-4">Trigger</TableHead>
                            <TableHead>Channel</TableHead>
                            <TableHead>Recipient</TableHead>
                            <TableHead className="text-center">Attempts</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Sent At</TableHead>
                            <TableHead className="pr-4">Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="pl-4">
                                <TriggerEventBadge event={log.triggerEvent} />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 text-sm">
                                  {getChannelIcon(log.channel)}
                                  {getChannelLabel(log.channel)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm font-mono">{log.recipient}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-sm text-muted-foreground">{log.attempts}</span>
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={log.status} />
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {format(new Date(log.createdAt), 'MMM d, HH:mm')}
                                </span>
                              </TableCell>
                              <TableCell>
                                {log.sentAt ? (
                                  <span className="text-sm text-muted-foreground">
                                    {format(new Date(log.sentAt), 'MMM d, HH:mm')}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="pr-4 max-w-[200px]">
                                {log.errorMessage ? (
                                  <span
                                    className="text-xs text-red-600 dark:text-red-400 truncate block"
                                    title={log.errorMessage}
                                  >
                                    {log.errorMessage}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y">
                    {logs.map((log) => (
                      <div key={log.id} className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <TriggerEventBadge event={log.triggerEvent} />
                          <StatusBadge status={log.status} />
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                          {getChannelIcon(log.channel)}
                          {getChannelLabel(log.channel)}
                          <Separator orientation="vertical" className="h-4 mx-1" />
                          <span className="font-mono text-xs">{log.recipient}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          <div>
                            <span className="font-medium text-foreground/70">Attempts </span>
                            {log.attempts}
                          </div>
                          <div>
                            <span className="font-medium text-foreground/70 flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                            </span>
                            {' '}
                            {format(new Date(log.createdAt), 'MMM d, HH:mm')}
                          </div>
                          <div>
                            {log.sentAt ? (
                              <>
                                <span className="font-medium text-foreground/70">Sent </span>
                                {format(new Date(log.sentAt), 'HH:mm')}
                              </>
                            ) : (
                              <span className="text-muted-foreground">Not sent</span>
                            )}
                          </div>
                        </div>
                        {log.errorMessage && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1" title={log.errorMessage}>
                            {log.errorMessage}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {logMeta.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        Page {logMeta.page} of {logMeta.totalPages} · {logMeta.total} total
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs"
                          disabled={logPage <= 1 || logsFetching}
                          onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs"
                          disabled={logPage >= logMeta.totalPages || logsFetching}
                          onClick={() => setLogPage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============ Create Rule Dialog ============ */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Create Automation Rule
            </DialogTitle>
            <DialogDescription>
              Define when and how notifications are sent automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Trigger Event */}
            <div className="space-y-1.5">
              <Label htmlFor="create-trigger">Trigger Event</Label>
              <Select
                value={createForm.triggerEvent}
                onValueChange={(val) => setCreateForm((f) => ({ ...f, triggerEvent: val }))}
              >
                <SelectTrigger id="create-trigger">
                  <SelectValue placeholder="Select trigger event" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_EVENTS.map((te) => (
                    <SelectItem key={te.value} value={te.value}>
                      <span className="font-medium">{te.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createForm.triggerEvent && (
                <p className="text-xs text-muted-foreground">
                  {TRIGGER_EVENTS.find((t) => t.value === createForm.triggerEvent)?.description}
                </p>
              )}
            </div>

            {/* Channel */}
            <div className="space-y-1.5">
              <Label htmlFor="create-channel">Channel</Label>
              <Select
                value={createForm.channel}
                onValueChange={(val) => setCreateForm((f) => ({ ...f, channel: val }))}
              >
                <SelectTrigger id="create-channel">
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((ch) => (
                    <SelectItem key={ch.value} value={ch.value}>
                      <span className="flex items-center gap-2">
                        <ch.icon className="h-4 w-4" />
                        {ch.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Delay */}
            <div className="space-y-1.5">
              <Label htmlFor="create-delay">Delay (minutes)</Label>
              <Input
                id="create-delay"
                type="number"
                min={0}
                placeholder="0"
                value={createForm.delayMinutes || ''}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, delayMinutes: parseInt(e.target.value, 10) || 0 }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Time to wait before sending. Set to 0 for immediate delivery.
              </p>
            </div>

            {/* Fallback Channel */}
            <div className="space-y-1.5">
              <Label htmlFor="create-fallback">Fallback Channel (optional)</Label>
              <Select
                value={createForm.fallbackChannel}
                onValueChange={(val) => setCreateForm((f) => ({ ...f, fallbackChannel: val }))}
              >
                <SelectTrigger id="create-fallback">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No fallback</SelectItem>
                  {CHANNELS.filter((ch) => ch.value !== createForm.channel).map((ch) => (
                    <SelectItem key={ch.value} value={ch.value}>
                      <span className="flex items-center gap-2">
                        <ch.icon className="h-4 w-4" />
                        {ch.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                If the primary channel fails, the message will be sent via this channel instead.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={!createForm.triggerEvent || !createForm.channel || createMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {createMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Edit Rule Dialog ============ */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Edit Automation Rule
            </DialogTitle>
            <DialogDescription>
              Update the automation rule configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Trigger Event */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-trigger">Trigger Event</Label>
              <Select
                value={editForm.triggerEvent}
                onValueChange={(val) => setEditForm((f) => ({ ...f, triggerEvent: val }))}
              >
                <SelectTrigger id="edit-trigger">
                  <SelectValue placeholder="Select trigger event" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_EVENTS.map((te) => (
                    <SelectItem key={te.value} value={te.value}>
                      <span className="font-medium">{te.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editForm.triggerEvent && (
                <p className="text-xs text-muted-foreground">
                  {TRIGGER_EVENTS.find((t) => t.value === editForm.triggerEvent)?.description}
                </p>
              )}
            </div>

            {/* Channel */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-channel">Channel</Label>
              <Select
                value={editForm.channel}
                onValueChange={(val) => setEditForm((f) => ({ ...f, channel: val }))}
              >
                <SelectTrigger id="edit-channel">
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((ch) => (
                    <SelectItem key={ch.value} value={ch.value}>
                      <span className="flex items-center gap-2">
                        <ch.icon className="h-4 w-4" />
                        {ch.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Delay */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-delay">Delay (minutes)</Label>
              <Input
                id="edit-delay"
                type="number"
                min={0}
                placeholder="0"
                value={editForm.delayMinutes || ''}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, delayMinutes: parseInt(e.target.value, 10) || 0 }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Time to wait before sending. Set to 0 for immediate delivery.
              </p>
            </div>

            {/* Fallback Channel */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-fallback">Fallback Channel (optional)</Label>
              <Select
                value={editForm.fallbackChannel}
                onValueChange={(val) => setEditForm((f) => ({ ...f, fallbackChannel: val }))}
              >
                <SelectTrigger id="edit-fallback">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No fallback</SelectItem>
                  {CHANNELS.filter((ch) => ch.value !== editForm.channel).map((ch) => (
                    <SelectItem key={ch.value} value={ch.value}>
                      <span className="flex items-center gap-2">
                        <ch.icon className="h-4 w-4" />
                        {ch.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                If the primary channel fails, the message will be sent via this channel instead.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedRule && updateMutation.mutate({ id: selectedRule.id, data: editForm })
              }
              disabled={!editForm.triggerEvent || !editForm.channel || updateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {updateMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Delete Confirmation Dialog ============ */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Delete Automation Rule
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this automation rule? This action cannot be undone.
              {selectedRule && (
                <span className="block mt-2 font-medium text-foreground/80">
                  Rule: {getTriggerLabel(selectedRule.triggerEvent)} → {getChannelLabel(selectedRule.channel)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedRule && deleteMutation.mutate(selectedRule.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
