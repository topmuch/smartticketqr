'use client';

import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

function FadeIn({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPrivacyPage() {
  return (
    <div className="pt-24 md:pt-28">
      {/* Header */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-[#007BFF] to-[#0056b3] text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <Shield className="w-12 h-12 mx-auto mb-4 text-white" />
            <h1 className="text-3xl md:text-5xl font-extrabold mb-4">
              Politique de Confidentialit&eacute;
            </h1>
            <p className="text-lg text-blue-100 max-w-2xl mx-auto">
              Derni&egrave;re mise &agrave; jour : 1er janvier 2025
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 md:py-20 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <FadeIn>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">1. Collecte des donn&eacute;es</h2>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  SmartTicketQR collecte les donn&eacute;es personnelles n&eacute;cessaires au bon fonctionnement de ses services, notamment : nom, pr&eacute;nom, adresse email, num&eacute;ro de t&eacute;l&eacute;phone, et informations de facturation. Ces donn&eacute;es sont collect&eacute;es lors de l&apos;inscription et de l&apos;utilisation de la plateforme.
                </p>
              </div>
            </FadeIn>

            <FadeIn>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">2. Utilisation des donn&eacute;es</h2>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Vos donn&eacute;es sont utilis&eacute;es pour : fournir et am&eacute;liorer nos services, g&eacute;rer votre compte, traiter les paiements, envoyer des notifications importantes, et assurer le support client. Nous ne vendons jamais vos donn&eacute;es &agrave; des tiers.
                </p>
              </div>
            </FadeIn>

            <FadeIn>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">3. S&eacute;curit&eacute; des donn&eacute;es</h2>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Nous mettons en &oelig;uvre des mesures de s&eacute;curit&eacute; avanc&eacute;es pour prot&eacute;ger vos donn&eacute;es : chiffrement AES-256 au repos, HTTPS pour les communications, contr&ocirc;le d&apos;acc&egrave;s strict, et audits de s&eacute;curit&eacute; r&eacute;guliers. Nos serveurs sont h&eacute;berg&eacute;s dans des datacenters certifi&eacute;s ISO 27001.
                </p>
              </div>
            </FadeIn>

            <FadeIn>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">4. Cookies</h2>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Nous utilisons des cookies essentiels au fonctionnement de la plateforme et des cookies analytiques pour am&eacute;liorer votre exp&eacute;rience. Vous pouvez g&eacute;rer vos pr&eacute;f&eacute;rences de cookies dans les param&egrave;tres de votre navigateur.
                </p>
              </div>
            </FadeIn>

            <FadeIn>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">5. Vos droits</h2>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Conform&eacute;ment au RGPD et &agrave; la loi s&eacute;n&eacute;galaise sur la protection des donn&eacute;es personnelles, vous disposez d&apos;un droit d&apos;acc&egrave;s, de rectification, de suppression et de portabilit&eacute; de vos donn&eacute;es. Pour exercer ces droits, contactez-nous &agrave; privacy@smartticketqr.com.
                </p>
              </div>
            </FadeIn>

            <FadeIn>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">6. Contact</h2>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Pour toute question relative &agrave; cette politique de confidentialit&eacute;, contactez notre D&eacute;l&eacute;gu&eacute; &agrave; la Protection des Donn&eacute;es &agrave; : privacy@smartticketqr.com ou SmartTicketQR, Dakar, S&eacute;n&eacute;gal.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>
    </div>
  );
}
