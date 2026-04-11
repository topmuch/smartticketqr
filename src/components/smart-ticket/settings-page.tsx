'use client';

import React, { useState } from 'react';
import {
  Shield,
  Bell,
  Globe,
  Palette,
  Database,
  Key,
  Download,
  RotateCcw,
  Activity,
  CheckCircle2,
  Save,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const settingSections: SettingSection[] = [
  { id: 'general', title: 'General', description: 'Application settings', icon: Globe },
  { id: 'appearance', title: 'Appearance', description: 'Theme and display', icon: Palette },
  { id: 'notifications', title: 'Notifications', description: 'Alert preferences', icon: Bell },
  { id: 'security', title: 'Security', description: 'Security settings', icon: Shield },
  { id: 'data', title: 'Data Management', description: 'Export & backup', icon: Database },
  { id: 'api', title: 'API Keys', description: 'Integration keys', icon: Key },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general');
  const { user } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [companyName, setCompanyName] = useState('SmartTicketQR');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [whatsappNotifications, setWhatsappNotifications] = useState(false);
  const [autoLogout, setAutoLogout] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    toast.success('Settings saved successfully');
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your application preferences and configuration</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Settings Navigation */}
        <div className="lg:w-64 shrink-0">
          <Card>
            <CardContent className="p-2">
              <nav className="flex flex-col gap-0.5">
                {settingSections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left w-full',
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Icon className={cn('h-4 w-4', isActive && 'text-emerald-600 dark:text-emerald-400')} />
                      <div>
                        <div>{section.title}</div>
                        <div className="text-[11px] text-muted-foreground font-normal">{section.description}</div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Settings Content */}
        <div className="flex-1 space-y-6">
          {/* General Settings */}
          {activeSection === 'general' && (
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Configure your application basic settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Enter company name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Default Currency</Label>
                    <Select defaultValue="USD">
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="XOF">XOF - West African CFA</SelectItem>
                        <SelectItem value="XAF">XAF - Central African CFA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select defaultValue="en">
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="ar">العربية</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select defaultValue="utc">
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="utc">UTC</SelectItem>
                        <SelectItem value="gmt">GMT (London)</SelectItem>
                        <SelectItem value="gmt1">GMT+1 (Paris/Dakar)</SelectItem>
                        <SelectItem value="gmt2">GMT+2 (Cairo/Helsinki)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Auto-generate QR codes</p>
                    <p className="text-xs text-muted-foreground">Automatically generate QR codes when tickets are created</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Send ticket via email</p>
                    <p className="text-xs text-muted-foreground">Automatically email tickets to holders</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Appearance Settings */}
          {activeSection === 'appearance' && (
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the look and feel of the application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-sm font-medium">Theme</Label>
                  <p className="text-xs text-muted-foreground mb-3">Select your preferred color theme</p>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setTheme('light')}
                      className={cn(
                        'rounded-lg border-2 p-4 text-center transition-all',
                        theme === 'light'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                          : 'border-border hover:border-muted-foreground'
                      )}
                    >
                      <div className="mx-auto mb-2 h-8 w-8 rounded-full bg-white border" />
                      <span className="text-sm font-medium">Light</span>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={cn(
                        'rounded-lg border-2 p-4 text-center transition-all',
                        theme === 'dark'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                          : 'border-border hover:border-muted-foreground'
                      )}
                    >
                      <div className="mx-auto mb-2 h-8 w-8 rounded-full bg-gray-900 border border-gray-700" />
                      <span className="text-sm font-medium">Dark</span>
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={cn(
                        'rounded-lg border-2 p-4 text-center transition-all',
                        theme === 'system'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                          : 'border-border hover:border-muted-foreground'
                      )}
                    >
                      <div className="mx-auto mb-2 h-8 w-8 rounded-full bg-gradient-to-br from-white to-gray-900 border" />
                      <span className="text-sm font-medium">System</span>
                    </button>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-sm font-medium">Primary Color</Label>
                  <p className="text-xs text-muted-foreground mb-3">Choose the primary accent color</p>
                  <div className="flex gap-3">
                    {['emerald', 'teal', 'amber', 'rose', 'violet'].map((color) => (
                      <button
                        key={color}
                        className={cn(
                          'h-10 w-10 rounded-full border-2 transition-all',
                          color === 'emerald' ? 'border-foreground ring-2 ring-offset-2 ring-emerald-500' : 'border-border'
                        )}
                        style={{
                          backgroundColor:
                            color === 'emerald'
                              ? '#059669'
                              : color === 'teal'
                              ? '#0d9488'
                              : color === 'amber'
                              ? '#d97706'
                              : color === 'rose'
                              ? '#e11d48'
                              : '#7c3aed',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notifications Settings */}
          {activeSection === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Configure how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Email Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive email alerts for important events</p>
                  </div>
                  <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">WhatsApp Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive WhatsApp messages for ticket sales</p>
                  </div>
                  <Switch checked={whatsappNotifications} onCheckedChange={setWhatsappNotifications} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Ticket Sold Alert</p>
                    <p className="text-xs text-muted-foreground">Get notified when a ticket is sold</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Scan Validation Alert</p>
                    <p className="text-xs text-muted-foreground">Get notified for each ticket validation</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Low Ticket Alert</p>
                    <p className="text-xs text-muted-foreground">Alert when tickets are running low</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Settings */}
          {activeSection === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Two-Factor Authentication</p>
                    <p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p>
                  </div>
                  <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Auto Logout</p>
                    <p className="text-xs text-muted-foreground">Automatically log out after inactivity</p>
                  </div>
                  <Switch checked={autoLogout} onCheckedChange={setAutoLogout} />
                </div>
                <Separator />

                <div className="space-y-2">
                  <Label>Session Timeout (minutes)</Label>
                  <Select defaultValue="30">
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Change Password</Label>
                  <div className="space-y-3 max-w-md">
                    <Input type="password" placeholder="Current password" />
                    <Input type="password" placeholder="New password" />
                    <Input type="password" placeholder="Confirm new password" />
                    <Button variant="outline" size="sm">
                      Update Password
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Active Sessions</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        You have 1 active session on this device.
                      </p>
                      <Button variant="outline" size="sm" className="mt-3 h-7 text-xs border-amber-300">
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Revoke All Other Sessions
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data Management */}
          {activeSection === 'data' && (
            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>Export, backup, and manage your data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Download className="h-4 w-4" /> Export Tickets
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">Download all tickets as CSV</p>
                    <Button variant="outline" size="sm" className="mt-3 h-8">
                      Export CSV
                    </Button>
                  </div>
                  <div className="rounded-lg border p-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Download className="h-4 w-4" /> Export Events
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">Download all events data</p>
                    <Button variant="outline" size="sm" className="mt-3 h-8">
                      Export CSV
                    </Button>
                  </div>
                  <div className="rounded-lg border p-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Database className="h-4 w-4" /> Backup Data
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">Create a full database backup</p>
                    <Button variant="outline" size="sm" className="mt-3 h-8">
                      Create Backup
                    </Button>
                  </div>
                  <div className="rounded-lg border p-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Activity className="h-4 w-4" /> Export Analytics
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">Download analytics report</p>
                    <Button variant="outline" size="sm" className="mt-3 h-8">
                      Export Report
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="rounded-lg border border-destructive/30 p-4">
                  <h4 className="text-sm font-medium text-destructive">Danger Zone</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    These actions are irreversible. Please be cautious.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="h-8 text-destructive border-destructive/30">
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset Demo Data
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* API Keys */}
          {activeSection === 'api' && (
            <Card>
              <CardHeader>
                <CardTitle>API Keys & Integrations</CardTitle>
                <CardDescription>Manage your third-party service integrations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                          <span className="text-sm font-bold text-purple-700 dark:text-purple-300">S</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Stripe</p>
                          <p className="text-xs text-muted-foreground">Payment processing</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">Not Connected</Badge>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">API Key</Label>
                      <div className="flex gap-2">
                        <Input type="password" placeholder="sk_live_..." className="text-sm" />
                        <Button variant="outline" size="sm" className="shrink-0">
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-700 dark:text-blue-300">W</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Wave</p>
                          <p className="text-xs text-muted-foreground">Mobile Money payments</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">Not Connected</Badge>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">API Key</Label>
                      <div className="flex gap-2">
                        <Input type="password" placeholder="Enter Wave API key" className="text-sm" />
                        <Button variant="outline" size="sm" className="shrink-0">
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                          <span className="text-sm font-bold text-orange-700 dark:text-orange-300">OM</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Orange Money</p>
                          <p className="text-xs text-muted-foreground">Mobile Money payments</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">Not Connected</Badge>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">API Key</Label>
                      <div className="flex gap-2">
                        <Input type="password" placeholder="Enter Orange Money API key" className="text-sm" />
                        <Button variant="outline" size="sm" className="shrink-0">
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <span className="text-sm font-bold text-green-700 dark:text-green-300">W</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">WhatsApp Business</p>
                          <p className="text-xs text-muted-foreground">WhatsApp notifications</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">Not Connected</Badge>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Phone Number ID</Label>
                      <div className="flex gap-2">
                        <Input placeholder="Enter WhatsApp Business Phone ID" className="text-sm" />
                        <Button variant="outline" size="sm" className="shrink-0">
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <Button variant="outline">Cancel</Button>
            <Button
              onClick={handleSave}
              className={cn(
                'bg-emerald-600 hover:bg-emerald-700 text-white transition-all',
                saved && 'bg-emerald-500'
              )}
            >
              {saved ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
