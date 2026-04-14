'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Ticket,
  ScanLine,
  Users,
  Receipt,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
  QrCode,
  Bell,
  Moon,
  Sun,
  ChevronRight,
  Building2,
  Check,
  CreditCard,
  ClipboardList,
  BarChart3,
  ShieldCheck,
  KeyRound,
  Webhook,
  ShieldAlert,
  Globe,
  Zap,
  Headphones,
  Handshake,
  Monitor,
  MessageSquare,
  Tags,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore, type PageName } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore, type Organization } from '@/store/org-store';
import SubscriptionBanner from '@/components/smart-ticket/subscription-banner';
import { LanguageSwitcher } from '@/components/smart-ticket/language-switcher';
import { cn } from '@/lib/utils';
import {
  type ClientRole,
  type NavPage,
  getNavForRole,
  getRoleConfig,
  canAccessPage,
  ROLE_CONFIG,
} from '@/lib/permissions';

// ── Types ───────────────────────────────────────────────────────────────────

type RoleScope = 'super_admin' | 'client';

interface NavItem {
  id: PageName;
  label: string;
  icon: LucideIcon;
  badge?: string;
  scope: RoleScope;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// ── Icon mapping for RBAC nav pages ────────────────────────────────────────

const PAGE_ICON_MAP: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  events: Calendar,
  tickets: Ticket,
  scanner: ScanLine,
  display: Monitor,
  users: Users,
  transactions: Receipt,
  reports: BarChart3,
  'scan-logs': ClipboardList,
  settings: Settings,
  'activity-logs': Activity,
  'api-keys': KeyRound,
  webhooks: Webhook,
  'ticketing-config': Tags,
};

// ── Super Admin Navigation (unchanged) ─────────────────────────────────────

const SUPER_ADMIN_NAV: NavGroup[] = [
  {
    title: 'Core Platform',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, scope: 'super_admin' },
      { id: 'organizations', label: 'Organizations', icon: Building2, scope: 'super_admin' },
      { id: 'users', label: 'User Management', icon: Users, scope: 'super_admin' },
      { id: 'billing', label: 'Billing & Plans', icon: CreditCard, scope: 'super_admin' },
      { id: 'transactions', label: 'Transactions', icon: Receipt, scope: 'super_admin' },
    ],
  },
  {
    title: 'Security & System',
    items: [
      { id: 'api-keys', label: 'API Keys', icon: KeyRound, scope: 'super_admin' },
      { id: 'webhooks', label: 'Webhooks', icon: Webhook, scope: 'super_admin' },
      { id: 'fraud-alerts', label: 'Fraud Alerts', icon: ShieldAlert, scope: 'super_admin' },
      { id: 'audit-logs', label: 'Audit Logs', icon: ShieldCheck, scope: 'super_admin' },
      { id: 'activity-logs', label: 'Activity Logs', icon: Activity, scope: 'super_admin' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, scope: 'super_admin' },
      { id: 'scan-logs', label: 'Scan Logs', icon: ClipboardList, scope: 'super_admin' },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      { id: 'custom-domains', label: 'Custom Domains', icon: Globe, scope: 'super_admin' },
      { id: 'automation', label: 'Automation', icon: Zap, scope: 'super_admin' },
      { id: 'display', label: 'Dynamic Display', icon: Monitor, scope: 'super_admin' },
    ],
  },
  {
    title: 'Growth',
    items: [
      { id: 'affiliates', label: 'Affiliates', icon: Handshake, scope: 'super_admin' },
      { id: 'support', label: 'Support', icon: Headphones, scope: 'super_admin' },
    ],
  },
];

// ── Client RBAC Navigation ──────────────────────────────────────────────────
// Builds dynamic navigation based on the user's client role

function buildClientNav(role: ClientRole): NavGroup[] {
  const navItems = getNavForRole(role);

  // Group items by section
  const sectionMap = new Map<string, NavItem[]>();
  for (const item of navItems) {
    const icon = PAGE_ICON_MAP[item.id] || LayoutDashboard;
    const badge = item.id === 'tickets' ? 'QR' : undefined;
    const navItem: NavItem = {
      id: item.id as PageName,
      label: item.label,
      icon,
      badge,
      scope: 'client',
    };

    const existing = sectionMap.get(item.section);
    if (existing) {
      existing.push(navItem);
    } else {
      sectionMap.set(item.section, [navItem]);
    }
  }

  const groups: NavGroup[] = [];
  for (const [title, items] of sectionMap) {
    groups.push({ title, items });
  }

  return groups;
}

