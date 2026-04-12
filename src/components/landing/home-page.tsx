'use client';

import React from 'react';
import { useLanding } from './landing-page';

/* ─── FAQ Data ─── */
const faqItems = [
  {
    q: 'Comment fonctionne SmartTicketQR ?',
    a: 'SmartTicketQR vous permet de creer des evenements ou trajets, generer des billets avec QR code securises, les vendre en ligne, et les valider instantanement via votre smartphone. Le processus est entierement numerique et ne necessite aucune installation materielle.',
  },
  {
    q: 'Faut-il une connexion internet pour valider les tickets ?',
    a: 'Oui et non. La validation en temps reel necessite internet, mais notre application supporte le mode hors-ligne grace au cache local. Les scans sont enregistres localement puis synchronises automatiquement des que la connexion revient.',
  },
  {
    q: 'Quels moyens de paiement acceptez-vous ?',
    a: 'Nous integrons les principaux moyens de paiement africains : Wave, Orange Money, MTN Mobile Money, carte bancaire et virement bancaire. Les paiements sont traites de maniere securisee.',
  },
  {
    q: 'Combien coute SmartTicketQR ?',
    a: 'Nous proposons 3 plans adaptes a vos besoins : Starter a 5 000 FCFA/mois, Pro a 15 000 FCFA/mois et Enterprise sur mesure. Un essai gratuit de 7 jours est disponible sans carte bancaire.',
  },
  {
    q: 'Puis-je personnaliser l\'apparence de mes billets ?',
    a: 'Absolument ! Avec les plans Pro et Enterprise, vous pouvez personnaliser les couleurs, logos et mise en page de vos billets. Le plan Enterprise offre meme la possibilite d\'utiliser votre propre nom de domaine.',
  },
];

/* ─── Testimonials Data ─── */
const testimonials = [
  {
    name: 'Mamadou Diallo',
    role: 'Directeur, Dakar Express Bus',
    text: 'Depuis que nous utilisons SmartTicketQR, nous avons elimine les billets contrefaits. Notre taux de fraude est tombe a zero et nos clients apprecient la simplicite du systeme.',
    rating: 5,
  },
  {
    name: 'Aminata Koné',
    role: 'Organisatrice, Festival Afrika Ngo',
    text: "L'envoi automatique de billets par WhatsApp a augmente notre vente en ligne de 40%. L'interface est intuitive et notre equipe a ete formee en moins d'une heure.",
    rating: 5,
  },
  {
    name: 'Ibrahim Touré',
    role: "Gerant, Compagnie Ferry Cote d'Ivoire",
    text: "SmartTicketQR s'adapte parfaitement a notre activite maritime. La validation offline est indispensable pour nos traversées ou le reseau est instable. Excellent service client.",
    rating: 5,
  },
];

/* ─── Features Data ─── */
const features = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16v16H4z"/><path d="m9 9 6-6"/><path d="M15 9l-6-6"/>
      </svg>
    ),
    title: 'Tickets QR Code Securises',
    desc: 'Chaque billet est protege par un QR code unique avec signature HMAC-SHA256. Impossible a reproduire ou a falsifier.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>
      </svg>
    ),
    title: 'Validation Mobile Offline',
    desc: 'Scannez et validez les tickets directement depuis votre smartphone, meme sans connexion internet.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
      </svg>
    ),
    title: 'Statistiques Temps Reel',
    desc: 'Suivez vos ventes, validations et revenus en temps reel. Tableaux de bord detailles et rapports exportables.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
      </svg>
    ),
    title: 'Paiements Wave / Orange Money',
    desc: 'Integrez les moyens de paiement locaux les plus utilises en Afrique. Vos clients paient comme ils le souhaitent.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>
      </svg>
    ),
    title: 'Multi-usage (Bus, Bateau, Train)',
    desc: 'Adapte a tous les types de transport et evenements : bus interurbains, ferries, trains, concerts, conferences...',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
      </svg>
    ),
    title: 'Concu pour l\'Afrique',
    desc: 'Interface en francais, paiements locaux, support de proximite. Une solution pensee pour les realites du continent.',
  },
];

/* ─── Steps Data ─── */
const steps = [
  {
    num: '01',
    title: 'Creez votre evenement ou trajet',
    desc: 'Configurez votre evenement ou trajet en quelques minutes. Ajoutez les details, tarifs et quotas de places disponibles.',
  },
  {
    num: '02',
    title: 'Generez les tickets QR code',
    desc: 'Les billets sont generes automatiquement avec un QR code securise unique. Ils sont envoyes directement par WhatsApp ou email.',
  },
  {
    num: '03',
    title: 'Validez en un scan',
    desc: 'Au point de controle, scannez le QR code avec votre smartphone. La validation est instantanee, meme hors-ligne.',
  },
];

