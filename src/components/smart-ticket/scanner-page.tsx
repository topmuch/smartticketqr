'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ScanLine,
  Camera,
  Upload,
  Ticket,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  AlertTriangle,
  Hash,
  RotateCcw,
  FileText,
  QrCode,
  Keyboard,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  MapPin,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';

// ============================================================
// Types
// ============================================================

interface ValidateResponse {
  success: boolean;
  status: 'valid' | 'used' | 'expired' | 'invalid';
  sound_hint: 'success' | 'error';
  message: string;
  qr_verified?: boolean;
  scan_id?: string;
  geo: {
    within_threshold: boolean;
    distance: number | null;
    max_distance: number;
    alert: string | null;
  } | null;
  ticket: {
    id: string;
    ticketCode: string;
    ticketType: string;
    holderName: string;
    holderEmail?: string;
    holderPhone?: string;
    seatNumber?: string;
    price?: number;
    currency?: string;
    validatedAt?: string;
    event: {
      id?: string;
      name: string;
      type?: string;
      location?: string;
      startDate?: string;
    };
  } | null;
}

interface ScanRecord {
  id: string;
  ticketId: string;
  eventId: string;
  result: string;
  createdAt: string;
  ticket: {
    id: string;
    ticketCode: string;
    ticketType: string;
    holderName: string;
    status: string;
  };
  event: {
    id: string;
    name: string;
    type: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface ScanHistoryResponse {
  data: ScanRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface OfflineQueueItem {
  ticketCode: string;
  scannedAt: string;
  latitude: number | null;
  longitude: number | null;
  synced: boolean;
}

// ============================================================
// API Helper
// ============================================================

function getApiHeaders() {
  const token = useAuthStore.getState().token;
  const orgId = useOrgStore.getState().currentOrganization?.id;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Organization-Id': orgId || '',
  };
}

// ============================================================
// IndexedDB Helpers (Offline Queue)
// ============================================================

const DB_NAME = 'smartticket-offline';
const DB_VERSION = 1;
const STORE_NAME = 'scan-queue';

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'ticketCode' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('[IndexedDB] Failed to open database');
        resolve(null);
      };
    } catch {
      console.warn('[IndexedDB] Not available (private browsing?)');
      resolve(null);
    }
  });
}

async function addToOfflineQueue(item: OfflineQueueItem): Promise<void> {
  try {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(item);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      console.warn('[IndexedDB] Failed to add item to queue');
      db.close();
    };
  } catch {
    // Graceful degradation — IndexedDB not available
  }
}

async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  try {
    const db = await openDB();
    if (!db) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const items = request.result as OfflineQueueItem[];
        db.close();
        resolve(items);
      };
      request.onerror = () => {
        db.close();
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

async function clearOfflineQueue(): Promise<void> {
  try {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  } catch {
    // Graceful degradation
  }
}

async function syncOfflineQueue(): Promise<void> {
  const queue = await getOfflineQueue();
  const unsynced = queue.filter((item) => !item.synced);
  if (unsynced.length === 0) return;

  try {
    const res = await fetch('/api/offline-sync', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ scans: unsynced }),
    });
    if (res.ok) {
      await clearOfflineQueue();
      toast.success(`Synced ${unsynced.length} offline scan(s)`);
    } else {
      toast.error('Offline sync failed — will retry when back online');
    }
  } catch {
    toast.error('Offline sync failed — will retry when back online');
  }
}

// ============================================================
// Geolocation Helper
// ============================================================

function getGeolocation(): Promise<{ latitude: number | null; longitude: number | null }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ latitude: null, longitude: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        // Respect privacy — fail silently
        resolve({ latitude: null, longitude: null });
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  });
}

// ============================================================
// Audio & Vibration Helpers
// ============================================================

function vibrateSuccess() {
  try {
    if (navigator.vibrate) navigator.vibrate([100]);
  } catch {
    // Not available
  }
}

function vibrateError() {
  try {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  } catch {
    // Not available
  }
}

// ============================================================
// Component
// ============================================================

