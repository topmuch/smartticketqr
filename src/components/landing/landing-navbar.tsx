'use client';

import React, { useEffect, useState } from 'react';
import { QrCode, Menu } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLandingStore, type LandingPage } from '@/store/landing-store';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const navLinks: { label: string; page: LandingPage }[] = [
  { label: 'Accueil', page: 'home' },
  { label: 'Tarifs', page: 'pricing' },
  { label: 'D\u00e9mo', page: 'demo' },
  { label: '\u00c0 Propos', page: 'about' },
  { label: 'Contact', page: 'contact' },
];

export default function LandingNavbar() {
  const { currentLandingPage, setCurrentLandingPage } = useLandingStore();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNav = (page: LandingPage) => {
    setCurrentLandingPage(page);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-md'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <button
            onClick={() => handleNav('home')}
            className="flex items-center gap-2 group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#007BFF] flex items-center justify-center group-hover:scale-105 transition-transform">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">
              Smart<span className="text-[#007BFF]">Ticket</span>QR
            </span>
          </button>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                key={link.page}
                onClick={() => handleNav(link.page)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  currentLandingPage === link.page
                    ? 'text-[#007BFF] bg-[#007BFF]/10'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => handleNav('login')}
              className="text-gray-700 border-gray-300 hover:text-[#007BFF] hover:border-[#007BFF] rounded-xl"
            >
              Se connecter
            </Button>
            <Button
              onClick={() => handleNav('register')}
              className="bg-[#007BFF] hover:bg-[#0056b3] text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              Essai Gratuit
            </Button>
          </div>

          {/* Mobile Hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Menu"
              >
                <Menu className="w-6 h-6 text-gray-700" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0">
              <SheetHeader className="p-6 pb-4 border-b border-gray-100">
                <SheetTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#007BFF] flex items-center justify-center">
                    <QrCode className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    Smart<span className="text-[#007BFF]">Ticket</span>QR
                  </span>
                </SheetTitle>
              </SheetHeader>
              <div className="px-4 py-4 space-y-1 overflow-y-auto max-h-[calc(100vh-200px)]">
                {navLinks.map((link) => (
                  <button
                    key={link.page}
                    onClick={() => handleNav(link.page)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      currentLandingPage === link.page
                        ? 'text-[#007BFF] bg-[#007BFF]/10'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {link.label}
                  </button>
                ))}
              </div>
              <div className="p-4 border-t border-gray-100 space-y-2">
                <Button
                  variant="outline"
                  onClick={() => handleNav('login')}
                  className="w-full text-gray-700 border-gray-300 hover:text-[#007BFF] hover:border-[#007BFF] rounded-xl"
                >
                  Se connecter
                </Button>
                <Button
                  onClick={() => handleNav('register')}
                  className="w-full bg-[#007BFF] hover:bg-[#0056b3] text-white font-semibold rounded-xl"
                >
                  Essai Gratuit
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.header>
  );
}
