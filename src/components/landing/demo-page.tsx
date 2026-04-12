'use client';

import React from 'react';
import { useLanding } from './landing-page';

const screenshots = [
  {
    title: 'Tableau de bord',
    desc: 'Vue d\'ensemble de vos ventes, tickets et revenus en temps reel.',
    gradient: 'from-[#007BFF] to-[#0056b3]',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
    ),
  },
  {
    title: 'Scanner mobile',
    desc: 'Validation instantanee des billets via la camera de votre smartphone.',
    gradient: 'from-[#28A745] to-[#1E7E34]',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M8 12h8"/></svg>
    ),
  },
  {
    title: 'Ticket WhatsApp',
    desc: 'Livraison automatique des billets par WhatsApp pour une meilleure experience client.',
    gradient: 'from-[#25D366] to-[#128C7E]',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    ),
  },
  {
    title: 'Rapports detailles',
    desc: 'Exportez vos statistiques en PDF ou CSV pour un suivi complet de votre activite.',
    gradient: 'from-[#FFC107] to-[#E0A800]',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
    ),
  },
  {
    title: 'Gestion des evenements',
    desc: 'Creez et gerez facilement vos trajets, concerts et evenements.',
    gradient: 'from-[#6F42C1] to-[#5A32A3]',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
    ),
  },
  {
    title: 'Impression thermique',
    desc: 'Imprimez directement des billets sur imprimantes thermiques 58mm et 80mm.',
    gradient: 'from-[#DC3545] to-[#C82333]',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
    ),
  },
];

export default function DemoPage() {
  const { navigateTo } = useLanding();
  const [activeScreenshot, setActiveScreenshot] = React.useState(0);

  return (
    <div className="pt-20 md:pt-24">
      {/* Header */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-[#007BFF] to-[#0056b3] text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4">
            Decouvrez SmartTicketQR en action
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            Regardez comment notre plateforme simplifie la gestion de billetterie pour les transporteurs et organisateurs en Afrique.
          </p>
        </div>
      </section>

      {/* Video Demo */}
      <section className="py-16 md:py-20 bg-[#F8F9FA]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative bg-gray-900 rounded-3xl overflow-hidden shadow-2xl aspect-video flex items-center justify-center">
            {/* Video Placeholder */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#007BFF]/20 to-[#004A99]/20" />
            <div className="relative text-center">
              <button className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl hover:scale-110 transition-transform group">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#007BFF" className="ml-1 group-hover:scale-110 transition-transform">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </button>
              <p className="text-white text-lg font-semibold">Voir la demonstration video</p>
              <p className="text-gray-400 text-sm mt-1">Duree : 3 min</p>
            </div>
            {/* Decorative Grid */}
            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '30px 30px' }} />
          </div>
        </div>
      </section>

      {/* Interactive Screenshots Gallery */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-4">
            Apercu de la plateforme
          </h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-12">
            Decouvrez les ecrans principaux de SmartTicketQR et comment ils s\'adaptent a votre activite.
          </p>

          {/* Gallery Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {screenshots.map((ss, i) => (
              <button
                key={i}
                onClick={() => setActiveScreenshot(i)}
                className={`group relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  activeScreenshot === i ? 'ring-4 ring-[#007BFF] shadow-xl scale-[1.02]' : 'shadow-md'
                }`}
              >
                <div className={`aspect-[4/3] bg-gradient-to-br ${ss.gradient} flex items-center justify-center relative`}>
                  {ss.icon}
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#007BFF" stroke="none">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    </div>
                  </div>
                  {/* Mockup UI lines */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-white/60" />
                        <div className="w-16 h-2 rounded bg-white/40" />
                      </div>
                      <div className="w-full h-2 rounded bg-white/20 mb-1" />
                      <div className="w-3/4 h-2 rounded bg-white/20" />
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-white">
                  <h3 className="font-bold text-gray-900 text-sm">{ss.title}</h3>
                  <p className="text-gray-500 text-xs mt-1">{ss.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* How Demo Flow Works */}
      <section className="py-16 md:py-20 bg-[#F8F9FA]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-12">
            Le parcours type
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Inscription', desc: ' Creez votre compte en 2 minutes', color: 'bg-[#007BFF]' },
              { step: '2', title: 'Configuration', desc: 'Ajoutez votre premier evenement ou trajet', color: 'bg-[#28A745]' },
              { step: '3', title: 'Vente', desc: 'Vendez et distribuez vos billets', color: 'bg-[#FFC107]' },
              { step: '4', title: 'Validation', desc: 'Scannez et validez en un clic', color: 'bg-[#DC3545]' },
            ].map((item, i) => (
              <div key={i} className="relative text-center">
                {i < 3 && <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-gray-300" />}
                <div className={`w-16 h-16 ${item.color} rounded-2xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-4 shadow-lg relative z-10`}>
                  {item.step}
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-gray-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Pret a essayer SmartTicketQR ?
          </h2>
          <p className="text-gray-600 mb-8">
            Commencez votre essai gratuit de 7 jours. Aucune carte bancaire requise.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigateTo('register')}
              className="w-full sm:w-auto px-8 py-4 text-base font-bold text-white bg-[#007BFF] rounded-xl hover:bg-[#0056b3] shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
            >
              Essayer gratuitement
            </button>
            <button
              onClick={() => navigateTo('contact')}
              className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200"
            >
              Demander une demo personnalisee
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
