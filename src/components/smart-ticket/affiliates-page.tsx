'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Copy,
  Check,
  Plus,
  Pencil,
  Trash2,
  Link2,
  Shield,
  DollarSign,
  TrendingUp,
  BarChart3,
  Search,
  MoreHorizontal,
  RefreshCw,
  Star,
  Clock,
  AlertCircle,
  Gift,
  Info,
  Eye,
  Activity,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

interface Affiliate {
  id: string;
  userId: string;
  code: string;
  commissionRate: number;
  totalRevenueGenerated: number;
  totalCommissionEarned: number;
  totalReferrals: number;
  isActive: boolean;
  createdAt: string;
  user?: { id: string; name: string; email: string };
}

interface AffiliateStats {
  totalAffiliates: number;
  activeAffiliates: number;
  totalRevenueGenerated: number;
  totalCommissionEarned: number;
  totalReferrals: number;
  topAffiliates: Affiliate[];
  recentReferrals: Array<{
    code: string;
    affiliateName: string;
    revenue: number;
    commission: number;
    createdAt: string;
  }>;
}

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
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
    transition: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

const slideIn = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2 } },
};

// ==================== Helpers ====================

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

// ==================== Sub-components ====================

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  index,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  subtitle?: string;
  index: number;
}) {
  return (
    <motion.div custom={index} variants={cardVariants} initial="hidden" animate="visible">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-2xl sm:text-3xl font-bold mt-1">{value}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
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

function CommissionBadge({ rate }: { rate: number }) {
  return (
    <Badge
      variant="outline"
      className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800 text-xs font-medium"
    >
      {rate}%
    </Badge>
  );
}

function ActiveToggle({
  isActive,
  onToggle,
  disabled,
}: {
  isActive: boolean;
  onToggle: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Switch
          checked={isActive}
          onCheckedChange={onToggle}
          disabled={disabled}
        />
      </TooltipTrigger>
      <TooltipContent>
        {isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
      </TooltipContent>
    </Tooltip>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, [text, label]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied!' : `Copy ${label}`}</TooltipContent>
    </Tooltip>
  );
}

function SkeletonStatsRow() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SkeletonTableRow() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
    </TableRow>
  );
}

function SkeletonTopPerformer() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-5 w-16" />
    </div>
  );
}

// ==================== Mobile Card View ====================

function MobileAffiliateCard({
  affiliate,
  onEdit,
  onDelete,
  onToggleActive,
  isAdmin,
}: {
  affiliate: Affiliate;
  onEdit: (a: Affiliate) => void;
  onDelete: (a: Affiliate) => void;
  onToggleActive: (a: Affiliate, val: boolean) => void;
  isAdmin: boolean;
}) {
  const referralLink = `${typeof window !== 'undefined' ? window.location.origin : ''}?ref=${affiliate.code}`;

  return (
    <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 min-w-0 flex-1">
              <p className="font-medium truncate">
                {affiliate.user?.name || 'Unknown User'}
              </p>
              {affiliate.user?.email && (
                <p className="text-xs text-muted-foreground truncate">{affiliate.user.email}</p>
              )}
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-xs shrink-0 ml-2',
                affiliate.isActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
              )}
            >
              {affiliate.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1 truncate">
              {affiliate.code}
            </code>
            <CopyButton text={affiliate.code} label="Referral code" />
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-semibold">{affiliate.totalReferrals}</p>
              <p className="text-[10px] text-muted-foreground">Referrals</p>
            </div>
            <div>
              <p className="text-lg font-semibold">{formatCurrency(affiliate.totalRevenueGenerated)}</p>
              <p className="text-[10px] text-muted-foreground">Revenue</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(affiliate.totalCommissionEarned)}
              </p>
              <p className="text-[10px] text-muted-foreground">Commission</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CommissionBadge rate={affiliate.commissionRate} />
              {isAdmin && (
                <ActiveToggle
                  isActive={affiliate.isActive}
                  onToggle={(val) => onToggleActive(affiliate, val)}
                />
              )}
            </div>
            <CopyButton text={referralLink} label="Referral link" />
          </div>

          {isAdmin && (
            <>
              <Separator />
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => onEdit(affiliate)}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                  onClick={() => onDelete(affiliate)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </>
          )}

          <p className="text-[10px] text-muted-foreground">
            Joined {format(new Date(affiliate.createdAt), 'MMM d, yyyy')}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ==================== Main Component ====================

