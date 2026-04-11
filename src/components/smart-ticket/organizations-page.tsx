'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Settings,
  Eye,
  Users,
  CalendarDays,
  Crown,
  Sparkles,
  Star,
  Loader2,
  X,
  Check,
  Mail,
  Phone,
  Palette,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore, type Organization } from '@/store/org-store';

// ── API Helpers ──────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  const token = useAuthStore.getState().token;
  const orgId = useOrgStore.getState().currentOrganization?.id;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'X-Organization-Id': orgId || '',
  };
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...options?.headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// ── Badge Helpers ────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: Organization['subscriptionPlan'] }) {
  switch (plan) {
    case 'starter':
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground border-transparent gap-1">
          <Building2 className="h-3 w-3" /> Starter
        </Badge>
      );
    case 'pro':
      return (
        <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 gap-1">
          <Sparkles className="h-3 w-3" /> Pro
        </Badge>
      );
    case 'enterprise':
      return (
        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800 gap-1">
          <Crown className="h-3 w-3" /> Enterprise
        </Badge>
      );
    default:
      return null;
  }
}

function StatusBadge({ status }: { status: Organization['subscriptionStatus'] }) {
  switch (status) {
    case 'trial':
      return (
        <Badge variant="outline" className="bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800">
          Trial
        </Badge>
      );
    case 'active':
      return (
        <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
          Active
        </Badge>
      );
    case 'expired':
      return (
        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
          Expired
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="outline" className="bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700">
          Cancelled
        </Badge>
      );
    default:
      return null;
  }
}

// ── Plan Info ────────────────────────────────────────────────────────────

const PLAN_INFO = {
  starter: {
    name: 'Starter',
    price: 'Free',
    limits: ['Up to 3 events', '100 tickets/event', '1 user', 'Basic analytics'],
  },
  pro: {
    name: 'Pro',
    price: '$29/mo',
    limits: ['Unlimited events', '1,000 tickets/event', '5 users', 'Advanced analytics', 'QR scanner', 'Export data'],
  },
  enterprise: {
    name: 'Enterprise',
    price: '$99/mo',
    limits: ['Unlimited events', 'Unlimited tickets', 'Unlimited users', 'White-label', 'Priority support', 'API access', 'Custom branding'],
  },
};

const COLOR_PRESETS = [
  '#10b981', '#059669', '#0d9488', '#0891b2', '#2563eb',
  '#7c3aed', '#c026d3', '#e11d48', '#ea580c', '#d97706',
  '#65a30d', '#4f46e5', '#6366f1',
];

// ── Form Types ───────────────────────────────────────────────────────────

interface OrgFormData {
  name: string;
  slug: string;
  email: string;
  phone: string;
  primaryColor: string;
  subscriptionPlan: 'starter' | 'pro' | 'enterprise';
}

const INITIAL_FORM: OrgFormData = {
  name: '',
  slug: '',
  email: '',
  phone: '',
  primaryColor: '#10b981',
  subscriptionPlan: 'starter',
};

// ── Main Component ───────────────────────────────────────────────────────

