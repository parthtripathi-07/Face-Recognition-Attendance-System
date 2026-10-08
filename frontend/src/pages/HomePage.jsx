import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  Users,
  ClipboardList,
  ShieldCheck,
  CheckCircle2,
  BookOpen,
  GraduationCap,
  Building2,
  Clock,
  Sparkles,
  ArrowRight,
  Cpu,
  Layers,
  Award,
  Bell,
  Check,
  ExternalLink,
} from 'lucide-react';
import { reportsAPI, studentsAPI, attendanceAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [topStudents, setTopStudents] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [activePhotoModal, setActivePhotoModal] = useState(null);
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }) + ' ? ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [dashRes, studentsRes, sessionRes] = await Promise.all([
          reportsAPI.getDashboard().catch(() => ({ data: null })),
          studentsAPI.getAll({ limit: 6 }).catch(() => ({ data: { students: [] } })),
          attendanceAPI.getActiveSession().catch(() => ({ data: { activeSession: null } })),
        ]);
        if (dashRes.data) setStats(dashRes.data);
        if (studentsRes.data?.students) setTopStudents(studentsRes.data.students);
        if (sessionRes.data?.activeSession) setActiveSession(sessionRes.data.activeSession);
      } catch (err) {
        console.warn('Home data load notice:', err);
      }
    }
    loadData();
  }, []);

  const galleryImages = [
    {
      id: 1,
      title: 'Central University Campus',
      tag: 'Main Academic Block & Grounds',
      url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80',
      description: 'State-of-the-art campus infrastructure supporting next-generation engineering and research.',
    },
    {
      id: 2,
      title: 'AI & Vision Research Lab',
      tag: 'Computer Science Department',
      url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80',
      description: 'High-performance computing laboratory where face detection and deep embedding models are deployed.',
    },
    {
      id: 3,
      title: 'Collaborative Study Commons',
      tag: 'Central University Library',
      url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80',
      description: 'Modern digital library equipped with biometric access turnstiles and silent study zones.',
    },
    {
      id: 4,
      title: 'Student Innovation & Projects',
      tag: 'Engineering Cohort',
      url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80',
      description: 'Undergraduate and postgraduate students actively collaborating on cross-departmental research.',
    },
  ];

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      {/* 1. HERO CAMPUS BANNER (LIGHT & CLEAN AESTHETIC) */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-10 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/30">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/70 dark:border-slate-800 pb-4 mb-5">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                Institute Biometric Portal &bull; PostgreSQL 18
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Clock className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              <span>{timeStr || 'Active Session'}</span>
            </div>
          </div>

          <div className="max-w-3xl">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
              Welcome to <span className="bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">FaceAttend AI</span>
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-slate-600 dark:text-slate-300 font-semibold">
              Smart Face Recognition Attendance System for Colleges, Universities & Organizations.
            </p>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
              Automated high-precision facial identification powered by OpenCV YuNet CNN detection and 
              ArcFace 128-dimensional biometric embeddings. Fully paperless, proxy-free, and real-time.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/attendance/live"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition active:scale-95"
            >
              <Camera className="h-4 w-4" />
              <span>Launch Live Attendance Kiosk</span>
            </Link>

            <Link
              to="/students"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
            >
              <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Student Directory</span>
            </Link>
          </div>

          {/* Live System Specs Ticker */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-slate-200/70 dark:border-slate-800 text-xs">
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-800/40 p-3">
              <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Total Students</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 block">{stats?.totalStudents || 9}</span>
            </div>
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-800/40 p-3">
              <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Verified Today</span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">{stats?.presentToday || 4}</span>
            </div>
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-800/40 p-3">
              <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Departments</span>
              <span className="text-xl font-bold text-sky-600 dark:text-sky-400 mt-0.5 block">8 Active</span>
            </div>
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-800/40 p-3">
              <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Database Engine</span>
              <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 block">PostgreSQL 18</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ACTIVE CLASS LECTURE ALERT (IF RUNNING) */}
      {activeSession && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/70 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Active Attendance Session in Progress
                </span>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {activeSession.subject} &bull; {activeSession.branch} ({activeSession.year}) &bull; Sec {activeSession.section}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Session ID: {activeSession.sessionId}</p>
              </div>
            </div>

            <Link
              to="/attendance/live"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition"
            >
              <span>Join Camera Kiosk</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* 3. CAMPUS & STUDENT LIFE GALLERY */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Campus & Academic Facilities
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Photographs of collegiate infrastructure, AI vision research laboratories, and student workspaces.
            </p>
          </div>
          <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
            Smart Campus Infrastructure &bull; 2026
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {galleryImages.map((img) => (
            <div
              key={img.id}
              onClick={() => setActivePhotoModal(img)}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 transition hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img
                  src={img.url}
                  alt={img.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-3.5">
                <span className="inline-block rounded-md bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                  {img.tag}
                </span>
                <h3 className="mt-1 text-xs font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">
                  {img.title}
                </h3>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  {img.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. ABOUT SECTION (SYSTEM & INSTITUTION) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* About the AI Biometric System (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              <Sparkles className="h-4 w-4" />
              <span>Technology Architecture</span>
            </div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              About FaceAttend AI System
            </h2>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Designed as an enterprise-grade attendance automation platform, FaceAttend AI replaces manual 
              paper registers and vulnerable proxy RFID cards with real-time biometric face detection, 
              ArcFace metric embedding comparisons, and authoritative server-side timestamps.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="rounded-xl border border-slate-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400 font-bold mb-2">
                <Cpu className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">YuNet CNN Detector</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Ultra-fast convolutional face detector locating faces in ~12ms with 5-point facial landmark 
                alignment across variable lighting.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 font-bold mb-2">
                <Layers className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">ArcFace 128-d Vectors</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Deep neural network extracts 128-dimensional L2-normalized feature embeddings matched via 
                cosine similarity.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 font-bold mb-2">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Anti-Duplicate & Cooldown</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Prevents duplicate attendance logging for the same class lecture. In-memory cooldown buffers 
                video stream hammering.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 font-bold mb-2">
                <Award className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">PostgreSQL 18 Storage</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Relational & JSONB storage with authoritative timestamps, automated audit logs, and instant Excel exports.
              </p>
            </div>
          </div>
        </div>

        {/* About the College & Vision (1 col) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <Building2 className="h-4 w-4" />
              <span>Campus Profile</span>
            </div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              About the College
            </h2>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Institute of Technology & Engineering Sciences is a premier higher education center committed 
              to academic excellence and paperless digital governance.
            </p>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">8 Engineering Branches:</span>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                    CSE, IT, AI-ML, AI-DS, ECE, EE, ME, and Civil.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Mandatory Turnout Rule:</span>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                    75% minimum semester attendance enforced automatically.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Continuous Digital Audit:</span>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                    Instant daily roll calls exported to Department Heads and Dean.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-sky-500/20 bg-sky-50/60 dark:bg-sky-950/30 p-3.5">
            <span className="text-xs font-bold text-sky-800 dark:text-sky-300 block">
              Notice Board &bull; Academic Year 2026-27
            </span>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
              Biometric face kiosks are active at all major lecture halls. Please maintain neutral posture 
              in front of the camera for 1-second verification.
            </p>
          </div>
        </div>
      </div>

      {/* 5. REGISTERED STUDENTS SPOTLIGHT */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Enrolled Students Spotlight</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Active student profiles registered with biometric facial embeddings.
            </p>
          </div>
          <Link
            to="/students"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400"
          >
            <span>View All Students ({stats?.totalStudents || topStudents.length})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {topStudents.map((st) => {
            const initial = st.name ? st.name.charAt(0).toUpperCase() : 'S';
            const isRegistered = st.faceRegistered;
            return (
              <div
                key={st.studentId || st._id}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-800/30 hover:bg-slate-50/50 dark:hover:bg-slate-800/60 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700 font-bold text-xs dark:bg-sky-950 dark:text-sky-300">
                    {initial}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                      {st.name}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      Roll: {st.rollNumber} &bull; {st.branch}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isRegistered
                        ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                        : 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                    }`}
                  >
                    {isRegistered ? 'Biometric Ready' : 'Pending Face'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PHOTO ZOOM MODAL */}
      {activePhotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setActivePhotoModal(null)}
        >
          <div
            className="max-w-2xl w-full rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[16/10] w-full bg-slate-100 dark:bg-slate-950">
              <img
                src={activePhotoModal.url}
                alt={activePhotoModal.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                {activePhotoModal.tag}
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                {activePhotoModal.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                {activePhotoModal.description}
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActivePhotoModal(null)}
                  className="rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Close Photo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
