'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Camera,
  CameraOff,
  SwitchCamera,
  Flashlight,
  FlashlightOff,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import jsQR from 'jsqr';

interface CameraScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  scanInterval?: number;
  className?: string;
}

type CameraFacing = 'environment' | 'user';
type ScannerStatus = 'idle' | 'starting' | 'scanning' | 'error';

export function CameraScanner({
  onScan,
  onError,
  continuous = true,
  scanInterval = 200,
  className = '',
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastScanRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [facing, setFacing] = useState<CameraFacing>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [hasTorch, setHasTorch] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Check for multiple cameras
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;

    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);
    }).catch(() => {
      // Silently fail
    });
  }, []);

  const stopStream = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (facingMode: CameraFacing) => {
    stopStream();
    setStatus('starting');
    setErrorMessage('');

    try {
      // Check permissions
      if (navigator.permissions) {
        const perm = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (perm.state === 'denied') {
          throw new Error('permission_denied');
        }
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error('Élément vidéo non disponible');
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Check torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities?.() as { torch?: boolean } | undefined;
        setHasTorch(!!capabilities?.torch);
      }

      setStatus('scanning');
    } catch (err) {
      const error = err as Error & { name: string };
      stopStream();

      if (error.name === 'NotAllowedError' || error.message === 'permission_denied') {
        setErrorMessage('Accès à la caméra refusé. Veuillez autoriser l\'accès dans les paramètres de votre navigateur.');
      } else if (error.name === 'NotFoundError') {
        setErrorMessage('Aucune caméra détectée sur cet appareil.');
      } else if (error.name === 'NotReadableError') {
        setErrorMessage('La caméra est déjà utilisée par une autre application.');
      } else {
        setErrorMessage(`Erreur d'accès à la caméra : ${error.message}`);
      }

      setStatus('error');
      onError?.(errorMessage || error.message);
    }
  }, [stopStream, onError, errorMessage]);

  // Scan loop
  useEffect(() => {
    if (status !== 'scanning') return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let scanning = true;

    const scanFrame = () => {
      if (!scanning) return;

      if (
        video.readyState === video.HAVE_ENOUGH_DATA &&
        Date.now() - lastScanTimeRef.current >= scanInterval
      ) {
        const width = video.videoWidth;
        const height = video.videoHeight;

        if (width > 0 && height > 0) {
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(video, 0, 0, width, height);

          const imageData = ctx.getImageData(0, 0, width, height);
          const code = jsQR(imageData.data, width, height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data && code.data !== lastScanRef.current) {
            lastScanRef.current = code.data;
            lastScanTimeRef.current = Date.now();
            onScan(code.data);

            if (!continuous) {
              stopStream();
              setStatus('idle');
              return;
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    scanFrame();

    return () => {
      scanning = false;
    };
  }, [status, continuous, scanInterval, onScan, stopStream]);

  const toggleCamera = async () => {
    const newFacing: CameraFacing = facing === 'environment' ? 'user' : 'environment';
    setFacing(newFacing);
    setTorchOn(false);
    await startCamera(newFacing);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;

    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const newTorch = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: newTorch } as MediaTrackConstraintSet],
      });
      setTorchOn(newTorch);
    } catch {
      // Torch not supported or failed
    }
  };

  const handleStart = () => {
    lastScanRef.current = '';
    startCamera(facing);
  };

  const handleStop = () => {
    stopStream();
    setStatus('idle');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return (
    <div className={`relative flex flex-col gap-3 ${className}`}>
      {/* Video container with overlay */}
      <div className="relative overflow-hidden rounded-xl bg-gray-900 aspect-video">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan overlay with corner markers */}
        {status === 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-52 w-52 sm:h-60 sm:w-60">
              {/* Semi-transparent background */}
              <div className="absolute inset-0 rounded-lg bg-black/20" />

              {/* Animated scan line */}
              <div className="absolute inset-x-2 top-0 h-0.5 bg-[#007BFF]/80 animate-scan-line" />

              {/* Corner markers */}
              {/* Top-left */}
              <div className="absolute top-0 left-0 h-6 w-6 border-l-3 border-t-3 border-[#007BFF] rounded-tl-lg" />
              {/* Top-right */}
              <div className="absolute top-0 right-0 h-6 w-6 border-r-3 border-t-3 border-[#007BFF] rounded-tr-lg" />
              {/* Bottom-left */}
              <div className="absolute bottom-0 left-0 h-6 w-6 border-l-3 border-b-3 border-[#007BFF] rounded-bl-lg" />
              {/* Bottom-right */}
              <div className="absolute bottom-0 right-0 h-6 w-6 border-r-3 border-b-3 border-[#007BFF] rounded-br-lg" />
            </div>
          </div>
        )}

        {/* Idle state */}
        {status === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <Camera className="h-12 w-12 opacity-50" />
            <p className="text-sm text-white/70">Appuyez sur Démarrer pour scanner</p>
          </div>
        )}

        {/* Starting state */}
        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-white/30 border-t-white" />
            <p className="text-sm text-white/70">Activation de la caméra...</p>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
            <AlertTriangle className="h-10 w-10 text-yellow-400" />
            <p className="text-sm text-white/80 leading-relaxed">{errorMessage}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        {status === 'idle' || status === 'error' ? (
          <Button
            onClick={handleStart}
            className="gap-2 bg-[#007BFF] hover:bg-[#0056b3] text-white"
          >
            <Camera className="h-4 w-4" />
            Démarrer le scanner
          </Button>
        ) : status === 'scanning' ? (
          <>
            <Button variant="outline" size="icon" onClick={handleStop} aria-label="Arrêter le scanner">
              <CameraOff className="h-4 w-4" />
            </Button>

            {hasMultipleCameras && (
              <Button variant="outline" size="icon" onClick={toggleCamera} aria-label="Changer de caméra">
                <SwitchCamera className="h-4 w-4" />
              </Button>
            )}

            {hasTorch && (
              <Button
                variant={torchOn ? 'default' : 'outline'}
                size="icon"
                onClick={toggleTorch}
                aria-label={torchOn ? 'Désactiver le flash' : 'Activer le flash'}
                className={torchOn ? 'bg-[#007BFF] hover:bg-[#0056b3]' : ''}
              >
                {torchOn ? <FlashlightOff className="h-4 w-4" /> : <Flashlight className="h-4 w-4" />}
              </Button>
            )}

            <Button variant="outline" size="icon" onClick={handleStart} aria-label="Redémarrer">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </>
        ) : null}
      </div>

      {/* Inline style for scan line animation */}
      <style jsx>{`
        @keyframes scan-line {
          0%, 100% { top: 0; }
          50% { top: calc(100% - 2px); }
        }
        .animate-scan-line {
          animation: scan-line 2.5s ease-in-out infinite;
        }
        .border-l-3 { border-left-width: 3px; }
        .border-r-3 { border-right-width: 3px; }
        .border-t-3 { border-top-width: 3px; }
        .border-b-3 { border-bottom-width: 3px; }
      `}</style>
    </div>
  );
}
