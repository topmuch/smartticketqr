'use client';

import React from 'react';
import { useLanding } from './landing-page';

const plans = [
  {
    name: 'Starter',
    price: '5 000',
    period: 'FCFA/mois',
    desc: 'Ideal pour les petites structures et les debutants',
    features: [
      { label: 'Tickets par mois', value: '100' },
      { label: 'Utilisateurs', value: '2' },
      { label: 'Validation QR code', value: true },
      { label: 'Statistiques basiques', value: true },
      { label: 'Envoi email', value: true },
      { label: 'Support email', value: true },
      { label: 'Validation offline', value: false },
      { label: 'Envoi WhatsApp', value: false },
      { label: 'Statistiques avancees', value: false },
      { label: 'Export PDF/CSV', value: false },
      { label: 'Impression thermique', value: false },
      { label: 'API acces', value: false },
      { label: 'White-label', value: false },
      { label: 'Multi-organisation', value: false },
      { label: 'Support prioritaire', value: false },
      { label: 'Account manager dedie', value: false },
      { label: 'SLA garanti', value: false },
    ],
    cta: 'Commencer l\'essai gratuit',
    popular: false,
  },
  {
    name: 'Pro',
    price: '15 000',
    period: 'FCFA/mois',
    desc: 'Pour les entreprises en croissance qui veulent aller plus loin',
    features: [
      { label: 'Tickets par mois', value: '1 000' },
      { label: 'Utilisateurs', value: '10' },
      { label: 'Validation QR code', value: true },
      { label: 'Statistiques basiques', value: true },
      { label: 'Envoi email', value: true },
      { label: 'Support email', value: true },
      { label: 'Validation offline', value: true },
      { label: 'Envoi WhatsApp', value: true },
      { label: 'Statistiques avancees', value: true },
      { label: 'Export PDF/CSV', value: true },
      { label: 'Impression thermique', value: true },
      { label: 'API acces', value: false },
      { label: 'White-label', value: false },
      { label: 'Multi-organisation', value: false },
      { label: 'Support prioritaire', value: true },
      { label: 'Account manager dedie', value: false },
      { label: 'SLA garanti', value: false },
    ],
    cta: 'Commencer l\'essai gratuit',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Sur mesure',
    period: '',
    desc: 'Solution personnalisee pour les grandes organisations',
    features: [
      { label: 'Tickets par mois', value: 'Illimite' },
      { label: 'Utilisateurs', value: 'Illimite' },
      { label: 'Validation QR code', value: true },
      { label: 'Statistiques basiques', value: true },
      { label: 'Envoi email', value: true },
      { label: 'Support email', value: true },
      { label: 'Validation offline', value: true },
      { label: 'Envoi WhatsApp', value: true },
      { label: 'Statistiques avancees', value: true },
      { label: 'Export PDF/CSV', value: true },
      { label: 'Impression thermique', value: true },
      { label: 'API acces', value: true },
      { label: 'White-label', value: true },
      { label: 'Multi-organisation', value: true },
      { label: 'Support prioritaire', value: true },
      { label: 'Account manager dedie', value: true },
      { label: 'SLA garanti', value: true },
    ],
    cta: 'Nous contacter',
    popular: false,
  },
];

