'use client';

import React, { useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Mail, Phone, MapPin, Send, Clock, Loader2, CheckCircle2 } from 'lucide-react';
import { useLandingStore } from '@/store/landing-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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

const contactInfo = [
  {
    icon: Mail,
    label: 'Email',
    value: 'contact@smartticketqr.com',
    href: 'mailto:contact@smartticketqr.com',
    color: 'bg-[#007BFF]/10 text-[#007BFF]',
  },
  {
    icon: Phone,
    label: 'T&eacute;l&eacute;phone',
    value: '+221 33 800 00 00',
    href: 'tel:+22133800000',
    color: 'bg-[#28A745]/10 text-[#28A745]',
  },
  {
    icon: MapPin,
    label: 'Adresse',
    value: 'Dakar, S&eacute;n&eacute;gal',
    href: null,
    color: 'bg-[#FFC107]/20 text-[#B8860B]',
  },
  {
    icon: Clock,
    label: 'Horaires',
    value: 'Lun-Ven : 8h - 18h',
    href: null,
    color: 'bg-[#6F42C1]/10 text-[#6F42C1]',
  },
];

export default function LandingContactPage() {
  const { setCurrentLandingPage } = useLandingStore();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleNav = (page: 'register') => {
    setCurrentLandingPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'envoi');
        return;
      }

      setSubmitted(true);
      setFormData({ firstName: '', lastName: '', email: '', subject: '', message: '' });
    } catch {
      setError('Erreur r&eacute;seau. Veuillez r&eacute;essayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-24 md:pt-28">
      {/* Header */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-[#007BFF] to-[#0056b3] text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <h1 className="text-3xl md:text-5xl font-extrabold mb-4">
              Contactez-nous
            </h1>
            <p className="text-lg text-blue-100 max-w-2xl mx-auto">
              Notre &eacute;quipe est &agrave; votre &eacute;coute pour r&eacute;pondre &agrave; toutes vos questions et vous accompagner dans votre projet.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="py-16 md:py-20 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {contactInfo.map((info, i) => {
              const Icon = info.icon;
              return (
                <FadeIn key={i} delay={i * 0.1}>
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-[#007BFF]/20 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full">
                    <CardContent className="p-6 text-center">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${info.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{info.label}</p>
                      {info.href ? (
                        <a
                          href={info.href}
                          className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-[#007BFF] transition-colors"
                        >
                          {info.value}
                        </a>
                      ) : (
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{info.value}</p>
                      )}
                    </CardContent>
                  </Card>
                </FadeIn>
              );
            })}
          </div>

          {/* Contact Form */}
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <FadeIn>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Envoyez-nous un message
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                  Remplissez le formulaire ci-dessous et nous vous r&eacute;pondrons dans les plus brefs d&eacute;lais.
                </p>

                {submitted ? (
                  <div className="p-8 rounded-2xl bg-[#28A745]/5 dark:bg-[#28A745]/10 border border-[#28A745]/20 text-center">
                    <CheckCircle2 className="w-12 h-12 text-[#28A745] mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      Message envoy&eacute;&nbsp;!
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Nous vous r&eacute;pondrons sous 24 heures.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setSubmitted(false)}
                      className="border-gray-300 dark:border-gray-600"
                    >
                      Envoyer un autre message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                      <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm text-center">
                        {error}
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                          Nom <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="firstName"
                          placeholder="Votre nom"
                          value={formData.firstName}
                          onChange={handleChange}
                          className="rounded-xl bg-white dark:bg-gray-800"
                          required
                          disabled={loading}
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                          Pr&eacute;nom
                        </Label>
                        <Input
                          id="lastName"
                          placeholder="Votre pr&eacute;nom"
                          value={formData.lastName}
                          onChange={handleChange}
                          className="rounded-xl bg-white dark:bg-gray-800"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                        Email <span className="text-red-500">*</span>
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
                      <Label htmlFor="subject" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                        Sujet
                      </Label>
                      <Input
                        id="subject"
                        placeholder="Sujet de votre message"
                        value={formData.subject}
                        onChange={handleChange}
                        className="rounded-xl bg-white dark:bg-gray-800"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <Label htmlFor="message" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                        Message <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="message"
                        placeholder="D&eacute;crivez votre demande..."
                        rows={5}
                        className="rounded-xl resize-none bg-white dark:bg-gray-800"
                        required
                        minLength={10}
                        maxLength={5000}
                        disabled={loading}
                        value={formData.message}
                        onChange={handleChange}
                      />
                    </div>
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full bg-[#007BFF] hover:bg-[#0056b3] text-white font-semibold rounded-xl flex items-center justify-center gap-2"
                      disabled={loading}
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Envoi en cours...
                        </span>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Envoyer le message
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Questions fr&eacute;quentes</h3>
                <div className="space-y-4">
                  {[
                    {
                      q: 'Comment d&eacute;marrer avec SmartTicketQR\u00a0?',
                      a: 'Cr&eacute;ez votre compte gratuit, configurez votre premier &eacute;v&eacute;nement ou trajet, et commencez &agrave; vendre des tickets en quelques minutes.',
                    },
                    {
                      q: 'Proposez-vous une d&eacute;monstration\u00a0?',
                      a: 'Oui, nous proposons des d&eacute;monstrations personnalis&eacute;es pour les entreprises. Contactez-nous pour planifier une session.',
                    },
                    {
                      q: 'Quel est le d&eacute;lai de r&eacute;ponse\u00a0?',
                      a: 'Nous r&eacute;pondons g&eacute;n&eacute;ralement dans les 24 heures. Les clients Pro et Enterprise b&eacute;n&eacute;ficient d\'un support prioritaire.',
                    },
                  ].map((item, i) => (
                    <Card key={i} className="border-gray-200 dark:border-gray-800">
                      <CardContent className="p-4">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1">{item.q}</p>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">{item.a}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Pr&ecirc;t &agrave; commencer\u00a0?
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Rejoignez 500+ professionnels qui font d&eacute;j&agrave; confiance &agrave; SmartTicketQR.
            </p>
            <Button
              size="lg"
              onClick={() => handleNav('register')}
              className="w-full sm:w-auto bg-[#007BFF] hover:bg-[#0056b3] text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
            >
              Commencer l&apos;essai gratuit
            </Button>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
