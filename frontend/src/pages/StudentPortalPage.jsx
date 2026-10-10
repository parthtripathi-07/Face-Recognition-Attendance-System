import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ScanFace, Camera, Search, CheckCircle2, AlertCircle, Clock,
  User, ShieldCheck, Lock, ArrowRight, RefreshCw, Volume2, VolumeX,
  Sparkles, Check, AlertTriangle, Building2, Calendar, Radio, Eye, ShieldAlert
} from 'lucide-react';
import CameraView from '../components/CameraView';
import { attendanceAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function StudentPortalPage() {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' or 'status'
  const [activeSession, setActiveSession] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [overlayBoxes, setOverlayBoxes] = useState([]);
  const [lastRecognition, setLastRecognition] = useState(null);

  // Status Check State ("Laga Ki Nahi")
  const [searchRoll, setSearchRoll] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusResult, setStatusResult] = useState(null);
  const [statusError, setStatusError] = useState('');

  // Clock
  const [currentTime, setCurrentTime] = useState('');
  const captureFrameFn = useRef(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }) + ' ? ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load active session
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await attendanceAPI.getActiveSession();
        if (res.data?.activeSession) {
          setActiveSession(res.data.activeSession);
        }
      } catch (e) {
        console.warn('Session check:', e);
      }
    }
    fetchSession();
  }, []);

  // Pleasant verification audio chime
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {}
  };

  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Fast Adaptive Camera Recognition Loop (~160ms delay)
  useEffect(() => {
    if (activeTab !== 'camera') return;
    isMountedRef.current = true;
    let timerId;

    const scanFrame = async () => {
      if (!isMountedRef.current || activeTab !== 'camera') return;

      if (!isProcessingRef.current && captureFrameFn.current) {
        const frame = captureFrameFn.current();
        if (frame) {
          isProcessingRef.current = true;
          setIsProcessing(true);
          try {
            const res = await attendanceAPI.recognizeAndMark({
              image: frame,
              sessionId: activeSession?.sessionId,
            });

            const data = res.data;
            if (isMountedRef.current) {
              setOverlayBoxes(data.results || []);

              if (data.results && data.results.length > 0) {
                const topFace = data.results[0];
                const hasMarked = data.markedStudents && data.markedStudents.length > 0;
                const hasAlready = data.alreadyMarked && data.alreadyMarked.length > 0;
                const hasSpoof = data.spoofDetected && data.spoofDetected.length > 0;
                const hasAwaitingBlink = data.awaitingBlink && data.awaitingBlink.length > 0;

                if (hasMarked) {
                  playChime();
                  setLastRecognition({
                    type: 'marked',
                    student: data.markedStudents[0].student,
                    time: data.markedStudents[0].markedAt,
                    confidence: data.markedStudents[0].confidencePercent || Math.round((data.markedStudents[0].confidence || 0) * 100),
                  });
                } else if (hasSpoof) {
                  setLastRecognition({
                    type: 'spoof',
                    student: data.spoofDetected[0].student,
                    message: data.spoofDetected[0].message || 'Photo or Screen Spoof Detected!',
                  });
                } else if (hasAwaitingBlink) {
                  setLastRecognition({
                    type: 'awaiting_blink',
                    student: data.awaitingBlink[0].student,
                    message: data.awaitingBlink[0].message || 'Please blink your eyes 2 times.',
                    eyeState: data.awaitingBlink[0].eyeState,
                    blinksCount: data.awaitingBlink[0].blinksCount ?? 0,
                    requiredBlinks: data.awaitingBlink[0].requiredBlinks ?? 2,
                    livenessStatus: data.awaitingBlink[0].livenessStatus,
                  });
                } else if (hasAlready) {
                  setLastRecognition({
                    type: 'already',
                    student: data.alreadyMarked[0].student,
                    time: data.alreadyMarked[0].markedAt,
                    confidence: Math.round((data.alreadyMarked[0].confidence || 0) * 100),
                    message: data.alreadyMarked[0].message,
                  });
                } else if (!topFace.recognized) {
                  setLastRecognition({
                    type: 'unknown',
                    message: 'Face detected, but not registered in student directory.',
                  });
                }
              }
            }
          } catch (err) {
            console.warn('Student scan error:', err);
          } finally {
            isProcessingRef.current = false;
            if (isMountedRef.current) {
              setIsProcessing(false);
            }
          }
        }
      }

      if (isMountedRef.current && activeTab === 'camera') {
        timerId = setTimeout(scanFrame, 160);
      }
    };

    timerId = setTimeout(scanFrame, 150);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timerId);
    };
  }, [activeTab, activeSession?.sessionId, soundEnabled]);

  // Handle Roll Number Status Check ("Laga Ki Nahi")
  const handleCheckStatus = async (e) => {
    e.preventDefault();
    const query = searchRoll.trim();
    if (!query) return;

    setStatusLoading(true);
    setStatusError('');
    setStatusResult(null);

    try {
      const res = await attendanceAPI.getStudentHistory(query);
      setStatusResult(res.data);
    } catch (err) {
      console.error('Status check error:', err);
      setStatusError(
        err.response?.data?.detail || `No student record found with Roll Number or ID "${query}".`
      );
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* 1. PUBLIC TOP HEADER */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-md shadow-sky-600/20">
            <ScanFace className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                FaceAttend
              </span>
              <span className="rounded bg-sky-50 dark:bg-sky-950 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-sky-600 dark:text-sky-400">
                Student Kiosk
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
              Self-Service Facial Attendance & Status Verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 font-medium">
            <Clock className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            <span>{currentTime || 'System Live'}</span>
          </div>

          {/* TEACHER LOGIN BUTTON */}
          <Link
            to="/login"
            className="flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 px-4 py-2 text-xs font-bold shadow-sm transition active:scale-95"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Teacher Login</span>
          </Link>
        </div>
      </header>

      {/* 2. MAIN STUDENT WORKSPACE */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Banner with 2 Big Mode Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <div className="flex rounded-xl bg-white dark:bg-slate-800 p-1 shadow-xs w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-xs sm:text-sm font-bold transition ${
                activeTab === 'camera'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Camera className="h-4 w-4" />
              <span>1. Scan Face (Mark Attendance)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('status')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-xs sm:text-sm font-bold transition ${
                activeTab === 'status'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Search className="h-4 w-4" />
              <span>2. Check Status (Laga Ki Nahi)</span>
            </button>
          </div>

          {activeSession && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Active Lecture: {activeSession.subject} ({activeSession.branch})</span>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: LIVE FACE RECOGNITION CAMERA                                       */}
        {/* ========================================================================= */}
        {activeTab === 'camera' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            {/* Camera Viewport (3 cols) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Live Biometric Scanner
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    title={soundEnabled ? 'Mute Chime' : 'Enable Chime'}
                  >
                    {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-600" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
                    <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
                  </button>
                </div>

                <CameraView
                  onFrameCapture={(fn) => {
                    captureFrameFn.current = fn;
                  }}
                  overlayBoxes={overlayBoxes}
                  isProcessing={isProcessing}
                  showGuides={true}
                />

                <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
                  Please look directly at the camera with neutral expression. Verification takes ~1 second.
                </p>
              </div>
            </div>

            {/* Live Feedback / Result Card (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                  Verification Status
                </h3>

                {lastRecognition?.type === 'marked' && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/40 p-5 text-emerald-900 dark:text-emerald-200 space-y-3 animate-fadeIn">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white font-bold text-lg shadow-md shadow-emerald-500/30">
                        <CheckCircle2 className="h-7 w-7" />
                      </div>
                      <div>
                        <span className="rounded bg-emerald-200/80 dark:bg-emerald-900 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-900 dark:text-emerald-200">
                          ATTENDANCE MARKED ?
                        </span>
                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                          {lastRecognition.student.name}
                        </h4>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-emerald-500/20 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-emerald-700 dark:text-emerald-300 font-medium">Roll Number:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{lastRecognition.student.rollNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-700 dark:text-emerald-300 font-medium">Department:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{lastRecognition.student.branch}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-700 dark:text-emerald-300 font-medium">Time Verified:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{lastRecognition.time}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-700 dark:text-emerald-300 font-medium">Confidence:</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">{lastRecognition.confidence}% Match</span>
                      </div>
                    </div>
                  </div>
                )}

                {lastRecognition?.type === 'already' && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/40 p-5 text-amber-900 dark:text-amber-200 space-y-3 animate-fadeIn">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white font-bold text-lg shadow-md shadow-amber-500/30">
                        <Clock className="h-7 w-7" />
                      </div>
                      <div>
                        <span className="rounded bg-amber-200/80 dark:bg-amber-900 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900 dark:text-amber-200">
                          ALREADY MARKED TODAY
                        </span>
                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                          {lastRecognition.student.name}
                        </h4>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-amber-500/20 text-xs space-y-2">
                      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                        {lastRecognition.message || `Live Eye Blink Verified! Your attendance was already recorded today at ${lastRecognition.time}.`}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-amber-700 dark:text-amber-400 font-medium pt-1">
                        <span>Roll: {lastRecognition.student.rollNumber}</span>
                        <span>Recorded at {lastRecognition.time}</span>
                      </div>
                    </div>
                  </div>
                )}

                {lastRecognition?.type === 'awaiting_blink' && (
                  <div className="rounded-2xl border-2 border-amber-400 bg-amber-50/90 dark:bg-amber-950/50 p-5 text-amber-900 dark:text-amber-200 space-y-3 animate-fadeIn shadow-lg shadow-amber-500/10">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white font-bold text-lg shadow-md shadow-amber-500/30 animate-pulse">
                        <Eye className="h-7 w-7" />
                      </div>
                      <div>
                        <span className="rounded bg-amber-200/90 dark:bg-amber-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                          LIVE CHECK: 2 BLINKS REQUIRED ({lastRecognition.blinksCount || 0}/2)
                        </span>
                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                          {lastRecognition.student?.name}
                        </h4>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-amber-500/20 text-xs space-y-3">
                      <p className="text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                        {(lastRecognition.blinksCount || 0) === 1 ? (
                          <span>✨ <strong>1st Blink Verified!</strong> Ek baar aur palak jhapkayen (Please blink 1 more time).</span>
                        ) : (
                          <span>Photo se attendance rokne ke liye: <strong>Camera ke samne 2 baar palak jhapkayen (Blink 2 times)</strong>.</span>
                        )}
                      </p>

                      {/* 2-Blink Visual Progress Bar */}
                      <div className="flex items-center gap-2 pt-1">
                        <div className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs transition-all ${
                          (lastRecognition.blinksCount || 0) >= 1
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400'
                            : 'bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 animate-pulse'
                        }`}>
                          <span>1st Blink: {(lastRecognition.blinksCount || 0) >= 1 ? '✓ Confirmed' : 'Waiting...'}</span>
                        </div>

                        <div className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs transition-all ${
                          (lastRecognition.blinksCount || 0) >= 2
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400'
                            : (lastRecognition.blinksCount || 0) === 1
                            ? 'bg-sky-500 text-white animate-pulse shadow-md'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                          <span>2nd Blink: {(lastRecognition.blinksCount || 0) >= 2 ? '✓ Confirmed' : 'Waiting...'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {lastRecognition?.type === 'spoof' && (
                  <div className="rounded-2xl border-2 border-rose-500 bg-rose-50/90 dark:bg-rose-950/50 p-5 text-rose-900 dark:text-rose-200 space-y-3 animate-fadeIn shadow-lg shadow-rose-500/15">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600 text-white font-bold text-lg shadow-md shadow-rose-600/30">
                        <ShieldAlert className="h-7 w-7" />
                      </div>
                      <div>
                        <span className="rounded bg-rose-200 dark:bg-rose-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-900 dark:text-rose-200">
                          PHOTO SPOOF DETECTED
                        </span>
                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                          Photo Attendance Rejected
                        </h4>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-rose-500/20 text-xs space-y-1.5">
                      <p className="text-rose-800 dark:text-rose-300 font-semibold leading-relaxed">
                        {lastRecognition.message || 'Static photo or screen detected. Photo se attendance nahi lagegi!'}
                      </p>
                      <p className="text-[11px] text-rose-700/80 dark:text-rose-400">
                        Asli student ko camera ke samne aakar live natural blink karna anivarya hai.
                      </p>
                    </div>
                  </div>
                )}

                {lastRecognition?.type === 'unknown' && (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-50/70 dark:bg-rose-950/40 p-5 text-rose-900 dark:text-rose-200 space-y-2 animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                        Face Not Recognized
                      </span>
                    </div>
                    <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                      Face detected in video feed, but could not be matched with enrolled students.
                      Please ensure good lighting or contact your teacher for enrollment.
                    </p>
                  </div>
                )}

                {!lastRecognition && (
                  <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
                    <ScanFace className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 animate-pulse" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Waiting for student to face camera...
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Stand directly in front of the lens. Your name and confirmation will appear here instantly.
                    </p>
                  </div>
                )}
              </div>

              {/* Quick instructions pill */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/60 p-4 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">?? Attendance Guidelines:</span>
                <p>? Remove dark sunglasses or face masks during scanning.</p>
                <p>? Want to check if your mark was recorded? Click the "Check Status" tab above.</p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CHECK ATTENDANCE STATUS ("LAGA KI NAHI")                           */}
        {/* ========================================================================= */}
        {activeTab === 'status' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Check Attendance Status (??? ?? ????)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enter your College Roll Number or Student ID below to instantly verify if your attendance has been marked for today.
                </p>
              </div>

              <form onSubmit={handleCheckStatus} className="flex gap-2.5">
                <div className="relative flex-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={searchRoll}
                    onChange={(e) => setSearchRoll(e.target.value)}
                    placeholder="Enter Roll Number (e.g. 64, 73, 16, or 2024-IT-101)..."
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={statusLoading || !searchRoll.trim()}
                  className="rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition active:scale-95"
                >
                  {statusLoading ? 'Checking...' : 'Check Status'}
                </button>
              </form>

              {statusError && (
                <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{statusError}</span>
                </div>
              )}

              {/* Status Verification Result Card */}
              {statusResult && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
                  {statusResult.isMarkedToday ? (
                    /* CASE 1: PRESENT TODAY */
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/40 p-5 text-emerald-900 dark:text-emerald-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                              ATTENDANCE STATUS
                            </span>
                            <span className="text-base font-extrabold text-emerald-900 dark:text-emerald-100">
                              PRESENT TODAY (???????) ?
                            </span>
                          </div>
                        </div>

                        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                          {statusResult.todayRecord?.time || 'Verified'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-emerald-500/20 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-emerald-700 dark:text-emerald-400 block text-[11px]">Student Name:</span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{statusResult.student.name}</span>
                        </div>
                        <div>
                          <span className="text-emerald-700 dark:text-emerald-400 block text-[11px]">Roll Number:</span>
                          <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">{statusResult.student.rollNumber}</span>
                        </div>
                        <div>
                          <span className="text-emerald-700 dark:text-emerald-400 block text-[11px]">Department:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{statusResult.student.branch} ({statusResult.student.year || 'College'})</span>
                        </div>
                        <div>
                          <span className="text-emerald-700 dark:text-emerald-400 block text-[11px]">Total Days Present:</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-300 font-mono">{statusResult.totalPresent} Days Recorded</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* CASE 2: NOT MARKED TODAY */
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/40 p-5 text-amber-900 dark:text-amber-200 space-y-3">
                      <div className="flex items-center gap-2.5">
                        <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0" />
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                            ATTENDANCE STATUS
                          </span>
                          <span className="text-base font-extrabold text-amber-900 dark:text-amber-100">
                            NOT MARKED TODAY (?? ????????? / ???????) ?
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-amber-500/20 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-amber-700 dark:text-amber-400 block text-[11px]">Student Name:</span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{statusResult.student.name}</span>
                        </div>
                        <div>
                          <span className="text-amber-700 dark:text-amber-400 block text-[11px]">Roll Number:</span>
                          <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">{statusResult.student.rollNumber}</span>
                        </div>
                      </div>

                      <p className="text-xs text-amber-800 dark:text-amber-300 pt-1 leading-relaxed">
                        Your face has not been scanned for today yet. Please switch to the{' '}
                        <button
                          type="button"
                          onClick={() => setActiveTab('camera')}
                          className="font-bold text-sky-700 dark:text-sky-300 underline"
                        >
                          Camera tab
                        </button>{' '}
                        to mark your attendance.
                      </p>
                    </div>
                  )}

                  {/* Student's recent past attendance history */}
                  {statusResult.history && statusResult.history.length > 0 && (
                    <div className="pt-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                        Your Recent Verified Dates:
                      </span>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {statusResult.history.slice(0, 5).map((h, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-xs"
                          >
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {h.date}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 font-mono text-[11px]">{h.time}</span>
                              <span className="rounded px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                                Present
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 3. PUBLIC FOOTER */}
      <footer className="border-t border-slate-200/80 bg-white py-4 px-6 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-950">
        <p>
          FaceAttend AI &bull; Smart Biometric Kiosk System &bull; Secure Student Portal
        </p>
      </footer>
    </div>
  );
}
