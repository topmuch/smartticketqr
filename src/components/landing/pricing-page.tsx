'use client';

import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Zap,
  Star,
  Building2,
  Check,
  X,
  Shield,
  Lock,
  FileCheck,
  ArrowRight,
} from 'lucide-react';
import { useLandingStore } from '@/store/landing-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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

/* ─── Plan Feature ─── */
interface PlanFeature {
  label: string;
  included: boolean;
}

/* ─── Plans Data ─── */
const plans = [
  {
    name: 'Starter',
    icon: Zap,
    monthlyPrice: '5 000',
    annualPrice: '4 000',
    period: 'FCFA/mois',
    desc: 'Id&eacute;al pour les petites structures',
    features: [
      { label: '100 tickets/mois', included: true },
      { label: '2 utilisateurs', included: true },
      { label: 'Validation QR code', included: true },
      { label: 'Statistiques basiques', included: true },
      { label: 'Support email', included: true },
      { label: 'Validation offline', included: false },
      { label: 'Envoi WhatsApp', included: false },
      { label: 'API acc&egrave;s', included: false },
    ],
    cta: "Commencer l'essai gratuit",
    popular: false,
    btnStyle: 'outline' as const,
  },
  {
    name: 'Pro',
    icon: Star,
    monthlyPrice: '15 000',
    annualPrice: '12 000',
    period: 'FCFA/mois',
    desc: 'Pour les entreprises en croissance',
    features: [
      { label: '1 000 tickets/mois', included: true },
      { label: '10 utilisateurs', included: true },
      { label: 'Validation QR code', included: true },
      { label: 'Validation offline', included: true },
      { label: 'Statistiques avanc&eacute;es', included: true },
      { label: 'Envoi WhatsApp automatique', included: true },
      { label: 'Export CSV & PDF', included: true },
      { label: 'Support prioritaire', included: true },
      { label: 'API acc&egrave;s', included: false },
      { label: 'White-label', included: false },
    ],
    cta: "Commencer l'essai gratuit",
    popular: true,
    btnStyle: 'filled' as const,
  },
  {
    name: 'Enterprise',
    icon: Building2,
    monthlyPrice: '',
    annualPrice: '',
    period: '',
    desc: 'Pour les grandes organisations',
    features: [
      { label: 'Tickets illimit&eacute;s', included: true },
      { label: 'Utilisateurs illimit&eacute;s', included: true },
      { label: 'API REST acc&egrave;s', included: true },
      { label: 'White-label (votre marque)', included: true },
      { label: 'Account manager d&eacute;di&eacute;', included: true },
      { label: 'SLA garanti 99.9%', included: true },
      { label: 'Formation personnalis&eacute;e', included: true },
      { label: 'Support 24/7', included: true },
    ],
    cta: 'Nous contacter',
    popular: false,
    btnStyle: 'green' as const,
  },
];

/* ─── Comparison Table ─── */
const comparisonRows = [
  { label: 'Tickets/mois', starter: '100', pro: '1 000', enterprise: 'Illimit&eacute;' },
  { label: 'Utilisateurs', starter: '2', pro: '10', enterprise: 'Illimit&eacute;' },
  { label: 'Validation QR', starter: true, pro: true, enterprise: true },
  { label: 'Mode Offline', starter: false, pro: true, enterprise: true },
  { label: 'Statistiques', starter: 'Basiques', pro: 'Avanc&eacute;es', enterprise: 'Avanc&eacute;es' },
  { label: 'Envoi WhatsApp', starter: false, pro: true, enterprise: true },
  { label: 'Export donn&eacute;es', starter: false, pro: true, enterprise: true },
  { label: 'API REST', starter: false, pro: false, enterprise: true },
  { label: 'White-label', starter: false, pro: false, enterprise: true },
  { label: 'SLA garanti', starter: false, pro: false, enterprise: '99.9%' },
  { label: 'Support', starter: 'Email', pro: 'Prioritaire', enterprise: '24/7 D&eacute;di&eacute;' },
];