export default function ScannerPage() {
  // -- State --
  const [ticketCode, setTicketCode] = useState('');
  const [scanResult, setScanResult] = useState<ValidateResponse | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showViewfinder, setShowViewfinder] = useState(false);
  const [flashColor, setFlashColor] = useState<'green' | 'red' | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scannerStarted, setScannerStarted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const errorAudioRef = useRef<HTMLAudioElement | null>(null);
  const queryClient = useQueryClient();

  // ============================================================
  // Online/Offline Status
  // ============================================================

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online — syncing queued scans...');
      syncOfflineQueue().then(() => refreshSyncQueueCount());
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline — scans will be queued');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ============================================================
  // Sync Queue Count Polling
  // ============================================================

  const refreshSyncQueueCount = useCallback(async () => {
    const queue = await getOfflineQueue();
    setSyncQueueCount(queue.filter((item) => !item.synced).length);
  }, []);

  useEffect(() => {
    refreshSyncQueueCount();
    const interval = setInterval(refreshSyncQueueCount, 5000);
    return () => clearInterval(interval);
  }, [refreshSyncQueueCount]);

  // ============================================================
  // Today's Scan Count
  // ============================================================

  useEffect(() => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    fetch(`/api/scans?page=1&limit=1&startDate=${today.toISOString()}`, {
      headers: getApiHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        setScanCount(data.total || 0);
      })
      .catch(() => {});
  }, [scanResult]);

  // ============================================================
  // Scan History Query
  // ============================================================

  const { data: scanHistory, isLoading: historyLoading } = useQuery<ScanHistoryResponse>({
    queryKey: ['scan-history'],
    queryFn: async () => {
      const res = await fetch('/api/scans?page=1&limit=20', {
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch scan history');
      return res.json();
    },
  });

  // ============================================================
  // Audio Initialization (on user gesture)
  // ============================================================

  const initAudio = useCallback(() => {
    if (successAudioRef.current && errorAudioRef.current) return;
    try {
      successAudioRef.current = new Audio('/audio/success.wav');
      errorAudioRef.current = new Audio('/audio/error.wav');
      successAudioRef.current.preload = 'auto';
      errorAudioRef.current.preload = 'auto';
    } catch {
      // Audio not supported
    }
  }, []);

  const playSound = useCallback((hint: 'success' | 'error') => {
    if (!soundEnabled) return;
    try {
      const audio = hint === 'success' ? successAudioRef.current : errorAudioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        // Audio not initialized, use vibration only
        if (hint === 'success') vibrateSuccess();
        else vibrateError();
      }
    } catch {
      if (hint === 'success') vibrateSuccess();
      else vibrateError();
    }
  }, [soundEnabled]);

  // ============================================================
  // Validate Mutation
  // ============================================================

  const validateMutation = useMutation({
    mutationFn: async ({ code, lat, lng }: { code: string; lat: number | null; lng: number | null }) => {
      const res = await fetch('/api/tickets/validate', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ ticketCode: code, latitude: lat, longitude: lng }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Validation failed' }));
        throw new Error(err.error || 'Validation failed');
      }
      return res.json() as Promise<ValidateResponse>;
    },
    onSuccess: (data) => {
      setScanResult(data);
      setFlashColor(data.status === 'valid' ? 'green' : 'red');
      setScanCount((prev) => prev + 1);

      // Play audio + vibration based on sound_hint
      if (data.sound_hint === 'success') {
        playSound('success');
        vibrateSuccess();
      } else {
        playSound('error');
        vibrateError();
      }

      if (data.status === 'valid') {
        toast.success('Ticket validated!', {
          description: `${data.ticket?.holderName} - ${data.ticket?.event.name}`,
        });
      } else if (data.status === 'used') {
        toast.warning('Ticket already used', {
          description: data.message,
        });
      } else if (data.status === 'expired') {
        toast.warning('Ticket expired', {
          description: data.message,
        });
      } else {
        toast.error('Validation failed', {
          description: data.message,
        });
      }

      // Geo alert banner
      if (data.geo?.alert) {
        toast.warning('Location Alert', {
          description: data.geo.alert,
          duration: 6000,
        });
      }

      setTimeout(() => setFlashColor(null), 1500);
      queryClient.invalidateQueries({ queryKey: ['scan-history'] });
    },
    onError: (error) => {
      toast.error('Error', { description: error.message });
      setFlashColor('red');
      playSound('error');
      vibrateError();
      setTimeout(() => setFlashColor(null), 1500);
    },
  });

  // ============================================================
  // Scan Handler
  // ============================================================

  const handleScan = useCallback(async () => {
    const code = ticketCode.trim();
    if (!code) {
      toast.error('Please enter a ticket code');
      return;
    }

    // Initialize audio on first scan (user gesture)
    initAudio();
    setScannerStarted(true);

    setIsScanning(true);

    try {
      // Capture geolocation
      const geo = await getGeolocation();

      // Check online status
      if (!navigator.onLine) {
        // Offline: queue the scan in IndexedDB
        await addToOfflineQueue({
          ticketCode: code,
          scannedAt: new Date().toISOString(),
          latitude: geo.latitude,
          longitude: geo.longitude,
          synced: false,
        });
        await refreshSyncQueueCount();

        // Show a local result so the scanner doesn't feel broken
        setScanResult({
          success: false,
          status: 'valid',
          sound_hint: 'success',
          message: 'Scan queued offline — will sync when connection is restored',
          geo: null,
          ticket: {
            id: 'offline',
            ticketCode: code,
            ticketType: 'Queued',
            holderName: 'Offline Scan',
            event: {
              name: 'Pending Sync',
            },
          },
        });
        setFlashColor('green');
        playSound('success');
        vibrateSuccess();
        setTimeout(() => setFlashColor(null), 1500);
        toast.success('Scan queued offline', {
          description: 'Will sync when you are back online',
        });
      } else {
        // Online: call the validation API
        validateMutation.mutate({ code, lat: geo.latitude, lng: geo.longitude });
      }
    } catch {
      // Fallback: try API call without geo
      validateMutation.mutate({ code, lat: null, lng: null });
    } finally {
      setIsScanning(false);
    }
  }, [ticketCode, validateMutation, initAudio, playSound, refreshSyncQueueCount]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  const handleReset = () => {
    setTicketCode('');
    setScanResult(null);
    setFlashColor(null);
  };

  const handleStartScanner = useCallback(() => {
    initAudio();
    setScannerStarted(true);
    setShowViewfinder(true);
  }, [initAudio]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    initAudio();
    setScannerStarted(true);

    const name = file.name.replace(/\.[^/.]+$/, '');
    if (name && name.length > 3) {
      setTicketCode(name);
      toast.info('Code extracted from filename. Click Scan to validate.');
    } else {
      toast.info('Could not extract code from image. Please enter manually.');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleManualSync = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error('Still offline — cannot sync now');
      return;
    }
    toast.info('Syncing offline scans...');
    await syncOfflineQueue();
    await refreshSyncQueueCount();
  }, [refreshSyncQueueCount]);

  // ============================================================
  // Result Helpers
  // ============================================================

  const getResultIcon = () => {
    if (!scanResult) return null;
    switch (scanResult.status) {
      case 'valid':
        return <CheckCircle2 className="h-6 w-6 text-emerald-500" />;
      case 'used':
        return <AlertTriangle className="h-6 w-6 text-amber-500" />;
      case 'expired':
        return <Clock className="h-6 w-6 text-amber-500" />;
      default:
        return <XCircle className="h-6 w-6 text-red-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">Valid</Badge>;
      case 'used':
        return <Badge className="bg-amber-500 text-white hover:bg-amber-600">Used</Badge>;
      case 'expired':
        return <Badge className="bg-amber-500 text-white hover:bg-amber-600">Expired</Badge>;
      default:
        return <Badge variant="destructive">Invalid</Badge>;
    }
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <QrCode className="h-7 w-7 text-emerald-500" />
            Ticket Scanner
          </h2>
          <p className="text-muted-foreground">Scan or enter ticket codes to validate</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Offline/Online Status Badge */}
          <Badge
            variant="outline"
            className={`text-sm px-3 py-1 gap-1.5 ${
              isOnline
                ? 'border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400'
                : 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400'
            }`}
          >
            {isOnline ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            {isOnline ? 'Online' : 'Offline'}
          </Badge>

          {/* Sync Queue Count Badge */}
          {syncQueueCount > 0 && (
            <Badge
              variant="outline"
              className="text-sm px-3 py-1 gap-1.5 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 cursor-pointer"
              onClick={handleManualSync}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {syncQueueCount} pending
            </Badge>
          )}

          {/* Scan Count Badge */}
          <Badge variant="outline" className="text-sm px-3 py-1 gap-1.5">
            <ScanLine className="h-3.5 w-3.5" />
            {scanCount} scans today
          </Badge>

          {/* Sound Toggle */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-muted-foreground" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>

      {/* Offline Alert Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
              <WifiOff className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  You are offline
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Scans will be queued locally and synced automatically when you reconnect.
                  {syncQueueCount > 0 && ` ${syncQueueCount} scan(s) waiting.`}
                </p>
              </div>
              {isOnline && syncQueueCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={handleManualSync}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Sync Now
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ============================================================ */}
        {/* Left: Scanner Area */}
        {/* ============================================================ */}
        <div className="space-y-4">
          {/* Viewfinder Card */}
          <Card className="overflow-hidden relative">
            <CardContent className="p-0">
              {/* Flash overlay */}
              <AnimatePresence>
                {flashColor && (
                  <motion.div
                    initial={{ opacity: 0.8 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5 }}
                    className={`absolute inset-0 z-30 pointer-events-none ${
                      flashColor === 'green'
                        ? 'bg-emerald-400/30'
                        : 'bg-red-400/30'
                    }`}
                  />
                )}
              </AnimatePresence>

              {/* Viewfinder */}
              <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center overflow-hidden">
                {showViewfinder ? (
                  <div className="relative w-full h-full">
                    {/* Camera simulation background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Camera className="h-16 w-16 text-gray-600 animate-pulse" />
                    </div>

                    {/* Scanning corners */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-56 sm:h-56">
                      {/* Top-left */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
                      {/* Top-right */}
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
                      {/* Bottom-left */}
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
                      {/* Bottom-right */}
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />

                      {/* Animated scanning line */}
                      <motion.div
                        className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                        animate={{ top: ['5%', '95%', '5%'] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      />

                      {/* Center icon */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30">
                        <QrCode className="h-20 w-20 text-emerald-400" />
                      </div>
                    </div>

                    {/* Camera overlay text */}
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <p className="text-emerald-400 text-sm font-medium">Point camera at QR code</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-gray-400">
                    <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-600 flex items-center justify-center">
                      <QrCode className="h-12 w-12" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-300">Ready to Scan</p>
                      <p className="text-xs text-gray-500 mt-1">Enter a code below or activate the scanner</p>
                    </div>
                  </div>
                )}

                {/* Scanner controls overlay */}
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                    onClick={showViewfinder ? () => setShowViewfinder(false) : handleStartScanner}
                  >
                    <Camera className="h-4 w-4 mr-1.5" />
                    {showViewfinder ? 'Hide' : 'Start Scanner'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Manual Input Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Keyboard className="h-4 w-4" />
                Manual Entry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter ticket code (e.g., ST-XXXX-XXXX)"
                  value={ticketCode}
                  onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  className="font-mono text-sm"
                  disabled={isScanning}
                />
                <Button
                  onClick={handleScan}
                  disabled={isScanning || !ticketCode.trim()}
                  className="shrink-0"
                >
                  {isScanning ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <ScanLine className="h-4 w-4" />
                    </motion.div>
                  ) : (
                    <ScanLine className="h-4 w-4 mr-1.5" />
                  )}
                  Scan
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Upload QR Image
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Reset
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </CardContent>
          </Card>

          {/* Result Card */}
          <AnimatePresence mode="wait">
            {scanResult && (
              <motion.div
                key={scanResult.scan_id || scanResult.ticket?.ticketCode || 'result'}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              >
                <Card
                  className={`border-2 ${
                    scanResult.status === 'valid'
                      ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : scanResult.status === 'used'
                        ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20'
                        : scanResult.status === 'expired'
                          ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20'
                          : 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20'
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {getResultIcon()}
                        {scanResult.status === 'valid'
                          ? 'Ticket Valid'
                          : scanResult.status === 'used'
                            ? 'Ticket Already Used'
                            : scanResult.status === 'expired'
                              ? 'Ticket Expired'
                              : 'Ticket Invalid'}
                      </CardTitle>
                      {getStatusBadge(scanResult.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">{scanResult.message}</p>

                    {/* QR Verification Badge */}
                    {scanResult.qr_verified && (
                      <Badge variant="outline" className="mt-2 gap-1 text-xs border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400">
                        <ShieldAlert className="h-3 w-3" />
                        QR Signature Verified
                      </Badge>
                    )}
                  </CardHeader>

                  {/* Geo Alert Banner */}
                  {scanResult.geo?.alert && (
                    <div className="px-6 pb-2">
                      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-700 dark:bg-amber-950/30">
                        <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                            Location Alert
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            {scanResult.geo.alert}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {scanResult.ticket && (
                    <CardContent>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Hash className="h-3 w-3" /> Ticket Code
                            </p>
                            <p className="text-sm font-mono font-medium">{scanResult.ticket.ticketCode}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Ticket className="h-3 w-3" /> Type
                            </p>
                            <p className="text-sm font-medium">{scanResult.ticket.ticketType}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" /> Holder
                            </p>
                            <p className="text-sm font-medium">{scanResult.ticket.holderName}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <FileText className="h-3 w-3" /> Event
                            </p>
                            <p className="text-sm font-medium">{scanResult.ticket.event.name}</p>
                          </div>
                        </div>

                        {/* Geo Distance Display */}
                        {scanResult.geo && scanResult.geo.distance !== null && (
                          <div className="flex items-center gap-2 rounded-md border p-2.5 bg-muted/30">
                            <MapPin
                              className={`h-4 w-4 shrink-0 ${
                                scanResult.geo.within_threshold
                                  ? 'text-emerald-500'
                                  : 'text-red-500'
                              }`}
                            />
                            <div className="flex-1">
                              <p className="text-xs font-medium">
                                Distance:{' '}
                                {scanResult.geo.distance < 1
                                  ? `${Math.round(scanResult.geo.distance * 1000)}m`
                                  : `${scanResult.geo.distance.toFixed(1)}km`}
                                {' / '}
                                {scanResult.geo.max_distance < 1
                                  ? `${Math.round(scanResult.geo.max_distance * 1000)}m`
                                  : `${scanResult.geo.max_distance.toFixed(1)}km`}
                                {' threshold'}
                              </p>
                              <p
                                className={`text-xs ${
                                  scanResult.geo.within_threshold
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}
                              >
                                {scanResult.geo.within_threshold
                                  ? 'Within allowed range'
                                  : 'Outside allowed range'}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Price Display */}
                        {scanResult.ticket.price != null && scanResult.ticket.currency && (
                          <Separator />
                        )}

                        {scanResult.ticket.price != null && scanResult.ticket.currency && (
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">Price</p>
                            <p className="text-sm font-semibold">
                              {scanResult.ticket.price.toLocaleString()} {scanResult.ticket.currency}
                            </p>
                          </div>
                        )}

                        {scanResult.ticket.holderEmail && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p className="text-sm">{scanResult.ticket.holderEmail}</p>
                          </div>
                        )}

                        {scanResult.ticket.holderPhone && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Phone</p>
                            <p className="text-sm">{scanResult.ticket.holderPhone}</p>
                          </div>
                        )}

                        {scanResult.ticket.seatNumber && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Seat</p>
                            <p className="text-sm font-medium">{scanResult.ticket.seatNumber}</p>
                          </div>
                        )}

                        {scanResult.ticket.validatedAt && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Validated At
                            </p>
                            <p className="text-sm">
                              {new Date(scanResult.ticket.validatedAt).toLocaleString()}
                            </p>
                          </div>
                        )}

                        {scanResult.ticket.event.location && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> Location
                            </p>
                            <p className="text-sm">{scanResult.ticket.event.location}</p>
                          </div>
                        )}

                        {scanResult.ticket.event.startDate && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Event Date
                            </p>
                            <p className="text-sm">
                              {new Date(scanResult.ticket.event.startDate).toLocaleDateString(undefined, {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ============================================================ */}
        {/* Right: Scan History */}
        {/* ============================================================ */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent Scans
                </CardTitle>
                {syncQueueCount > 0 && isOnline && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleManualSync}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Sync {syncQueueCount}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : scanHistory && scanHistory.data.length > 0 ? (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {scanHistory.data.map((scan) => (
                    <motion.div
                      key={scan.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                          scan.result === 'valid'
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {scan.result === 'valid' ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : scan.result === 'already_used' ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : scan.result === 'expired' ? (
                          <Clock className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {scan.ticket?.holderName || 'Unknown'}
                          </p>
                          <Badge
                            variant={
                              scan.result === 'valid'
                                ? 'default'
                                : 'destructive'
                            }
                            className={`text-[10px] px-1.5 py-0 ${
                              scan.result === 'valid'
                                ? 'bg-emerald-500 hover:bg-emerald-600'
                                : ''
                            }`}
                          >
                            {scan.result}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {scan.ticket?.ticketCode} &middot; {scan.event?.name}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {new Date(scan.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          by {scan.user?.name?.split(' ')[0] || 'System'}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ScanLine className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No scans yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Scan a ticket to see it appear here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          {scanHistory && scanHistory.data.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-500">
                    {scanHistory.data.filter((s) => s.result === 'valid').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Valid</p>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-500">
                    {scanHistory.data.filter((s) => s.result === 'already_used' || s.result === 'expired').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Used / Exp</p>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">
                    {scanHistory.data.filter((s) => s.result === 'invalid').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Invalid</p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
