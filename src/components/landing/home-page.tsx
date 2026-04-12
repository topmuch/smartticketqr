'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { motion, useInView } from 'framer-motion';
import {
  Ticket,
  Smartphone,
  BarChart3,
  CreditCard,
  Bus,
  Globe,
  Star,
  Play,
  Check,
  ArrowRight,
  Shield,
  Headphones,
  Clock,
} from 'lucide-react';
import { useLandingStore } from '@/store/landing-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

/* ─── Animation Helper ─── */
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

/* ─── FAQ Data ─── */
const faqItems = [
  {
    q: 'Comment fonctionne l\'essai gratuit de 7 jours\u00a0?',
    a: 'Vous avez acc\u00e8s \u00e0 toutes les fonctionnalit\u00e9s du plan Pro pendant 7 jours, sans engagement et sans carte bancaire. \u00c0 la fin, choisissez le plan qui vous convient.',
  },
  {
    q: 'Quels moyens de paiement acceptez-vous\u00a0?',
    a: 'Nous acceptons Wave, Orange Money, cartes bancaires (Visa, Mastercard) et virements bancaires pour le paiement de votre abonnement.',
  },
  {
    q: 'Le scanner fonctionne-t-il sans internet\u00a0?',
    a: 'Oui\u00a0! Le scanner est con\u00e7u pour fonctionner en mode offline. Les tickets sont v\u00e9rifi\u00e9s localement et synchronis\u00e9s d\u00e8s que la connexion revient.',
  },
  {
    q: 'Puis-je envoyer les tickets par WhatsApp\u00a0?',
    a: 'Absolument. Vos clients re\u00e7oivent directement leur ticket QR code sur WhatsApp, pr\u00eat \u00e0 \u00eatre pr\u00e9sent\u00e9 \u00e0 l\'entr\u00e9e.',
  },
  {
    q: 'Comment sont s\u00e9curis\u00e9s les tickets QR code\u00a0?',
    a: 'Chaque ticket est sign\u00e9 avec un algorithme HMAC-SHA256, rendant toute contrefa\u00e7on impossible. Nous avons aussi un syst\u00e8me anti-fraude avec g\u00e9olocalisation.',
  },
];

/* ─── Testimonials Data ─── */
const testimonials = [
  {
    name: 'Mamadou Diallo',
    title: 'Directeur - SunuBus Express',
    text: 'Depuis qu\'on utilise SmartTicketQR, nos pertes de tickets ont diminu\u00e9 de 90\u00a0%. Le syst\u00e8me est fiable et nos passagers appr\u00e9cient la simplicit\u00e9.',
    rating: 5,
  },
  {
    name: 'A\u00efssatou Ndiaye',
    title: 'Organisatrice - Dakar Live Festival',
    text: 'La gestion de nos 15\u00a0000 places est devenue un jeu d\'enfant. Les stats en temps r\u00e9el nous aident \u00e0 prendre de meilleures d\u00e9cisions.',
    rating: 5,
  },
  {
    name: 'Ibrahim Kon\u00e9',
    title: 'G\u00e9rant - Compagnie Ferry Maritime',
    text: 'L\'int\u00e9gration WhatsApp est un game changer. Nos clients re\u00e7oivent leurs billets instantan\u00e9ment. Le support est r\u00e9actif.',
    rating: 5,
  },
];

/* ─── Features Data ─── */
const features = [
  {
    icon: Ticket,
    emoji: '\ud83c\udfab',
    title: 'Tickets QR Code S\u00e9curis\u00e9s',
    desc: 'G\u00e9n\u00e9rez des tickets uniques avec QR codes crypt\u00e9s HMAC-SHA256. Chaque ticket est infalsifiable.',
  },
  {
    icon: Smartphone,
    emoji: '\ud83d\udcf1',
    title: 'Validation Mobile Offline',
    desc: 'Validez vos tickets m\u00eame sans internet. Scanner performant avec retour audio et visuel instantan\u00e9.',
  },
  {
    icon: BarChart3,
    emoji: '\ud83d\udcca',
    title: 'Statistiques Temps R\u00e9el',
    desc: 'Suivez vos ventes, remplissage et performances en direct. Tableaux de bord intuitifs.',
  },
  {
    icon: CreditCard,
    emoji: '\ud83d\udcb3',
    title: 'Paiements Wave & Orange Money',
    desc: 'Int\u00e9gration native avec les moyens de paiement locaux. Vos clients paient comme ils veulent.',
  },
  {
    icon: Bus,
    emoji: '\ud83d\ude8d',
    title: 'Multi-Usage',
    desc: 'Bus, bateau, ferry, train, concerts, festivals... Une plateforme pour tous vos besoins.',
  },
  {
    icon: Globe,
    emoji: '\ud83c\udf0d',
    title: 'Con\u00e7u pour l\'Afrique',
    desc: 'Interface en fran\u00e7ais, support FCFA, adapt\u00e9 \u00e0 la r\u00e9alit\u00e9 du terrain africain.',
  },
];

