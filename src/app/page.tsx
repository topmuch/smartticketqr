'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore, type PageName } from '@/store/app-store';
import LandingPage from '@/components/landing/landing-page';
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
import ScanLogsPage from '@/components/smart-ticket/scan-logs-page';
import ReportsPage from '@/components/smart-ticket/reports-page';
import AuditLogsPage from '@/components/smart-ticket/audit-logs-page';
import ApiKeysPage from '@/components/smart-ticket/api-keys-page';
import WebhooksPage from '@/components/smart-ticket/webhooks-page';
import FraudAlertsPage from '@/components/smart-ticket/fraud-alerts-page';
import CustomDomainsPage from '@/components/smart-ticket/custom-domains-page';
import AutomationPage from '@/components/smart-ticket/automation-page';
import SupportPage from '@/components/smart-ticket/support-page';
import AffiliatesPage from '@/components/smart-ticket/affiliates-page';

const pageComponents: Record<PageName, React.ComponentType> = {
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
  'scan-logs': ScanLogsPage,
  reports: ReportsPage,
  'audit-logs': AuditLogsPage,
  'api-keys': ApiKeysPage,
  webhooks: WebhooksPage,
  'fraud-alerts': FraudAlertsPage,
  'custom-domains': CustomDomainsPage,
  'automation': AutomationPage,
  'support': SupportPage,
  'affiliates': AffiliatesPage,
};

export default function Home() {
  const { isAuthenticated, token, user } = useAuthStore();
  const { currentPage, setCurrentPage } = useAppStore();

  // Verify token validity on mount
  useEffect(() => {
    if (isAuthenticated && token) {
      fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': useAuthStore.getState().user?.organizationId || '',
        },
      })
        .then((res) => {
          if (!res.ok) {
            useAuthStore.getState().logout();
            setCurrentPage('dashboard');
          }
        })
        .catch(() => {
          // Network error, keep user logged in for offline support
        });
    }
  }, [isAuthenticated, token, setCurrentPage]);

  // Show landing page for unauthenticated visitors
  if (!isAuthenticated || !user) {
    return <LandingPage />;
  }

  // Get the current page component
  const PageComponent = pageComponents[currentPage] || Dashboard;

  return (
    <AppShell>
      <PageComponent />
    </AppShell>
  );
}
