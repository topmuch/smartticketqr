'use client';

import React, { useState } from 'react';
import { QrCode, Eye, EyeOff, Check } from 'lucide-react';
import { useLandingStore } from '@/store/landing-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LandingRegisterPage() {
  const { setCurrentLandingPage } = useLandingStore();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    password: '',
  });

  const handleNav = (page: 'login' | 'home') => {
    setCurrentLandingPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleNav('home');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
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
            <span className="text-2xl font-bold tracking-tight text-gray-900">
              Smart<span className="text-[#007BFF]">Ticket</span>QR
            </span>
          </button>
        </div>

        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Cr&eacute;er un compte</h1>
              <p className="text-gray-500 text-sm mt-1">
                Essai gratuit de 7 jours, sans carte bancaire
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Nom complet
                  </Label>
                  <Input
                    id="name"
                    placeholder="Votre nom"
                    value={formData.name}
                    onChange={handleChange}
                    className="rounded-xl"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="company" className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Entreprise
                  </Label>
                  <Input
                    id="company"
                    placeholder="Nom de l&apos;entreprise"
                    value={formData.company}
                    onChange={handleChange}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="rounded-xl"
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-sm font-medium text-gray-700 mb-1.5 block">
                  T&eacute;l&eacute;phone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+221 7X XXX XX XX"
                  value={formData.phone}
                  onChange={handleChange}
                  className="rounded-xl"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 caract&egrave;res"
                    value={formData.password}
                    onChange={handleChange}
                    className="rounded-xl pr-10"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium text-gray-700 mb-2">Votre essai gratuit inclut :</p>
                {[
                  'Acc&egrave;s complet au plan Pro pendant 7 jours',
                  'G&eacute;n&eacute;ration de tickets QR code',
                  'Validation mobile offline',
                  'Statistiques en temps r&eacute;el',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-[#28A745] shrink-0" />
                    {item}
                  </div>
                ))}
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full bg-[#007BFF] hover:bg-[#0056b3] text-white font-semibold rounded-xl"
              >
                Commencer l&apos;essai gratuit
              </Button>

              <p className="text-xs text-gray-400 text-center">
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
              <p className="text-sm text-gray-500">
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