// ── Flat nav lookup (for header title) ─────────────────────────────────────

const SUPER_ADMIN_FLAT: NavItem[] = SUPER_ADMIN_NAV.flatMap((g) => g.items);

function getPageLabel(pageId: PageName, userRole?: string): string {
  // Check super admin nav first
  const saMatch = SUPER_ADMIN_FLAT.find((item) => item.id === pageId);
  if (saMatch) return saMatch.label;

  // Check RBAC client nav
  if (userRole && userRole !== 'super_admin') {
    const navItems = getNavForRole(userRole as ClientRole);
    const rbacMatch = navItems.find((item) => item.id === pageId);
    if (rbacMatch) return rbacMatch.label;
  }

  return 'Dashboard';
}

// ── Sidebar Component ──────────────────────────────────────────────────────

function Sidebar() {
  const { currentPage, setCurrentPage, sidebarOpen, setSidebarOpen } = useAppStore();
  const { user, logout } = useAuthStore();
  const currentOrg = useOrgStore((s) => s.currentOrganization);
  const { theme, setTheme } = useTheme();
  const [mounted] = useState(true);

  const userRole = user?.role || 'caisse';
  const isSuperAdmin = userRole === 'super_admin';

  // Build navigation based on role
  const navGroups = useMemo(() => {
    if (isSuperAdmin) return SUPER_ADMIN_NAV;
    if (userRole in getRoleConfig(userRole)) {
      return buildClientNav(userRole as ClientRole);
    }
    // Fallback: show minimal nav for unknown roles
    return buildClientNav('caisse');
  }, [isSuperAdmin, userRole]);

  // Safety: if current page isn't accessible, redirect to first accessible page
  const accessiblePages = navGroups.flatMap((g) => g.items.map((i) => i.id));
  useEffect(() => {
    if (!accessiblePages.includes(currentPage)) {
      const firstPage = accessiblePages[0] || 'dashboard';
      setCurrentPage(firstPage);
    }
  }, [currentPage, accessiblePages, setCurrentPage]);

  const handleNavClick = (pageId: PageName) => {
    setCurrentPage(pageId);
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    logout();
    setCurrentPage('login');
    setSidebarOpen(false);
  };

  // Get role display info
  const roleInfo = getRoleConfig(userRole);

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 flex h-full w-72 flex-col border-r border-border bg-card transition-transform duration-300 ease-in-out lg:relative lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          <div className="flex items-center gap-3">
            {currentOrg?.logoUrl ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden">
                <img src={currentOrg.logoUrl} alt={currentOrg.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: currentOrg?.primaryColor || '#059669' }}
              >
                <QrCode className="h-5 w-5" />
              </div>
            )}
            <div>
              <h1 className="text-base font-bold tracking-tight">SmartTicketQR</h1>
              <p className="text-[10px] text-muted-foreground -mt-0.5 truncate max-w-[120px]">
                {currentOrg?.name || 'Ticket Management'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Role badge with RBAC info */}
        <div className="px-4 pt-3 pb-1">
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-semibold px-2 py-0.5 w-full justify-center gap-1',
              isSuperAdmin
                ? 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-300'
                : `${roleInfo.bgColor} ${roleInfo.color} border-transparent`
            )}
          >
            <span>{roleInfo.emoji}</span>
            <span>{isSuperAdmin ? 'Super Admin - Plateforme' : roleInfo.labelFr}</span>
          </Badge>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-2">
          <nav className="flex flex-col gap-1">
            {navGroups.map((group) => (
              <React.Fragment key={group.title}>
                <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.title}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <TooltipProvider key={item.id} delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleNavClick(item.id)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                              isActive
                                ? 'shadow-sm'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            )}
                            style={isActive ? {
                              backgroundColor: 'hsl(var(--org-primary) / 0.08)',
                              color: 'var(--org-primary, hsl(var(--primary)))',
                            } : undefined}
                          >
                            <Icon
                              className={cn(
                                'h-5 w-5 shrink-0',
                                isActive
                                  ? ''
                                  : 'text-muted-foreground'
                              )}
                              style={isActive ? { color: 'var(--org-primary, hsl(var(--primary)))' } : undefined}
                            />
                            <span className="flex-1 text-left">{item.label}</span>
                            {item.badge && (
                              <Badge
                                variant="secondary"
                                className="h-5 px-1.5 text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                              >
                                {item.badge}
                              </Badge>
                            )}
                            {isActive && (
                              <ChevronRight className="h-4 w-4" style={{ color: 'var(--org-primary, hsl(var(--primary)))' }} />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="lg:hidden">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </React.Fragment>
            ))}

            {/* Support button for Admin Client */}
            {!isSuperAdmin && (
              <React.Fragment>
                <div className="my-2" />
                <Button
                  variant="outline"
                  className="w-full gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setCurrentPage('support');
                    setSidebarOpen(false);
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-sm">Contacter le support</span>
                </Button>
              </React.Fragment>
            )}
          </nav>
        </ScrollArea>

        {/* User section */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs font-semibold" style={{
                backgroundColor: isSuperAdmin ? undefined : 'var(--org-primary, #059669)20',
                color: isSuperAdmin ? undefined : 'var(--org-primary, #059669)',
              }}>
                {user?.name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {isSuperAdmin ? 'Super Admin' : `${roleInfo.emoji} ${roleInfo.labelFr}`}
              </p>
            </div>
          </div>

          {/* Theme toggle and logout */}
          <div className="flex items-center gap-1 mt-2 px-1">
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 flex-1 gap-2 text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              <span className="text-xs">Déconnexion</span>
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Plan Badge ─────────────────────────────────────────────────────────────

function getPlanBadge(plan: Organization['subscriptionPlan']) {
  switch (plan) {
    case 'starter':
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-transparent">starter</Badge>;
    case 'pro':
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">pro</Badge>;
    case 'enterprise':
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">enterprise</Badge>;
    default:
      return null;
  }
}

// ── Organization Switcher ──────────────────────────────────────────────────

function OrgSwitcher() {
  const { organizations, currentOrganization, setCurrentOrganization, setOrganizations } = useOrgStore();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (token && organizations.length === 0 && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetch('/api/organizations', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Failed to fetch organizations');
        })
        .then((data) => {
          const orgs: Organization[] = Array.isArray(data) ? data : data.data || [];
          setOrganizations(orgs);
        })
        .catch(() => {
          // Silent fail
        });
    }
  }, [token, organizations.length, setOrganizations]);

  // Only Super Admin sees the org switcher
  if (user?.role !== 'super_admin') return null;

  const handleSwitch = (org: Organization) => {
    setCurrentOrganization(org);
    window.location.reload();
  };

  if (organizations.length <= 1 && !currentOrganization) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
          {currentOrganization?.primaryColor && (
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: currentOrganization.primaryColor }}
            />
          )}
          {!currentOrganization?.primaryColor && (
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="hidden sm:inline max-w-[120px] truncate">
            {currentOrganization?.name || 'Sélectionner'}
          </span>
          <span className="sm:hidden">Org</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Organisations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitch(org)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: org.primaryColor || '#10b981' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{org.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{org.slug}</p>
            </div>
            {currentOrganization?.id === org.id && (
              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            )}
            {getPlanBadge(org.subscriptionPlan)}
          </DropdownMenuItem>
        ))}
        {organizations.length === 0 && (
          <div className="py-2 px-2 text-xs text-muted-foreground text-center">Aucune organisation</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────

function Header() {
  const { currentPage, setSidebarOpen } = useAppStore();
  const { user } = useAuthStore();

  const userRole = user?.role || 'caisse';
  const roleInfo = getRoleConfig(userRole);
  const pageTitle = getPageLabel(currentPage, userRole);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card/80 backdrop-blur-sm px-4 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden h-9 w-9"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1">
        <h2 className="text-lg font-semibold">{pageTitle}</h2>
      </div>

      <div className="flex items-center gap-2">
        <OrgSwitcher />
        <LanguageSwitcher />

        <Button variant="ghost" size="icon" className="h-9 w-9 relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500" />
        </Button>

        <div className="hidden md:flex items-center gap-2 ml-2">
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs font-semibold">
                {user?.name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">{user?.name || 'User'}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {userRole === 'super_admin' ? 'Super Admin' : `${roleInfo.emoji} ${roleInfo.labelFr}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

// ── App Shell ──────────────────────────────────────────────────────────────

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const currentOrg = useOrgStore((s) => s.currentOrganization);

  return (
    <div
      className="flex h-screen overflow-hidden bg-background"
      style={{ '--org-primary': currentOrg?.primaryColor || '#059669' } as React.CSSProperties}
    >
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            <SubscriptionBanner />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