/* ─── FAQ Data ─── */
const faqItems = [
  {
    q: 'Puis-je changer de plan &agrave; tout moment\u00a0?',
    a: 'Oui, vous pouvez upgrader ou downgrader votre plan &agrave; tout moment. La diff&eacute;rence sera calcul&eacute;e au prorata.',
  },
  {
    q: 'Y a-t-il des frais suppl&eacute;mentaires\u00a0?',
    a: 'Non, nos prix sont tous inclus. Pas de frais de transaction, pas de frais d\'installation, pas de frais cach&eacute;s.',
  },
  {
    q: 'Comment fonctionne la garantie satisfait ou rembours&eacute;\u00a0?',
    a: 'Si vous n\'&ecirc;tes pas satisfait dans les 30 premiers jours, nous vous remboursons int&eacute;gralement, sans question.',
  },
];

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="w-5 h-5 text-[#28A745] mx-auto" />
    ) : (
      <X className="w-5 h-5 text-gray-300 mx-auto" />
    );
  }
  return <span className="font-medium text-sm">{value}</span>;
}

export default function PricingPage() {
  const { setCurrentLandingPage } = useLandingStore();
  const [annual, setAnnual] = React.useState(false);

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
              Des tarifs simples et transparents
            </h1>
            <p className="text-lg text-blue-100 max-w-2xl mx-auto mb-10">
              Pas de frais cach&eacute;s. Changez de plan &agrave; tout moment.
            </p>

            {/* Toggle */}
            <div className="flex items-center justify-center gap-4">
              <span className={`text-sm font-medium transition-colors ${!annual ? 'text-white' : 'text-blue-200'}`}>
                Mensuel
              </span>
              <Switch
                checked={annual}
                onCheckedChange={setAnnual}
                className="data-[state=checked]:bg-[#28A745] data-[state=unchecked]:bg-white/30 scale-125"
              />
              <span className={`text-sm font-medium transition-colors ${annual ? 'text-white' : 'text-blue-200'}`}>
                Annuel{' '}
                <Badge className="bg-[#FFC107] text-gray-900 border-0 ml-1 hover:bg-[#FFC107]">
                  -20%
                </Badge>
              </span>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16 md:py-20 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6 md:gap-8 items-start">
            {plans.map((plan, i) => {
              const Icon = plan.icon;
              const price = annual ? plan.annualPrice : plan.monthlyPrice;
              return (
                <FadeIn key={i} delay={i * 0.1}>
                  <Card
                    className={`relative transition-all duration-300 hover:-translate-y-1 h-full ${
                      plan.popular
                        ? 'bg-[#007BFF] text-white shadow-xl shadow-[#007BFF]/25 scale-[1.02] md:scale-105 border-0'
                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-[#007BFF]/30 hover:shadow-lg'
                    }`}
                  >
                    <CardContent className="p-6 md:p-8">
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#FFC107] text-gray-900 text-xs font-bold rounded-full">
                          ⭐ Le plus populaire
                        </div>
                      )}
                      {/* Icon & Name */}
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            plan.popular ? 'bg-white/20' : 'bg-[#007BFF]/10'
                          }`}
                        >
                          <Icon
                            className={`w-5 h-5 ${plan.popular ? 'text-white' : 'text-[#007BFF]'}`}
                          />
                        </div>
                        <h3
                          className={`text-xl font-bold ${
                            plan.popular ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          {plan.name}
                        </h3>
                      </div>
                      <p
                        className={`text-sm mb-6 ${
                          plan.popular ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {plan.desc}
                      </p>

                      {/* Price */}
                      <div className="mb-6">
                        {price === '' ? (
                          <p
                            className={`text-4xl font-extrabold ${
                              plan.popular ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                            }`}
                          >
                            Sur mesure
                          </p>
                        ) : (
                          <div className="flex items-baseline gap-1">
                            <span
                              className={`text-5xl font-extrabold ${
                                plan.popular ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                              }`}
                            >
                              {price}
                            </span>
                            <span
                              className={`text-sm ${
                                plan.popular ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                              }`}
                            >
                              {plan.period}
                            </span>
                          </div>
                        )}
                        {annual && price !== '' && (
                          <p
                            className={`text-xs mt-1 ${
                              plan.popular ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'
                            }`}
                          >
                            Factur&eacute; annuellement
                          </p>
                        )}
                      </div>

                      {/* Features */}
                      <ul className="space-y-3 mb-8">
                        {plan.features.map((f, fi) => (
                          <li key={fi} className="flex items-start gap-2.5 text-sm">
                            {f.included ? (
                              <Check
                                className={`w-4 h-4 mt-0.5 shrink-0 ${
                                  plan.popular ? 'text-blue-200' : 'text-[#28A745]'
                                }`}
                              />
                            ) : (
                              <X className="w-4 h-4 mt-0.5 shrink-0 text-gray-300" />
                            )}
                            <span
                              className={
                                plan.popular
                                  ? f.included
                                    ? 'text-blue-50'
                                    : 'text-blue-200/50'
                                  : f.included
                                    ? 'text-gray-700 dark:text-gray-300'
                                    : 'text-gray-400 dark:text-gray-500'
                              }
                            >
                              {f.label}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA */}
                      <Button
                        onClick={() =>
                          handleNav(plan.name === 'Enterprise' ? 'contact' : 'register')
                        }
                        size="lg"
                        className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                          plan.btnStyle === 'filled'
                            ? 'bg-white text-[#007BFF] hover:bg-gray-100 dark:hover:bg-gray-800 shadow-lg'
                            : plan.btnStyle === 'green'
                              ? 'bg-[#28A745] hover:bg-[#1E7E34] text-white shadow-md hover:shadow-lg'
                              : 'border-2 border-[#007BFF] text-[#007BFF] bg-transparent hover:bg-[#007BFF]/5'
                        }`}
                      >
                        {plan.cta}
                      </Button>
                    </CardContent>
                  </Card>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 md:py-20 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Comparaison d&eacute;taill&eacute;e
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th className="text-left p-4 md:p-5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Fonctionnalit&eacute;
                    </th>
                    <th className="p-4 md:p-5 text-sm font-semibold text-gray-900 dark:text-gray-100 text-center">
                      Starter
                    </th>
                    <th className="p-4 md:p-5 text-sm font-semibold text-[#007BFF] text-center bg-[#007BFF]/5">
                      Pro
                    </th>
                    <th className="p-4 md:p-5 text-sm font-semibold text-gray-900 dark:text-gray-100 text-center">
                      Enterprise
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {comparisonRows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="p-4 md:p-5 text-sm text-gray-700 dark:text-gray-300 font-medium">
                        {row.label}
                      </td>
                      <td className="p-4 md:p-5 text-center">
                        <CellValue value={row.starter} />
                      </td>
                      <td className="p-4 md:p-5 text-center bg-[#007BFF]/5">
                        <CellValue value={row.pro} />
                      </td>
                      <td className="p-4 md:p-5 text-center">
                        <CellValue value={row.enterprise} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Guarantee */}
      <section className="py-12 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 md:p-12 border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="w-16 h-16 bg-[#28A745]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-[#28A745]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                Satisfait ou rembours&eacute; 30 jours
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                Nous sommes convaincus de la qualit&eacute; de notre service. Si SmartTicketQR ne
                r&eacute;pond pas &agrave; vos attentes dans les 30 premiers jours, nous vous rembourserons
                int&eacute;gralement, sans condition.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-20 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Questions fr&eacute;quentes sur les tarifs
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="bg-gray-50 dark:bg-gray-800 rounded-xl mb-3 px-6 border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <AccordionTrigger className="text-gray-900 dark:text-gray-100 font-semibold hover:no-underline py-5 text-left">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 dark:text-gray-400 leading-relaxed pb-5">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </FadeIn>
        </div>
      </section>

      {/* Trust Badge */}
      <section className="py-10 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#007BFF]" />
                Satisfait ou rembours&eacute; 30 jours
              </span>
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#007BFF]" />
                Donn&eacute;es chiffr&eacute;es
              </span>
              <span className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[#007BFF]" />
                RGPD conforme
              </span>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
