'use client';

import React, { useState } from 'react';
import { QrCode, Eye, EyeOff, Check, Loader2 } from 'lucide-react';
import { useLandingStore } from '@/store/landing-store';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LandingRegisterPage() {
  const { setCurrentLandingPage } = useLandingStore();
  const { login } = useAuthStore();
  const { setCurrentPage } = useAppStore();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });

  const handleNav = (page: 'login' | 'home') => {
    setCurrentLandingPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Step 1: Create organization first
      const orgRes = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${formData.name}'s Organization`,
          slug: formData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + Date.now().toString(36),
        }),
      });

      if (!orgRes.ok) {
        const orgData = await orgRes.json();
        setError(orgData.error || 'Erreur lors de la création de l\'organisation');
        return;
      }

      const orgData = await orgRes.json();

      // Step 2: Register user as first user (self-service → super_admin)
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          organizationId: orgData.id,
        }),
      });

      const regData = await regRes.json();

      if (!regRes.ok) {
        setError(regData.error || 'Erreur lors de l\'inscription');
        return;
      }

      // Step 3: Auto-login
      login(regData.user, regData.token);
      setCurrentPage('dashboard');
      setCurrentLandingPage('home');
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <button
            onClick={() => handleNav('home')}
            className="inline-flex items-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#007BFF] flex items-center justify-center group-hover:scale-105 transition-transform">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Smart<span className="text-[#007BFF]">Ticket</span>QR
            </span>
          </button>
        </div>

        <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cr&eacute;er un compte</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Essai gratuit de 7 jours, sans carte bancaire
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Nom complet
                </Label>
                <Input
                  id="name"
                  placeholder="Votre nom"
                  value={formData.name}
                  onChange={handleChange}
                  className="rounded-xl bg-white dark:bg-gray-800"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="rounded-xl bg-white dark:bg-gray-800"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  T&eacute;l&eacute;phone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+221 7X XXX XX XX"
                  value={formData.phone}
                  onChange={handleChange}
                  className="rounded-xl bg-white dark:bg-gray-800"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 caract&egrave;res"
                    value={formData.password}
                    onChange={handleChange}
                    className="rounded-xl pr-10 bg-white dark:bg-gray-800"
                    required
                    minLength={8}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Votre essai gratuit inclut :</p>
                {[
                  'Acc&egrave;s complet au plan Pro pendant 7 jours',
                  'G&eacute;n&eacute;ration de tickets QR code',
                  'Validation mobile offline',
                  'Statistiques en temps r&eacute;el',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-[#28A745] shrink-0" />
                    {item}
                  </div>
                ))}
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full bg-[#007BFF] hover:bg-[#0056b3] text-white font-semibold rounded-xl"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cr&eacute;ation du compte...
                  </span>
                ) : (
                  'Commencer l&apos;essai gratuit'
                )}
              </Button>

              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                En cr&eacute;ant un compte, vous acceptez nos{' '}
                <button onClick={() => setCurrentLandingPage('privacy')} className="text-[#007BFF] hover:underline">
                  CGU
                </button>{' '}
                et notre{' '}
                <button onClick={() => setCurrentLandingPage('privacy')} className="text-[#007BFF] hover:underline">
                  politique de confidentialit&eacute;
                </button>
                .
              </p>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                D&eacute;j&agrave; un compte&thinsp;?{' '}
                <button
                  onClick={() => handleNav('login')}
                  className="text-[#007BFF] font-semibold hover:underline"
                >
                  Se connecter
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
