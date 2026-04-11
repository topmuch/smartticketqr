'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { cn } from '@/lib/utils';

interface NavItem {
  id: PageName;
  label: string;
  icon: React.ElementType;
  badge?: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'events', label: 'Events & Transport', icon: Calendar },
  { id: 'tickets', label: 'Tickets', icon: Ticket, badge: 'QR' },
  { id: 'scanner', label: 'QR Scanner', icon: ScanLine },
  { id: 'users', label: 'User Management', icon: Users, roles: ['super_admin', 'admin'] },
  { id: 'transactions', label: 'Transactions', icon: Receipt, roles: ['super_admin', 'admin'] },
  { id: 'activity-logs', label: 'Activity Logs', icon: Activity, roles: ['super_admin', 'admin'] },
  { id: 'organizations', label: 'Organizations', icon: Building2, roles: ['super_admin', 'admin'] },
  { id: 'billing', label: 'Billing & Plans', icon: CreditCard, roles: ['super_admin', 'admin'] },
  { id: 'scan-logs', label: 'Scan Logs', icon: ClipboardList, roles: ['super_admin', 'admin'] },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function Sidebar() {
  const { currentPage, setCurrentPage, sidebarOpen, setSidebarOpen } = useAppStore();
  const { user, logout } = useAuthStore();
  const currentOrg = useOrgStore((s) => s.currentOrganization);
  const { theme, setTheme } = useTheme();
  const [mounted] = useState(true);

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || (user?.role && item.roles.includes(user.role))
  );

  const handleNavClick = (pageId: PageName) => {
    setCurrentPage(pageId);
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    logout();
    setCurrentPage('login');
    setSidebarOpen(false);
  };

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
            {currentOrg?.logo ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden">
                <img src={currentOrg.logo} alt={currentOrg.name} className="h-full w-full object-cover" />
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

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="flex flex-col gap-1">
            {filteredNavItems.map((item) => {
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
          </nav>
        </ScrollArea>

        {/* User section */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs font-semibold">
                {user?.name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
              <p className="text-[11px] text-muted-foreground capitalize truncate">
                {user?.role?.replace('_', ' ') || 'Unknown'}
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
              <span className="text-xs">Logout</span>
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

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

function OrgSwitcher() {
  const { organizations, currentOrganization, setCurrentOrganization, setOrganizations } = useOrgStore();
  const token = useAuthStore((s) => s.token);
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

  const handleSwitch = (org: Organization) => {
 setCurrentOrganization(org);
    // Force refresh by reloading the page data
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
            {currentOrganization?.name || 'Select Org'}
          </span>
          <span className="sm:hidden">Org</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Organizations</DropdownMenuLabel>
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
          <div className="py-2 px-2 text-xs text-muted-foreground text-center">No organizations</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Header() {
  const { currentPage, setSidebarOpen } = useAppStore();
  const { user } = useAuthStore();

  const pageTitle = navItems.find((item) => item.id === currentPage)?.label || 'Dashboard';

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

        <Button variant="ghost" size="icon" className="h-9 w-9 relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500" />
        </Button>

        <div className="hidden md:flex items-center gap-2 ml-2">
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs font-semibold">
                {user?.name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">{user?.name || 'User'}</p>
              <p className="text-[11px] text-muted-foreground capitalize leading-tight">
                {user?.role?.replace('_', ' ') || 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

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
