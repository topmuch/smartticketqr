'use client';

import React, { useState } from 'react';
import { QrCode, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useLandingStore } from '@/store/landing-store';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LandingLoginPage() {
  const { setCurrentLandingPage } = useLandingStore();
  const { login } = useAuthStore();
  const { setCurrentPage } = useAppStore();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNav = (page: 'register' | 'home') => {
    setCurrentLandingPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur de connexion');
        return;
      }

      // Store auth state
      login(data.user, data.token);

      // Navigate to dashboard
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Se connecter</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Acc&eacute;dez &agrave; votre espace de gestion
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl bg-white dark:bg-gray-800"
                  required
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
                    placeholder="Votre mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl pr-10 bg-white dark:bg-gray-800"
                    required
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

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-[#007BFF] focus:ring-[#007BFF]" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Se souvenir de moi</span>
                </label>
                <button type="button" className="text-sm text-[#007BFF] hover:underline font-medium">
                  Mot de passe oubli&eacute;&thinsp;?
                </button>
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
                    Connexion...
                  </span>
                ) : (
                  'Se connecter'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Pas encore de compte&thinsp;?{' '}
                <button
                  onClick={() => handleNav('register')}
                  className="text-[#007BFF] font-semibold hover:underline"
                >
                  Cr&eacute;er un compte
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
