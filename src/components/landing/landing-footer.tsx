'use client';

import React from 'react';
import { useLanding, type LandingPageName } from './landing-page';

const footerSections = [
  {
    title: 'Produit',
    links: [
      { label: 'Fonctionnalites', page: 'home' as LandingPageName },
      { label: 'Tarifs', page: 'tarifs' as LandingPageName },
      { label: 'Demo', page: 'demo' as LandingPageName },
      { label: 'Integrations', page: 'home' as LandingPageName },
    ],
  },
  {
    title: 'Entreprise',
    links: [
      { label: 'A propos', page: 'apropos' as LandingPageName },
      { label: 'Blog', page: 'home' as LandingPageName },
      { label: 'Carrieres', page: 'home' as LandingPageName },
      { label: 'Partenaires', page: 'apropos' as LandingPageName },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Confidentialite', page: 'confidentialite' as LandingPageName },
      { label: 'CGU', page: 'confidentialite' as LandingPageName },
      { label: 'Mentions legales', page: 'confidentialite' as LandingPageName },
      { label: 'Securite', page: 'confidentialite' as LandingPageName },
    ],
  },
  {
    title: 'Contact',
    links: [
      { label: 'contact@smartticketqr.com', page: 'contact' as LandingPageName, isEmail: true },
      { label: '+221 33 800 00 00', page: 'contact' as LandingPageName, isPhone: true },
      { label: 'Dakar, Senegal', page: 'contact' as LandingPageName },
      { label: 'Support', page: 'contact' as LandingPageName },
    ],
  },
];

const socialLinks = [
  {
    name: 'LinkedIn',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  {
    name: 'Twitter',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    name: 'Facebook',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
];

export default function LandingFooter() {
  const { navigateTo } = useLanding();

  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* CTA Banner */}
      <div className="bg-[#007BFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4">
            Pret a digitaliser votre billetterie ?
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            Rejoignez plus de 500 transporteurs et organisateurs qui font confiance a SmartTicketQR.
            Essai gratuit de 7 jours, sans carte bancaire.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigateTo('register')}
              className="px-8 py-3.5 text-base font-semibold bg-white text-[#007BFF] rounded-xl hover:bg-gray-100 shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
            >
              Commencer gratuitement
            </button>
            <button
              onClick={() => navigateTo('contact')}
              className="px-8 py-3.5 text-base font-semibold text-white border-2 border-white/30 rounded-xl hover:bg-white/10 transition-all duration-200"
            >
              Nous contacter
            </button>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
                {section.title}
              </h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => navigateTo(link.page)}
                      className={`text-sm hover:text-white transition-colors text-left ${
                        link.isEmail ? 'text-[#007BFF]' : ''
                      }`}
                    >
                      {link.isEmail && (
                        <span className="inline mr-1">&#9993;</span>
                      )}
                      {link.isPhone && (
                        <span className="inline mr-1">&#9742;</span>
                      )}
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#007BFF] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="5" height="5" x="3" y="3" rx="1"/>
                  <rect width="5" height="5" x="16" y="3" rx="1"/>
                  <rect width="5" height="5" x="3" y="16" rx="1"/>
                  <path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
                  <path d="M21 21v.01"/>
                  <path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                  <path d="M3 12h.01"/>
                  <path d="M12 3h.01"/>
                  <path d="M12 16v.01"/>
                  <path d="M16 12h1"/>
                  <path d="M21 12v.01"/>
                  <path d="M12 21v-1"/>
                </svg>
              </div>
              <span className="text-sm text-gray-400">
                &copy; {new Date().getFullYear()} SmartTicketQR. Tous droits reserves.
              </span>
            </div>
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => (
                <button
                  key={social.name}
                  className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-[#007BFF] flex items-center justify-center transition-all duration-200 hover:scale-110"
                  aria-label={social.name}
                >
                  {social.icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
