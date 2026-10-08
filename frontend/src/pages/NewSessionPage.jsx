import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Radio,
  Play,
  Clock,
  BookOpen,
  Building2,
  GraduationCap,
  Layers,
  CheckCircle2,
  StopCircle,
  Camera,
  AlertCircle,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { attendanceAPI } from '../services/api';

export default function NewSessionPage() {
  const navigate = useNavigate();

  const getCurrentTimeString = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const [formData, setFormData] = useState({
    subject: '',
    branch: 'CSE',
    year: '3rd Year',
    section: 'A',
    startTime: getCurrentTimeString(),
    endTime: '',
  });

  const [activeSession, setActiveSession] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [endingId, setEndingId] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadSessionData = async () => {
    try {
      const [activeRes, listRes] = await Promise.all([
        attendanceAPI.getActiveSession().catch(() => ({ data: { activeSession: null } })),
        attendanceAPI.getSessions().catch(() => ({ data: { sessions: [] } })),
      ]);
      setActiveSession(activeRes.data?.activeSession || null);
      setRecentSessions(listRes.data?.sessions || []);
    } catch (err) {
      console.warn('Failed to load session details:', err);
    }
  };

  useEffect(() => {
    loadSessionData();
  }, []);

  const handleEndSession = async (sessionId) => {
    try {
      setEndingId(sessionId);
      setError('');
      await attendanceAPI.endSession(sessionId);
      setSuccessMsg(`Session ${sessionId} ended successfully.`);
      await loadSessionData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to end session.');
    } finally {
      setEndingId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject.trim()) {
      setError('Please provide a subject title or course name.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccessMsg('');
      const res = await attendanceAPI.createSession({
        subject: formData.subject.trim(),
        branch: formData.branch,
        year: formData.year,
        section: formData.section.trim().toUpperCase() || 'A',
        startTime: formData.startTime || undefined,
        endTime: formData.endTime || undefined,
      });

      // Navigate straight to the live camera kiosk with the newly created session
      navigate('/attendance/live');
    } catch (err) {
      console.error('Create session error:', err);
      setError(err.response?.data?.detail || 'Failed to start session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Lecture Session Management
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Bind facial recognition attendance to a specific subject, department, and class section.
            </p>
          </div>
        </div>

        <button
          onClick={loadSessionData}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Currently Active Session Banner */}
      {activeSession && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/70 p-5 dark:border-emerald-500/30 dark:bg-emerald-950/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-3 w-3 mt-1 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Active Session in Progress
                  </span>
                  <span className="rounded bg-emerald-200/80 dark:bg-emerald-800/80 px-2 py-0.5 text-[11px] font-mono font-bold text-emerald-900 dark:text-emerald-200">
                    {activeSession.sessionId}
                  </span>
                </div>
                <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  {activeSession.subject}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Department: <span className="font-semibold">{activeSession.branch}</span> &bull;{' '}
                  Year: <span className="font-semibold">{activeSession.year}</span> &bull;{' '}
                  Section: <span className="font-semibold">{activeSession.section}</span> &bull;{' '}
                  Started: <span className="font-semibold">{activeSession.startTime || activeSession.date}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                to="/attendance/live"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
              >
                <Camera className="h-4 w-4" />
                <span>Enter Live Kiosk</span>
              </Link>

              <button
                type="button"
                onClick={() => handleEndSession(activeSession.sessionId)}
                disabled={endingId === activeSession.sessionId}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
              >
                <StopCircle className="h-4 w-4 text-rose-500" />
                <span>{endingId === activeSession.sessionId ? 'Ending...' : 'End Session'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Grid: Create Form on Left, Previous Sessions on Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Create Session Form (3 cols) */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Launch New Lecture Session
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Attendance records scanned via camera will be associated with this session.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Subject / Course Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Course / Subject Title *
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <BookOpen className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g. Data Structures & Algorithms"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-sky-400"
                />
              </div>
            </div>

            {/* Department & Academic Year */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Academic Department / Branch *
                </label>
                <div className="relative">
                  <select
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-sky-400 font-medium"
                  >
                    <option value="CSE">CSE ? Computer Science</option>
                    <option value="IT">IT ? Information Technology</option>
                    <option value="AI-ML">AI-ML ? Artificial Intelligence & ML</option>
                    <option value="AI-DS">AI-DS ? AI & Data Science</option>
                    <option value="ECE">ECE ? Electronics & Communication</option>
                    <option value="EE">EE ? Electrical Engineering</option>
                    <option value="ME">ME ? Mechanical Engineering</option>
                    <option value="CE">CE ? Civil Engineering</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Academic Year *
                </label>
                <div className="relative">
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-sky-400 font-medium"
                  >
                    <option value="1st Year">1st Year (1st / 2nd Sem)</option>
                    <option value="2nd Year">2nd Year (3rd / 4th Sem)</option>
                    <option value="3rd Year">3rd Year (5th / 6th Sem)</option>
                    <option value="4th Year">4th Year (7th / 8th Sem)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section & Timings */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Section
                </label>
                <input
                  type="text"
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  placeholder="e.g. A, B, or ALL"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs text-slate-900 uppercase focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-sky-400 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Lecture Start Time
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-sky-400 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  End Time (Optional)
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-sky-400 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <span className="text-[11px] text-slate-400">
                Will redirect to live camera feed upon starting.
              </span>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-500 active:scale-95 disabled:opacity-50 transition"
              >
                <Play className="h-4 w-4" />
                <span>{loading ? 'Starting Session...' : 'Start Session & Open Camera'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Previous Sessions Audit (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Recent Sessions</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Previously configured class lectures</p>
              </div>
              <Calendar className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[380px] overflow-y-auto">
              {recentSessions.length > 0 ? (
                recentSessions.slice(0, 6).map((sess) => {
                  const isActive = sess.status === 'active';
                  return (
                    <div key={sess.sessionId || sess._id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="overflow-hidden">
                          <p className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                            {sess.subject}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {sess.branch} &bull; {sess.year} &bull; Sec {sess.section}
                          </p>
                          <span className="inline-block mt-1 font-mono text-[10px] text-slate-400">
                            {sess.sessionId} ({sess.date})
                          </span>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isActive
                                ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {isActive ? 'Active' : 'Completed'}
                          </span>

                          {isActive && (
                            <button
                              type="button"
                              onClick={() => handleEndSession(sess.sessionId)}
                              disabled={endingId === sess.sessionId}
                              className="text-[10px] font-semibold text-rose-500 hover:underline"
                            >
                              End
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No previous sessions recorded.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <Link
              to="/attendance/live"
              className="text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400"
            >
              Go directly to Live Camera &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 

