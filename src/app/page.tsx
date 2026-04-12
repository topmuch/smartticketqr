'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore, type PageName } from '@/store/app-store';
import { useLandingStore, type LandingPage } from '@/store/landing-store';
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
import DisplayPage from '@/components/smart-ticket/display-page';
import LandingNavbar from '@/components/landing/landing-navbar';
import LandingFooter from '@/components/landing/landing-footer';
import LandingHomePage from '@/components/landing/home-page';
import LandingPricingPage from '@/components/landing/pricing-page';
import LandingDemoPage from '@/components/landing/demo-page';
import LandingAboutPage from '@/components/landing/about-page';
import LandingContactPage from '@/components/landing/contact-page';
import LandingPrivacyPage from '@/components/landing/privacy-page';
import LandingLoginPage from '@/components/landing/landing-login';
import LandingRegisterPage from '@/components/landing/landing-register';
import PublicDisplay from '@/components/smart-ticket/public-display';

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
  'scan-logs': ScanLogsPage,
  reports: ReportsPage,
  'audit-logs': AuditLogsPage,
  'api-keys': ApiKeysPage,
  webhooks: WebhooksPage,
  'fraud-alerts': FraudAlertsPage,
  'custom-domains': CustomDomainsPage,
  automation: AutomationPage,
  support: SupportPage,
  affiliates: AffiliatesPage,
  display: DisplayPage,
};

const landingComponents: Record<LandingPage, React.ComponentType> = {
  home: LandingHomePage,
  pricing: LandingPricingPage,
  demo: LandingDemoPage,
  about: LandingAboutPage,
  contact: LandingContactPage,
  privacy: LandingPrivacyPage,
  login: LandingLoginPage,
  register: LandingRegisterPage,
};

export default function Home() {
  const { isAuthenticated, token, user } = useAuthStore();
  const { currentPage, setCurrentPage } = useAppStore();
  const { currentLandingPage } = useLandingStore();

  // ── Public display kiosk mode (no auth required) ────────────────────────
  // When ?configId=xxx is present, render the public kiosk display directly
  const [publicConfigId, setPublicConfigId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const configId = params.get('configId');
    if (configId) {
      setPublicConfigId(configId);
    }
  }, []);

  // Verify token validity on mount
  useEffect(() => {
    if (isAuthenticated && token && !publicConfigId) {
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
  }, [isAuthenticated, token, setCurrentPage, publicConfigId]);

  // ── Early returns (after all hooks) ──────────────────────────────────────

  // Public kiosk mode: bypass auth entirely
  if (publicConfigId) {
    return <PublicDisplay configId={publicConfigId} />;
  }

  // Redirect to landing pages when not authenticated
  if (!isAuthenticated || !user) {
    const LandingComponent = landingComponents[currentLandingPage] || LandingHomePage;

    // Login and register pages don't show navbar/footer
    if (currentLandingPage === 'login' || currentLandingPage === 'register') {
      return <LandingComponent />;
    }

    return (
      <div className="min-h-screen flex flex-col bg-white">
        <LandingNavbar />
        <main className="flex-1">
          <LandingComponent />
        </main>
        <LandingFooter />
      </div>
    );
  }

  // Get the current page component
  const PageComponent = pageComponents[currentPage] || Dashboard;

  return (
    <AppShell>
      <PageComponent />
    </AppShell>
  );
}