export default function OrganizationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState<OrgFormData>(INITIAL_FORM);

  // ── Fetch organizations ──────────────────────────────────────────────

  const { data: orgsData, isLoading } = useQuery<{ data: Organization[]; total: number }>({
    queryKey: ['organizations', search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      return apiFetch(`/api/organizations?${params.toString()}`);
    },
  });

  const organizations = orgsData?.data ?? [];
  const orgStore = useOrgStore();

  // ── Stats ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    return {
      total: orgsData?.total ?? organizations.length,
      active: organizations.filter((o) => o.subscriptionStatus === 'active').length,
      pro: organizations.filter((o) => o.subscriptionPlan === 'pro').length,
      enterprise: organizations.filter((o) => o.subscriptionPlan === 'enterprise').length,
    };
  }, [organizations, orgsData]);

  // ── Mutations ────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: OrgFormData) =>
      apiFetch('/api/organizations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (newOrg) => {
      toast.success('Organization created successfully');
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setShowCreateDialog(false);
      setFormData(INITIAL_FORM);
      orgStore.addOrganization(newOrg as Organization);
    },
    onError: (err: Error) => {
      toast.error('Failed to create organization', { description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<OrgFormData> }) =>
      apiFetch(`/api/organizations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success('Organization updated successfully');
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setShowEditDialog(false);
      setSelectedOrg(null);
      setFormData(INITIAL_FORM);
    },
    onError: (err: Error) => {
      toast.error('Failed to update organization', { description: err.message });
    },
  });

  // ── Form Helpers ─────────────────────────────────────────────────────

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
  }

  function openCreateDialog() {
    setFormData(INITIAL_FORM);
    setShowCreateDialog(true);
  }

  function openEditDialog(org: Organization) {
    setSelectedOrg(org);
    setFormData({
      name: org.name,
      slug: org.slug,
      email: org.email || '',
      phone: org.phone || '',
      primaryColor: org.primaryColor || '#10b981',
      subscriptionPlan: org.subscriptionPlan,
    });
    setShowEditDialog(true);
  }

  function openViewDialog(org: Organization) {
    setSelectedOrg(org);
    setShowViewDialog(true);
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Organization name is required');
      return;
    }
    if (!formData.slug.trim()) {
      toast.error('Slug is required');
      return;
    }
    createMutation.mutate(formData);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrg) return;
    if (!formData.name.trim()) {
      toast.error('Organization name is required');
      return;
    }
    updateMutation.mutate({ id: selectedOrg.id, data: formData });
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2">
            <Building2 className="h-7 w-7 text-emerald-500" />
            Organizations
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your organizations and subscription plans
          </p>
        </div>
        <Button onClick={openCreateDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <Plus className="h-4 w-4" />
          Create Organization
        </Button>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Orgs</CardTitle>
            <Building2 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats.total}</div>
            )}
            <p className="text-muted-foreground text-xs">All organizations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Check className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-emerald-600">{stats.active}</div>
            )}
            <p className="text-muted-foreground text-xs">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pro Plans</CardTitle>
            <Sparkles className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-emerald-600">{stats.pro}</div>
            )}
            <p className="text-muted-foreground text-xs">Pro subscribers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Enterprise</CardTitle>
            <Crown className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-amber-600">{stats.enterprise}</div>
            )}
            <p className="text-muted-foreground text-xs">Enterprise plans</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Search ─────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search organizations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Organizations List ──────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : organizations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium">No organizations found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? 'Try adjusting your search' : 'Create your first organization to get started'}
            </p>
            {!search && (
              <Button onClick={openCreateDialog} className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Create Organization
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {/* Mobile: Cards */}
          <div className="grid gap-4 sm:hidden">
            {organizations.map((org) => (
              <Card key={org.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${org.primaryColor || '#10b981'}20` }}
                    >
                      <Building2 className="h-5 w-5" style={{ color: org.primaryColor || '#10b981' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{org.name}</h3>
                        <PlanBadge plan={org.subscriptionPlan} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">@{org.slug}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <StatusBadge status={org.subscriptionStatus} />
                        <span className="text-[10px] text-muted-foreground">
                          {org.memberCount ?? 0} members
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {org.eventCount ?? 0} events
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openViewDialog(org)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(org)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: Table */}
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Members</TableHead>
                    <TableHead className="hidden md:table-cell">Events</TableHead>
                    <TableHead className="hidden lg:table-cell">Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${org.primaryColor || '#10b981'}20` }}
                          >
                            <Building2 className="h-4 w-4" style={{ color: org.primaryColor || '#10b981' }} />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{org.name}</p>
                            <p className="text-xs text-muted-foreground">@{org.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <PlanBadge plan={org.subscriptionPlan} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={org.subscriptionStatus} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {org.memberCount ?? 0}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {org.eventCount ?? 0}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {org.createdAt ? format(new Date(org.createdAt), 'MMM d, yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openViewDialog(org)} title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(org)} title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(org)} title="Settings">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Create Organization Dialog ──────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Set up a new organization for managing events and tickets.
            </DialogDescription>
          </DialogHeader>
          <OrgForm
            formData={formData}
            onChange={(data) => setFormData(data)}
            onSubmit={handleCreateSubmit}
            isLoading={createMutation.isPending}
            submitLabel="Create Organization"
          />
        </DialogContent>
      </Dialog>

      {/* ── Edit Organization Dialog ────────────────────────────────── */}
      <Dialog
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) {
            setSelectedOrg(null);
            setFormData(INITIAL_FORM);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update organization details and subscription settings.
            </DialogDescription>
          </DialogHeader>
          <OrgForm
            formData={formData}
            onChange={(data) => setFormData(data)}
            onSubmit={handleEditSubmit}
            isLoading={updateMutation.isPending}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>

      {/* ── View Organization Dialog ────────────────────────────────── */}
      <Dialog
        open={showViewDialog}
        onOpenChange={(open) => {
          setShowViewDialog(open);
          if (!open) setSelectedOrg(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {selectedOrg && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${selectedOrg.primaryColor || '#10b981'}20` }}
                  >
                    <Building2 className="h-4 w-4" style={{ color: selectedOrg.primaryColor || '#10b981' }} />
                  </div>
                  {selectedOrg.name}
                </DialogTitle>
                <DialogDescription>@{selectedOrg.slug}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <PlanBadge plan={selectedOrg.subscriptionPlan} />
                  <StatusBadge status={selectedOrg.subscriptionStatus} />
                </div>

                {selectedOrg.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {selectedOrg.email}
                  </div>
                )}
                {selectedOrg.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {selectedOrg.phone}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {selectedOrg.memberCount ?? 0} members
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    {selectedOrg.eventCount ?? 0} events
                  </div>
                </div>

                {selectedOrg.createdAt && (
                  <p className="text-xs text-muted-foreground">
                    Created {format(new Date(selectedOrg.createdAt), 'MMM d, yyyy')}
                  </p>
                )}

                <Separator />

                {/* Plan info */}
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <Star className="h-4 w-4 text-amber-500" />
                    {PLAN_INFO[selectedOrg.subscriptionPlan].name} Plan
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {PLAN_INFO[selectedOrg.subscriptionPlan].limits.map((limit) => (
                      <li key={limit} className="flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-emerald-500" />
                        {limit}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Organization Form ────────────────────────────────────────────────────

function OrgForm({
  formData,
  onChange,
  onSubmit,
  isLoading,
  submitLabel,
}: {
  formData: OrgFormData;
  onChange: (data: OrgFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  submitLabel: string;
}) {
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="org-name">Name *</Label>
        <Input
          id="org-name"
          value={formData.name}
          onChange={(e) => {
            const name = e.target.value;
            onChange({
              ...formData,
              name,
              slug: formData.slug === generateSlug(formData.name) ? generateSlug(name) : formData.slug,
            });
          }}
          placeholder="My Organization"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-slug">Slug *</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">@</span>
          <Input
            id="org-slug"
            value={formData.slug}
            onChange={(e) => onChange({ ...formData, slug: generateSlug(e.target.value) })}
            placeholder="my-organization"
            className="flex-1"
          />
        </div>
        <p className="text-xs text-muted-foreground">Auto-generated from name. Used in URLs.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="org-email">Email</Label>
          <Input
            id="org-email"
            type="email"
            value={formData.email}
            onChange={(e) => onChange({ ...formData, email: e.target.value })}
            placeholder="org@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-phone">Phone</Label>
          <Input
            id="org-phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => onChange({ ...formData, phone: e.target.value })}
            placeholder="+1 234 567 890"
          />
        </div>
      </div>

      {/* Color Picker */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Palette className="h-4 w-4" />
          Primary Color
        </Label>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onChange({ ...formData, primaryColor: color })}
                className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  formData.primaryColor === color ? 'border-foreground scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div
            className="h-8 w-8 rounded-lg border"
            style={{ backgroundColor: formData.primaryColor }}
          />
        </div>
      </div>

      {/* Subscription Plan */}
      <div className="space-y-2">
        <Label htmlFor="org-plan">Subscription Plan</Label>
        <Select
          value={formData.subscriptionPlan}
          onValueChange={(v) => onChange({ ...formData, subscriptionPlan: v as OrgFormData['subscriptionPlan'] })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="starter">Starter (Free)</SelectItem>
            <SelectItem value="pro">Pro ($29/mo)</SelectItem>
            <SelectItem value="enterprise">Enterprise ($99/mo)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Plan Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="p-3">
          <p className="text-xs font-medium flex items-center gap-1 mb-2">
            <Star className="h-3 w-3 text-amber-500" />
            {PLAN_INFO[formData.subscriptionPlan].name} Plan includes:
          </p>
          <ul className="text-xs text-muted-foreground space-y-1">
            {PLAN_INFO[formData.subscriptionPlan].limits.map((limit) => (
              <li key={limit} className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-emerald-500" />
                {limit}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <DialogFooter>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
