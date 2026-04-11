'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Webhook,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  Trash2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Filter,
  Send,
  Clock,
  ChevronLeft,
  ChevronRight,
  Globe,
  Zap,
  Shield,
  Eye,
  EyeOff,
  Pencil,
  X,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  totalLogs: number;
}

interface WebhookLog {
  id: string;
  endpointId: string;
  endpointUrl: string;
  eventType: string;
  httpStatus: number | null;
  attempts: number;
  status: 'pending' | 'delivered' | 'failed';
  createdAt: string;
  nextRetryAt: string | null;
}

interface WebhookLogsResponse {
  data: WebhookLog[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==================== Constants ====================

const ALLOWED_EVENT_TYPES = [
  'ticket.created',
  'ticket.validated',
  'ticket.cancelled',
  'subscription.created',
  'subscription.expired',
  'user.created',
];

const EVENT_COLORS: Record<string, string> = {
  'ticket.created': 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
  'ticket.validated': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  'ticket.cancelled': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  'subscription.created': 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800',
  'subscription.expired': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  'user.created': 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800',
};

const EVENT_LABELS: Record<string, string> = {
  'ticket.created': 'Ticket Created',
  'ticket.validated': 'Ticket Validated',
  'ticket.cancelled': 'Ticket Cancelled',
  'subscription.created': 'Subscription Created',
  'subscription.expired': 'Subscription Expired',
  'user.created': 'User Created',
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

function truncateUrl(url: string, maxLen = 50) {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + '...';
}

function formatHttpColor(status: number | null): string {
  if (!status) return 'text-muted-foreground';
  if (status >= 200 && status < 300) return 'text-emerald-600 dark:text-emerald-400';
  if (status >= 400 && status < 500) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getStatusConfig(status: string): { label: string; className: string } {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending',
        className: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
      };
    case 'delivered':
      return {
        label: 'Delivered',
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
      };
    case 'failed':
      return {
        label: 'Failed',
        className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
      };
    default:
      return { label: status, className: 'bg-muted text-muted-foreground border-transparent' };
  }
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

function EventBadge({ event }: { event: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] px-1.5 py-0 whitespace-nowrap', EVENT_COLORS[event] || '')}
    >
      {EVENT_LABELS[event] || event}
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

function EndpointSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Main Component ====================

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('endpoints');

  // ---- Endpoint Dialog States ----
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSecretDialog, setShowSecretDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<WebhookEndpoint | null>(null);

  // Create form
  const [createUrl, setCreateUrl] = useState('');
  const [createEvents, setCreateEvents] = useState<string[]>([]);

  // Edit form
  const [editUrl, setEditUrl] = useState('');
  const [editEvents, setEditEvents] = useState<string[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);

  // Secret display
  const [newSecret, setNewSecret] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);
  const [secretRevealed, setSecretRevealed] = useState(false);

  // ---- Logs Filter States ----
  const [logStatusFilter, setLogStatusFilter] = useState('all');
  const [logEventTypeFilter, setLogEventTypeFilter] = useState('all');
  const [logEndpointFilter, setLogEndpointFilter] = useState('all');
  const [logPage, setLogPage] = useState(1);

  // ==================== Queries ====================

  const { data: endpoints = [], isLoading: endpointsLoading } = useQuery<WebhookEndpoint[]>({
    queryKey: ['webhook-endpoints'],
    queryFn: async () => {
      const res = await fetch('/api/webhooks/endpoints', {
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch webhook endpoints');
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    },
  });

  const { data: logsData, isLoading: logsLoading, isFetching: logsFetching } = useQuery<WebhookLogsResponse>({
    queryKey: ['webhook-logs', logStatusFilter, logEventTypeFilter, logEndpointFilter, logPage],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(logPage), limit: '20' });
      if (logStatusFilter !== 'all') params.set('status', logStatusFilter);
      if (logEventTypeFilter !== 'all') params.set('eventType', logEventTypeFilter);
      if (logEndpointFilter !== 'all') params.set('endpointId', logEndpointFilter);

      const res = await fetch(`/api/webhooks/logs?${params}`, {
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch webhook logs');
      return res.json();
    },
    enabled: activeTab === 'logs',
  });

  // ==================== Mutations ====================

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/webhooks/endpoints', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ url: createUrl, events: createEvents }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create endpoint');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setShowCreateDialog(false);
      resetCreateForm();
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      if (data.data?.secret || data.secret) {
        setNewSecret(data.data?.secret || data.secret);
        setShowSecretDialog(true);
      }
      toast.success('Webhook endpoint created successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create webhook endpoint');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await fetch(`/api/webhooks/endpoints/${id}`, {
        method: 'PUT',
        headers: getApiHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update endpoint');
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      setShowEditDialog(false);
      setSelectedEndpoint(null);
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      // If secret was regenerated, show it
      if (variables.body.regenerateSecret && (data.data?.secret || data.secret)) {
        setNewSecret(data.data?.secret || data.secret);
        setSecretRevealed(false);
        setSecretCopied(false);
        setShowSecretDialog(true);
      }
      toast.success('Webhook endpoint updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update endpoint');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/webhooks/endpoints/${id}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete endpoint');
      }
      return res.json();
    },
    onSuccess: () => {
      setShowDeleteDialog(false);
      setSelectedEndpoint(null);
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      queryClient.invalidateQueries({ queryKey: ['webhook-logs'] });
      toast.success('Webhook endpoint deleted');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete endpoint');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/webhooks/endpoints/${id}`, {
        method: 'PUT',
        headers: getApiHeaders(),
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle endpoint');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Endpoint status updated');
    },
    onError: () => {
      toast.error('Failed to toggle endpoint');
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (logId: string) => {
      const res = await fetch('/api/webhooks/retry', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ logId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to retry webhook');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-logs'] });
      toast.success('Webhook retry initiated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to retry webhook');
    },
  });

  const processQueueMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/webhooks/process', {
        method: 'POST',
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to process queue');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['webhook-logs'] });
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success(`Queue processed: ${data.processed} delivered, ${data.failed} failed`);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to process queue');
    },
  });

  // ==================== Form Helpers ====================

  const resetCreateForm = useCallback(() => {
    setCreateUrl('');
    setCreateEvents([]);
  }, []);

  const openCreateDialog = useCallback(() => {
    resetCreateForm();
    setShowCreateDialog(true);
  }, [resetCreateForm]);

  const openEditDialog = useCallback((ep: WebhookEndpoint) => {
    setSelectedEndpoint(ep);
    setEditUrl(ep.url);
    setEditEvents([...ep.events]);
    setEditIsActive(ep.isActive);
    setShowEditDialog(true);
  }, []);

  const toggleCreateEvent = useCallback((event: string) => {
    setCreateEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }, []);

  const toggleEditEvent = useCallback((event: string) => {
    setEditEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }, []);

  const handleCopySecret = useCallback(() => {
    navigator.clipboard.writeText(newSecret);
    setSecretCopied(true);
    toast.success('Secret copied to clipboard');
    setTimeout(() => setSecretCopied(false), 2000);
  }, [newSecret]);

  const handleLogFilterChange = useCallback((setter: (val: string) => void) => (val: string) => {
    setter(val);
    setLogPage(1);
  }, []);

  // ==================== Computed ====================

  const activeEndpoints = endpoints.filter((e) => e.isActive);
  const totalDeliveries = endpoints.reduce((sum, e) => sum + (e.totalLogs || 0), 0);

  const logs = logsData?.data || [];
  const logMeta = logsData?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const hasActiveLogFilters =
    logStatusFilter !== 'all' || logEventTypeFilter !== 'all' || logEndpointFilter !== 'all';

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Webhook className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            Webhooks
          </h1>
          <p className="text-muted-foreground">
            Manage webhook endpoints and monitor delivery logs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => processQueueMutation.mutate()}
            disabled={processQueueMutation.isPending}
          >
            {processQueueMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1.5" />
            )}
            Process Queue
          </Button>
          <Button
            onClick={openCreateDialog}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Endpoint
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <motion.div
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.3 }}
      >
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-emerald-800 dark:text-emerald-200">Webhook Security</p>
                <p className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                  All webhook payloads are signed with HMAC-SHA256. Use the endpoint secret to verify
                  signatures. Endpoints must use HTTPS. Failed deliveries are retried with exponential
                  backoff up to 3 attempts.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="endpoints" className="gap-1.5">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Endpoints</span>
            {endpoints.length > 0 && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-[10px] ml-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
              >
                {endpoints.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Delivery Logs</span>
          </TabsTrigger>
        </TabsList>

        {/* ============ Endpoints Tab ============ */}
        <TabsContent value="endpoints" className="space-y-6 mt-6">
          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              icon={Webhook}
              label="Total Endpoints"
              value={endpoints.length}
              color="bg-emerald-600"
              delay={0}
            />
            <StatsCard
              icon={Zap}
              label="Active"
              value={activeEndpoints.length}
              color="bg-sky-600"
              delay={0.05}
            />
            <StatsCard
              icon={Send}
              label="Total Deliveries"
              value={totalDeliveries}
              color="bg-violet-600"
              delay={0.1}
            />
          </div>

          {/* Endpoint Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {endpointsLoading ? (
              <>
                <EndpointSkeleton />
                <EndpointSkeleton />
                <EndpointSkeleton />
              </>
            ) : endpoints.length === 0 ? (
              <div className="col-span-full">
                <Card>
                  <CardContent className="text-center py-16">
                    <Webhook className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-sm font-medium text-muted-foreground">No webhook endpoints</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Create your first endpoint to receive real-time event notifications
                    </p>
                    <Button
                      onClick={openCreateDialog}
                      variant="outline"
                      size="sm"
                      className="mt-4"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Create Endpoint
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {endpoints.map((ep, idx) => (
                  <motion.div
                    key={ep.id}
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
                          ep.isActive
                            ? 'bg-emerald-500'
                            : 'bg-gray-300 dark:bg-gray-600'
                        )}
                      />
                      <CardContent className="p-4 pt-5 space-y-3">
                        {/* URL + Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={cn(
                                'h-2 w-2 rounded-full shrink-0',
                                ep.isActive ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-500'
                              )}
                            />
                            <p
                              className="text-sm font-mono truncate"
                              title={ep.url}
                            >
                              {truncateUrl(ep.url)}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-2 py-0 shrink-0',
                              ep.isActive
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700'
                            )}
                          >
                            {ep.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>

                        {/* Event Types */}
                        <div className="flex flex-wrap gap-1.5">
                          {ep.events.map((event) => (
                            <EventBadge key={event} event={event} />
                          ))}
                        </div>

                        {/* Meta + Actions */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Send className="h-3 w-3" />
                              {ep.totalLogs || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(ep.createdAt), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => openEditDialog(ep)}
                              title="Edit endpoint"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() =>
                                toggleMutation.mutate({ id: ep.id, isActive: !ep.isActive })
                              }
                              disabled={toggleMutation.isPending}
                              title={ep.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {ep.isActive ? (
                                <ToggleRight className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                              onClick={() => {
                                setSelectedEndpoint(ep);
                                setShowDeleteDialog(true);
                              }}
                              title="Delete endpoint"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
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

        {/* ============ Delivery Logs Tab ============ */}
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
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Event Type Filter */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Event Type</Label>
                    <Select value={logEventTypeFilter} onValueChange={handleLogFilterChange(setLogEventTypeFilter)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Events" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Events</SelectItem>
                        {ALLOWED_EVENT_TYPES.map((et) => (
                          <SelectItem key={et} value={et}>
                            {EVENT_LABELS[et] || et}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Endpoint Filter */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Endpoint</Label>
                    <Select value={logEndpointFilter} onValueChange={handleLogFilterChange(setLogEndpointFilter)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Endpoints" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Endpoints</SelectItem>
                        {endpoints.map((ep) => (
                          <SelectItem key={ep.id} value={ep.id}>
                            {truncateUrl(ep.url, 35)}
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
                    onClick={() => {
                      setLogStatusFilter('all');
                      setLogEventTypeFilter('all');
                      setLogEndpointFilter('all');
                      setLogPage(1);
                    }}
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
                <div className="space-y-3 p-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-5 w-12" />
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-16">
                  <Clock className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-sm font-medium text-muted-foreground">No delivery logs found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasActiveLogFilters
                      ? 'Try adjusting your filters'
                      : 'Webhook delivery logs will appear here as events are processed'}
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
                            <TableHead className="pl-4">Event</TableHead>
                            <TableHead>Endpoint</TableHead>
                            <TableHead className="text-center">HTTP Status</TableHead>
                            <TableHead className="text-center">Attempts</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Next Retry</TableHead>
                            <TableHead className="text-right pr-4">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs.map((log) => {
                            const statusConf = getStatusConfig(log.status);
                            return (
                              <TableRow key={log.id}>
                                <TableCell className="pl-4">
                                  <EventBadge event={log.eventType} />
                                </TableCell>
                                <TableCell>
                                  <p
                                    className="text-sm font-mono truncate max-w-[180px]"
                                    title={log.endpointUrl}
                                  >
                                    {truncateUrl(log.endpointUrl, 30)}
                                  </p>
                                </TableCell>
                                <TableCell className="text-center">
                                  {log.httpStatus ? (
                                    <span className={cn('text-sm font-mono font-medium', formatHttpColor(log.httpStatus))}>
                                      {log.httpStatus}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="text-sm text-muted-foreground">{log.attempts}</span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={cn('text-xs', statusConf.className)}>
                                    {statusConf.label}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-muted-foreground">
                                    {format(new Date(log.createdAt), 'MMM d, HH:mm')}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {log.nextRetryAt ? (
                                    <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {format(new Date(log.nextRetryAt), 'MMM d, HH:mm')}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right pr-4">
                                  {log.status === 'failed' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => retryMutation.mutate(log.id)}
                                      disabled={retryMutation.isPending}
                                    >
                                      <RefreshCw className={cn('h-3 w-3 mr-1', retryMutation.isPending && 'animate-spin')} />
                                      Retry
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y">
                    {logs.map((log) => {
                      const statusConf = getStatusConfig(log.status);
                      return (
                        <div key={log.id} className="p-4 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <EventBadge event={log.eventType} />
                            <Badge variant="outline" className={cn('text-[10px]', statusConf.className)}>
                              {statusConf.label}
                            </Badge>
                          </div>
                          <p className="text-xs font-mono text-muted-foreground truncate" title={log.endpointUrl}>
                            {log.endpointUrl}
                          </p>
                          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                            <div>
                              <span className="font-medium text-foreground/70">HTTP </span>
                              <span className={cn('font-mono', formatHttpColor(log.httpStatus))}>
                                {log.httpStatus || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-foreground/70">Attempts </span>
                              {log.attempts}
                            </div>
                            <div>
                              <span className="font-medium text-foreground/70 flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />
                              </span>
                              {format(new Date(log.createdAt), 'MMM d, HH:mm')}
                            </div>
                          </div>
                          {log.nextRetryAt && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Next retry: {format(new Date(log.nextRetryAt), 'MMM d, HH:mm')}
                            </p>
                          )}
                          {log.status === 'failed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-7 text-xs mt-1"
                              onClick={() => retryMutation.mutate(log.id)}
                              disabled={retryMutation.isPending}
                            >
                              <RefreshCw className={cn('h-3 w-3 mr-1', retryMutation.isPending && 'animate-spin')} />
                              Retry Delivery
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {logMeta.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <p className="text-sm text-muted-foreground">
                        Page {logMeta.page} of {logMeta.totalPages} ({logMeta.total} logs)
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={logPage <= 1 || logsFetching}
                          onClick={() => setLogPage((p) => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
                        </Button>

                        <div className="hidden sm:flex items-center gap-1">
                          {Array.from({ length: Math.min(5, logMeta.totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (logMeta.totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (logPage <= 3) {
                              pageNum = i + 1;
                            } else if (logPage >= logMeta.totalPages - 2) {
                              pageNum = logMeta.totalPages - 4 + i;
                            } else {
                              pageNum = logPage - 2 + i;
                            }
                            return (
                              <Button
                                key={pageNum}
                                variant={pageNum === logPage ? 'default' : 'outline'}
                                size="sm"
                                className="w-8 h-8 p-0"
                                onClick={() => setLogPage(pageNum)}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={logPage >= logMeta.totalPages || logsFetching}
                          onClick={() => setLogPage((p) => p + 1)}
                        >
                          <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
                          <ChevronRight className="h-4 w-4" />
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

      {/* ==================== Create Endpoint Dialog ==================== */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Webhook Endpoint</DialogTitle>
            <DialogDescription>
              Add a new endpoint to receive event notifications via HTTP POST
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* URL Input */}
            <div className="space-y-2">
              <Label htmlFor="create-url">Endpoint URL</Label>
              <Input
                id="create-url"
                value={createUrl}
                onChange={(e) => setCreateUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                type="url"
              />
              <p className="text-[11px] text-muted-foreground">
                Must be a valid HTTPS URL
              </p>
            </div>

            {/* Event Types */}
            <div className="space-y-2">
              <Label>Event Types</Label>
              <p className="text-[11px] text-muted-foreground mb-2">
                Select which events should trigger this webhook
              </p>
              <div className="space-y-2">
                {ALLOWED_EVENT_TYPES.map((event) => (
                  <div key={event} className="flex items-center gap-2">
                    <Checkbox
                      id={`create-${event}`}
                      checked={createEvents.includes(event)}
                      onCheckedChange={() => toggleCreateEvent(event)}
                    />
                    <Label htmlFor={`create-${event}`} className="text-sm font-normal cursor-pointer flex items-center gap-2">
                      <EventBadge event={event} />
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                !createUrl.trim() ||
                !createUrl.startsWith('https://') ||
                createEvents.length === 0 ||
                createMutation.isPending
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {createMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Endpoint'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Secret Reveal Dialog ==================== */}
      <Dialog open={showSecretDialog} onOpenChange={setShowSecretDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Webhook Secret
            </DialogTitle>
            <DialogDescription>
              Your webhook signing secret has been generated
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Warning */}
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Save this secret now — it won&apos;t be shown again! Use it to verify webhook
                  signatures using HMAC-SHA256.
                </p>
              </div>
            </div>

            {/* Secret Display */}
            <div className="space-y-2">
              <Label>Signing Secret</Label>
              <div className="relative">
                <code className="block w-full rounded-md border bg-muted p-3 text-xs font-mono break-all pr-20">
                  {secretRevealed ? newSecret : '••••••••••••••••••••••••••••••••••••'}
                </code>
                <div className="absolute top-1.5 right-1.5 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setSecretRevealed(!secretRevealed)}
                  >
                    {secretRevealed ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={handleCopySecret}
                  >
                    {secretCopied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Use this secret with the <code className="bg-muted px-1 rounded text-[10px]">X-Webhook-Signature</code> header to verify payload authenticity.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowSecretDialog(false)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              I&apos;ve Saved My Secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Edit Endpoint Dialog ==================== */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Webhook Endpoint</DialogTitle>
            <DialogDescription>
              Modify endpoint URL, events, and status
            </DialogDescription>
          </DialogHeader>
          {selectedEndpoint && (
            <div className="space-y-4 py-2">
              {/* Current Info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Webhook className="h-3.5 w-3.5" />
                <code className="font-mono truncate max-w-[300px]">
                  {selectedEndpoint.url}
                </code>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] ml-auto',
                    selectedEndpoint.isActive
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700'
                  )}
                >
                  {selectedEndpoint.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <Separator />

              {/* URL */}
              <div className="space-y-2">
                <Label htmlFor="edit-url">Endpoint URL</Label>
                <Input
                  id="edit-url"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  type="url"
                />
              </div>

              {/* Events */}
              <div className="space-y-2">
                <Label>Event Types</Label>
                <div className="space-y-2">
                  {ALLOWED_EVENT_TYPES.map((event) => (
                    <div key={event} className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-${event}`}
                        checked={editEvents.includes(event)}
                        onCheckedChange={() => toggleEditEvent(event)}
                      />
                      <Label htmlFor={`edit-${event}`} className="text-sm font-normal cursor-pointer flex items-center gap-2">
                        <EventBadge event={event} />
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="edit-active">Active</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Inactive endpoints won&apos;t receive events
                  </p>
                </div>
                <Switch
                  id="edit-active"
                  checked={editIsActive}
                  onCheckedChange={setEditIsActive}
                />
              </div>

              {/* Regenerate Secret */}
              <Separator />
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
                  onClick={() => setShowRegenerateDialog(true)}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Regenerate Signing Secret
                </Button>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  This will invalidate the current secret and generate a new one
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedEndpoint &&
                updateMutation.mutate({
                  id: selectedEndpoint.id,
                  body: { url: editUrl, events: editEvents, isActive: editIsActive },
                })
              }
              disabled={
                !editUrl.trim() ||
                !editUrl.startsWith('https://') ||
                editEvents.length === 0 ||
                updateMutation.isPending ||
                !selectedEndpoint
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {updateMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Regenerate Secret Confirmation ==================== */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Regenerate Signing Secret
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will invalidate the current secret immediately. Any service verifying webhook
              signatures with the old secret will stop working. Make sure to update all consumers
              with the new secret.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                selectedEndpoint &&
                updateMutation.mutate({
                  id: selectedEndpoint.id,
                  body: { regenerateSecret: true },
                })
              }
              disabled={updateMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {updateMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                'Regenerate Secret'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ==================== Delete Confirmation ==================== */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Webhook Endpoint
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this endpoint and all its delivery logs. This action
              cannot be undone. Any events configured for this endpoint will no longer be delivered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedEndpoint && (
            <div className="rounded-md border bg-muted/50 p-3">
              <p className="text-xs font-medium">Endpoint to delete:</p>
              <p className="text-sm font-mono text-muted-foreground mt-1 truncate">
                {selectedEndpoint.url}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedEndpoint && deleteMutation.mutate(selectedEndpoint.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Endpoint'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
