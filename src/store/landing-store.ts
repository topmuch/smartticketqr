import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LandingPage =
  | 'home'
  | 'pricing'
  | 'demo'
  | 'about'
  | 'contact'
  | 'privacy'
  | 'login'
  | 'register';

interface LandingState {
  currentLandingPage: LandingPage;
  setCurrentLandingPage: (page: LandingPage) => void;
}

export const useLandingStore = create<LandingState>()(
  persist(
    (set) => ({
      currentLandingPage: 'home',
      setCurrentLandingPage: (page) => set({ currentLandingPage: page }),
    }),
    {
      name: 'smart-ticket-qr-landing',
    }
  )
);
