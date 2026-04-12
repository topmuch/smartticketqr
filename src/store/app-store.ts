import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PageName = 
  | 'login'
  | 'dashboard'
  | 'events'
  | 'tickets'
  | 'scanner'
  | 'users'
  | 'transactions'
  | 'activity-logs'
  | 'settings'
  | 'organizations'
  | 'billing'
  | 'scan-logs'
  | 'reports'
  | 'audit-logs'
  | 'api-keys'
  | 'webhooks'
  | 'custom-domains'
  | 'automation'
  | 'support'
  | 'affiliates'
  | 'fraud-alerts'
  | 'display'
  | 'ticketing-config'
  | 'passenger-board';

interface AppState {
  currentPage: PageName;
  sidebarOpen: boolean;
  setCurrentPage: (page: PageName) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentPage: 'dashboard',
      sidebarOpen: true,
      setCurrentPage: (page) => set({ currentPage: page }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'smart-ticket-qr-app',
      partialize: (state) => ({ currentPage: state.currentPage }),
    }
  )
);