/* ─── Steps Data ─── */
const steps = [
  {
    num: 1,
    title: 'Cr\u00e9ez votre \u00e9v\u00e9nement ou trajet',
    desc: 'Configurez en quelques clics votre \u00e9v\u00e9nement, trajet de bus ou travers\u00e9e en ferry.',
    icon: Clock,
  },
  {
    num: 2,
    title: 'G\u00e9n\u00e9rez et distribuez les tickets',
    desc: 'Les tickets QR code sont g\u00e9n\u00e9r\u00e9s automatiquement et envoy\u00e9s par WhatsApp ou email.',
    icon: Ticket,
  },
  {
    num: 3,
    title: 'Validez en un scan',
    desc: 'Scannez les tickets \u00e0 l\'entr\u00e9e avec votre smartphone. Validation instantan\u00e9e, m\u00eame hors ligne.',
    icon: Smartphone,
  },
];

/* ─── Pricing Preview Data ─── */
const plans = [
  {
    name: 'Starter',
    price: '5 000',
    period: 'FCFA',
    cta: 'Commencer',
    popular: false,
  },
  {
    name: 'Pro',
    price: '15 000',
    period: 'FCFA',
    cta: 'Commencer',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Sur mesure',
    period: '',
    cta: 'Nous contacter',
    popular: false,
  },
];

/* ─── Partner Logos ─── */
const partnerLogos = ['Wave', 'Orange Money', 'Sunu Bus', 'Dakar Ferry', 'Salon Events'];

