'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  Plus,
  RotateCw,
  Trash2,
  Eye,
  EyeOff,
  Shield,
  Clock,
  Zap,
  Globe,
  RefreshCw,
  Search,
  MoreHorizontal,
  Pencil,
  ArrowUpDown,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { cn } from '@/lib/utils';

// ==================== Types ====================

interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string;
  permissions: string[];
  rateLimit: number;
  lastUsedAt: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

interface CreateKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  rawKey: string;
  permissions: string[];
  rateLimit: number;
  expiresAt: string | null;
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

// ==================== Animation Variants ====================

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const },
  }),
};

const dialogVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15 } },
};

// ==================== Helpers ====================

function maskKeyPrefix(prefix: string): string {
  if (!prefix || prefix.length <= 8) return prefix;
  return prefix.slice(0, 8) + '••••••••';
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

function formatExpiry(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    if (date < now) {
      return `Expired ${formatDistanceToNow(date, { addSuffix: true })}`;
    }
    return format(date, 'MMM d, yyyy');
  } catch {
    return 'Unknown';
  }
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return date > now && date < new Date(now.getTime() + sevenDays);
}

// ==================== Sub-components ====================

function StatsCard({
  title,
  value,
  icon: Icon,
  badge,
  badgeColor,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-2xl sm:text-3xl font-bold mt-1">{value}</p>
              {badge && (
                <Badge variant="outline" className={cn('text-[10px] mt-2', badgeColor)}>
                  {badge}
                </Badge>
              )}
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
              <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PermissionBadges({ permissions }: { permissions: string[] }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {permissions.includes('read') && (
        <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800 text-xs">
          <Eye className="h-3 w-3 mr-1" />
          Read
        </Badge>
      )}
      {permissions.includes('write') && (
        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800 text-xs">
          <KeyRound className="h-3 w-3 mr-1" />
          Write
        </Badge>
      )}
    </div>
  );
}

function StatusBadge({ isActive, expiresAt }: { isActive: boolean; expiresAt: string | null }) {
  if (!isActive) {
    return (
      <Badge variant="outline" className="bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 text-xs">
        Revoked
      </Badge>
    );
  }
  if (isExpired(expiresAt)) {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800 text-xs">
        Expired
      </Badge>
    );
  }
  if (isExpiringSoon(expiresAt)) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800 text-xs">
        Expiring Soon
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800 text-xs">
      Active
    </Badge>
  );
}

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
    </TableRow>
  );
}

// ==================== Mobile Card View ====================