/* ─── Pricing Preview Data ─── */
const plans = [
  {
    name: 'Starter',
    price: '5 000',
    period: 'FCFA/mois',
    desc: 'Ideal pour les petites structures',
    features: ['100 tickets/mois', '2 utilisateurs', 'Validation QR code', 'Stats basiques', 'Support email'],
    cta: 'Commencer l\'essai gratuit',
    popular: false,
  },
  {
    name: 'Pro',
    price: '15 000',
    period: 'FCFA/mois',
    desc: 'Pour les entreprises en croissance',
    features: ['1 000 tickets/mois', '10 utilisateurs', 'Validation offline', 'Stats avancees', 'Envoi WhatsApp', 'Support prioritaire'],
    cta: 'Commencer l\'essai gratuit',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Sur mesure',
    period: '',
    desc: 'Pour les grandes organisations',
    features: ['Tickets illimites', 'Utilisateurs illimites', 'API acces', 'White-label', 'Account manager dedie', 'SLA garanti'],
    cta: 'Nous contacter',
    popular: false,
  },
];

const partnerLogos = [
  'Dakar Express', 'SOTRA', 'GTS Abidjan', 'Brazza Ferry', 'CamRail', 'Bolloré Transport'
];

export default function HomePage() {
  const { navigateTo } = useLanding();
  const [openFaq, setOpenFaq] = React.useState<number | null>(null);

  return (
    <div className="overflow-hidden">
      {/* ═══ HERO SECTION ═══ */}
      <section className="relative pt-24 md:pt-32 lg:pt-40 pb-16 md:pb-24 bg-gradient-to-br from-[#007BFF] via-[#0062CC] to-[#004A99]">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left - Text */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium mb-6">
                <span className="w-2 h-2 bg-[#28A745] rounded-full animate-pulse" />
                Plus de 500 transporteurs nous font confiance
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
                La Billetterie
                <br />
                <span className="text-[#FFC107]">Digitale Connectee</span>
              </h1>
              <p className="text-lg sm:text-xl text-blue-100 mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                Generez, vendez et controlez vos tickets par QR code.
                <br className="hidden sm:block" />
                Simple. Rapide. Securise.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <button
                  onClick={() => navigateTo('register')}
                  className="w-full sm:w-auto px-8 py-4 text-base font-bold text-[#007BFF] bg-white rounded-xl hover:bg-gray-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                >
                  Essai Gratuit 7 jours
                </button>
                <button
                  onClick={() => navigateTo('demo')}
                  className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white border-2 border-white/30 rounded-xl hover:bg-white/10 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Voir la Demo
                </button>
              </div>
              <p className="text-blue-200/70 text-sm mt-4">
                Sans carte bancaire &bull; Configuration en 2 minutes
              </p>
            </div>

            {/* Right - Illustration */}
            <div className="relative hidden lg:flex justify-center">
              <div className="relative">
                {/* Phone Mockup */}
                <div className="w-72 h-[540px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl border-4 border-gray-800 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                  <div className="w-full h-full bg-white rounded-[2.3rem] overflow-hidden relative">
                    {/* Status Bar */}
                    <div className="bg-[#007BFF] px-6 pt-4 pb-8 text-white">
                      <div className="flex items-center justify-between text-xs">
                        <span>9:41</span>
                        <div className="flex gap-1">
                          <div className="w-4 h-2 border border-white/60 rounded-sm"><div className="w-3 h-full bg-white/60 rounded-sm" /></div>
                        </div>
                      </div>
                      <p className="text-sm font-medium mt-2 opacity-80">Mon Ticket</p>
                      <p className="text-xl font-bold">Dakar - Saint-Louis</p>
                    </div>
                    {/* Ticket Body */}
                    <div className="px-5 -mt-4">
                      <div className="bg-white rounded-2xl shadow-lg p-4">
                        <div className="flex justify-between text-xs text-gray-500 mb-3">
                          <span>12 Mars 2025</span>
                          <span>08:30</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mb-3">
                          <span>Place: A12</span>
                          <span>Classe: VIP</span>
                        </div>
                        {/* QR Code Placeholder */}
                        <div className="w-32 h-32 mx-auto my-4 bg-gray-100 rounded-xl flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#007BFF" strokeWidth="1.5">
                            <rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/>
                            <path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                            <path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>
                          </svg>
                        </div>
                        <div className="text-center">
                          <div className="inline-flex items-center gap-1 px-3 py-1 bg-[#28A745]/10 text-[#28A745] rounded-full text-xs font-semibold">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                            Valide
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Floating Badge */}
                <div className="absolute -left-16 top-32 bg-white rounded-2xl shadow-xl p-4 flex items-center gap-3 animate-bounce" style={{ animationDuration: '3s' }}>
                  <div className="w-10 h-10 bg-[#28A745]/10 rounded-xl flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#28A745" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">Ticket Valide</p>
                    <p className="text-xs text-gray-500">08:32 - Dakar</p>
                  </div>
                </div>
                {/* Floating Stats */}
                <div className="absolute -right-12 bottom-40 bg-white rounded-2xl shadow-xl p-4 animate-bounce" style={{ animationDuration: '4s' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007BFF" strokeWidth="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                    <span className="text-xs font-semibold text-gray-900">Ventes du jour</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">127 <span className="text-xs text-[#28A745] font-medium">+23%</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave Separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 120L60 105C120 90 240 60 360 52.5C480 45 600 60 720 67.5C840 75 960 75 1080 67.5C1200 60 1320 45 1380 37.5L1440 30V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* ═══ PARTNER LOGOS ═══ */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-400 font-medium mb-8 uppercase tracking-wider">
            Ils nous font deja confiance
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {partnerLogos.map((name) => (
              <div
                key={name}
                className="px-6 py-3 rounded-xl bg-gray-50 text-gray-400 font-semibold text-sm hover:bg-gray-100 transition-colors"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES SECTION ═══ */}
      <section className="py-16 md:py-24 bg-[#F8F9FA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-[#007BFF]/10 text-[#007BFF] rounded-full text-sm font-semibold mb-4">
              Fonctionnalites
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Une plateforme complete pour gerer votre billetterie de A a Z, specialement concue pour le marche africain.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {features.map((feature, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-lg border border-gray-100 transition-all duration-300 hover:-translate-y-1 group"
              >
                <div className="w-14 h-14 bg-[#007BFF]/10 rounded-2xl flex items-center justify-center text-[#007BFF] mb-5 group-hover:bg-[#007BFF] group-hover:text-white transition-all duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-[#28A745]/10 text-[#28A745] rounded-full text-sm font-semibold mb-4">
              Comment ca marche
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              3 etapes simples pour commencer
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              De la creation de votre evenement a la validation des billets, tout est simplifie.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((step, i) => (
              <div key={i} className="relative text-center">
                {/* Connector Line */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] border-t-2 border-dashed border-[#007BFF]/20" />
                )}
                <div className="relative z-10 w-24 h-24 bg-gradient-to-br from-[#007BFF] to-[#0056b3] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#007BFF]/25">
                  <span className="text-3xl font-extrabold text-white">{step.num}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="py-16 md:py-24 bg-[#F8F9FA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-[#FFC107]/20 text-[#B8860B] rounded-full text-sm font-semibold mb-4">
              Temoignages
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Ce que disent nos clients
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Des transporteurs et organisateurs satisfaits a travers l'Afrique.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-lg border border-gray-100 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, si) => (
                    <svg key={si} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#FFC107" stroke="#FFC107" strokeWidth="1">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                </div>
                <p className="text-gray-700 leading-relaxed mb-6 italic">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#007BFF] to-[#0056b3] flex items-center justify-center text-white font-bold text-sm">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-gray-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING PREVIEW ═══ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-[#007BFF]/10 text-[#007BFF] rounded-full text-sm font-semibold mb-4">
              Tarifs
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Des tarifs simples et transparents
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choisissez le plan adapte a vos besoins. Satisfait ou rembourse 30 jours.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
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
                <h3 className={`text-lg font-bold mb-1 ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-6 ${plan.popular ? 'text-blue-100' : 'text-gray-500'}`}>
                  {plan.desc}
                </p>
                <div className="mb-6">
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
                        {plan.period}
                      </span>
                    </div>
                  )}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-2 text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={plan.popular ? '#93C5FD' : '#28A745'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span className={plan.popular ? 'text-blue-50' : 'text-gray-600'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigateTo(plan.name === 'Enterprise' ? 'contact' : 'register')}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
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

          <div className="text-center mt-8">
            <button
              onClick={() => navigateTo('tarifs')}
              className="text-[#007BFF] font-semibold hover:underline flex items-center gap-1 mx-auto"
            >
              Voir le tableau comparatif complet
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="py-16 md:py-24 bg-[#F8F9FA]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-[#007BFF]/10 text-[#007BFF] rounded-full text-sm font-semibold mb-4">
              FAQ
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Questions frequentes
            </h2>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 md:p-6 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900 pr-4">{item.q}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 text-gray-400 transition-transform duration-300 ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  >
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openFaq === i ? 'max-h-60' : 'max-h-0'
                  }`}
                >
                  <div className="px-5 pb-5 md:px-6 md:pb-6 text-gray-600 leading-relaxed">
                    {item.a}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
