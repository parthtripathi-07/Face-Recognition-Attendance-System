import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, AlertCircle, RefreshCw, Eye, ShieldCheck, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';

export default function CameraView({
  onFrameCapture,
  overlayBoxes = [],
  isProcessing = false,
  width = 640,
  height = 480,
  showGuides = true,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  useEffect(() => {
    async function getCameras() {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devs.filter((d) => d.kind === 'videoinput');
        setDevices(videoDevs);
        if (videoDevs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevs[0].deviceId);
        }
      } catch (err) {
        console.warn('Could not enumerate cameras:', err);
      }
    }
    if (navigator.mediaDevices?.enumerateDevices) {
      getCameras();
    }
  }, []);

  const startCamera = async (deviceId = selectedDeviceId) => {
    setError(null);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: width },
          height: { ideal: height },
          facingMode: 'user',
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No webcam detected on your system.');
      } else {
        setError(`Unable to access camera: ${err.message || 'Unknown error'}`);
      }
    }
  };

  useEffect(() => {
    startCamera(selectedDeviceId);
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [selectedDeviceId]);

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  useEffect(() => {
    if (onFrameCapture) {
      onFrameCapture(captureFrame);
    }
  }, [onFrameCapture]);

  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative aspect-[4/3] w-full max-w-2xl overflow-hidden bg-black flex items-center justify-center">
        {error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-rose-400">
            <CameraOff className="mb-3 h-12 w-12 text-rose-500/80" />
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={() => startCamera(selectedDeviceId)}
              className="mt-4 flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry Camera</span>
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover -scale-x-100"
            />

            {showGuides && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-64 w-52 sm:h-72 sm:w-60 rounded-[45%] border-2 border-dashed border-sky-400/50 shadow-[0_0_50px_rgba(56,189,248,0.2)] animate-pulse" />
              </div>
            )}

            {overlayBoxes.map((box, idx) => {
              const [x, y, w, h] = box.bbox || [0, 0, 0, 0];
              const vw = videoRef.current?.videoWidth || 640;
              const vh = videoRef.current?.videoHeight || 480;

              // Compute percentage coordinates taking into account mirrored video (-scale-x-100)
              const mirrorX = Math.max(0, vw - (x + w));
              const leftPct = (mirrorX / vw) * 100;
              const topPct = (y / vh) * 100;
              const widthPct = (w / vw) * 100;
              const heightPct = (h / vh) * 100;

              const isSpoof = box.liveness?.is_spoof || box.liveness?.liveness_status === 'spoof_detected';
              const isVerified = box.liveness?.liveness_status === 'verified' || box.status === 'marked' || box.liveness?.blink_verified;
              const isAwaitingBlink = box.liveness?.liveness_status === 'awaiting_blink';
              const isBlinking = box.liveness?.liveness_status === 'blinking';
              const isRecognized = box.status === 'recognized' || box.recognized;

              let borderColor = 'border-amber-400 shadow-amber-400/30';
              let badgeBg = 'bg-amber-500 text-slate-900 font-bold';
              let badgeText = isRecognized ? `${box.student?.name || 'Recognized'} (${box.confidencePercent}%)` : 'Unknown Student';
              let icon = null;

              if (isSpoof) {
                borderColor = 'border-rose-500 shadow-rose-500/60 ring-2 ring-rose-500/40 animate-pulse';
                badgeBg = 'bg-rose-600 text-white font-bold';
                badgeText = 'Photo / Screen Spoof (Rejected)';
                icon = <ShieldAlert className="h-3.5 w-3.5 inline mr-1" />;
              } else if (isVerified) {
                borderColor = 'border-emerald-500 shadow-emerald-500/50 ring-2 ring-emerald-500/40';
                badgeBg = 'bg-emerald-600 text-white font-bold';
                badgeText = `Live Verified | ${box.student?.name || 'Student'}`;
                icon = <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" />;
              } else if (isBlinking) {
                borderColor = 'border-cyan-400 shadow-cyan-400/50 ring-2 ring-cyan-400/40 animate-pulse';
                badgeBg = 'bg-cyan-600 text-white font-bold';
                badgeText = `Blinking Detected... | ${box.student?.name || 'Student'}`;
                icon = <Sparkles className="h-3.5 w-3.5 inline mr-1 animate-spin" />;
              } else if (isAwaitingBlink && isRecognized) {
                borderColor = 'border-amber-400 shadow-amber-400/50 ring-2 ring-amber-400/40';
                badgeBg = 'bg-amber-500 text-slate-900 font-bold';
                badgeText = `Blink Eyes to Confirm | ${box.student?.name || 'Student'}`;
                icon = <Eye className="h-3.5 w-3.5 inline mr-1 animate-bounce" />;
              }

              return (
                <div
                  key={idx}
                  className={`pointer-events-none absolute border-2 rounded-2xl transition-all duration-150 ${borderColor} shadow-xl`}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                  }}
                >
                  <span
                    className={`absolute -top-7 left-0 whitespace-nowrap rounded-lg px-2.5 py-0.5 text-[11px] font-bold tracking-wide shadow-md flex items-center gap-1 ${badgeBg}`}
                  >
                    {icon}
                    <span>{badgeText}</span>
                  </span>
                </div>
              );
            })}

            {/* Active Live Eye Liveness Floating HUD */}
            {overlayBoxes.length > 0 && overlayBoxes[0].recognized && (
              <div className="pointer-events-none absolute bottom-4 inset-x-0 flex justify-center px-4">
                {overlayBoxes[0].liveness?.is_spoof ? (
                  <div className="flex items-center gap-2 rounded-full bg-rose-600/90 px-4 py-1.5 text-xs font-bold text-white shadow-xl backdrop-blur animate-pulse">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Photo or Screen detected! Please face camera directly.</span>
                  </div>
                ) : overlayBoxes[0].liveness?.liveness_status === 'verified' || overlayBoxes[0].liveness?.blink_verified ? (
                  <div className="flex items-center gap-2 rounded-full bg-emerald-600/90 px-4 py-1.5 text-xs font-bold text-white shadow-xl backdrop-blur">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Live Verified! Eye blink confirmed.</span>
                  </div>
                ) : overlayBoxes[0].liveness?.liveness_status === 'blinking' ? (
                  <div className="flex items-center gap-2 rounded-full bg-cyan-600/90 px-4 py-1.5 text-xs font-bold text-white shadow-xl backdrop-blur animate-pulse">
                    <Sparkles className="h-4 w-4 animate-spin" />
                    <span>Blink detected! Re-opening eyes to complete...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-full bg-amber-500/95 px-4 py-1.5 text-xs font-black text-slate-900 shadow-xl backdrop-blur animate-bounce">
                    <Eye className="h-4 w-4" />
                    <span>Please blink your eyes naturally to confirm attendance</span>
                  </div>
                )}
              </div>
            )}

            <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-slate-900/85 px-3 py-1 text-[11px] font-medium text-emerald-400 backdrop-blur border border-emerald-500/30 shadow-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Eye Liveness & Anti-Spoof Active</span>
            </div>

            {isProcessing && (
              <div className="absolute top-4 right-4 flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs text-sky-400 backdrop-blur border border-sky-500/30">
                <span className="h-2 w-2 rounded-full bg-sky-400 animate-ping" />
                <span>Processing Face...</span>
              </div>
            )}
          </>
        )}
      </div>

      {devices.length > 1 && (
        <div className="flex w-full items-center justify-between border-t border-slate-800 bg-slate-900/90 px-4 py-2.5 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 font-medium">
            <Camera className="h-3.5 w-3.5 text-slate-500" />
            <span>Select Camera:</span>
          </span>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
