'use client';

import React from 'react';
import { useLanding } from './landing-page';

type Step = 1 | 2 | 3;

const planOptions = [
  {
    id: 'starter',
    name: 'Starter',
    price: '5 000 FCFA/mois',
    desc: '100 tickets, 2 utilisateurs',
    features: ['100 tickets/mois', '2 utilisateurs', 'Validation QR', 'Stats basiques'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '15 000 FCFA/mois',
    desc: '1 000 tickets, envoi WhatsApp',
    features: ['1 000 tickets/mois', '10 utilisateurs', 'Offline + WhatsApp', 'Stats avancees'],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Sur mesure',
    desc: 'Ilimite, white-label',
    features: ['Tickets illimites', 'API acces', 'White-label', 'SLA garanti'],
  },
];

const countries = [
  'Senegal', 'Cote d\'Ivoire', 'Cameroun', 'Mali', 'Guinee', 'Burkina Faso',
  'Togo', 'Benin', 'Niger', 'Tchad', 'Gabon', 'Congo', 'RDC', 'Autre',
];

const orgTypes = ['Transport (Bus)', 'Transport (Bateau/Ferry)', 'Transport (Train)', 'Evenementiel', 'Autre'];

export default function LandingRegister() {
  const { navigateTo } = useLanding();
  const [step, setStep] = React.useState<Step>(1);
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    orgName: '',
    orgType: '',
    phone: '',
    country: '',
    plan: 'pro',
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = React.useState(false);

  const passwordStrength = React.useMemo(() => {
    const p = form.password;
    if (!p) return { score: 0, label: '', color: '' };
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    const levels = [
      { label: 'Tres faible', color: '#DC3545' },
      { label: 'Faible', color: '#FFC107' },
      { label: 'Moyen', color: '#FFC107' },
      { label: 'Fort', color: '#28A745' },
      { label: 'Tres fort', color: '#28A745' },
    ];
    return { score, ...levels[score] };
  }, [form.password]);

  const canProceedStep1 = form.name && form.email && form.password && form.confirmPassword && form.password === form.confirmPassword && form.password.length >= 6;
  const canProceedStep2 = form.orgName && form.orgType;
  const canProceedStep3 = form.plan && form.acceptTerms;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Register via API
    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        organizationName: form.orgName,
        organizationType: form.orgType,
      }),
    }).then(res => res.json()).then(data => {
      if (data.token) {
        // Auto login
        fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password }),
        }).then(r => r.json()).then(loginData => {
          if (loginData.token) {
            import('@/store/auth-store').then(({ useAuthStore }) => {
              useAuthStore.getState().login(loginData.token, loginData.user);
            });
          }
        });
      }
    }).catch(() => {});
  };

  const updateForm = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-[#007BFF] via-[#0062CC] to-[#004A99] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>
        <div className="relative flex flex-col justify-center px-12 xl:px-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/>
                <path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/>
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">SmartTicketQR</span>
          </div>
          <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight mb-4">
            Creez votre compte<br />
            <span className="text-[#FFC107]">en 3 etapes</span>
          </h2>
          <p className="text-blue-100 text-lg leading-relaxed mb-10">
            Commencez a digitaliser votre billetterie en quelques minutes. Essai gratuit de 7 jours, sans carte bancaire.
          </p>

          {/* Benefits */}
          <div className="space-y-4">
            {[
              { icon: '✓', text: 'Configuration rapide en moins de 5 minutes' },
              { icon: '✓', text: '100 tickets gratuits pendant l\'essai' },
              { icon: '✓', text: 'Support dedie en francais' },
              { icon: '✓', text: 'Sans engagement, annulez a tout moment' },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center text-sm text-[#FFC107] font-bold">
                  {b.icon}
                </div>
                <span className="text-blue-50 text-sm">{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 bg-[#F8F9FA] py-12">
        <div className="w-full max-w-lg">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#007BFF] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/>
                <path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/>
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">Smart<span className="text-[#007BFF]">Ticket</span>QR</span>
          </div>

          <div className="bg-white rounded-2xl p-8 md:p-10 shadow-sm border border-gray-100">
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-0 mb-8">
              {[1, 2, 3].map((s) => (
                <React.Fragment key={s}>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      step >= s ? 'bg-[#007BFF] text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {step > s ? '✓' : s}
                    </div>
                    <span className={`text-sm font-medium hidden sm:block ${step >= s ? 'text-gray-900' : 'text-gray-400'}`}>
                      {s === 1 ? 'Compte' : s === 2 ? 'Organisation' : 'Plan'}
                    </span>
                  </div>
                  {s < 3 && <div className={`w-12 sm:w-20 h-0.5 mx-2 transition-colors ${step > s ? 'bg-[#007BFF]' : 'bg-gray-200'}`} />}
                </React.Fragment>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              {/* Step 1 - Account */}
              {step === 1 && (
                <div className="space-y-5">
                  <div className="text-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Creez votre compte</h2>
                    <p className="text-gray-500 text-sm mt-1">Informations de connexion</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => updateForm('name', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/20 outline-none transition-all text-sm"
                      placeholder="Mamadou Diallo"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email professionnel <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => updateForm('email', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/20 outline-none transition-all text-sm"
                      placeholder="mamadou@entreprise.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={form.password}
                        onChange={(e) => updateForm('password', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/20 outline-none transition-all text-sm pr-12"
                        placeholder="Min. 6 caracteres"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                      </button>
                    </div>
                    {/* Password Strength */}
                    {form.password && (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4].map((level) => (
                            <div
                              key={level}
                              className={`h-1.5 flex-1 rounded-full transition-colors ${
                                passwordStrength.score >= level
                                  ? passwordStrength.color === '#28A745'
                                    ? 'bg-[#28A745]'
                                    : passwordStrength.color === '#FFC107'
                                    ? 'bg-[#FFC107]'
                                    : 'bg-[#DC3545]'
                                  : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs" style={{ color: passwordStrength.color }}>{passwordStrength.label}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmer le mot de passe <span className="text-red-500">*</span></label>
                    <input
                      type="password"
                      required
                      value={form.confirmPassword}
                      onChange={(e) => updateForm('confirmPassword', e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-sm ${
                        form.confirmPassword && form.password !== form.confirmPassword
                          ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                          : 'border-gray-300 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/20'
                      }`}
                      placeholder="Confirmez votre mot de passe"
                    />
                    {form.confirmPassword && form.password !== form.confirmPassword && (
                      <p className="text-red-500 text-xs mt-1">Les mots de passe ne correspondent pas</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => canProceedStep1 && setStep(2)}
                    disabled={!canProceedStep1}
                    className={`w-full py-3.5 font-semibold rounded-xl transition-all duration-200 ${
                      canProceedStep1
                        ? 'bg-[#007BFF] text-white hover:bg-[#0056b3] shadow-md hover:shadow-lg hover:-translate-y-0.5'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Continuer
                  </button>
                </div>
              )}

              {/* Step 2 - Organization */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="text-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Votre organisation</h2>
                    <p className="text-gray-500 text-sm mt-1">Informations sur votre structure</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom de la societe <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={form.orgName}
                      onChange={(e) => updateForm('orgName', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/20 outline-none transition-all text-sm"
                      placeholder="Dakar Express Bus"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Type d&apos;activite <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={form.orgType}
                      onChange={(e) => updateForm('orgType', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/20 outline-none transition-all text-sm bg-white"
                    >
                      <option value="">Selectionnez votre activite</option>
                      {orgTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Telephone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => updateForm('phone', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/20 outline-none transition-all text-sm"
                      placeholder="+221 77 123 45 67"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Pays</label>
                    <select
                      value={form.country}
                      onChange={(e) => updateForm('country', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/20 outline-none transition-all text-sm bg-white"
                    >
                      <option value="">Selectionnez votre pays</option>
                      {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all"
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      onClick={() => canProceedStep2 && setStep(3)}
                      disabled={!canProceedStep2}
                      className={`flex-1 py-3.5 font-semibold rounded-xl transition-all duration-200 ${
                        canProceedStep2
                          ? 'bg-[#007BFF] text-white hover:bg-[#0056b3] shadow-md hover:shadow-lg'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Continuer
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 - Plan */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="text-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Choisissez votre plan</h2>
                    <p className="text-gray-500 text-sm mt-1">Essai gratuit de 7 jours</p>
                  </div>

                  <div className="space-y-3">
                    {planOptions.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => updateForm('plan', plan.id)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          form.plan === plan.id
                            ? 'border-[#007BFF] bg-[#007BFF]/5'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        } ${plan.popular && form.plan !== plan.id ? 'ring-2 ring-[#FFC107] ring-offset-1' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              form.plan === plan.id ? 'border-[#007BFF] bg-[#007BFF]' : 'border-gray-300'
                            }`}>
                              {form.plan === plan.id && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900">{plan.name}</span>
                                {plan.popular && (
                                  <span className="px-2 py-0.5 bg-[#FFC107] text-gray-900 text-xs font-bold rounded-full">
                                    Populaire
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-500 text-xs">{plan.desc}</p>
                            </div>
                          </div>
                          <span className="font-bold text-gray-900 text-sm">{plan.price}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={form.acceptTerms}
                      onChange={(e) => updateForm('acceptTerms', e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 text-[#007BFF] focus:ring-[#007BFF]"
                    />
                    <span className="text-sm text-gray-600">
                      J&apos;accepte les{' '}
                      <button type="button" onClick={() => navigateTo('confidentialite')} className="text-[#007BFF] hover:underline">
                        Conditions Generales d&apos;Utilisation
                      </button>{' '}
                      et la{' '}
                      <button type="button" onClick={() => navigateTo('confidentialite')} className="text-[#007BFF] hover:underline">
                        Politique de Confidentialite
                      </button>
                    </span>
                  </label>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex-1 py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all"
                    >
                      Retour
                    </button>
                    <button
                      type="submit"
                      disabled={!canProceedStep3}
                      className={`flex-1 py-3.5 font-semibold rounded-xl transition-all duration-200 ${
                        canProceedStep3
                          ? 'bg-[#007BFF] text-white hover:bg-[#0056b3] shadow-md hover:shadow-lg hover:-translate-y-0.5'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Commencer l&apos;essai gratuit
                    </button>
                  </div>
                </div>
              )}
            </form>

            {/* Login Link */}
            <p className="text-center text-sm text-gray-500 mt-6">
              Vous avez deja un compte ?{' '}
              <button
                onClick={() => navigateTo('login')}
                className="text-[#007BFF] font-semibold hover:underline"
              >
                Se connecter
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
