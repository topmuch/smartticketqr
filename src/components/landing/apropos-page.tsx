'use client';

import React from 'react';
import { useLanding } from './landing-page';

const values = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4"/><path d="m6.8 15-3.5 2"/><path d="m20.7 17-3.5-2"/><path d="M6.8 9 3.3 7"/><path d="m20.7 7-3.5 2"/><path d="m9 22 3-8 3 8"/>
        <path d="M8 22h8"/>
      </svg>
    ),
    title: 'Innovation adaptee',
    desc: 'Nous concevons des solutions qui repondent aux realites du marche africain : connectivite limitee, paiements mobiles, multilinguisme.',
    color: 'bg-[#007BFF]/10 text-[#007BFF]',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
      </svg>
    ),
    title: 'Securite et fiabilite',
    desc: 'Chaque billet est protege par une signature numerique HMAC-SHA256. Nos serveurs garantissent une disponibilite de 99.9%.',
    color: 'bg-[#28A745]/10 text-[#28A745]',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    title: 'Proximite avec nos clients',
    desc: 'Notre equipe est basee en Afrique. Nous comprenons vos defis et offrons un support reactif en francais.',
    color: 'bg-[#FFC107]/20 text-[#B8860B]',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
      </svg>
    ),
    title: 'Impact social positif',
    desc: 'Nous contribuons a la formalisation de l\'economie informelle et a la modernisation des transports en Afrique.',
    color: 'bg-[#DC3545]/10 text-[#DC3545]',
  },
];

const stats = [
  { value: '500+', label: 'Clients actifs' },
  { value: '100 000+', label: 'Tickets generes' },
  { value: '99.9%', label: 'Disponibilite' },
  { value: '5', label: 'Pays couverts' },
];

const team = [
  { name: 'Moussa Ndiaye', role: 'CEO & Co-fondateur', color: 'from-[#007BFF] to-[#0056b3]' },
  { name: 'Fatou Sow', role: 'CTO', color: 'from-[#28A745] to-[#1E7E34]' },
  { name: 'Abdoulaye Diop', role: 'Directeur Commercial', color: 'from-[#FFC107] to-[#E0A800]' },
  { name: 'Aissatou Ba', role: 'Lead Design', color: 'from-[#6F42C1] to-[#5A32A3]' },
  { name: 'Cheikh Sy', role: 'Lead Developpeur', color: 'from-[#DC3545] to-[#C82333]' },
  { name: 'Mariama Fall', role: 'Responsable Support', color: 'from-[#20C997] to-[#17A689]' },
];

const partners = [
  'Wave', 'Orange Money', 'MTN Mobile Money', 'Mobicash', 'YUP', 'Free Money',
];

export default function AproposPage() {
  return (
    <div className="pt-20 md:pt-24">
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#007BFF] to-[#004A99] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-6">
            Notre mission : Digitaliser l&apos;Afrique
          </h1>
          <p className="text-lg md:text-xl text-blue-100 leading-relaxed max-w-3xl mx-auto">
            Nous croyons que la technologie peut transformer le quotidien des Africains. SmartTicketQR est ne de cette conviction : simplifier la billetterie pour les transporteurs et organisateurs du continent.
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-4 py-1.5 bg-[#007BFF]/10 text-[#007BFF] rounded-full text-sm font-semibold mb-4">
                Notre histoire
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
                Ne d&apos;une idee simple
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  En 2023, Moussa Ndiaye, alors directeur d&apos;une compagnie de bus interurbains a Dakar, perdait chaque mois plus de 15% de ses revenus a cause de la contrefacon de billets.
                </p>
                <p>
                  Constatant qu&apos;aucune solution existante n&apos;etait adaptee aux realites africaines (connectivite instable, paiements mobiles, multilinguisme), il a reuni une equipe de passionnes pour creer SmartTicketQR.
                </p>
                <p>
                  Aujourd&apos;hui, plus de 500 transporteurs et organisateurs a travers 5 pays africains font confiance a notre plateforme pour gerer leur billetterie au quotidien.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-[#007BFF]/10 to-[#28A745]/10 rounded-3xl flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-20 h-20 bg-[#007BFF] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M12 2v4"/><path d="m6.8 15-3.5 2"/><path d="m20.7 17-3.5-2"/><path d="M6.8 9 3.3 7"/><path d="m20.7 7-3.5 2"/><path d="m9 22 3-8 3 8"/><path d="M8 22h8"/>
                    </svg>
                  </div>
                  <p className="text-gray-900 font-bold text-xl">Depuis 2023</p>
                  <p className="text-gray-500 mt-1">Dakar, Senegal</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="py-16 md:py-20 bg-[#F8F9FA]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-1.5 bg-[#28A745]/10 text-[#28A745] rounded-full text-sm font-semibold mb-4">
            Notre vision
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
            Devenir la reference de la billetterie digitale en Afrique
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed max-w-3xl mx-auto">
            Nous voulons que chaque transporteur, chaque organisateur, chaque entrepreneur africain puisse acceder a une solution de billetterie moderne, abordable et fiable. Notre ambition : couvrir 20 pays africains d&apos;ici 2027 et servir plus de 10 000 clients.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Nos valeurs</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Les principes qui guident chacune de nos decisions.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <div key={i} className="bg-[#F8F9FA] rounded-2xl p-6 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${v.color}`}>
                  {v.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 md:py-20 bg-gradient-to-r from-[#007BFF] to-[#0056b3]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl md:text-4xl font-extrabold text-white mb-2">{s.value}</p>
                <p className="text-blue-200 text-sm font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-16 md:py-20 bg-[#F8F9FA]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 bg-[#007BFF]/10 text-[#007BFF] rounded-full text-sm font-semibold mb-4">
              L&apos;equipe
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Les esprits derriere SmartTicketQR
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Une equipe passionnee, basee en Afrique, dediee a votre succes.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.map((member, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${member.color} flex items-center justify-center mx-auto mb-4`}>
                  <span className="text-white text-xl font-bold">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900">{member.name}</h3>
                <p className="text-gray-500 text-sm mt-1">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-10">
            Nos partenaires de paiement
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {partners.map((p, i) => (
              <div key={i} className="px-8 py-4 bg-gray-50 rounded-2xl text-gray-600 font-semibold hover:bg-gray-100 transition-colors">
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
