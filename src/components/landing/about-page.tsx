'use client';

import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Lightbulb, Shield, Users, Heart } from 'lucide-react';
import { useLandingStore } from '@/store/landing-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

const values = [
  {
    icon: Lightbulb,
    title: 'Innovation adapt&eacute;e',
    desc: 'Nous concevons des solutions qui r&eacute;pondent aux r&eacute;alit&eacute;s du march&eacute; africain : connectivit&eacute; limit&eacute;e, paiements mobiles, multilinguisme.',
    color: 'bg-[#007BFF]/10 text-[#007BFF]',
  },
  {
    icon: Shield,
    title: 'S&eacute;curit&eacute; et fiabilit&eacute;',
    desc: 'Chaque billet est prot&eacute;g&eacute; par une signature num&eacute;rique HMAC-SHA256. Nos serveurs garantissent une disponibilit&eacute; de 99.9%.',
    color: 'bg-[#28A745]/10 text-[#28A745]',
  },
  {
    icon: Users,
    title: 'Proxit&eacute; avec nos clients',
    desc: 'Notre &eacute;quipe est bas&eacute;e en Afrique. Nous comprenons vos d&eacute;fis et offrons un support r&eacute;actif en fran&ccedil;ais.',
    color: 'bg-[#FFC107]/20 text-[#B8860B]',
  },
  {
    icon: Heart,
    title: 'Impact social positif',
    desc: 'Nous contribuons &agrave; la formalisation de l\'&eacute;conomie informelle et &agrave; la modernisation des transports en Afrique.',
    color: 'bg-[#DC3545]/10 text-[#DC3545]',
  },
];

const stats = [
  { value: '500+', label: 'Clients actifs' },
  { value: '100 000+', label: 'Tickets g&eacute;n&eacute;r&eacute;s' },
  { value: '99.9%', label: 'Disponibilit&eacute;' },
  { value: '5', label: 'Pays couverts' },
];

const team = [
  { name: 'Moussa Ndiaye', role: 'CEO & Co-fondateur', color: 'from-[#007BFF] to-[#0056b3]' },
  { name: 'Fatou Sow', role: 'CTO', color: 'from-[#28A745] to-[#1E7E34]' },
  { name: 'Abdoulaye Diop', role: 'Directeur Commercial', color: 'from-[#FFC107] to-[#E0A800]' },
  { name: 'Aissatou Ba', role: 'Lead Design', color: 'from-[#6F42C1] to-[#5A32A3]' },
  { name: 'Cheikh Sy', role: 'Lead D&eacute;veloppeur', color: 'from-[#DC3545] to-[#C82333]' },
  { name: 'Mariama Fall', role: 'Responsable Support', color: 'from-[#20C997] to-[#17A689]' },
];

const partners = ['Wave', 'Orange Money', 'MTN Mobile Money', 'Mobicash', 'YUP', 'Free Money'];

export default function LandingAboutPage() {
  const { setCurrentLandingPage } = useLandingStore();

  const handleNav = (page: 'register' | 'contact') => {
    setCurrentLandingPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="pt-24 md:pt-28">
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#007BFF] to-[#004A99] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h1 className="text-3xl md:text-5xl font-extrabold mb-6">
              Notre mission : Digitaliser l&apos;Afrique
            </h1>
            <p className="text-lg md:text-xl text-blue-100 leading-relaxed max-w-3xl mx-auto">
              Nous croyons que la technologie peut transformer le quotidien des Africains. SmartTicketQR est n&eacute; de cette conviction : simplifier la billetterie pour les transporteurs et organisateurs du continent.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-16 md:py-20 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <FadeIn>
              <Badge variant="outline" className="border-[#007BFF]/20 text-[#007BFF] bg-[#007BFF]/5 mb-4">
                Notre histoire
              </Badge>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                N&eacute; d&apos;une id&eacute;e simple
              </h2>
              <div className="space-y-4 text-gray-600 dark:text-gray-400 leading-relaxed">
                <p>
                  En 2023, Moussa Ndiaye, alors directeur d&apos;une compagnie de bus interurbains &agrave; Dakar, perdait chaque mois plus de 15% de ses revenus &agrave; cause de la contrefa&ccedil;on de billets.
                </p>
                <p>
                  Constatant qu&apos;aucune solution existante n&apos;&eacute;tait adapt&eacute;e aux r&eacute;alit&eacute;s africaines, il a r&eacute;uni une &eacute;quipe de passionn&eacute;s pour cr&eacute;er SmartTicketQR.
                </p>
                <p>
                  Aujourd&apos;hui, plus de 500 transporteurs et organisateurs &agrave; travers 5 pays africains font confiance &agrave; notre plateforme.
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div className="aspect-square bg-gradient-to-br from-[#007BFF]/10 to-[#28A745]/10 rounded-3xl flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-20 h-20 bg-[#007BFF] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Lightbulb className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-gray-900 dark:text-gray-100 font-bold text-xl">Depuis 2023</p>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">Dakar, S&eacute;n&eacute;gal</p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 md:py-20 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Nos valeurs</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Les principes qui guident chacune de nos d&eacute;cisions.</p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => {
              const Icon = v.icon;
              return (
                <FadeIn key={i} delay={i * 0.1}>
                  <Card className="bg-white dark:bg-gray-900 border-0 hover:shadow-md transition-all duration-300 hover:-translate-y-1 h-full">
                    <CardContent className="p-6">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${v.color}`}>
                        <Icon className="w-7 h-7" />
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{v.title}</h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{v.desc}</p>
                    </CardContent>
                  </Card>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 md:py-20 bg-gradient-to-r from-[#007BFF] to-[#0056b3]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="text-center">
                  <p className="text-3xl md:text-4xl font-extrabold text-white mb-2">{s.value}</p>
                  <p className="text-blue-200 text-sm font-medium">{s.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-16 md:py-20 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-12">
            <Badge variant="outline" className="border-[#007BFF]/20 text-[#007BFF] bg-[#007BFF]/5 mb-4">
              L&apos;&eacute;quipe
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Les esprits derri&egrave;re SmartTicketQR
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Une &eacute;quipe passionn&eacute;e, bas&eacute;e en Afrique, d&eacute;di&eacute;e &agrave; votre succ&egrave;s.
            </p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.map((member, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <Card className="bg-white dark:bg-gray-900 border-0 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <CardContent className="p-6">
                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${member.color} flex items-center justify-center mx-auto mb-4`}>
                      <span className="text-white text-xl font-bold">
                        {member.name.split(' ').map((n) => n[0]).join('')}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100">{member.name}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{member.role}</p>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="py-16 md:py-20 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Nos partenaires de paiement
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
              {partners.map((p, i) => (
                <div key={i} className="px-8 py-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl text-gray-600 dark:text-gray-400 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  {p}
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Rejoignez l&apos;aventure
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
                Nous contacter
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