const comparisonFeatures = [
  { label: 'Tickets / mois', starter: '100', pro: '1 000', enterprise: 'Illimite' },
  { label: 'Utilisateurs', starter: '2', pro: '10', enterprise: 'Illimite' },
  { label: 'Validation QR code', starter: true, pro: true, enterprise: true },
  { label: 'Validation offline', starter: false, pro: true, enterprise: true },
  { label: 'Statistiques basiques', starter: true, pro: true, enterprise: true },
  { label: 'Statistiques avancees', starter: false, pro: true, enterprise: true },
  { label: 'Envoi email', starter: true, pro: true, enterprise: true },
  { label: 'Envoi WhatsApp', starter: false, pro: true, enterprise: true },
  { label: 'Export PDF / CSV', starter: false, pro: true, enterprise: true },
  { label: 'Impression thermique', starter: false, pro: true, enterprise: true },
  { label: 'API acces', starter: false, pro: false, enterprise: true },
  { label: 'White-label', starter: false, pro: false, enterprise: true },
  { label: 'Multi-organisation', starter: false, pro: false, enterprise: true },
  { label: 'Support email', starter: true, pro: true, enterprise: true },
  { label: 'Support prioritaire', starter: false, pro: true, enterprise: true },
  { label: 'Account manager dedie', starter: false, pro: false, enterprise: true },
  { label: 'SLA garanti (99.9%)', starter: false, pro: false, enterprise: true },
];

const faqItems = [
  {
    q: 'Puis-je changer de plan a tout moment ?',
    a: 'Oui, vous pouvez passer a un superieur plan a tout moment. Le prorata sera calcule automatiquement. Pour passer a un plan inferieur, la modification prendra effet au renouvellement.',
  },
  {
    q: 'Y a-t-il des frais caches ?',
    a: 'Non, nos tarifs sont totalement transparents. Le prix affiche est le prix que vous payez. Les frais de transaction bancaire ou mobile money sont a la charge du client final.',
  },
  {
    q: 'Comment fonctionne l\'essai gratuit de 7 jours ?',
    a: 'Vous avez acces a toutes les fonctionnalites du plan Pro pendant 7 jours, sans carte bancaire. A la fin de la periode, vous pouvez choisir un plan ou continuer gratuitement avec le plan Starter.',
  },
  {
    q: 'Quels modes de paiement acceptez-vous ?',
    a: 'Nous acceptons Wave, Orange Money, MTN Mobile Money, les cartes Visa/Mastercard et les virements bancaires. Le paiement peut etre mensuel ou annuel (avec 2 mois offerts).',
  },
  {
    q: 'Que se passe-t-il si je depasse mon quota de tickets ?',
    a: 'Vous recevrez une notification a 80% et 100% de votre quota. Vous pouvez acheter des tickets supplementaires ou passer a un plan superieur. Aucune interruption de service.',
  },
];

function CheckIcon({ color = '#28A745' }: { color?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
  );
}

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value ? <CheckIcon /> : <CrossIcon />;
  }
  return <span className="font-medium">{value}</span>;
}

