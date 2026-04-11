import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  email?: string | null;
  phone?: string | null;
  primaryColor?: string | null;
  subscriptionPlan: 'starter' | 'pro' | 'enterprise';
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'cancelled';
  memberCount?: number;
  eventCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface OrgState {
  organizations: Organization[];
  currentOrganization: Organization | null;
  setOrganizations: (orgs: Organization[]) => void;
  setCurrentOrganization: (org: Organization | null) => void;
  addOrganization: (org: Organization) => void;
  updateOrganization: (id: string, data: Partial<Organization>) => void;
  removeOrganization: (id: string) => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      organizations: [],
      currentOrganization: null,
      setOrganizations: (orgs) =>
        set((state) => ({
          organizations: orgs,
          currentOrganization: state.currentOrganization
            ? orgs.find((o) => o.id === state.currentOrganization!.id) || orgs[0] || null
            : orgs[0] || null,
        })),
      setCurrentOrganization: (org) => set({ currentOrganization: org }),
      addOrganization: (org) =>
        set((state) => {
          const newOrgs = [...state.organizations, org];
          return {
            organizations: newOrgs,
            currentOrganization: state.currentOrganization || org,
          };
        }),
      updateOrganization: (id, data) =>
        set((state) => {
          const newOrgs = state.organizations.map((o) =>
            o.id === id ? { ...o, ...data } : o
          );
          return {
            organizations: newOrgs,
            currentOrganization:
              state.currentOrganization?.id === id
                ? { ...state.currentOrganization, ...data }
                : state.currentOrganization,
          };
        }),
      removeOrganization: (id) =>
        set((state) => {
          const newOrgs = state.organizations.filter((o) => o.id !== id);
          return {
            organizations: newOrgs,
            currentOrganization:
              state.currentOrganization?.id === id
                ? newOrgs[0] || null
                : state.currentOrganization,
          };
        }),
    }),
    {
      name: 'smart-ticket-qr-org',
    }
  )
);
