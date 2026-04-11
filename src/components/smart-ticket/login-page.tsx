'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Ticket,
  QrCode,
  Mail,
  Lock,
  User,
  Shield,
  Bus,
  Ship,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  BarChart3,
  ScanLine,
  Database,
} from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import { useOrgStore, type Organization } from '@/store/org-store';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState('operator');

  const authStore = useAuthStore();
  const appStore = useAppStore();
  const orgStore = useOrgStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginEmail || !loginPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Login failed');
        return;
      }

      authStore.login(data.user, data.token);

      // Fetch user's organizations after login
      try {
        const orgRes = await fetch('/api/organizations', {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        if (orgRes.ok) {
          const orgData = await orgRes.json();
          const orgs: Organization[] = Array.isArray(orgData) ? orgData : orgData.data || [];
          orgStore.setOrganizations(orgs);
        }
      } catch {
        // Organization fetch failed silently - non-blocking
      }

      toast.success(`Welcome back, ${data.user.name}!`);
      appStore.setCurrentPage('dashboard');
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regName || !regEmail || !regPassword || !regConfirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (regPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          role: regRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Registration failed');
        return;
      }

      authStore.login(data.user, data.token);

      // Fetch user's organizations after registration
      try {
        const orgRes = await fetch('/api/organizations', {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        if (orgRes.ok) {
          const orgData = await orgRes.json();
          const orgs: Organization[] = Array.isArray(orgData) ? orgData : orgData.data || [];
          orgStore.setOrganizations(orgs);
        }
      } catch {
        // Organization fetch failed silently - non-blocking
      }

      toast.success(`Account created! Welcome, ${data.user.name}!`);
      appStore.setCurrentPage('dashboard');
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch('/api/auth/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        toast.info(data.message || 'Seed already completed');
        return;
      }

      toast.success(
        `Demo data loaded! ${data.stats?.events || 0} events, ${data.stats?.tickets || 0} tickets created.`
      );
    } catch {
      toast.error('Failed to seed demo data');
    } finally {
      setIsSeeding(false);
    }
  };

  const formVariants = {
    enter: { opacity: 0, x: 40, scale: 0.97 },
    center: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -40, scale: 0.97 },
  };

  const featureIcons = [
    { icon: QrCode, label: 'QR Generation' },
    { icon: ScanLine, label: 'Real-time Validation' },
    { icon: BarChart3, label: 'Analytics Dashboard' },
  ];

  const transportIcons = [Bus, Ship];

  return (
    <div className="flex min-h-screen w-full">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-700">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-emerald-400 blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-emerald-300 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-emerald-500 blur-3xl" />
        </div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-center">
          {/* Main QR/Ticket Illustration */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="relative mb-10"
          >
            {/* Outer glow ring */}
            <div className="absolute -inset-6 rounded-3xl bg-emerald-400/20 blur-2xl" />
            {/* Main card */}
            <div className="relative w-56 h-56 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              {/* Inner card with ticket + QR */}
              <div className="w-44 h-44 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 flex flex-col items-center justify-center gap-3">
                <div className="relative">
                  <Ticket className="w-14 h-14 text-emerald-300" strokeWidth={1.5} />
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-md bg-white/20 flex items-center justify-center">
                    <QrCode className="w-4 h-4 text-emerald-200" strokeWidth={2} />
                  </div>
                </div>
                <div className="flex gap-1">
                  <div className="w-8 h-1 rounded-full bg-emerald-300/60" />
                  <div className="w-5 h-1 rounded-full bg-emerald-300/40" />
                  <div className="w-6 h-1 rounded-full bg-emerald-300/50" />
                </div>
              </div>
            </div>

            {/* Floating transport icons */}
            {transportIcons.map((Icon, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + idx * 0.2, type: 'spring' }}
                className={`absolute w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center ${
                  idx === 0 ? '-top-3 -right-3' : '-bottom-3 -left-3'
                }`}
              >
                <Icon className="w-5 h-5 text-emerald-200" />
              </motion.div>
            ))}
          </motion.div>

          {/* App Name */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-4xl font-bold text-white tracking-tight"
          >
            SmartTicket
            <span className="text-emerald-300">QR</span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-3 text-lg text-emerald-100/80 max-w-md"
          >
            Digital Ticket Management & Validation Platform
          </motion.p>

          {/* Feature highlights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="mt-10 flex flex-col gap-4"
          >
            {featureIcons.map(({ icon: FeatureIcon, label }, idx) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + idx * 0.15 }}
                className="flex items-center gap-3 text-emerald-100/70"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-400/20 flex items-center justify-center">
                  <FeatureIcon className="w-4.5 h-4.5 text-emerald-300" />
                </div>
                <span className="text-sm font-medium">{label}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Bottom decoration */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="absolute bottom-8 left-0 right-0 flex justify-center gap-6 text-emerald-300/40"
          >
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-emerald-300"
                style={{ opacity: 0.3 + i * 0.15 }}
              />
            ))}
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center bg-background px-4 py-8 sm:px-8 lg:px-16">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2 lg:hidden mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-emerald-700">
              SmartTicket<span className="text-emerald-500">QR</span>
            </span>
          </div>

          {/* Tab Toggle */}
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as 'login' | 'register')}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6 h-11 bg-emerald-50 dark:bg-emerald-950/30">
              <TabsTrigger
                value="login"
                className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-emerald-700 dark:text-emerald-400 font-medium transition-all"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-emerald-700 dark:text-emerald-400 font-medium transition-all"
              >
                Register
              </TabsTrigger>
            </TabsList>

            <AnimatePresence mode="wait">
              {/* Login Form */}
              {mode === 'login' && (
                <TabsContent value="login" forceMount asChild>
                  <motion.div
                    key="login-form"
                    variants={formVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    <Card className="border-0 shadow-none bg-transparent">
                      <CardHeader className="pb-4 px-0">
                        <div className="space-y-1">
                          <h2 className="text-2xl font-bold tracking-tight text-foreground">
                            Welcome back
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            Enter your credentials to access your account
                          </p>
                        </div>
                      </CardHeader>
                      <CardContent className="px-0" asChild>
                        <form onSubmit={handleLogin} className="space-y-4">
                          <div className="space-y-2">
                            <Label
                              htmlFor="login-email"
                              className="text-sm font-medium text-foreground"
                            >
                              Email
                            </Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="login-email"
                                type="email"
                                placeholder="you@example.com"
                                className="pl-10 h-11 bg-background border-border focus:border-emerald-500 focus:ring-emerald-500/20"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                disabled={isLoading}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="login-password"
                              className="text-sm font-medium text-foreground"
                            >
                              Password
                            </Label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter your password"
                                className="pl-10 pr-10 h-11 bg-background border-border focus:border-emerald-500 focus:ring-emerald-500/20"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                disabled={isLoading}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                tabIndex={-1}
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                          <Button
                            type="submit"
                            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm cursor-pointer"
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Signing in...
                              </>
                            ) : (
                              'Sign In'
                            )}
                          </Button>
                        </form>
                      </CardContent>
                      <CardFooter className="px-0 pt-2">
                        <p className="text-sm text-muted-foreground w-full text-center">
                          Don&apos;t have an account?{' '}
                          <button
                            type="button"
                            onClick={() => setMode('register')}
                            className="text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer"
                          >
                            Register
                          </button>
                        </p>
                      </CardFooter>
                    </Card>
                  </motion.div>
                </TabsContent>
              )}

              {/* Register Form */}
              {mode === 'register' && (
                <TabsContent value="register" forceMount asChild>
                  <motion.div
                    key="register-form"
                    variants={formVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    <Card className="border-0 shadow-none bg-transparent">
                      <CardHeader className="pb-4 px-0">
                        <div className="space-y-1">
                          <h2 className="text-2xl font-bold tracking-tight text-foreground">
                            Create an account
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            Fill in the details below to get started
                          </p>
                        </div>
                      </CardHeader>
                      <CardContent className="px-0" asChild>
                        <form onSubmit={handleRegister} className="space-y-4">
                          <div className="space-y-2">
                            <Label
                              htmlFor="reg-name"
                              className="text-sm font-medium text-foreground"
                            >
                              Full Name
                            </Label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="reg-name"
                                type="text"
                                placeholder="John Doe"
                                className="pl-10 h-11 bg-background border-border focus:border-emerald-500 focus:ring-emerald-500/20"
                                value={regName}
                                onChange={(e) => setRegName(e.target.value)}
                                disabled={isLoading}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="reg-email"
                              className="text-sm font-medium text-foreground"
                            >
                              Email
                            </Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="reg-email"
                                type="email"
                                placeholder="you@example.com"
                                className="pl-10 h-11 bg-background border-border focus:border-emerald-500 focus:ring-emerald-500/20"
                                value={regEmail}
                                onChange={(e) => setRegEmail(e.target.value)}
                                disabled={isLoading}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label
                                htmlFor="reg-password"
                                className="text-sm font-medium text-foreground"
                              >
                                Password
                              </Label>
                              <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  id="reg-password"
                                  type={showPassword ? 'text' : 'password'}
                                  placeholder="Min. 6 chars"
                                  className="pl-10 pr-10 h-11 bg-background border-border focus:border-emerald-500 focus:ring-emerald-500/20"
                                  value={regPassword}
                                  onChange={(e) =>
                                    setRegPassword(e.target.value)
                                  }
                                  disabled={isLoading}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                  tabIndex={-1}
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor="reg-confirm-password"
                                className="text-sm font-medium text-foreground"
                              >
                                Confirm
                              </Label>
                              <div className="relative">
                                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  id="reg-confirm-password"
                                  type={
                                    showConfirmPassword ? 'text' : 'password'
                                  }
                                  placeholder="Repeat password"
                                  className="pl-10 pr-10 h-11 bg-background border-border focus:border-emerald-500 focus:ring-emerald-500/20"
                                  value={regConfirmPassword}
                                  onChange={(e) =>
                                    setRegConfirmPassword(e.target.value)
                                  }
                                  disabled={isLoading}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowConfirmPassword(!showConfirmPassword)
                                  }
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                  tabIndex={-1}
                                >
                                  {showConfirmPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Role selector - visible */}
                          <div className="space-y-2">
                            <Label
                              htmlFor="reg-role"
                              className="text-sm font-medium text-foreground"
                            >
                              Role
                            </Label>
                            <div className="relative">
                              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                              <Select
                                value={regRole}
                                onValueChange={setRegRole}
                                disabled={isLoading}
                              >
                                <SelectTrigger className="pl-10 h-11 bg-background border-border focus:border-emerald-500 focus:ring-emerald-500/20">
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="super_admin">
                                    Super Admin
                                  </SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="operator">
                                    Operator
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              First user registered will automatically become Super
                              Admin
                            </p>
                          </div>

                          <Button
                            type="submit"
                            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm cursor-pointer"
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating account...
                              </>
                            ) : (
                              'Create Account'
                            )}
                          </Button>
                        </form>
                      </CardContent>
                      <CardFooter className="px-0 pt-2">
                        <p className="text-sm text-muted-foreground w-full text-center">
                          Already have an account?{' '}
                          <button
                            type="button"
                            onClick={() => setMode('login')}
                            className="text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer"
                          >
                            Sign In
                          </button>
                        </p>
                      </CardFooter>
                    </Card>
                  </motion.div>
                </TabsContent>
              )}
            </AnimatePresence>
          </Tabs>

          {/* Demo Data Seeder */}
          <div className="mt-8 border-t border-border pt-6">
            <Button
              variant="outline"
              className="w-full h-11 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-400 dark:text-emerald-400 dark:hover:bg-emerald-950/30 cursor-pointer"
              onClick={handleSeed}
              disabled={isSeeding}
            >
              {isSeeding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading demo data...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Load Demo Data
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Seeds demo accounts, events, tickets, and scan data
            </p>
            <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground/80 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-emerald-500" />
                Demo Credentials
              </p>
              <p>Admin: admin@smartticketqr.com</p>
              <p>Manager: john@smartticketqr.com</p>
              <p>Operator: sarah@smartticketqr.com</p>
              <p>Password: Admin@123</p>
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-10 pb-4 text-center">
            <p className="text-xs text-muted-foreground">
              &copy; 2024 SmartTicketQR. All rights reserved.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
