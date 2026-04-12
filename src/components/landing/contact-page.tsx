'use client';

import React from 'react';
import { useLanding } from './landing-page';

export default function ContactPage() {
  const { navigateTo } = useLanding();
  const [formState, setFormState] = React.useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    type: '',
    message: '',
  });
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
    setFormState({ name: '', email: '', phone: '', company: '', type: '', message: '' });
  };

  return (
    <div className="pt-20 md:pt-24">
      {/* Header */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-[#007BFF] to-[#0056b3] text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4">
            Contactez-nous
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            Une question, un projet ? Notre equipe est a votre ecoute pour vous accompagner.
          </p>
        </div>
      </section>

      {/* Contact Content */}
      <section className="py-16 md:py-20 bg-[#F8F9FA]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12">
            {/* Form */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl p-6 md:p-10 shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Envoyez-nous un message</h2>

                {submitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-[#28A745]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#28A745" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Message envoye !</h3>
                    <p className="text-gray-600">Nous vous repondrons dans les 24 heures.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Nom complet <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formState.name}
                          onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/20 outline-none transition-all text-sm"
                          placeholder="Votre nom complet"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={formState.email}
                          onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/20 outline-none transition-all text-sm"
                          placeholder="votre@email.com"
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Telephone
                        </label>
                        <input
                          type="tel"
                          value={formState.phone}
                          onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/20 outline-none transition-all text-sm"
                          placeholder="+221 XX XXX XX XX"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Societe / Organisation
                        </label>
                        <input
                          type="text"
                          value={formState.company}
                          onChange={(e) => setFormState({ ...formState, company: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/20 outline-none transition-all text-sm"
                          placeholder="Nom de votre organisation"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Type de besoin <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={formState.type}
                        onChange={(e) => setFormState({ ...formState, type: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/20 outline-none transition-all text-sm bg-white"
                      >
                        <option value="">Selectionnez votre besoin</option>
                        <option value="transport">Transport (Bus, Bateau, Train)</option>
                        <option value="evenementiel">Evenementiel (Concerts, Conferences)</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Message <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={5}
                        value={formState.message}
                        onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/20 outline-none transition-all text-sm resize-none"
                        placeholder="Decrivez votre projet ou votre question..."
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3.5 bg-[#007BFF] text-white font-semibold rounded-xl hover:bg-[#0056b3] shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                    >
                      Envoyer le message
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Contact Info Sidebar */}
            <div className="lg:col-span-2 space-y-6">
              {/* Contact Cards */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-5">Nos coordonnees</h3>
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-[#007BFF]/10 rounded-xl flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Email</p>
                      <p className="text-[#007BFF] text-sm">contact@smartticketqr.com</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-[#28A745]/10 rounded-xl flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#28A745" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Telephone</p>
                      <p className="text-gray-600 text-sm">+221 33 800 00 00</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-[#FFC107]/20 rounded-xl flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8860B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Adresse</p>
                      <p className="text-gray-600 text-sm">Dakar, Senegal</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-[#DC3545]/10 rounded-xl flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC3545" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Horaires</p>
                      <p className="text-gray-600 text-sm">Lun - Ven : 8h - 18h</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-4">Suivez-nous</h3>
                <div className="flex gap-3">
                  {['LinkedIn', 'Twitter', 'Facebook'].map((social) => (
                    <button
                      key={social}
                      className="flex-1 py-3 rounded-xl bg-gray-50 text-gray-600 font-medium text-sm hover:bg-[#007BFF] hover:text-white transition-all"
                    >
                      {social}
                    </button>
                  ))}
                </div>
              </div>

              {/* Map Placeholder */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                <div className="aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-[#007BFF]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">Dakar, Senegal</p>
                    <p className="text-gray-400 text-xs mt-1">Google Maps</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