export default function TarifsPage() {
  const { navigateTo } = useLanding();
  const [openFaq, setOpenFaq] = React.useState<number | null>(null);
  const [annual, setAnnual] = React.useState(false);

  return (
    <div className="pt-20 md:pt-24">
      {/* Header */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-[#007BFF] to-[#0056b3] text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4">
            Des tarifs simples et transparents
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            Pas de frais caches, pas de surprises. Choisissez le plan qui correspond a vos besoins et commencez a digitaliser votre billetterie.
          </p>
          {/* Toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={`text-sm font-medium ${!annual ? 'text-white' : 'text-blue-200'}`}>Mensuel</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-14 h-7 rounded-full transition-colors ${annual ? 'bg-[#28A745]' : 'bg-white/30'}`}
            >
              <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${annual ? 'translate-x-7.5' : 'translate-x-0.5'}`} />
            </button>
            <span className={`text-sm font-medium ${annual ? 'text-white' : 'text-blue-200'}`}>
              Annuel <span className="text-[#FFC107] font-bold">(-2 mois)</span>
            </span>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16 md:py-20 bg-[#F8F9FA]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-2xl p-6 md:p-8 transition-all duration-300 hover:-translate-y-1 ${
                  plan.popular
                    ? 'bg-[#007BFF] text-white shadow-xl shadow-[#007BFF]/25 scale-[1.02] md:scale-105'
                    : 'bg-white border-2 border-gray-200 hover:border-[#007BFF]/30 shadow-sm hover:shadow-lg'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#FFC107] text-gray-900 text-xs font-bold rounded-full">
                    Populaire
                  </div>
                )}
                <h3 className={`text-xl font-bold mb-1 ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-6 ${plan.popular ? 'text-blue-100' : 'text-gray-500'}`}>
                  {plan.desc}
                </p>
                <div className="mb-6">
                  {plan.price === 'Sur mesure' ? (
                    <p className={`text-4xl font-extrabold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                      Sur mesure
                    </p>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className={`text-5xl font-extrabold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                        {annual ? Math.round(parseInt(plan.price.replace(/\s/g, '')) * 10 / 12).toLocaleString('fr-FR').replace(/\s/g, ' ') : plan.price}
                      </span>
                      <span className={`text-sm ${plan.popular ? 'text-blue-100' : 'text-gray-500'}`}>
                        FCFA/mois
                      </span>
                    </div>
                  )}
                  {annual && plan.price !== 'Sur mesure' && (
                    <p className={`text-xs mt-1 ${plan.popular ? 'text-blue-200' : 'text-gray-400'}`}>
                      Facture annuellement
                    </p>
                  )}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-2.5 text-sm">
                      {typeof f.value === 'boolean' ? (
                        f.value ? (
                          <CheckIcon color={plan.popular ? '#93C5FD' : '#28A745'} />
                        ) : (
                          <CrossIcon />
                        )
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={plan.popular ? '#93C5FD' : '#007BFF'} strokeWidth="2" className="mt-0.5 shrink-0">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                      <span className={plan.popular ? 'text-blue-50' : 'text-gray-600'}>
                        {typeof f.value === 'string' ? `${f.label}: ${f.value}` : f.label}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigateTo(plan.name === 'Enterprise' ? 'contact' : 'register')}
                  className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                    plan.popular
                      ? 'bg-white text-[#007BFF] hover:bg-gray-100 shadow-lg'
                      : 'bg-[#007BFF] text-white hover:bg-[#0056b3] shadow-md hover:shadow-lg'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-10">
            Tableau comparatif detaille
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-4 md:p-5 text-sm font-semibold text-gray-900">Fonctionnalite</th>
                  <th className="p-4 md:p-5 text-sm font-semibold text-gray-900 text-center">Starter</th>
                  <th className="p-4 md:p-5 text-sm font-semibold text-[#007BFF] text-center bg-[#007BFF]/5">Pro</th>
                  <th className="p-4 md:p-5 text-sm font-semibold text-gray-900 text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comparisonFeatures.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 md:p-5 text-sm text-gray-700 font-medium">{row.label}</td>
                    <td className="p-4 md:p-5 text-center"><CellValue value={row.starter} /></td>
                    <td className="p-4 md:p-5 text-center bg-[#007BFF]/5"><CellValue value={row.pro} /></td>
                    <td className="p-4 md:p-5 text-center"><CellValue value={row.enterprise} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Guarantee */}
      <section className="py-12 bg-[#F8F9FA]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white rounded-2xl p-8 md:p-12 border border-gray-200 shadow-sm">
            <div className="w-16 h-16 bg-[#28A745]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#28A745" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Satisfait ou rembourse 30 jours</h3>
            <p className="text-gray-600 max-w-xl mx-auto">
              Nous sommes convaincus de la qualite de notre service. Si SmartTicketQR ne repond pas a vos attentes dans les 30 premiers jours, nous vous rembourserons integrallement, sans condition.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-10">
            Questions frequentes sur les tarifs
          </h2>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <div key={i} className="bg-[#F8F9FA] rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 md:p-6 text-left hover:bg-gray-100 transition-colors"
                >
                  <span className="font-semibold text-gray-900 pr-4">{item.q}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-gray-400 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`}>
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? 'max-h-60' : 'max-h-0'}`}>
                  <div className="px-5 pb-5 md:px-6 md:pb-6 text-gray-600 leading-relaxed">{item.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
