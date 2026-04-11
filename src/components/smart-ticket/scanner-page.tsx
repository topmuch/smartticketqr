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
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';

interface ValidateResponse {
  valid: boolean;
  ticket: {
    id: string;
    ticketCode: string;
    ticketType: string;
    holderName: string;
    holderEmail?: string;
    holderPhone?: string;
    seatNumber?: string;
    validatedAt?: string;
    event: {
      id?: string;
      name: string;
      type?: string;
      location?: string;
      startDate?: string;
    };
  } | null;
  message: string;
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

function getApiHeaders() {
  const token = useAuthStore.getState().token;
  const orgId = useOrgStore.getState().currentOrganization?.id;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Organization-Id': orgId || '',
  };
}

export default function ScannerPage() {
  const [ticketCode, setTicketCode] = useState('');
  const [scanResult, setScanResult] = useState<ValidateResponse | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showViewfinder, setShowViewfinder] = useState(false);
  const [flashColor, setFlashColor] = useState<'green' | 'red' | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Track today's scan count
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

  // Fetch scan history
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

  // Validate ticket mutation
  const validateMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch('/api/tickets/validate', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ ticketCode: code }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Validation failed' }));
        throw new Error(err.error || 'Validation failed');
      }
      return res.json() as Promise<ValidateResponse>;
    },
    onSuccess: (data) => {
      setScanResult(data);
      setFlashColor(data.valid ? 'green' : 'red');
      setScanCount((prev) => prev + 1);

      if (data.valid) {
        toast.success('Ticket validated!', {
          description: `${data.ticket?.holderName} - ${data.ticket?.event.name}`,
        });
      } else {
        toast.error('Validation failed', {
          description: data.message,
        });
      }

      setTimeout(() => setFlashColor(null), 1500);
      queryClient.invalidateQueries({ queryKey: ['scan-history'] });
    },
    onError: (error) => {
      toast.error('Error', { description: error.message });
      setFlashColor('red');
      setTimeout(() => setFlashColor(null), 1500);
    },
  });

  const handleScan = useCallback(() => {
    const code = ticketCode.trim();
    if (!code) {
      toast.error('Please enter a ticket code');
      return;
    }
    setIsScanning(true);
    validateMutation.mutate(code, {
      onSettled: () => setIsScanning(false),
    });
  }, [ticketCode, validateMutation]);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Extract text from filename or prompt user
    const name = file.name.replace(/\.[^/.]+$/, '');
    if (name && name.length > 3) {
      setTicketCode(name);
      toast.info('Code extracted from filename. Click Scan to validate.');
    } else {
      toast.info('Could not extract code from image. Please enter manually.');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getResultIcon = () => {
    if (!scanResult) return null;
    if (scanResult.valid) return <CheckCircle2 className="h-6 w-6 text-emerald-500" />;
    return <XCircle className="h-6 w-6 text-red-500" />;
  };

  const getResultBadge = () => {
    if (!scanResult) return null;
    return scanResult.valid ? (
      <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">Valid</Badge>
    ) : (
      <Badge variant="destructive">Invalid</Badge>
    );
  };

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
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm px-3 py-1">
            <ScanLine className="h-3.5 w-3.5 mr-1.5" />
            {scanCount} scans today
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            <Volume2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            Sound On
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Scanner Area */}
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

                {/* Scan button overlay */}
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                    onClick={() => setShowViewfinder(!showViewfinder)}
                  >
                    <Camera className="h-4 w-4 mr-1.5" />
                    {showViewfinder ? 'Hide' : 'Scanner'}
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
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              >
                <Card
                  className={`border-2 ${
                    scanResult.valid
                      ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20'
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {getResultIcon()}
                        {scanResult.valid ? 'Ticket Valid' : 'Ticket Invalid'}
                      </CardTitle>
                      {getResultBadge()}
                    </div>
                    <p className="text-sm text-muted-foreground">{scanResult.message}</p>
                  </CardHeader>
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

                        {scanResult.ticket.holderEmail && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p className="text-sm">{scanResult.ticket.holderEmail}</p>
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
                            <p className="text-xs text-muted-foreground">Location</p>
                            <p className="text-sm">{scanResult.ticket.event.location}</p>
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

        {/* Right: Scan History */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Scans
              </CardTitle>
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
                    {scanHistory.data.filter((s) => s.result === 'already_used').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Used</p>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">
                    {scanHistory.data.filter((s) => s.result === 'invalid' || s.result === 'expired').length}
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
