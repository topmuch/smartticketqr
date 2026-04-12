'use client';

import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Mail, Phone, MapPin, Send, Clock } from 'lucide-react';
import { useLandingStore } from '@/store/landing-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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

const contactInfo = [
  {
    icon: Mail,
    label: 'Email',
    value: 'contact@smartticketqr.com',
    href: 'mailto:contact@smartticketqr.com',
    color: 'bg-[#007BFF]/10 text-[#007BFF]',
  },
  {
    icon: Phone,
    label: 'T&eacute;l&eacute;phone',
    value: '+221 33 800 00 00',
    href: 'tel:+22133800000',
    color: 'bg-[#28A745]/10 text-[#28A745]',
  },
  {
    icon: MapPin,
    label: 'Adresse',
    value: 'Dakar, S&eacute;n&eacute;gal',
    href: null,
    color: 'bg-[#FFC107]/20 text-[#B8860B]',
  },
  {
    icon: Clock,
    label: 'Horaires',
    value: 'Lun-Ven : 8h - 18h',
    href: null,
    color: 'bg-[#6F42C1]/10 text-[#6F42C1]',
  },
];

export default function LandingContactPage() {
  const { setCurrentLandingPage } = useLandingStore();

  const handleNav = (page: 'register') => {
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
              Contactez-nous
            </h1>
            <p className="text-lg text-blue-100 max-w-2xl mx-auto">
              Notre &eacute;quipe est &agrave; votre &eacute;coute pour r&eacute;pondre &agrave; toutes vos questions et vous accompagner dans votre projet.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {contactInfo.map((info, i) => {
              const Icon = info.icon;
              return (
                <FadeIn key={i} delay={i * 0.1}>
                  <Card className="bg-white border-gray-200 hover:border-[#007BFF]/20 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full">
                    <CardContent className="p-6 text-center">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${info.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <p className="text-sm text-gray-500 mb-1">{info.label}</p>
                      {info.href ? (
                        <a
                          href={info.href}
                          className="text-sm font-semibold text-gray-900 hover:text-[#007BFF] transition-colors"
                        >
                          {info.value}
                        </a>
                      ) : (
                        <p className="text-sm font-semibold text-gray-900">{info.value}</p>
                      )}
                    </CardContent>
                  </Card>
                </FadeIn>
              );
            })}
          </div>

          {/* Contact Form */}
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <FadeIn>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                  Envoyez-nous un message
                </h2>
                <p className="text-gray-600 mb-8">
                  Remplissez le formulaire ci-dessous et nous vous r&eacute;pondrons dans les plus brefs d&eacute;lais.
                </p>
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
                      <Input placeholder="Votre nom" className="rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Pr&eacute;nom</label>
                      <Input placeholder="Votre pr&eacute;nom" className="rounded-xl" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                    <Input type="email" placeholder="votre@email.com" className="rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Sujet</label>
                    <Input placeholder="Sujet de votre message" className="rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
                    <Textarea placeholder="D&eacute;crivez votre demande..." rows={5} className="rounded-xl resize-none" />
                  </div>
                  <Button
                    size="lg"
                    className="w-full bg-[#007BFF] hover:bg-[#0056b3] text-white font-semibold rounded-xl flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Envoyer le message
                  </Button>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Questions fr&eacute;quentes</h3>
                <div className="space-y-4">
                  {[
                    {
                      q: 'Comment d&eacute;marrer avec SmartTicketQR\u00a0?',
                      a: 'Cr&eacute;ez votre compte gratuit, configurez votre premier &eacute;v&eacute;nement ou trajet, et commencez &agrave; vendre des tickets en quelques minutes.',
                    },
                    {
                      q: 'Proposez-vous une d&eacute;monstration\u00a0?',
                      a: 'Oui, nous proposons des d&eacute;monstrations personnalis&eacute;es pour les entreprises. Contactez-nous pour planifier une session.',
                    },
                    {
                      q: 'Quel est le d&eacute;lai de r&eacute;ponse\u00a0?',
                      a: 'Nous r&eacute;pondons g&eacute;n&eacute;ralement dans les 24 heures. Les clients Pro et Enterprise b&eacute;n&eacute;ficient d\'un support prioritaire.',
                    },
                  ].map((item, i) => (
                    <Card key={i} className="border-gray-200">
                      <CardContent className="p-4">
                        <p className="font-semibold text-gray-900 text-sm mb-1">{item.q}</p>
                        <p className="text-gray-600 text-sm">{item.a}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Pr&ecirc;t &agrave; commencer\u00a0?
            </h2>
            <p className="text-gray-600 mb-8">
              Rejoignez 500+ professionnels qui font d&eacute;j&agrave; confiance &agrave; SmartTicketQR.
            </p>
            <Button
              size="lg"
              onClick={() => handleNav('register')}
              className="w-full sm:w-auto bg-[#007BFF] hover:bg-[#0056b3] text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
            >
              Commencer l&apos;essai gratuit
            </Button>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
