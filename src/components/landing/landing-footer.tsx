'use client';

import React from 'react';
import { QrCode, Linkedin, Twitter, Facebook, Mail, Phone, MapPin } from 'lucide-react';
import { useLandingStore, type LandingPage } from '@/store/landing-store';
import { Button } from '@/components/ui/button';

const footerSections = [
  {
    title: 'Produit',
    links: [
      { label: 'Fonctionnalit\u00e9s', page: 'home' as LandingPage },
      { label: 'Tarifs', page: 'pricing' as LandingPage },
      { label: 'D\u00e9mo', page: 'demo' as LandingPage },
      { label: 'S\u00e9curit\u00e9', page: 'about' as LandingPage },
    ],
  },
  {
    title: 'Entreprise',
    links: [
      { label: '\u00c0 Propos', page: 'about' as LandingPage },
      { label: 'Carri\u00e8res', page: 'about' as LandingPage },
      { label: 'Blog', page: 'about' as LandingPage },
      { label: 'Partenaires', page: 'about' as LandingPage },
    ],
  },
  {
    title: 'L\u00e9gal',
    links: [
      { label: 'CGU', page: 'privacy' as LandingPage },
      { label: 'Confidentialit\u00e9', page: 'privacy' as LandingPage },
      { label: 'Cookies', page: 'privacy' as LandingPage },
    ],
  },
];

const socialLinks = [
  { name: 'LinkedIn', icon: Linkedin },
  { name: 'Twitter', icon: Twitter },
  { name: 'Facebook', icon: Facebook },
];

export default function LandingFooter() {
  const { setCurrentLandingPage } = useLandingStore();

  const handleNav = (page: LandingPage) => {
    setCurrentLandingPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#1a1a2e] text-gray-300">
      {/* CTA Banner */}
      <div className="bg-gradient-to-r from-[#007BFF] to-[#0056b3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4">
            Pr&ecirc;t &agrave; digitaliser votre billetterie&thinsp;?
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            Rejoignez 500+ professionnels qui font confiance &agrave; SmartTicketQR.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={() => handleNav('register')}
              size="lg"
              className="bg-white text-[#007BFF] hover:bg-gray-100 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
            >
              Commencer l&apos;essai gratuit
            </Button>
            <Button
              onClick={() => handleNav('contact')}
              variant="outline"
              size="lg"
              className="text-white border-white/30 bg-transparent hover:bg-white/10 hover:text-white rounded-xl"
            >
              Nous contacter
            </Button>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Product Columns */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
                {section.title}
              </h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => handleNav(link.page)}
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact Column */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
              Contact
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="mailto:contact@smartticketqr.com"
                  className="flex items-center gap-2 text-sm text-[#007BFF] hover:text-[#4d9fff] transition-colors"
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  contact@smartticketqr.com
                </a>
              </li>
              <li>
                <a
                  href="tel:+22133800000"
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  +221 33 800 00 00
                </a>
              </li>
              <li>
                <span className="flex items-center gap-2 text-sm text-gray-400">
                  <MapPin className="w-4 h-4 shrink-0" />
                  Dakar, S&eacute;n&eacute;gal
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#007BFF] flex items-center justify-center">
                <QrCode className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm text-gray-400">
                &copy; 2025 SmartTicketQR. Tous droits r&eacute;serv&eacute;s.
              </span>
            </div>
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <button
                    key={social.name}
                    className="w-9 h-9 rounded-lg bg-white/5 hover:bg-[#007BFF] flex items-center justify-center transition-all duration-200 hover:scale-110"
                    aria-label={social.name}
                  >
                    <Icon className="w-4 h-4 text-gray-400 hover:text-white" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
