'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  Shield,
  ShieldCheck,
  Eye,
  MoreHorizontal,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Mail,
  Calendar,
  Check,
  X,
  Info,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { useAppStore } from '@/store/app-store';
import {
  type ClientRole,
  ROLE_CONFIG,
  CLIENT_ROLES,
  PERMISSION_MATRIX,
  PERMISSION_LABELS,
  hasPermission,
  type Permission,
} from '@/lib/permissions';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    tickets: number;
    scans: number;
    events: number;
  };
}

interface UsersResponse {
  data: UserRecord[];
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

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserRecord | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeLimitInfo, setUpgradeLimitInfo] = useState({ limit: 0, label: 'utilisateurs' });
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [selectedPermRole, setSelectedPermRole] = useState<ClientRole>('admin');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'operator' as string,
  });
  const queryClient = useQueryClient();

  const currentUser = useAuthStore.getState().user;
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdmin = currentUser?.role === 'admin';
  const canManageUsers = isSuperAdmin || isAdmin;

  // Fetch users
  const { data: usersData, isLoading } = useQuery<UsersResponse>({
    queryKey: ['users', search, roleFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (roleFilter !== 'all') params.set('role', roleFilter);

      const res = await fetch(`/api/users?${params}`, {
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; role: string }) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create user' }));
        throw new Error(err.error || 'Failed to create user');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Utilisateur créé avec succès');
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error & { needsUpgrade?: boolean; limit?: number }) => {
      if (error.needsUpgrade) {
        setDialogOpen(false);
        resetForm();
        setUpgradeLimitInfo({ limit: error.limit || 0, label: 'utilisateurs' });
        setShowUpgradeDialog(true);
      } else {
        toast.error('Échec de la création', { description: error.message });
      }
    },
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; email?: string; role?: string; isActive?: boolean } }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: getApiHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update user' }));
        throw new Error(err.error || 'Failed to update user');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Utilisateur mis à jour');
      setDialogOpen(false);
      setEditUser(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      toast.error('Échec de la mise à jour', { description: error.message });
    },
  });

  // Deactivate user mutation
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to deactivate user' }));
        throw new Error(err.error || 'Failed to deactivate user');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Utilisateur désactivé');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      toast.error('Échec de la désactivation', { description: error.message });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', email: '', password: '', role: 'operator' });
  };

  const handleOpenCreate = () => {
    resetForm();
    setEditUser(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (user: UserRecord) => {
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    });
    setEditUser(user);
    setDialogOpen(true);
  };

  const handleOpenDelete = (user: UserRecord) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.email) {
      toast.error('Le nom et l\'email sont obligatoires');
      return;
    }

    if (editUser) {
      const updateData: Record<string, string | boolean> = { name: formData.name, email: formData.email };
      // Admin can change roles of other admin-level users (not super_admin)
      if (formData.role && (isSuperAdmin || isAdmin)) updateData.role = formData.role;
      // Don't allow changing role to super_admin unless current user is super_admin
      if (formData.role === 'super_admin' && !isSuperAdmin) {
        toast.error('Seul un Super Admin peut attribuer ce rôle');
        return;
      }
      updateMutation.mutate({ id: editUser.id, data: updateData });
    } else {
      if (!formData.password) {
        toast.error('Le mot de passe est obligatoire pour les nouveaux utilisateurs');
        return;
      }
      // Don't allow creating super_admin unless current user is super_admin
      if (formData.role === 'super_admin' && !isSuperAdmin) {
        toast.error('Seul un Super Admin peut créer ce rôle');
        return;
      }
      createMutation.mutate(formData);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleRoleFilter = (value: string) => {
    setRoleFilter(value);
    setPage(1);
  };

  // Stats
  const stats = useMemo(() => {
    const users = usersData?.data || [];
    return {
      total: usersData?.total || 0,
      admins: users.filter((u) => u.role === 'admin' || u.role === 'super_admin').length,
      cashiers: users.filter((u) => u.role === 'caisse').length,
      controllers: users.filter((u) => u.role === 'controleur').length,
      accountants: users.filter((u) => u.role === 'comptable').length,
      active: users.filter((u) => u.isActive).length,
    };
  }, [usersData]);

  if (!canManageUsers) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold">Accès refusé</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Vous devez être administrateur pour gérer l&apos;équipe.
        </p>
      </div>
    );
  }

  // Get role config safely
  function getRoleBadge(role: string) {
    const config = ROLE_CONFIG[role];
    if (config) {
      return (
        <Badge variant="outline" className={`${config.bgColor} ${config.color} border-transparent text-xs gap-1`}>
          <span className="hidden sm:inline">{config.emoji}</span>
          <span className="hidden sm:inline">{config.labelFr}</span>
          <span className="sm:hidden">{config.label.slice(0, 3)}</span>
        </Badge>
      );
    }
    return <Badge variant="outline" className="text-xs">{role}</Badge>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-orange-500" />
            Gérer l&apos;Équipe
          </h2>
          <p className="text-muted-foreground">
            Gérez les membres de votre équipe et attribuez les rôles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            setSelectedPermRole('admin');
            setShowPermissionsDialog(true);
          }}>
            <Info className="h-4 w-4 mr-1.5" />
            Matrice des permissions
          </Button>
          {(isSuperAdmin || isAdmin) && (
            <Button onClick={handleOpenCreate}>
              <UserPlus className="h-4 w-4 mr-1.5" />
              Ajouter un membre
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.admins}</p>
              <p className="text-[10px] text-muted-foreground">Admins</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <span className="text-base">💰</span>
            </div>
            <div>
              <p className="text-lg font-bold">{stats.cashiers}</p>
              <p className="text-[10px] text-muted-foreground">Caisses</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <span className="text-base">📱</span>
            </div>
            <div>
              <p className="text-lg font-bold">{stats.controllers}</p>
              <p className="text-[10px] text-muted-foreground">Contrôleurs</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <span className="text-base">📊</span>
            </div>
            <div>
              <p className="text-lg font-bold">{stats.accountants}</p>
              <p className="text-[10px] text-muted-foreground">Comptables</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.active}</p>
              <p className="text-[10px] text-muted-foreground">Actifs</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou email..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={handleRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtrer par rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="admin">👑 Admin</SelectItem>
                <SelectItem value="caisse">💰 Caisse</SelectItem>
                <SelectItem value="controleur">📱 Contrôleur</SelectItem>
                <SelectItem value="comptable">📊 Comptable</SelectItem>
                {isSuperAdmin && <SelectItem value="super_admin">👑 Super Admin</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : usersData && usersData.data.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Membre</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead className="hidden md:table-cell">Statut</TableHead>
                    <TableHead className="hidden lg:table-cell">Rejoint</TableHead>
                    <TableHead className="hidden sm:table-cell">Scans</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersData.data.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs font-medium bg-muted">
                              {user.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(user.role)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={user.isActive ? 'default' : 'secondary'} className="text-xs">
                          {user.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {format(new Date(user.createdAt), 'd MMM yyyy')}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {user._count.scans}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(user)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            {user.role !== 'super_admin' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleOpenDelete(user)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Désactiver
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {usersData.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {usersData.page} sur {usersData.totalPages} ({usersData.total} membres)
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= usersData.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucun membre trouvé</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || roleFilter !== 'all'
                  ? 'Ajustez vos filtres'
                  : 'Cliquez "Ajouter un membre" pour commencer'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditUser(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editUser ? 'Modifier le membre' : 'Ajouter un membre'}</DialogTitle>
            <DialogDescription>
              {editUser
                ? 'Modifiez les informations et le rôle du membre.'
                : 'Ajoutez un nouveau membre à votre équipe.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nom complet</Label>
              <Input
                id="name"
                placeholder="Ex: Amadou Diallo"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemple.com"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            {!editUser && (
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 6 caractères"
                  value={formData.password}
                  onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="role">Rôle</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, role: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-2">
                      <span>👑</span> Admin — Accès complet
                    </span>
                  </SelectItem>
                  <SelectItem value="caisse">
                    <span className="flex items-center gap-2">
                      <span>💰</span> Caisse — Vente de tickets
                    </span>
                  </SelectItem>
                  <SelectItem value="controleur">
                    <span className="flex items-center gap-2">
                      <span>📱</span> Contrôleur — Scan & Validation
                    </span>
                  </SelectItem>
                  <SelectItem value="comptable">
                    <span className="flex items-center gap-2">
                      <span>📊</span> Comptable — Revenus & Rapports
                    </span>
                  </SelectItem>
                  {isSuperAdmin && (
                    <SelectItem value="super_admin">
                      <span className="flex items-center gap-2">
                        <span>👑</span> Super Admin
                      </span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {/* Role description */}
              {formData.role && ROLE_CONFIG[formData.role] && (
                <p className="text-xs text-muted-foreground mt-1">
                  {ROLE_CONFIG[formData.role].description}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Enregistrement...'
                : editUser
                ? 'Mettre à jour'
                : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Matrix Dialog */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Matrice des Permissions RBAC
            </DialogTitle>
            <DialogDescription>
              Visualisez les accès de chaque rôle dans le système
            </DialogDescription>
          </DialogHeader>

          <Tabs value={selectedPermRole} onValueChange={(v) => setSelectedPermRole(v as ClientRole)}>
            <TabsList className="grid grid-cols-4 w-full">
              {CLIENT_ROLES.map((role) => (
                <TabsTrigger key={role} value={role} className="text-xs">
                  {ROLE_CONFIG[role].emoji} {ROLE_CONFIG[role].labelFr.split(' ')[0]}
                </TabsTrigger>
              ))}
            </TabsList>

            {CLIENT_ROLES.map((role) => (
              <TabsContent key={role} value={role} className="mt-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={`${ROLE_CONFIG[role].bgColor} ${ROLE_CONFIG[role].color} border-transparent text-sm`}>
                      {ROLE_CONFIG[role].emoji} {ROLE_CONFIG[role].labelFr}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {PERMISSION_MATRIX[role].length} permissions
                    </span>
                  </div>

                  {/* Group permissions by category */}
                  {[
                    { title: '📊 Dashboard', perms: ['dashboard.view', 'dashboard.view_sales', 'dashboard.view_revenue'] },
                    { title: '🎫 Tickets', perms: ['tickets.create', 'tickets.view', 'tickets.edit', 'tickets.delete', 'tickets.sell'] },
                    { title: '📱 Scanner', perms: ['scanner.use', 'scanner.view_logs'] },
                    { title: '📅 Événements', perms: ['events.view', 'events.create', 'events.edit', 'events.delete', 'lines.manage'] },
                    { title: '💰 Finance', perms: ['transactions.view', 'transactions.view_own', 'transactions.export', 'reports.view', 'reports.export'] },
                    { title: '👥 Équipe', perms: ['team.view', 'team.create', 'team.edit', 'team.delete'] },
                    { title: '🖥️ Affichage', perms: ['display.view', 'display.manage'] },
                    { title: '⚙️ Paramètres', perms: ['settings.view', 'settings.edit', 'api_keys.manage', 'webhooks.manage'] },
                    { title: '📋 Logs', perms: ['logs.activity', 'logs.scan'] },
                    { title: '🗑️ Données', perms: ['data.delete'] },
                  ].map((group) => (
                    <div key={group.title}>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">{group.title}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {group.perms.map((perm) => {
                          const label = PERMISSION_LABELS[perm];
                          const has = hasPermission(role, perm as Permission);
                          return (
                            <div
                              key={perm}
                              className={`flex items-center gap-2 text-xs rounded-md px-2 py-1.5 ${
                                has
                                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-muted/50 text-muted-foreground/50 line-through'
                              }`}
                            >
                              {has ? (
                                <Check className="h-3 w-3 shrink-0" />
                              ) : (
                                <X className="h-3 w-3 shrink-0" />
                              )}
                              <span className="truncate">{label?.label || perm}</span>
                            </div>
                          );
                        })}
                      </div>
                      <Separator className="my-2" />
                    </div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Limite d&apos;utilisateurs atteinte</DialogTitle>
            <DialogDescription>
              Votre plan actuel permet {upgradeLimitInfo.limit} {upgradeLimitInfo.label}. Passez à un plan supérieur pour en ajouter davantage.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Désactiver le membre</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir désactiver{' '}
              <strong>{userToDelete?.name}</strong> ? Il ne pourra plus accéder au système.
              Cette action peut être annulée par un administrateur.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => userToDelete && deactivateMutation.mutate(userToDelete.id)}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending ? 'Désactivation...' : 'Désactiver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
