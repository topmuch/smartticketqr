'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { motion, useInView } from 'framer-motion';
import {
  BarChart3,
  Smartphone,
  MessageSquare,
  FileText,
  Printer,
  CalendarDays,
} from 'lucide-react';
import { useLandingStore } from '@/store/landing-store';
import { Button } from '@/components/ui/button';
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

const screenshots = [
  {
    title: 'Tableau de bord',
    desc: "Vue d'ensemble de vos ventes, tickets et revenus en temps r\u00e9el.",
    icon: BarChart3,
    image: '/screenshots/dashboard.png',
  },
  {
    title: 'Scanner mobile',
    desc: "Validation instantan\u00e9e des billets via la cam\u00e9ra de votre smartphone.",
    icon: Smartphone,
    image: '/screenshots/scanner-mobile.png',
  },
  {
    title: 'Ticket WhatsApp',
    desc: 'Livraison automatique des billets par WhatsApp.',
    icon: MessageSquare,
    image: '/screenshots/whatsapp-ticket.png',
  },
  {
    title: 'Rapports d\u00e9taill\u00e9s',
    desc: 'Exportez vos statistiques en PDF ou CSV.',
    icon: FileText,
    image: '/screenshots/reports-stats.png',
  },
  {
    title: 'Impression thermique',
    desc: 'Imprimez directement des billets sur imprimantes thermiques.',
    icon: Printer,
    image: null,
    gradient: 'from-[#DC3545] to-[#C82333]',
  },
  {
    title: "Gestion des \u00e9v\u00e9nements",
    desc: "Cr\u00e9ez et g\u00e9rez vos trajets, concerts et \u00e9v\u00e9nements.",
    icon: CalendarDays,
    image: null,
    gradient: 'from-[#6F42C1] to-[#5A32A3]',
  },
];

export default function LandingDemoPage() {
  const { setCurrentLandingPage } = useLandingStore();

  const handleNav = (page: 'register' | 'contact') => {
    setCurrentLandingPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="pt-24 md:pt-28">
      {/* Header */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-[#007BFF] to-[#0056b3] text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <h1 className="text-3xl md:text-5xl font-extrabold mb-4">
              D&eacute;couvrez SmartTicketQR en action
            </h1>
            <p className="text-lg text-blue-100 max-w-2xl mx-auto">
              Regardez comment notre plateforme simplifie la gestion de billetterie pour les transporteurs et organisateurs en Afrique.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Video Demo */}
      <section className="py-16 md:py-20 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="relative bg-gray-900 rounded-3xl overflow-hidden shadow-2xl aspect-video flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-[#007BFF]/20 to-[#004A99]/20" />
              <div className="relative text-center">
                <button className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl hover:scale-110 transition-transform group">
                  <div className="ml-1 w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-l-[20px] border-l-[#007BFF] group-hover:scale-110 transition-transform" />
                </button>
                <p className="text-white text-lg font-semibold">Voir la d&eacute;monstration vid&eacute;o</p>
                <p className="text-gray-400 text-sm mt-1">Dur&eacute;e : 3 min</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Screenshots Gallery */}
      <section className="py-16 md:py-20 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Aper&ccedil;u de la plateforme
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center max-w-2xl mx-auto">
              D&eacute;couvrez les &eacute;crans principaux de SmartTicketQR.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {screenshots.map((ss, i) => {
              const Icon = ss.icon;
              return (
                <FadeIn key={i} delay={i * 0.1}>
                  <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
                    {ss.image ? (
                      <div className="aspect-[4/3] relative overflow-hidden">
                        <Image
                          src={ss.image}
                          alt={ss.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    ) : (
                      <div className={`aspect-[4/3] bg-gradient-to-br ${ss.gradient || 'from-gray-400 to-gray-600'} flex items-center justify-center relative`}>
                        <Icon className="w-16 h-16 text-white/90" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">{ss.title}</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{ss.desc}</p>
                    </CardContent>
                  </Card>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Pr&ecirc;t &agrave; essayer SmartTicketQR&thinsp;?
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Commencez votre essai gratuit de 7 jours. Aucune carte bancaire requise.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => handleNav('register')}
                className="w-full sm:w-auto bg-[#007BFF] hover:bg-[#0056b3] text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
              >
                Essayer gratuitement
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleNav('contact')}
                className="w-full sm:w-auto border-gray-300 dark:border-gray-600 hover:border-[#007BFF] hover:text-[#007BFF] rounded-xl"
              >
                Demander une d&eacute;mo personnalis&eacute;e
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