export default function HomePage() {
  const { setCurrentLandingPage } = useLandingStore();

  const handleNav = (page: 'pricing' | 'demo' | 'register' | 'contact') => {
    setCurrentLandingPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="overflow-hidden">
      {/* ═══ HERO SECTION ═══ */}
      <section className="relative pt-28 md:pt-36 lg:pt-44 pb-16 md:pb-24 bg-gradient-to-br from-[#007BFF] via-[#0062CC] to-[#004A99]">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left - Text */}
            <FadeIn className="text-center lg:text-left">
              <Badge className="bg-white/15 backdrop-blur-sm text-white/90 border-0 text-sm font-medium px-4 py-1.5 mb-6 hover:bg-white/15">
                <span className="w-2 h-2 bg-[#28A745] rounded-full animate-pulse mr-2" />
                N&deg;1 de la billetterie digitale en Afrique
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
                La Billetterie
                <br />
                <span className="text-[#FFC107]">Digitale Connect&eacute;e</span>
              </h1>
              <p className="text-lg sm:text-xl text-blue-100 mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                G&eacute;n&eacute;rez, vendez et contr&ocirc;lez vos tickets par QR code.
                <br className="hidden sm:block" />
                Simple. Rapide. S&eacute;curis&eacute;.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Button
                  size="lg"
                  onClick={() => handleNav('register')}
                  className="w-full sm:w-auto bg-white text-[#007BFF] hover:bg-gray-100 font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 text-base px-8 py-4"
                >
                  Essai Gratuit 7 jours
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleNav('demo')}
                  className="w-full sm:w-auto text-white border-2 border-white/30 bg-transparent hover:bg-white/10 hover:text-white rounded-xl text-base px-8 py-4 flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Voir la D&eacute;mo
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mt-6 text-blue-200/80 text-sm">
                <span className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-[#28A745]" />
                  Sans carte bancaire
                </span>
                <span className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-[#28A745]" />
                  Setup en 5 min
                </span>
                <span className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-[#28A745]" />
                  Support 24/7
                </span>
              </div>
            </FadeIn>

            {/* Right - Image */}
            <FadeIn delay={0.2} className="relative hidden lg:flex justify-center">
              <div className="relative">
                <div className="relative w-full max-w-md">
                  <Image
                    src="/hero-illustration.png"
                    alt="SmartTicketQR - Billetterie digitale"
                    width={448}
                    height={512}
                    className="rounded-3xl shadow-2xl"
                    priority
                  />
                </div>
                {/* Floating Badge */}
                <div
                  className="absolute -left-12 top-20 bg-white rounded-2xl shadow-xl p-4 flex items-center gap-3"
                  style={{ animation: 'bounce 3s infinite' }}
                >
                  <div className="w-10 h-10 bg-[#28A745]/10 rounded-xl flex items-center justify-center">
                    <Check className="w-5 h-5 text-[#28A745]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">Ticket Valid&eacute;</p>
                    <p className="text-xs text-gray-500">Validation instantan&eacute;e</p>
                  </div>
                </div>
                {/* Floating Stats */}
                <div
                  className="absolute -right-10 bottom-32 bg-white rounded-2xl shadow-xl p-4"
                  style={{ animation: 'bounce 4s infinite' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-4 h-4 text-[#007BFF]" />
                    <span className="text-xs font-semibold text-gray-900">Ventes du jour</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    127 <span className="text-xs text-[#28A745] font-medium">+23%</span>
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>

        {/* Wave Separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path
              d="M0 120L60 105C120 90 240 60 360 52.5C480 45 600 60 720 67.5C840 75 960 75 1080 67.5C1200 60 1320 45 1380 37.5L1440 30V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              fill="white"
            />
          </svg>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF BAR ═══ */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <p className="text-center text-sm text-gray-400 font-medium mb-8 uppercase tracking-wider">
              D&eacute;j&agrave; 500+ transporteurs et organisateurs nous font confiance
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
              {partnerLogos.map((name) => (
                <div
                  key={name}
                  className="px-6 py-3 rounded-xl bg-gray-50 text-gray-400 font-semibold text-sm hover:bg-gray-100 hover:text-gray-500 transition-colors"
                >
                  {name}
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ FEATURES SECTION ═══ */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <Badge variant="outline" className="border-[#007BFF]/20 text-[#007BFF] bg-[#007BFF]/5 mb-4">
              Fonctionnalit&eacute;s
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Une plateforme compl&egrave;te pour g&eacute;rer votre billetterie de A &agrave; Z, sp&eacute;cialement con&ccedil;ue pour le march&eacute; africain.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <FadeIn key={i} delay={i * 0.1}>
                  <Card className="bg-white border-gray-100 hover:border-[#007BFF]/20 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group h-full">
                    <CardContent className="p-6 md:p-8">
                      <div className="w-14 h-14 bg-[#007BFF]/10 rounded-2xl flex items-center justify-center text-[#007BFF] mb-5 group-hover:bg-[#007BFF] group-hover:text-white transition-all duration-300">
                        <Icon className="w-7 h-7" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                      <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                    </CardContent>
                  </Card>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <Badge variant="outline" className="border-[#28A745]/20 text-[#28A745] bg-[#28A745]/5 mb-4">
              Comment &ccedil;a marche
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              3 &eacute;tapes simples pour commencer
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              De la cr&eacute;ation &agrave; la validation, tout est simplifi&eacute;.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <FadeIn key={i} delay={i * 0.15}>
                  <div className="relative text-center">
                    {/* Connector Line */}
                    {i < steps.length - 1 && (
                      <div className="hidden md:block absolute top-12 left-[60%] w-[80%] border-t-2 border-dashed border-[#007BFF]/20" />
                    )}
                    <div className="relative z-10 w-24 h-24 bg-gradient-to-br from-[#007BFF] to-[#0056b3] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#007BFF]/25">
                      <Icon className="w-10 h-10 text-white" />
                      <span className="absolute -top-2 -right-2 w-8 h-8 bg-[#FFC107] rounded-full flex items-center justify-center text-gray-900 font-extrabold text-sm shadow-md">
                        {step.num}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                    <p className="text-gray-600 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <Badge variant="outline" className="border-[#FFC107]/30 text-[#B8860B] bg-[#FFC107]/10 mb-4">
              T&eacute;moignages
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Ce que disent nos clients
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Des transporteurs et organisateurs satisfaits &agrave; travers l&apos;Afrique.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {testimonials.map((t, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <Card className="bg-white border-gray-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full">
                  <CardContent className="p-6 md:p-8">
                    {/* Stars */}
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: t.rating }).map((_, si) => (
                        <Star key={si} className="w-5 h-5 fill-[#FFC107] text-[#FFC107]" />
                      ))}
                    </div>
                    <p className="text-gray-700 leading-relaxed mb-6 italic">&ldquo;{t.text}&rdquo;</p>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#007BFF] to-[#0056b3] flex items-center justify-center text-white font-bold text-sm">
                        {t.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                        <p className="text-gray-500 text-xs">{t.title}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING PREVIEW ═══ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <Badge variant="outline" className="border-[#007BFF]/20 text-[#007BFF] bg-[#007BFF]/5 mb-4">
              Tarifs
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Des tarifs adapt&eacute;s &agrave; votre activit&eacute;
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choisissez le plan adapt&eacute; &agrave; vos besoins. Satisfait ou rembours&eacute; 30 jours.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div
                  className={`relative rounded-2xl p-6 md:p-8 transition-all duration-300 hover:-translate-y-1 h-full flex flex-col ${
                    plan.popular
                      ? 'bg-[#007BFF] text-white shadow-xl shadow-[#007BFF]/25 scale-[1.02] md:scale-105'
                      : 'bg-white border-2 border-gray-200 hover:border-[#007BFF]/30 shadow-sm hover:shadow-lg'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#FFC107] text-gray-900 text-xs font-bold rounded-full">
                      ⭐ Le plus populaire
                    </div>
                  )}
                  <h3 className={`text-lg font-bold mb-1 ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                    {plan.name}
                  </h3>
                  <div className="mb-6 mt-4">
                    {plan.price === 'Sur mesure' ? (
                      <p className={`text-3xl font-extrabold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                        Sur mesure
                      </p>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className={`text-4xl font-extrabold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                          {plan.price}
                        </span>
                        <span className={`text-sm ${plan.popular ? 'text-blue-100' : 'text-gray-500'}`}>
                          {plan.period}/mois
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1" />
                  <Button
                    onClick={() => handleNav(plan.name === 'Enterprise' ? 'contact' : 'register')}
                    className={`w-full mt-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                      plan.popular
                        ? 'bg-white text-[#007BFF] hover:bg-gray-100 shadow-lg'
                        : plan.name === 'Enterprise'
                          ? 'bg-[#28A745] hover:bg-[#1E7E34] text-white shadow-md hover:shadow-lg'
                          : 'bg-[#007BFF] hover:bg-[#0056b3] text-white shadow-md hover:shadow-lg'
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn className="text-center mt-10">
            <button
              onClick={() => handleNav('pricing')}
              className="text-[#007BFF] font-semibold hover:underline flex items-center gap-1 mx-auto"
            >
              Voir tous les d&eacute;tails
              <ArrowRight className="w-4 h-4" />
            </button>
          </FadeIn>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <Badge variant="outline" className="border-[#007BFF]/20 text-[#007BFF] bg-[#007BFF]/5 mb-4">
              FAQ
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Questions fr&eacute;quentes
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="bg-white rounded-xl mb-3 px-6 border border-gray-200 overflow-hidden"
                >
                  <AccordionTrigger className="text-gray-900 font-semibold hover:no-underline py-5 text-left">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 leading-relaxed pb-5">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </FadeIn>
        </div>
      </section>

      {/* ═══ FOOTER CTA ═══ */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Pr&ecirc;t &agrave; digitaliser votre billetterie&thinsp;?
            </h2>
            <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
              Rejoignez 500+ professionnels qui font confiance &agrave; SmartTicketQR.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => handleNav('register')}
                className="w-full sm:w-auto bg-[#007BFF] hover:bg-[#0056b3] text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-1 text-base px-8 py-4"
              >
                Commencer l&apos;essai gratuit
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleNav('contact')}
                className="w-full sm:w-auto text-gray-300 border-gray-500 bg-transparent hover:bg-white/10 hover:text-white rounded-xl text-base px-8 py-4"
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
