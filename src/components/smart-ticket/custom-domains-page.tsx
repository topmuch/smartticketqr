'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Mail,
  ImageIcon,
  AlertTriangle,
  Info,
  Server,
  ExternalLink,
  MoreHorizontal,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { cn } from '@/lib/utils';

// ==================== Types ====================

interface CustomDomain {
  id: string;
  domain: string;
  sslStatus: 'pending' | 'active' | 'failed';
  isActive: boolean;
  faviconUrl: string | null;
  emailFrom: string | null;
  createdAt: string;
  updatedAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
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

// ==================== Animation Variants ====================

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const },
  }),
};

// ==================== Helpers ====================

function isValidDomain(domain: string): boolean {
  const pattern = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return pattern.test(domain);
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
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

function SslStatusBadge({ status }: { status: CustomDomain['sslStatus'] }) {
  switch (status) {
    case 'active':
      return (
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800 text-xs"
        >
          <ShieldCheck className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    case 'pending':
      return (
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800 text-xs"
        >
          <ShieldAlert className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'failed':
      return (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800 text-xs"
        >
          <ShieldX className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    default:
      return null;
  }
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800 text-xs"
      >
        Enabled
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 text-xs"
    >
      Disabled
    </Badge>
  );
}

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-44" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-8 w-8" />
      </TableCell>
    </TableRow>
  );
}

// ==================== DNS Instructions Card ====================

function DnsInstructionsCard() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, []);

  const dnsRecords = [
    {
      type: 'CNAME',
      host: '@',
      value: 'smartticketqr.app',
      description: 'Points your root domain to our platform',
    },
    {
      type: 'CNAME',
      host: 'www',
      value: 'smartticketqr.app',
      description: 'Points the www subdomain to our platform',
    },
    {
      type: 'A',
      host: '@',
      value: '76.76.21.21',
      description: 'Alternative: A record pointing to our server IP',
    },
  ];

  return (
    <Card className="border-dashed border-amber-300 dark:border-amber-700/50 bg-amber-50/30 dark:bg-amber-950/10">
      <CardContent className="p-4 sm:p-6">
        <button
          type="button"
          className="w-full flex items-center justify-between text-left"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 mt-0.5">
              <Server className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                DNS Configuration Guide
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">
                How to point your custom domain to SmartTicketQR
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-amber-500 shrink-0" />
          ) : (
            <ChevronDown className="h-5 w-5 text-amber-500 shrink-0" />
          )}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-4">
                <Separator className="bg-amber-200 dark:bg-amber-800/50" />

                {/* SSL Auto-provisioning note */}
                <div className="flex items-start gap-2.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3 border border-emerald-200/50 dark:border-emerald-800/30">
                  <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                    SSL certificates are automatically provisioned via Let&apos;s Encrypt once DNS is properly configured.
                    No manual SSL setup is required on your end.
                  </p>
                </div>

                {/* DNS Records Table */}
                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Add the following DNS records at your domain registrar:
                  </p>

                  <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-4 gap-2 bg-amber-100/60 dark:bg-amber-900/30 px-3 py-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Type
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Host
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Value
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 text-right">
                        Action
                      </span>
                    </div>

                    {dnsRecords.map((record) => (
                      <div
                        key={`${record.type}-${record.host}`}
                        className="grid grid-cols-4 gap-2 items-center px-3 py-2.5 border-t border-amber-100 dark:border-amber-900/30 last:border-b-0"
                      >
                        <Badge
                          variant="outline"
                          className="bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700 text-[10px] justify-center w-fit"
                        >
                          {record.type}
                        </Badge>
                        <code className="text-xs font-mono bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded text-amber-800 dark:text-amber-200">
                          {record.host}
                        </code>
                        <code className="text-xs font-mono bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded text-amber-800 dark:text-amber-200 truncate">
                          {record.value}
                        </code>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-900/40"
                            onClick={() => handleCopy(record.value, `${record.type}-${record.host}`)}
                          >
                            {copiedField === `${record.type}-${record.host}` ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    {dnsRecords.map((record) => (
                      <div key={`note-${record.type}-${record.host}`} className="flex items-start gap-2">
                        <Info className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70 leading-relaxed">
                          <span className="font-semibold">{record.type} {record.host}:</span> {record.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70 leading-relaxed">
                      DNS changes can take up to 48 hours to propagate. SSL provisioning will begin automatically once DNS is verified.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

// ==================== Mobile Card View ====================

function MobileDomainCard({
  domain,
  onEdit,
  onDelete,
  onToggleActive,
  isAdmin,
}: {
  domain: CustomDomain;
  onEdit: (d: CustomDomain) => void;
  onDelete: (d: CustomDomain) => void;
  onToggleActive: (d: CustomDomain) => void;
  isAdmin: boolean;
}) {
  return (
    <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 min-w-0 flex-1">
              <p className="font-medium truncate flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {domain.domain}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {domain.organization.name}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <ActiveBadge isActive={domain.isActive} />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <SslStatusBadge status={domain.sslStatus} />
          </div>

          <Separator />

          <div className="space-y-1.5 text-xs text-muted-foreground">
            {domain.emailFrom && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                <span className="truncate">{domain.emailFrom}</span>
              </div>
            )}
            {domain.faviconUrl && (
              <div className="flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3" />
                <span className="truncate">{domain.faviconUrl}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>Added {format(new Date(domain.createdAt), 'MMM d, yyyy')}</span>
            </div>
          </div>

          <Separator />

          {isAdmin && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => onEdit(domain)}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'flex-1 text-xs',
                  domain.isActive
                    ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                    : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                )}
                onClick={() => onToggleActive(domain)}
              >
                {domain.isActive ? (
                  <>
                    <ShieldX className="h-3 w-3 mr-1" />
                    Disable
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Enable
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={() => onDelete(domain)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ==================== Main Component ====================

export default function CustomDomainsPage() {
  const { token, user } = useAuthStore();
  const { currentOrganization } = useOrgStore();
  const queryClient = useQueryClient();

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Selected domain
  const [selectedDomain, setSelectedDomain] = useState<CustomDomain | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    domain: '',
    faviconUrl: '',
    emailFrom: '',
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    faviconUrl: '',
    emailFrom: '',
  });

  // Domain validation state
  const [domainError, setDomainError] = useState('');

  // ==================== Queries ====================

  const { data: domains = [], isLoading, refetch } = useQuery<CustomDomain[]>({
    queryKey: ['custom-domains'],
    queryFn: async () => {
      const res = await fetch('/api/custom-domains', {
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch custom domains');
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!token,
  });

  // ==================== Mutations ====================

  const createMutation = useMutation({
    mutationFn: async (body: {
      domain: string;
      faviconUrl?: string;
      emailFrom?: string;
    }) => {
      const res = await fetch('/api/custom-domains', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create custom domain' }));
        throw new Error(err.error || 'Failed to create custom domain');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-domains'] });
      setShowCreateDialog(false);
      setCreateForm({ domain: '', faviconUrl: '', emailFrom: '' });
      setDomainError('');
      toast.success('Custom domain added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: {
        faviconUrl?: string;
        emailFrom?: string;
        isActive?: boolean;
      };
    }) => {
      const res = await fetch(`/api/custom-domains/${id}`, {
        method: 'PUT',
        headers: getApiHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update custom domain' }));
        throw new Error(err.error || 'Failed to update custom domain');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-domains'] });
      setShowEditDialog(false);
      setSelectedDomain(null);
      toast.success('Custom domain updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/custom-domains/${id}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to delete custom domain' }));
        throw new Error(err.error || 'Failed to delete custom domain');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-domains'] });
      setShowDeleteDialog(false);
      setSelectedDomain(null);
      toast.success('Custom domain removed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ==================== Handlers ====================

  const handleDomainChange = useCallback((value: string) => {
    const cleaned = value.trim().toLowerCase();
    setCreateForm((prev) => ({ ...prev, domain: cleaned }));

    if (!cleaned) {
      setDomainError('');
      return;
    }
    if (!isValidDomain(cleaned)) {
      setDomainError('Please enter a valid domain (e.g. tickets.yourdomain.com)');
      return;
    }
    const existing = domains.find(
      (d) => d.domain.toLowerCase() === cleaned
    );
    if (existing) {
      setDomainError('This domain is already configured');
      return;
    }
    setDomainError('');
  }, [domains]);

  const handleCreate = useCallback(() => {
    if (!createForm.domain.trim()) {
      toast.error('Domain name is required');
      return;
    }
    if (domainError) {
      toast.error('Please fix the domain validation error');
      return;
    }
    if (!isValidDomain(createForm.domain.trim())) {
      toast.error('Please enter a valid domain name');
      return;
    }

    const body: {
      domain: string;
      faviconUrl?: string;
      emailFrom?: string;
    } = {
      domain: createForm.domain.trim().toLowerCase(),
    };
    if (createForm.faviconUrl.trim()) {
      body.faviconUrl = createForm.faviconUrl.trim();
    }
    if (createForm.emailFrom.trim()) {
      body.emailFrom = createForm.emailFrom.trim();
    }

    createMutation.mutate(body);
  }, [createForm, domainError, createMutation]);

  const handleEdit = useCallback((domain: CustomDomain) => {
    setSelectedDomain(domain);
    setEditForm({
      faviconUrl: domain.faviconUrl || '',
      emailFrom: domain.emailFrom || '',
    });
    setShowEditDialog(true);
  }, []);

  const handleUpdate = useCallback(() => {
    if (!selectedDomain) return;

    const body: {
      faviconUrl?: string;
      emailFrom?: string;
    } = {};
    if (editForm.faviconUrl.trim() !== (selectedDomain.faviconUrl || '')) {
      body.faviconUrl = editForm.faviconUrl.trim() || null as unknown as string;
    }
    if (editForm.emailFrom.trim() !== (selectedDomain.emailFrom || '')) {
      body.emailFrom = editForm.emailFrom.trim() || null as unknown as string;
    }

    updateMutation.mutate({ id: selectedDomain.id, body });
  }, [selectedDomain, editForm, updateMutation]);

  const handleDelete = useCallback((domain: CustomDomain) => {
    setSelectedDomain(domain);
    setShowDeleteDialog(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!selectedDomain) return;
    deleteMutation.mutate(selectedDomain.id);
  }, [selectedDomain, deleteMutation]);

  const handleToggleActive = useCallback(
    (domain: CustomDomain) => {
      updateMutation.mutate({
        id: domain.id,
        body: { isActive: !domain.isActive },
      });
    },
    [updateMutation]
  );

  // ==================== Computed ====================

  const totalDomains = domains.length;
  const activeSsl = domains.filter((d) => d.sslStatus === 'active').length;
  const pendingSetup = domains.filter(
    (d) => d.sslStatus === 'pending' || d.sslStatus === 'failed'
  ).length;

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // ==================== Render ====================

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Globe className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Please log in to manage custom domains</p>
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
              <Globe className="h-7 w-7 text-emerald-500" />
              Custom Domains
            </h1>
            <p className="text-muted-foreground">
              Manage white-label domains for your organization&apos;s ticket pages
            </p>
            {currentOrganization && (
              <div className="flex items-center gap-2 mt-2">
                {currentOrganization.primaryColor && (
                  <div
                    className="h-3 w-3 rounded-full border border-muted-foreground/20"
                    style={{ backgroundColor: currentOrganization.primaryColor }}
                  />
                )}
                <span className="text-xs text-muted-foreground">
                  {currentOrganization.name} &middot; {currentOrganization.slug}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Domain
              </Button>
            )}
          </div>
        </div>

        {/* ==================== Stats Cards ==================== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard
            title="Total Domains"
            value={totalDomains}
            icon={Globe}
          />
          <StatsCard
            title="Active SSL"
            value={activeSsl}
            icon={ShieldCheck}
            badge={
              totalDomains > 0
                ? `${Math.round((activeSsl / totalDomains) * 100)}% secured`
                : undefined
            }
            badgeColor="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
          />
          <StatsCard
            title="Pending Setup"
            value={pendingSetup}
            icon={ShieldAlert}
            badge={
              pendingSetup > 0
                ? 'Action needed'
                : 'All configured'
            }
            badgeColor={
              pendingSetup > 0
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
            }
          />
        </div>

        {/* ==================== DNS Instructions ==================== */}
        <DnsInstructionsCard />

        {/* ==================== Domains Table (Desktop) ==================== */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="sticky top-0 bg-background z-10">
                    <TableHead className="min-w-[200px]">Domain</TableHead>
                    <TableHead className="min-w-[100px]">SSL Status</TableHead>
                    <TableHead className="min-w-[90px]">Active</TableHead>
                    <TableHead className="min-w-[180px]">Sender Email</TableHead>
                    <TableHead className="min-w-[180px]">Favicon URL</TableHead>
                    <TableHead className="min-w-[110px]">Created</TableHead>
                    <TableHead className="min-w-[110px]">Updated</TableHead>
                    <TableHead className="min-w-[50px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : domains.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-48 text-center">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <Globe className="h-10 w-10" />
                          <div>
                            <p className="text-sm font-medium">No custom domains configured</p>
                            <p className="text-xs mt-1">
                              Add your first custom domain to white-label your ticket pages
                            </p>
                          </div>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowCreateDialog(true)}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1.5" />
                              Add Custom Domain
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <AnimatePresence>
                      {domains.map((domain) => (
                        <motion.tr
                          key={domain.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className={cn(
                            'border-b transition-colors hover:bg-muted/50',
                            !domain.isActive && 'opacity-60'
                          )}
                        >
                          {/* Domain */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <span className="text-sm font-medium block truncate">
                                  {domain.domain}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {domain.organization.name}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* SSL Status */}
                          <TableCell>
                            <SslStatusBadge status={domain.sslStatus} />
                          </TableCell>

                          {/* Active */}
                          <TableCell>
                            <ActiveBadge isActive={domain.isActive} />
                          </TableCell>

                          {/* Sender Email */}
                          <TableCell>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground truncate">
                                {domain.emailFrom || (
                                  <span className="italic">Not set</span>
                                )}
                              </span>
                            </div>
                          </TableCell>

                          {/* Favicon URL */}
                          <TableCell>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <ImageIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground truncate">
                                {domain.faviconUrl || (
                                  <span className="italic">Not set</span>
                                )}
                              </span>
                            </div>
                          </TableCell>

                          {/* Created */}
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(domain.createdAt), 'MMM d, yyyy')}
                            </span>
                          </TableCell>

                          {/* Updated */}
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeTime(domain.updatedAt)}
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
                                {isAdmin && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleEdit(domain)}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Edit Domain
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleToggleActive(domain)}
                                    >
                                      {domain.isActive ? (
                                        <>
                                          <ShieldX className="h-4 w-4 mr-2" />
                                          Disable Domain
                                        </>
                                      ) : (
                                        <>
                                          <ShieldCheck className="h-4 w-4 mr-2" />
                                          Enable Domain
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleDelete(domain)}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Remove Domain
                                    </DropdownMenuItem>
                                  </>
                                )}
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

        {/* ==================== Domains Cards (Mobile) ==================== */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-5 w-36" />
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
          ) : domains.length === 0 ? (
            <Card>
              <CardContent className="p-8">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Globe className="h-10 w-10" />
                  <div className="text-center">
                    <p className="text-sm font-medium">No custom domains configured</p>
                    <p className="text-xs mt-1">
                      Add your first custom domain to white-label your ticket pages
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCreateDialog(true)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add Custom Domain
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            domains.map((domain) => (
              <MobileDomainCard
                key={domain.id}
                domain={domain}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleActive={handleToggleActive}
                isAdmin={isAdmin}
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
                  White-Label Domain Security
                </p>
                <ul className="text-xs text-emerald-700/80 dark:text-emerald-400/80 space-y-1 list-disc list-inside">
                  <li>All custom domains are served over HTTPS with automatic SSL certificates</li>
                  <li>DNS changes can take up to 48 hours to fully propagate globally</li>
                  <li>Each organization can configure multiple custom domains</li>
                  <li>Custom sender emails require proper SPF/DKIM records for deliverability</li>
                  <li>Domain changes take effect immediately after SSL activation</li>
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
                Add Custom Domain
              </DialogTitle>
              <DialogDescription>
                Add a custom domain to white-label your organization&apos;s ticket pages and emails.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Domain */}
              <div className="space-y-2">
                <Label htmlFor="domain-name">
                  Domain Name <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="domain-name"
                    placeholder="tickets.yourdomain.com"
                    value={createForm.domain}
                    onChange={(e) => handleDomainChange(e.target.value)}
                    className={cn('pl-9', domainError && 'border-red-500 focus-visible:ring-red-500/30')}
                    autoComplete="url"
                  />
                </div>
                {domainError ? (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {domainError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Enter the full domain name including subdomain (e.g. tickets.yourdomain.com)
                  </p>
                )}
              </div>

              {/* Favicon URL */}
              <div className="space-y-2">
                <Label htmlFor="favicon-url">
                  Favicon URL
                </Label>
                <div className="relative">
                  <ImageIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="favicon-url"
                    placeholder="https://yourdomain.com/favicon.ico"
                    value={createForm.faviconUrl}
                    onChange={(e) => setCreateForm((p) => ({ ...p, faviconUrl: e.target.value }))}
                    className="pl-9"
                    autoComplete="url"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  URL to a favicon image displayed in the browser tab (optional)
                </p>
              </div>

              {/* Sender Email */}
              <div className="space-y-2">
                <Label htmlFor="email-from">
                  Sender Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email-from"
                    placeholder="tickets@yourdomain.com"
                    value={createForm.emailFrom}
                    onChange={(e) => setCreateForm((p) => ({ ...p, emailFrom: e.target.value }))}
                    className="pl-9"
                    autoComplete="email"
                    type="email"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Email address displayed as the sender for ticket notifications (optional)
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || !createForm.domain.trim() || !!domainError}
              >
                {createMutation.isPending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add Domain
                  </>
                )}
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
                Edit Domain Settings
              </DialogTitle>
              <DialogDescription>
                {selectedDomain
                  ? `Update branding settings for ${selectedDomain.domain}`
                  : 'Update domain settings'}
              </DialogDescription>
            </DialogHeader>
            {selectedDomain && (
              <div className="space-y-4 py-2">
                {/* Domain (read-only) */}
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{selectedDomain.domain}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Domain names cannot be changed after creation
                  </p>
                </div>

                {/* SSL Status (read-only info) */}
                <div className="space-y-2">
                  <Label>SSL Status</Label>
                  <div className="flex items-center gap-2">
                    <SslStatusBadge status={selectedDomain.sslStatus} />
                    {selectedDomain.sslStatus === 'pending' && (
                      <span className="text-xs text-muted-foreground">
                        &middot; Provisioning in progress
                      </span>
                    )}
                    {selectedDomain.sslStatus === 'failed' && (
                      <span className="text-xs text-red-500">
                        &middot; Check your DNS configuration
                      </span>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Favicon URL */}
                <div className="space-y-2">
                  <Label htmlFor="edit-favicon-url">
                    Favicon URL
                  </Label>
                  <div className="relative">
                    <ImageIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-favicon-url"
                      placeholder="https://yourdomain.com/favicon.ico"
                      value={editForm.faviconUrl}
                      onChange={(e) => setEditForm((p) => ({ ...p, faviconUrl: e.target.value }))}
                      className="pl-9"
                      autoComplete="url"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use the default SmartTicketQR favicon
                  </p>
                </div>

                {/* Sender Email */}
                <div className="space-y-2">
                  <Label htmlFor="edit-email-from">
                    Sender Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-email-from"
                      placeholder="tickets@yourdomain.com"
                      value={editForm.emailFrom}
                      onChange={(e) => setEditForm((p) => ({ ...p, emailFrom: e.target.value }))}
                      className="pl-9"
                      autoComplete="email"
                      type="email"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use the default sender address
                  </p>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ==================== Delete Confirmation ==================== */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Remove Custom Domain
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Are you sure you want to remove{' '}
                    <span className="font-semibold text-foreground">
                      {selectedDomain?.domain}
                    </span>
                    ?
                  </p>
                  <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 border border-red-200/50 dark:border-red-800/30 space-y-1.5">
                    <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                      This action cannot be undone. The following will happen:
                    </p>
                    <ul className="text-xs text-red-600/80 dark:text-red-400/80 space-y-1 list-disc list-inside">
                      <li>The domain will be immediately removed from your organization</li>
                      <li>Any active SSL certificate will be revoked</li>
                      <li>Ticket pages using this domain will revert to the default domain</li>
                      <li>Email notifications using this sender address will use the default</li>
                    </ul>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {deleteMutation.isPending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Remove Domain
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