export default function AffiliatesPage() {
  const { token, user } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('affiliates');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Selected affiliate
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({
    userId: '',
    code: generateReferralCode(),
    commissionRate: 10,
  });

  // Edit form
  const [editForm, setEditForm] = useState({
    commissionRate: 10,
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // ==================== Queries ====================

  const { data: affiliates = [], isLoading: isLoadingAffiliates, refetch: refetchAffiliates } = useQuery<Affiliate[]>({
    queryKey: ['affiliates'],
    queryFn: async () => {
      const res = await fetch('/api/affiliates', { headers: getApiHeaders() });
      if (!res.ok) throw new Error('Failed to fetch affiliates');
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!token,
  });

  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = useQuery<AffiliateStats>({
    queryKey: ['affiliate-stats'],
    queryFn: async () => {
      const res = await fetch('/api/affiliates/stats', { headers: getApiHeaders() });
      if (!res.ok) throw new Error('Failed to fetch affiliate stats');
      const json = await res.json();
      return json.data;
    },
    enabled: !!token,
  });

  const { data: users = [] } = useQuery<OrgUser[]>({
    queryKey: ['users-list-affiliates'],
    queryFn: async () => {
      const res = await fetch('/api/users', { headers: getApiHeaders() });
      if (!res.ok) throw new Error('Failed to fetch users');
      const json = await res.json();
      return json.data || [];
    },
    enabled: showCreateDialog,
  });

  // ==================== Mutations ====================

  const createMutation = useMutation({
    mutationFn: async (body: { userId: string; code?: string; commissionRate?: number }) => {
      const res = await fetch('/api/affiliates', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create affiliate' }));
        throw new Error(err.error || 'Failed to create affiliate');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      queryClient.invalidateQueries({ queryKey: ['affiliate-stats'] });
      setShowCreateDialog(false);
      setCreateForm({ userId: '', code: generateReferralCode(), commissionRate: 10 });
      toast.success('Affiliate created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: { commissionRate?: number; isActive?: boolean } }) => {
      const res = await fetch(`/api/affiliates/${id}`, {
        method: 'PUT',
        headers: getApiHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update affiliate' }));
        throw new Error(err.error || 'Failed to update affiliate');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      queryClient.invalidateQueries({ queryKey: ['affiliate-stats'] });
      if (variables.body.commissionRate !== undefined) {
        setShowEditDialog(false);
        setSelectedAffiliate(null);
        toast.success('Affiliate updated');
      } else if (variables.body.isActive !== undefined) {
        toast.success(variables.body.isActive ? 'Affiliate activated' : 'Affiliate deactivated');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/affiliates/${id}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to delete affiliate' }));
        throw new Error(err.error || 'Failed to delete affiliate');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      queryClient.invalidateQueries({ queryKey: ['affiliate-stats'] });
      setShowDeleteDialog(false);
      setSelectedAffiliate(null);
      toast.success('Affiliate deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ==================== Handlers ====================

  const handleCreate = useCallback(() => {
    if (!createForm.userId) {
      toast.error('Please select a user');
      return;
    }
    if (createForm.commissionRate <= 0 || createForm.commissionRate > 100) {
      toast.error('Commission rate must be between 0 and 100');
      return;
    }
    createMutation.mutate({
      userId: createForm.userId,
      code: createForm.code || undefined,
      commissionRate: createForm.commissionRate,
    });
  }, [createForm, createMutation]);

  const handleOpenEdit = useCallback((affiliate: Affiliate) => {
    setSelectedAffiliate(affiliate);
    setEditForm({ commissionRate: affiliate.commissionRate });
    setShowEditDialog(true);
  }, []);

  const handleEdit = useCallback(() => {
    if (!selectedAffiliate) return;
    if (editForm.commissionRate <= 0 || editForm.commissionRate > 100) {
      toast.error('Commission rate must be between 0 and 100');
      return;
    }
    updateMutation.mutate({
      id: selectedAffiliate.id,
      body: { commissionRate: editForm.commissionRate },
    });
  }, [selectedAffiliate, editForm, updateMutation]);

  const handleOpenDelete = useCallback((affiliate: Affiliate) => {
    setSelectedAffiliate(affiliate);
    setShowDeleteDialog(true);
  }, []);

  const handleToggleActive = useCallback((affiliate: Affiliate, isActive: boolean) => {
    updateMutation.mutate({
      id: affiliate.id,
      body: { isActive },
    });
  }, [updateMutation]);

  const handleRefetch = useCallback(() => {
    refetchAffiliates();
    refetchStats();
  }, [refetchAffiliates, refetchStats]);

  // ==================== Computed ====================

  const filteredAffiliates = useMemo(() => {
    if (!searchQuery) return affiliates;
    const q = searchQuery.toLowerCase();
    return affiliates.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.user?.name?.toLowerCase().includes(q) ||
        a.user?.email?.toLowerCase().includes(q)
    );
  }, [affiliates, searchQuery]);

  // Users that are not already affiliates
  const availableUsers = useMemo(() => {
    const affiliateUserIds = new Set(affiliates.map((a) => a.userId));
    return users.filter((u) => !affiliateUserIds.has(u.id));
  }, [users, affiliates]);

  const maxRevenueInTop = useMemo(() => {
    if (!stats?.topAffiliates?.length) return 0;
    return Math.max(...stats.topAffiliates.map((a) => a.totalRevenueGenerated), 1);
  }, [stats]);

  // ==================== Auth Gate ====================

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Users className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Please log in to manage affiliates</p>
        </div>
      </div>
    );
  }

  // ==================== Render ====================

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        {/* ==================== Header ==================== */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Gift className="h-7 w-7 text-emerald-500" />
              Affiliate Program
            </h1>
            <p className="text-muted-foreground">
              Manage affiliates, track referrals, and monitor commissions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefetch}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Affiliate
              </Button>
            )}
          </div>
        </motion.div>

        {/* ==================== Info Card ==================== */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible">
          <Card className="bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-800/30">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    How Commissions Work
                  </p>
                  <ul className="text-xs text-emerald-700/80 dark:text-emerald-400/80 space-y-1 list-disc list-inside">
                    <li>
                      Commissions are only calculated on tickets with status &quot;used&quot;{' '}
                      <span className="font-medium">(anti-refund fraud protection)</span>
                    </li>
                    <li>Referral cookies last <span className="font-medium">30 days</span> from first visit</li>
                    <li>Affiliates earn a percentage of each qualifying ticket sale</li>
                    <li>
                      Only users with admin or super admin roles can manage affiliate settings
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ==================== Tabs ==================== */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="affiliates">
              <Users className="h-4 w-4 mr-1.5" />
              Affiliates
              {affiliates.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                  {affiliates.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="dashboard">
              <BarChart3 className="h-4 w-4 mr-1.5" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          {/* ==================== Affiliates Tab ==================== */}
          <TabsContent value="affiliates" className="space-y-4">
            {/* Search */}
            <Card>
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or referral code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Desktop Table */}
            <Card className="hidden md:block">
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="sticky top-0 bg-background z-10">
                        <TableHead className="min-w-[180px]">Affiliate</TableHead>
                        <TableHead className="min-w-[160px]">Referral Code</TableHead>
                        <TableHead className="min-w-[100px]">Commission</TableHead>
                        <TableHead className="min-w-[110px]">Revenue</TableHead>
                        <TableHead className="min-w-[100px]">Referrals</TableHead>
                        <TableHead className="min-w-[90px]">Status</TableHead>
                        <TableHead className="min-w-[110px]">Joined</TableHead>
                        <TableHead className="min-w-[50px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingAffiliates ? (
                        Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} />)
                      ) : filteredAffiliates.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-48 text-center">
                            <div className="flex flex-col items-center gap-3 text-muted-foreground">
                              <Users className="h-10 w-10" />
                              <div>
                                <p className="text-sm font-medium">No affiliates found</p>
                                <p className="text-xs mt-1">
                                  {searchQuery
                                    ? 'Try adjusting your search'
                                    : 'Add your first affiliate to start the referral program'}
                                </p>
                              </div>
                              {isAdmin && !searchQuery && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setShowCreateDialog(true)}
                                >
                                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                                  Add Affiliate
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <AnimatePresence>
                          {filteredAffiliates.map((affiliate) => {
                            const referralLink = `${typeof window !== 'undefined' ? window.location.origin : ''}?ref=${affiliate.code}`;
                            return (
                              <motion.tr
                                key={affiliate.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className={cn(
                                  'border-b transition-colors hover:bg-muted/50',
                                  !affiliate.isActive && 'opacity-60'
                                )}
                              >
                                {/* Affiliate */}
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                      {affiliate.user?.name
                                        ?.split(' ')
                                        .map((n) => n[0])
                                        .join('')
                                        .toUpperCase()
                                        .slice(0, 2) || '??'}
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">
                                        {affiliate.user?.name || 'Unknown User'}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {affiliate.user?.email || 'No email'}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>

                                {/* Referral Code */}
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                                      {affiliate.code}
                                    </code>
                                    <CopyButton text={affiliate.code} label="Referral code" />
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => {
                                            navigator.clipboard.writeText(referralLink);
                                            toast.success('Referral link copied');
                                          }}
                                        >
                                          <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Copy referral link</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TableCell>

                                {/* Commission Rate */}
                                <TableCell>
                                  <CommissionBadge rate={affiliate.commissionRate} />
                                </TableCell>

                                {/* Revenue */}
                                <TableCell>
                                  <div>
                                    <p className="text-sm font-medium">
                                      {formatCurrency(affiliate.totalRevenueGenerated)}
                                    </p>
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                      +{formatCurrency(affiliate.totalCommissionEarned)} earned
                                    </p>
                                  </div>
                                </TableCell>

                                {/* Referrals */}
                                <TableCell>
                                  <span className="text-sm">{affiliate.totalReferrals}</span>
                                </TableCell>

                                {/* Status */}
                                <TableCell>
                                  {isAdmin ? (
                                    <ActiveToggle
                                      isActive={affiliate.isActive}
                                      onToggle={(val) => handleToggleActive(affiliate, val)}
                                    />
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-xs',
                                        affiliate.isActive
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                                          : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                                      )}
                                    >
                                      {affiliate.isActive ? 'Active' : 'Inactive'}
                                    </Badge>
                                  )}
                                </TableCell>

                                {/* Joined */}
                                <TableCell>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(affiliate.createdAt), 'MMM d, yyyy')}
                                  </span>
                                </TableCell>

                                {/* Actions */}
                                <TableCell>
                                  {isAdmin && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleOpenEdit(affiliate)}>
                                          <Pencil className="h-4 w-4 mr-2" />
                                          Edit Commission
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => {
                                            navigator.clipboard.writeText(referralLink);
                                            toast.success('Referral link copied');
                                          }}
                                        >
                                          <Link2 className="h-4 w-4 mr-2" />
                                          Copy Referral Link
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => handleOpenDelete(affiliate)}
                                          className="text-red-600 focus:text-red-600"
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Delete Affiliate
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </TableCell>
                              </motion.tr>
                            );
                          })}
                        </AnimatePresence>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {isLoadingAffiliates ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-28" />
                      <Separator />
                      <div className="grid grid-cols-3 gap-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                      <Separator />
                      <div className="flex gap-2">
                        <Skeleton className="h-8 flex-1" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : filteredAffiliates.length === 0 ? (
                <Card>
                  <CardContent className="p-8">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Users className="h-10 w-10" />
                      <div className="text-center">
                        <p className="text-sm font-medium">No affiliates found</p>
                        <p className="text-xs mt-1">Add your first affiliate to get started</p>
                      </div>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowCreateDialog(true)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Add Affiliate
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                filteredAffiliates.map((affiliate) => (
                  <MobileAffiliateCard
                    key={affiliate.id}
                    affiliate={affiliate}
                    onEdit={handleOpenEdit}
                    onDelete={handleOpenDelete}
                    onToggleActive={handleToggleActive}
                    isAdmin={isAdmin}
                  />
                ))
              )}
            </div>
          </TabsContent>

          {/* ==================== Dashboard Tab ==================== */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            {isLoadingStats ? (
              <SkeletonStatsRow />
            ) : stats ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Affiliates"
                  value={stats.totalAffiliates}
                  icon={Users}
                  subtitle={`${stats.activeAffiliates} active`}
                  index={0}
                />
                <StatCard
                  title="Total Referrals"
                  value={stats.totalReferrals}
                  icon={TrendingUp}
                  subtitle="All time conversions"
                  index={1}
                />
                <StatCard
                  title="Revenue Generated"
                  value={formatCurrency(stats.totalRevenueGenerated)}
                  icon={DollarSign}
                  subtitle="From affiliate referrals"
                  index={2}
                />
                <StatCard
                  title="Commission Earned"
                  value={formatCurrency(stats.totalCommissionEarned)}
                  icon={Gift}
                  subtitle="Total payouts"
                  index={3}
                />
              </div>
            ) : null}

            {/* Top Performers & Recent Referrals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Performers */}
              <motion.div variants={slideIn} initial="hidden" animate="visible">
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Star className="h-4 w-4 text-emerald-500" />
                      Top Performers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingStats ? (
                      <div className="space-y-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <SkeletonTopPerformer key={i} />
                        ))}
                      </div>
                    ) : stats?.topAffiliates && stats.topAffiliates.length > 0 ? (
                      <div className="max-h-80 overflow-y-auto space-y-1">
                        {stats.topAffiliates.map((affiliate, idx) => {
                          const revenuePercent = maxRevenueInTop > 0
                            ? (affiliate.totalRevenueGenerated / maxRevenueInTop) * 100
                            : 0;
                          return (
                            <motion.div
                              key={affiliate.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05, duration: 0.2 }}
                              className="flex items-center gap-3 py-3"
                            >
                              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-xs font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {affiliate.user?.name || 'Unknown'}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Progress value={revenuePercent} className="h-1.5 flex-1" />
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    {formatCurrency(affiliate.totalRevenueGenerated)}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {affiliate.totalReferrals} referrals &middot;{' '}
                                  {formatCurrency(affiliate.totalCommissionEarned)} earned
                                </p>
                              </div>
                              <CommissionBadge rate={affiliate.commissionRate} />
                            </motion.div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <TrendingUp className="h-8 w-8 mb-2" />
                        <p className="text-sm">No performance data yet</p>
                        <p className="text-xs mt-1">Stats will appear once affiliates start generating referrals</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Recent Referrals */}
              <motion.div variants={slideIn} initial="hidden" animate="visible">
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-500" />
                      Recent Referrals
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingStats ? (
                      <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="space-y-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-60" />
                            <Separator />
                          </div>
                        ))}
                      </div>
                    ) : stats?.recentReferrals && stats.recentReferrals.length > 0 ? (
                      <div className="max-h-80 overflow-y-auto">
                        {/* Desktop table */}
                        <Table className="hidden sm:block">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Affiliate</TableHead>
                              <TableHead>Revenue</TableHead>
                              <TableHead>Commission</TableHead>
                              <TableHead>Time</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stats.recentReferrals.map((ref, idx) => (
                              <motion.tr
                                key={`${ref.code}-${idx}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: idx * 0.03, duration: 0.15 }}
                                className="border-b transition-colors hover:bg-muted/50"
                              >
                                <TableCell>
                                  <div>
                                    <p className="text-sm font-medium">{ref.affiliateName}</p>
                                    <code className="text-[10px] font-mono text-muted-foreground">
                                      {ref.code}
                                    </code>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm">{formatCurrency(ref.revenue)}</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(ref.commission)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatRelativeTime(ref.createdAt)}
                                  </span>
                                </TableCell>
                              </motion.tr>
                            ))}
                          </TableBody>
                        </Table>

                        {/* Mobile list */}
                        <div className="sm:hidden space-y-3">
                          {stats.recentReferrals.map((ref, idx) => (
                            <motion.div
                              key={`${ref.code}-${idx}`}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.03, duration: 0.15 }}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-sm font-medium">{ref.affiliateName}</p>
                                  <code className="text-[10px] font-mono text-muted-foreground">
                                    {ref.code}
                                  </code>
                                </div>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatRelativeTime(ref.createdAt)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-sm">{formatCurrency(ref.revenue)}</span>
                                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                  +{formatCurrency(ref.commission)} commission
                                </span>
                              </div>
                              {idx < stats.recentReferrals.length - 1 && (
                                <Separator className="mt-3" />
                              )}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Clock className="h-8 w-8 mb-2" />
                        <p className="text-sm">No recent referrals</p>
                        <p className="text-xs mt-1">Referral activity will show up here</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>
        </Tabs>

        {/* ==================== Create Dialog ==================== */}
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setCreateForm({ userId: '', code: generateReferralCode(), commissionRate: 10 });
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-emerald-500" />
                Add Affiliate
              </DialogTitle>
              <DialogDescription>
                Select a user to enroll in the affiliate program. They&apos;ll receive a unique referral code to share.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* User Selection */}
              <div className="space-y-2">
                <Label htmlFor="affiliate-user">
                  User <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={createForm.userId}
                  onValueChange={(val) => setCreateForm((p) => ({ ...p, userId: val }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a user..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {availableUsers.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No available users
                      </SelectItem>
                    ) : (
                      availableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          <div className="flex items-center gap-2">
                            <span>{u.name}</span>
                            <span className="text-xs text-muted-foreground">({u.email})</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only users not already enrolled as affiliates are shown
                </p>
              </div>

              {/* Referral Code */}
              <div className="space-y-2">
                <Label htmlFor="affiliate-code">Referral Code</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="affiliate-code"
                    value={createForm.code}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                      }))
                    }
                    placeholder="AUTO-GENERATED"
                    className="font-mono uppercase"
                    maxLength={12}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() =>
                      setCreateForm((p) => ({ ...p, code: generateReferralCode() }))
                    }
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave as-is for an auto-generated code, or customize it (max 12 chars, alphanumeric)
                </p>
              </div>

              {/* Commission Rate */}
              <div className="space-y-2">
                <Label htmlFor="commission-rate">
                  Commission Rate <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="commission-rate"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={createForm.commissionRate}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        commissionRate: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  <span className="text-xs text-muted-foreground">
                    of each qualifying ticket sale
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || !createForm.userId}
              >
                {createMutation.isPending ? 'Creating...' : 'Add Affiliate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ==================== Edit Dialog ==================== */}
        <Dialog open={showEditDialog} onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) {
            setSelectedAffiliate(null);
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-emerald-500" />
                Edit Affiliate
              </DialogTitle>
              <DialogDescription>
                Update the commission rate for{' '}
                <strong>{selectedAffiliate?.user?.name || 'this affiliate'}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Current info */}
              {selectedAffiliate && (
                <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Referral Code</span>
                    <code className="text-xs font-mono">{selectedAffiliate.code}</code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Total Referrals</span>
                    <span className="text-xs font-medium">{selectedAffiliate.totalReferrals}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Revenue Generated</span>
                    <span className="text-xs font-medium">
                      {formatCurrency(selectedAffiliate.totalRevenueGenerated)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Commission Earned</span>
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(selectedAffiliate.totalCommissionEarned)}
                    </span>
                  </div>
                </div>
              )}

              {/* Commission Rate */}
              <div className="space-y-2">
                <Label htmlFor="edit-commission-rate">
                  Commission Rate <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="edit-commission-rate"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={editForm.commissionRate}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        commissionRate: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleEdit}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ==================== Delete Confirmation ==================== */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Delete Affiliate
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove{' '}
                <strong>{selectedAffiliate?.user?.name || 'this affiliate'}</strong> from the
                affiliate program? Their referral code will be deactivated and no longer track
                new referrals. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSelectedAffiliate(null);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedAffiliate && deleteMutation.mutate(selectedAffiliate.id)}
                disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Affiliate'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