function MobileKeyCard({
  apiKey,
  onEdit,
  onRevoke,
  onRotate,
}: {
  apiKey: ApiKey;
  onEdit: (k: ApiKey) => void;
  onRevoke: (k: ApiKey) => void;
  onRotate: (k: ApiKey) => void;
}) {
  return (
    <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 min-w-0 flex-1">
              <p className="font-medium truncate">{apiKey.name}</p>
              <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                {maskKeyPrefix(apiKey.keyPrefix)}
              </code>
            </div>
            <StatusBadge isActive={apiKey.isActive} expiresAt={apiKey.expiresAt} />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <PermissionBadges permissions={apiKey.permissions} />
            <Badge variant="outline" className="text-xs text-muted-foreground">
              <Zap className="h-3 w-3 mr-1" />
              {apiKey.rateLimit}/hr
            </Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>Used: {formatRelativeTime(apiKey.lastUsedAt)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Globe className="h-3 w-3" />
              <span>Expires: {formatExpiry(apiKey.expiresAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            Created {format(new Date(apiKey.createdAt), 'MMM d, yyyy')}
          </div>

          <Separator />

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              disabled={!apiKey.isActive}
              onClick={() => onEdit(apiKey)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              disabled={!apiKey.isActive}
              onClick={() => onRotate(apiKey)}
            >
              <RotateCw className="h-3 w-3 mr-1" />
              Rotate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
              disabled={!apiKey.isActive}
              onClick={() => onRevoke(apiKey)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ==================== Main Component ====================

export default function ApiKeysPage() {
  const { token, user } = useAuthStore();
  const queryClient = useQueryClient();

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRevealDialog, setShowRevealDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);

  // Selected key
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [revealedKey, setRevealedKey] = useState<CreateKeyResponse | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    permissions: ['read'],
    rateLimit: 100,
    expiresAt: '',
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    permissions: ['read'] as string[],
    rateLimit: 100,
  });

  // Mask visibility
  const [maskedKeys, setMaskedKeys] = useState<Set<string>>(new Set());

  // Copy state
  const [copiedKey, setCopiedKey] = useState(false);

  // ==================== Queries ====================

  const { data: apiKeys = [], isLoading, refetch } = useQuery<ApiKey[]>({
    queryKey: ['api-keys', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/api-keys?${params.toString()}`, {
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch API keys');
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!token,
  });

  // ==================== Mutations ====================

  const createMutation = useMutation({
    mutationFn: async (body: { name: string; permissions: string[]; rateLimit: number; expiresAt?: string }) => {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create API key' }));
        throw new Error(err.error || 'Failed to create API key');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setShowCreateDialog(false);
      setRevealedKey(data.data);
      setShowRevealDialog(true);
      setCreateForm({ name: '', permissions: ['read'], rateLimit: 100, expiresAt: '' });
      toast.success('API key created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: { name?: string; permissions?: string[]; rateLimit?: number } }) => {
      const res = await fetch(`/api/api-keys/${id}`, {
        method: 'PUT',
        headers: getApiHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update API key' }));
        throw new Error(err.error || 'Failed to update API key');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setShowEditDialog(false);
      setSelectedKey(null);
      toast.success('API key updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/api-keys/${id}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to revoke API key' }));
        throw new Error(err.error || 'Failed to revoke API key');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setShowRevokeDialog(false);
      setSelectedKey(null);
      toast.success('API key revoked');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const rotateMutation = useMutation({
    mutationFn: async (oldKey: ApiKey) => {
      // Step 1: Revoke old key
      const revokeRes = await fetch(`/api/api-keys/${oldKey.id}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      if (!revokeRes.ok) {
        const err = await revokeRes.json().catch(() => ({ error: 'Failed to revoke old key' }));
        throw new Error(err.error || 'Failed to revoke old key');
      }

      // Step 2: Create new key with same settings
      const createRes = await fetch('/api/api-keys', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          name: oldKey.name,
          permissions: oldKey.permissions,
          rateLimit: oldKey.rateLimit,
          expiresAt: oldKey.expiresAt,
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({ error: 'Failed to create new key' }));
        throw new Error(err.error || 'Failed to create new key');
      }
      return createRes.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setShowRotateConfirm(false);
      setSelectedKey(null);
      setRevealedKey(data.data);
      setShowRevealDialog(true);
      toast.success('API key rotated — old key revoked, new key created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ==================== Handlers ====================

  const handleCreate = useCallback(() => {
    if (!createForm.name.trim()) {
      toast.error('Key name is required');
      return;
    }
    if (createForm.permissions.length === 0) {
      toast.error('At least one permission is required');
      return;
    }
    const body: { name: string; permissions: string[]; rateLimit: number; expiresAt?: string } = {
      name: createForm.name.trim(),
      permissions: createForm.permissions,
      rateLimit: createForm.rateLimit,
    };
    if (createForm.expiresAt) {
      body.expiresAt = new Date(createForm.expiresAt).toISOString();
    }
    createMutation.mutate(body);
  }, [createForm, createMutation]);

  const handleEdit = useCallback((apiKey: ApiKey) => {
    setSelectedKey(apiKey);
    setEditForm({
      name: apiKey.name,
      permissions: Array.isArray(apiKey.permissions) ? [...apiKey.permissions] : ['read'],
      rateLimit: apiKey.rateLimit,
    });
    setShowEditDialog(true);
  }, []);

  const handleUpdate = useCallback(() => {
    if (!selectedKey) return;
    if (!editForm.name.trim()) {
      toast.error('Key name is required');
      return;
    }
    updateMutation.mutate({
      id: selectedKey.id,
      body: {
        name: editForm.name.trim(),
        permissions: editForm.permissions,
        rateLimit: editForm.rateLimit,
      },
    });
  }, [selectedKey, editForm, updateMutation]);

  const handleRevoke = useCallback((apiKey: ApiKey) => {
    setSelectedKey(apiKey);
    setShowRevokeDialog(true);
  }, []);

  const confirmRevoke = useCallback(() => {
    if (!selectedKey) return;
    revokeMutation.mutate(selectedKey.id);
  }, [selectedKey, revokeMutation]);

  const handleRotate = useCallback((apiKey: ApiKey) => {
    setSelectedKey(apiKey);
    setShowRotateConfirm(true);
  }, []);

  const confirmRotate = useCallback(() => {
    if (!selectedKey) return;
    rotateMutation.mutate(selectedKey);
  }, [selectedKey, rotateMutation]);

  const handleCopyKey = useCallback(async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(true);
      toast.success('API key copied to clipboard');
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, []);

  const toggleMask = useCallback((keyId: string) => {
    setMaskedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(keyId)) {
        next.delete(keyId);
      } else {
        next.add(keyId);
      }
      return next;
    });
  }, []);

  const handleDismissReveal = useCallback(() => {
    setShowRevealDialog(false);
    setRevealedKey(null);
    setCopiedKey(false);
  }, []);

  const handleCreatePermissionToggle = useCallback((permission: string) => {
    setCreateForm((prev) => {
      const perms = prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission];
      return { ...prev, permissions: perms };
    });
  }, []);

  const handleEditPermissionToggle = useCallback((permission: string) => {
    setEditForm((prev) => {
      const perms = prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission];
      return { ...prev, permissions: perms };
    });
  }, []);

  // ==================== Computed ====================

  const totalKeys = apiKeys.length;
  const activeKeys = apiKeys.filter((k) => k.isActive && !isExpired(k.expiresAt)).length;
  const revokedKeys = apiKeys.filter((k) => !k.isActive || isExpired(k.expiresAt)).length;

  const filteredKeys = apiKeys.filter((k) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      k.name.toLowerCase().includes(q) ||
      k.keyPrefix.toLowerCase().includes(q)
    );
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // ==================== Render ====================

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Key className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Please log in to manage API keys</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        {/* ==================== Header ==================== */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Key className="h-7 w-7 text-emerald-500" />
              API Keys
            </h1>
            <p className="text-muted-foreground">
              Manage API keys for programmatic access to your organization
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create Key
              </Button>
            )}
          </div>
        </div>

        {/* ==================== Stats Cards ==================== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard
            title="Total Keys"
            value={totalKeys}
            icon={Key}
          />
          <StatsCard
            title="Active Keys"
            value={activeKeys}
            icon={Shield}
            badge={`${totalKeys > 0 ? Math.round((activeKeys / totalKeys) * 100) : 0}% active`}
            badgeColor="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
          />
          <StatsCard
            title="Revoked / Expired"
            value={revokedKeys}
            icon={KeyRound}
            badge={revokedKeys > 0 ? 'Review needed' : 'All clear'}
            badgeColor={revokedKeys > 0
              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
            }
          />
        </div>

        {/* ==================== Filters ==================== */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 w-full sm:max-w-xs">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <Search className="h-3 w-3" />
                  Search
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or prefix..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="w-full sm:w-40">
                <div className="text-xs text-muted-foreground mb-1.5">Status</div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Keys</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="revoked">Revoked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ==================== Keys Table (Desktop) ==================== */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="sticky top-0 bg-background z-10">
                    <TableHead className="min-w-[160px]">Key</TableHead>
                    <TableHead className="min-w-[130px]">Name</TableHead>
                    <TableHead className="min-w-[120px]">Permissions</TableHead>
                    <TableHead className="min-w-[90px]">Rate Limit</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[120px]">Last Used</TableHead>
                    <TableHead className="min-w-[110px]">Expires</TableHead>
                    <TableHead className="min-w-[100px]">Created</TableHead>
                    <TableHead className="min-w-[50px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : filteredKeys.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-48 text-center">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <Key className="h-10 w-10" />
                          <div>
                            <p className="text-sm font-medium">No API keys found</p>
                            <p className="text-xs mt-1">
                              {searchQuery || statusFilter !== 'all'
                                ? 'Try adjusting your search or filters'
                                : 'Create your first API key to get started'}
                            </p>
                          </div>
                          {isAdmin && !searchQuery && statusFilter === 'all' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowCreateDialog(true)}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1.5" />
                              Create API Key
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <AnimatePresence>
                      {filteredKeys.map((apiKey) => (
                        <motion.tr
                          key={apiKey.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className={cn(
                            'border-b transition-colors hover:bg-muted/50',
                            !apiKey.isActive && 'opacity-60'
                          )}
                        >
                          {/* Key Prefix */}
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded select-all">
                                {maskedKeys.has(apiKey.id)
                                  ? maskKeyPrefix(apiKey.keyPrefix)
                                  : apiKey.keyPrefix}
                              </code>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => toggleMask(apiKey.id)}
                                  >
                                    {maskedKeys.has(apiKey.id) ? (
                                      <Eye className="h-3 w-3 text-muted-foreground" />
                                    ) : (
                                      <EyeOff className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {maskedKeys.has(apiKey.id) ? 'Show prefix' : 'Hide prefix'}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>

                          {/* Name */}
                          <TableCell>
                            <span className="text-sm font-medium">{apiKey.name}</span>
                          </TableCell>

                          {/* Permissions */}
                          <TableCell>
                            <PermissionBadges permissions={Array.isArray(apiKey.permissions) ? apiKey.permissions : []} />
                          </TableCell>

                          {/* Rate Limit */}
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Zap className="h-3 w-3" />
                                  {apiKey.rateLimit}/hr
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Rate limit: {apiKey.rateLimit} requests per hour</TooltipContent>
                            </Tooltip>
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <StatusBadge isActive={apiKey.isActive} expiresAt={apiKey.expiresAt} />
                          </TableCell>

                          {/* Last Used */}
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(apiKey.lastUsedAt)}
                              </span>
                            </div>
                          </TableCell>

                          {/* Expires */}
                          <TableCell>
                            <span className={cn(
                              'text-xs',
                              isExpired(apiKey.expiresAt) && 'text-red-500',
                              isExpiringSoon(apiKey.expiresAt) && 'text-amber-500',
                            )}>
                              {formatExpiry(apiKey.expiresAt)}
                            </span>
                          </TableCell>

                          {/* Created */}
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(apiKey.createdAt), 'MMM d, yyyy')}
                            </span>
                          </TableCell>

                          {/* Actions */}
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleEdit(apiKey)}
                                  disabled={!apiKey.isActive}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit Key
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleRotate(apiKey)}
                                  disabled={!apiKey.isActive}
                                >
                                  <RotateCw className="h-4 w-4 mr-2" />
                                  Rotate Key
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleRevoke(apiKey)}
                                  disabled={!apiKey.isActive}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Revoke Key
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ==================== Keys Cards (Mobile) ==================== */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Separator />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 flex-1" />
                    <Skeleton className="h-8 flex-1" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredKeys.length === 0 ? (
            <Card>
              <CardContent className="p-8">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Key className="h-10 w-10" />
                  <div className="text-center">
                    <p className="text-sm font-medium">No API keys found</p>
                    <p className="text-xs mt-1">Create your first API key to get started</p>
                  </div>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCreateDialog(true)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Create API Key
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredKeys.map((apiKey) => (
              <MobileKeyCard
                key={apiKey.id}
                apiKey={apiKey}
                onEdit={handleEdit}
                onRevoke={handleRevoke}
                onRotate={handleRotate}
              />
            ))
          )}
        </div>

        {/* ==================== Info Card ==================== */}
        <Card className="bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-800/30">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  API Key Security Best Practices
                </p>
                <ul className="text-xs text-emerald-700/80 dark:text-emerald-400/80 space-y-1 list-disc list-inside">
                  <li>Never share your API keys or expose them in client-side code</li>
                  <li>Use the minimum required permissions (read-only when possible)</li>
                  <li>Rotate keys regularly using the Rotate action</li>
                  <li>Set expiry dates to limit exposure if a key is compromised</li>
                  <li>Monitor usage via the &quot;Last Used&quot; field and revoke unused keys</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ==================== Create Dialog ==================== */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-500" />
                Create API Key
              </DialogTitle>
              <DialogDescription>
                Generate a new API key for programmatic access to your organization&apos;s resources.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="key-name">
                  Key Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="key-name"
                  placeholder="e.g. Mobile App, Partner Integration"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">A descriptive name to identify this key</p>
              </div>

              {/* Permissions */}
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="space-y-2.5">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="perm-read"
                      checked={createForm.permissions.includes('read')}
                      onCheckedChange={() => handleCreatePermissionToggle('read')}
                    />
                    <Label htmlFor="perm-read" className="text-sm font-normal cursor-pointer">
                      <Eye className="h-3.5 w-3.5 inline mr-1.5 text-sky-500" />
                      Read
                      <span className="text-muted-foreground ml-1.5">— Access events, tickets, and stats</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="perm-write"
                      checked={createForm.permissions.includes('write')}
                      onCheckedChange={() => handleCreatePermissionToggle('write')}
                    />
                    <Label htmlFor="perm-write" className="text-sm font-normal cursor-pointer">
                      <KeyRound className="h-3.5 w-3.5 inline mr-1.5 text-orange-500" />
                      Write
                      <span className="text-muted-foreground ml-1.5">— Create tickets, validate scans</span>
                    </Label>
                  </div>
                </div>
              </div>

              {/* Rate Limit */}
              <div className="space-y-2">
                <Label htmlFor="rate-limit">
                  Rate Limit <span className="text-muted-foreground font-normal">(requests/hour)</span>
                </Label>
                <Input
                  id="rate-limit"
                  type="number"
                  min={1}
                  max={10000}
                  value={createForm.rateLimit}
                  onChange={(e) =>
                    setCreateForm((p) => ({
                      ...p,
                      rateLimit: Math.min(Math.max(1, parseInt(e.target.value) || 1), 10000),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">Max 10,000 requests per hour</p>
              </div>

              {/* Expires At */}
              <div className="space-y-2">
                <Label htmlFor="expires-at">
                  Expiry Date <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="expires-at"
                  type="date"
                  value={createForm.expiresAt}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setCreateForm((p) => ({ ...p, expiresAt: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Leave empty for no expiry</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || !createForm.name.trim()}
              >
                {createMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Key className="h-4 w-4 mr-1.5" />
                )}
                Create Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ==================== Reveal Dialog ==================== */}
        <Dialog open={showRevealDialog} onOpenChange={handleDismissReveal}>
          <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-emerald-500" />
                API Key Created
              </DialogTitle>
              <DialogDescription>
                Your new API key has been generated. Copy it now — it won&apos;t be shown again.
              </DialogDescription>
            </DialogHeader>
            {revealedKey && (
              <div className="space-y-4">
                {/* Warning */}
                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      Make sure to copy your API key now
                    </p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                      You won&apos;t be able to see it again after closing this dialog.
                    </p>
                  </div>
                </div>

                {/* Key Details */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Key: <span className="text-muted-foreground font-normal">{revealedKey.name}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Raw Key:</Label>
                    <Badge variant="outline" className="text-xs">
                      {revealedKey.keyPrefix}
                    </Badge>
                  </div>
                </div>

                {/* Raw Key Code Block */}
                <div className="relative">
                  <div className="bg-zinc-950 text-zinc-50 rounded-lg p-4 pr-12 font-mono text-sm break-all select-all leading-relaxed">
                    {revealedKey.rawKey}
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="absolute top-2 right-2 h-8 w-8 bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700 hover:text-white"
                        onClick={() => handleCopyKey(revealedKey.rawKey)}
                      >
                        {copiedKey ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{copiedKey ? 'Copied!' : 'Copy key'}</TooltipContent>
                  </Tooltip>
                </div>

                {/* Summary */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <PermissionBadges permissions={revealedKey.permissions} />
                  <span className="text-muted-foreground">·</span>
                  <span>{revealedKey.rateLimit}/hr rate limit</span>
                  {revealedKey.expiresAt && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span>Expires {format(new Date(revealedKey.expiresAt), 'MMM d, yyyy')}</span>
                    </>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleDismissReveal} className="bg-emerald-600 hover:bg-emerald-700">
                <Check className="h-4 w-4 mr-1.5" />
                I Have Saved My Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ==================== Edit Dialog ==================== */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-emerald-500" />
                Edit API Key
              </DialogTitle>
              <DialogDescription>
                Update the name, permissions, or rate limit for this API key.
              </DialogDescription>
            </DialogHeader>
            {selectedKey && (
              <div className="space-y-4 py-2">
                {/* Key Info */}
                <div className="p-3 bg-muted rounded-lg space-y-1">
                  <p className="text-sm font-medium">{selectedKey.name}</p>
                  <code className="text-xs font-mono text-muted-foreground">{maskKeyPrefix(selectedKey.keyPrefix)}</code>
                  <p className="text-[10px] text-muted-foreground">
                    Created {format(new Date(selectedKey.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Key Name</Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    maxLength={100}
                  />
                </div>

                {/* Permissions */}
                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <div className="space-y-2.5">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-perm-read"
                        checked={editForm.permissions.includes('read')}
                        onCheckedChange={() => handleEditPermissionToggle('read')}
                      />
                      <Label htmlFor="edit-perm-read" className="text-sm font-normal cursor-pointer">
                        <Eye className="h-3.5 w-3.5 inline mr-1.5 text-sky-500" />
                        Read
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-perm-write"
                        checked={editForm.permissions.includes('write')}
                        onCheckedChange={() => handleEditPermissionToggle('write')}
                      />
                      <Label htmlFor="edit-perm-write" className="text-sm font-normal cursor-pointer">
                        <KeyRound className="h-3.5 w-3.5 inline mr-1.5 text-orange-500" />
                        Write
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Rate Limit */}
                <div className="space-y-2">
                  <Label htmlFor="edit-rate-limit">Rate Limit (requests/hour)</Label>
                  <Input
                    id="edit-rate-limit"
                    type="number"
                    min={1}
                    max={10000}
                    value={editForm.rateLimit}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        rateLimit: Math.min(Math.max(1, parseInt(e.target.value) || 1), 10000),
                      }))
                    }
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updateMutation.isPending || !editForm.name.trim()}
              >
                {updateMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1.5" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ==================== Revoke Confirmation ==================== */}
        <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Revoke API Key
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Are you sure you want to revoke <strong>&quot;{selectedKey?.name}&quot;</strong>?
                  </p>
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                      This action is irreversible
                    </p>
                    <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                      Any applications using this key will immediately lose access. This cannot be undone.
                    </p>
                  </div>
                  <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    {selectedKey ? maskKeyPrefix(selectedKey.keyPrefix) : ''}
                  </code>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={revokeMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRevoke}
                disabled={revokeMutation.isPending}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {revokeMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1.5" />
                )}
                Revoke Key
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ==================== Rotate Confirmation ==================== */}
        <AlertDialog open={showRotateConfirm} onOpenChange={setShowRotateConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <RotateCw className="h-5 w-5 text-amber-500" />
                Rotate API Key
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Rotate <strong>&quot;{selectedKey?.name}&quot;</strong>?
                  </p>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg space-y-1.5">
                    <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                      What happens during rotation:
                    </p>
                    <ul className="text-xs text-amber-600/80 dark:text-amber-400/80 list-disc list-inside space-y-0.5">
                      <li>The current key will be <strong>immediately revoked</strong></li>
                      <li>A new key will be created with the same settings</li>
                      <li>You&apos;ll see the new key once (save it securely)</li>
                      <li>Update all applications using this key to the new one</li>
                    </ul>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={rotateMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRotate}
                disabled={rotateMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-600"
              >
                {rotateMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <RotateCw className="h-4 w-4 mr-1.5" />
                )}
                Rotate Key
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
