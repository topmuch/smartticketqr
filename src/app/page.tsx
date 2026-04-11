'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore, type PageName } from '@/store/app-store';
import LoginPage from '@/components/smart-ticket/login-page';
import AppShell from '@/components/smart-ticket/app-shell';
import Dashboard from '@/components/smart-ticket/dashboard';
import EventsPage from '@/components/smart-ticket/events-page';
import TicketsPage from '@/components/smart-ticket/tickets-page';
import ScannerPage from '@/components/smart-ticket/scanner-page';
import UsersPage from '@/components/smart-ticket/users-page';
import TransactionsPage from '@/components/smart-ticket/transactions-page';
import ActivityLogsPage from '@/components/smart-ticket/activity-logs-page';
import SettingsPage from '@/components/smart-ticket/settings-page';
import OrganizationsPage from '@/components/smart-ticket/organizations-page';
import BillingPage from '@/components/smart-ticket/billing-page';

const pageComponents: Record<PageName, React.ComponentType> = {
  login: LoginPage,
  dashboard: Dashboard,
  events: EventsPage,
  tickets: TicketsPage,
  scanner: ScannerPage,
  users: UsersPage,
  transactions: TransactionsPage,
  'activity-logs': ActivityLogsPage,
  settings: SettingsPage,
  organizations: OrganizationsPage,
  billing: BillingPage,
};

export default function Home() {
  const { isAuthenticated, token, user } = useAuthStore();
  const { currentPage, setCurrentPage } = useAppStore();

  // Verify token validity on mount
  useEffect(() => {
    if (isAuthenticated && token) {
      // Check if token is still valid
      fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': useAuthStore.getState().user?.organizationId || '',
        },
      })
        .then((res) => {
          if (!res.ok) {
            useAuthStore.getState().logout();
            setCurrentPage('login');
          }
        })
        .catch(() => {
          // Network error, keep user logged in for offline support
        });
    }
  }, [isAuthenticated, token, setCurrentPage]);

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <LoginPage />;
  }

  // Get the current page component
  const PageComponent = pageComponents[currentPage] || Dashboard;

  return (
    <AppShell>
      <PageComponent />
    </AppShell>
  );
}
