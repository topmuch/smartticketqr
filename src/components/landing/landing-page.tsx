'use client';

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import LandingNavbar from './landing-navbar';
import LandingFooter from './landing-footer';
import HomePage from './home-page';
import TarifsPage from './tarifs-page';
import DemoPage from './demo-page';
import AproposPage from './apropos-page';
import ContactPage from './contact-page';
import ConfidentialitePage from './confidentialite-page';
import LandingLogin from './landing-login';
import LandingRegister from './landing-register';

export type LandingPageName = 'home' | 'tarifs' | 'demo' | 'apropos' | 'contact' | 'confidentialite' | 'login' | 'register';

interface LandingContextType {
  currentPage: LandingPageName;
  navigateTo: (page: LandingPageName) => void;
}

export const LandingContext = createContext<LandingContextType>({
  currentPage: 'home',
  navigateTo: () => {},
});

export const useLanding = () => useContext(LandingContext);

export default function LandingPage() {
  const [currentPage, setCurrentPage] = useState<LandingPageName>('home');
  const [showBackToTop, setShowBackToTop] = useState(false);

  const navigateTo = useCallback((page: LandingPageName) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'tarifs':
        return <TarifsPage />;
      case 'demo':
        return <DemoPage />;
      case 'apropos':
        return <AproposPage />;
      case 'contact':
        return <ContactPage />;
      case 'confidentialite':
        return <ConfidentialitePage />;
      case 'login':
        return <LandingLogin />;
      case 'register':
        return <LandingRegister />;
      default:
        return <HomePage />;
    }
  };

  const hideFooter = currentPage === 'login' || currentPage === 'register';

  return (
    <LandingContext.Provider value={{ currentPage, navigateTo }}>
      <div className="min-h-screen flex flex-col bg-white">
        <LandingNavbar />
        <main className="flex-1">
          {renderPage()}
        </main>
        {!hideFooter && <LandingFooter />}
        {showBackToTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[#007BFF] text-white shadow-lg hover:bg-[#0056b3] transition-all duration-300 flex items-center justify-center hover:scale-110"
            aria-label="Retour en haut"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
          </button>
        )}
      </div>
    </LandingContext.Provider>
  );
}
