import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera, CheckCircle2, AlertTriangle, XCircle, Clock,
  UserCheck, Radio, Pause, Play, Volume2, VolumeX,
  Users, ShieldCheck, PlusCircle, Scan,
} from 'lucide-react';
import CameraView from '../components/CameraView';
import { attendanceAPI } from '../services/api';

export default function LiveAttendancePage() {
  const [activeSession, setActiveSession] = useState(null);
  const [isScanning, setIsScanning] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentRecognition, setCurrentRecognition] = useState(null);
  const [sessionLogs, setSessionLogs] = useState([]);
  const [overlayBoxes, setOverlayBoxes] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const captureFrameFn = useRef(null);
  const scanningRef = useRef(isScanning);

  useEffect(() => {
    scanningRef.current = isScanning;
  }, [isScanning]);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await attendanceAPI.getActiveSession();
        setActiveSession(res.data.activeSession);
      } catch (err) {
        console.warn('No active session found:', err);
      }
    }
    loadSession();
  }, []);

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
    } catch (e) {
    }
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!scanningRef.current || isProcessing) return;
      if (!captureFrameFn.current) return;

      const frame = captureFrameFn.current();
      if (!frame) return;

      try {
        setIsProcessing(true);
        const res = await attendanceAPI.recognizeAndMark({
          image: frame,
          sessionId: activeSession?.sessionId,
        });

        const data = res.data;
        setOverlayBoxes(data.results || []);

        if (data.results && data.results.length > 0) {
          const topFace = data.results[0];
          setCurrentRecognition({
            ...topFace,
            markedStudents: data.markedStudents || [],
            alreadyMarked: data.alreadyMarked || [],
          });

          if (data.markedStudents && data.markedStudents.length > 0) {
            playChime();
            setSessionLogs((prev) => {
              const newEntries = data.markedStudents.filter(
                (m) => !prev.some((p) => p.student.studentId === m.student.studentId)
              );
              return [...newEntries, ...prev];
            });
          }
        } else {
          setCurrentRecognition(null);
        }
      } catch (err) {
        console.warn('Recognition frame error:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 650);

    return () => clearInterval(interval);
  }, [activeSession, isProcessing, soundEnabled]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Live Attendance Session</h1>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Automatic facial identification & duplicate attendance filtering.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute Chimes' : 'Enable Chimes'}
            className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-sky-500" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
          </button>
          <button
            onClick={() => setIsScanning(!isScanning)}
            className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs sm:text-sm font-semibold transition shadow-md ${
              isScanning
                ? 'bg-amber-500 text-slate-900 hover:bg-amber-400'
                : 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:brightness-105'
            }`}
          >
            {isScanning ? (
              <>
                <Pause className="h-4 w-4" />
                <span>Pause Scanner</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                <span>Resume Scanner</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-sky-500/20 bg-sky-500/5 p-4 dark:border-sky-500/20 dark:bg-sky-500/10 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-white font-bold">
            <Radio className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <span className="font-bold text-sky-700 dark:text-sky-300">
              {activeSession ? activeSession.subject : 'General Campus Session'}
            </span>
            <p className="text-[11px] text-slate-500">
              {activeSession
                ? `${activeSession.branch} ? ${activeSession.year} ? Sec ${activeSession.section} (${activeSession.sessionId})`
                : 'All branches eligible ? Tap below to attach a class schedule'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!activeSession ? (
            <Link
              to="/session/new"
              className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1.5 font-semibold text-white hover:bg-sky-700 transition"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Link Class Session</span>
            </Link>
          ) : (
            <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 font-mono font-bold text-emerald-600 dark:text-emerald-400">
              Active Session
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <CameraView
            onFrameCapture={(fn) => {
              captureFrameFn.current = fn;
            }}
            overlayBoxes={overlayBoxes}
            isProcessing={isProcessing}
            showGuides={true}
          />

          {currentRecognition ? (
            <div
              className={`rounded-3xl border p-5 transition-all animate-fadeIn ${
                currentRecognition.recognized
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
                  : currentRecognition.status === 'low_confidence'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                      currentRecognition.recognized
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : currentRecognition.status === 'low_confidence'
                        ? 'bg-amber-500 text-slate-900'
                        : 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                    }`}
                  >
                    {currentRecognition.recognized ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : currentRecognition.status === 'low_confidence' ? (
                      <AlertTriangle className="h-6 w-6" />
                    ) : (
                      <XCircle className="h-6 w-6" />
                    )}
                  </div>

                  <div>
                    {currentRecognition.recognized ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-extrabold text-slate-900 dark:text-white">
                            {currentRecognition.student?.name}
                          </span>
                          <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                            ({currentRecognition.student?.rollNumber})
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {currentRecognition.student?.branch} &bull; {currentRecognition.student?.year}
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-bold block text-slate-900 dark:text-white">
                          {currentRecognition.status === 'low_confidence'
                            ? 'Low Confidence Match'
                            : 'Unknown Face Detected'}
                        </span>
                        <p className="text-xs text-slate-500">{currentRecognition.message}</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right sm:border-l sm:border-slate-200 dark:sm:border-slate-800 sm:pl-6">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Match Confidence</span>
                  <span
                    className={`text-xl font-black ${
                      currentRecognition.recognized
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {currentRecognition.confidencePercent}%
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs font-semibold">
                {currentRecognition.markedStudents?.length > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Attendance Marked at {currentRecognition.markedStudents[0].markedAt}</span>
                  </span>
                ) : currentRecognition.alreadyMarked?.length > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>Already Marked Today (at {currentRecognition.alreadyMarked[0].markedAt})</span>
                  </span>
                ) : (
                  <span className="text-slate-400">
                    {currentRecognition.recognized ? 'Verification in progress...' : 'Attendance not marked'}
                  </span>
                )}
                <span className="text-[10px] font-mono text-slate-400">Deep ArcFace / YuNet</span>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 text-center text-xs text-slate-400 dark:border-slate-800/80 dark:bg-slate-900">
              <Scan className="mx-auto mb-2 h-6 w-6 text-slate-400 animate-pulse" />
              <span>Scanning camera stream for registered student faces...</span>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 flex flex-col h-[560px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Session Turnout</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {sessionLogs.length} Verified
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 py-2 dark:divide-slate-800/60">
            {sessionLogs.length > 0 ? (
              sessionLogs.map((entry, idx) => (
                <div key={idx} className="py-3 px-1 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                  <div className="truncate">
                    <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                      {entry.student.name}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {entry.student.rollNumber} &bull; {entry.student.branch}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 block">
                      {entry.markedAt}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {entry.confidencePercent}% conf
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-400 p-6">
                <Users className="mb-2 h-8 w-8 text-slate-300 dark:text-slate-700" />
                <p className="text-xs font-semibold">Waiting for student check-ins...</p>
                <p className="text-[11px] mt-1 text-slate-400">
                  Registered students facing the camera will be automatically recognized and logged here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
