import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  UserX,
  Percent,
  Camera,
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
  Radio,
  RefreshCw,
  PlusCircle,
  Search,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Building2,
  FileSpreadsheet,
  UserPlus,
} from 'lucide-react';
import { reportsAPI, attendanceAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedSearch, setFeedSearch] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashRes, sessRes] = await Promise.all([
        reportsAPI.getDashboard(),
        attendanceAPI.getActiveSession().catch(() => ({ data: { activeSession: null } })),
      ]);
      setStats(dashRes.data);
      setActiveSession(sessRes.data?.activeSession);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const total = stats?.totalStudents || 0;
  const present = stats?.presentToday || 0;
  const absent = stats?.absentToday || 0;
  const pct = stats?.attendancePercentage || 0;

  // Filter recent attendance by search
  const filteredRecent = (stats?.recentAttendance || []).filter((rec) => {
    if (!feedSearch.trim()) return true;
    const q = feedSearch.toLowerCase();
    return (
      (rec.studentName && rec.studentName.toLowerCase().includes(q)) ||
      (rec.rollNumber && rec.rollNumber.toLowerCase().includes(q)) ||
      (rec.studentId && rec.studentId.toLowerCase().includes(q)) ||
      (rec.branch && rec.branch.toLowerCase().includes(q))
    );
  });

  const currentDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions Header */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Biometric Attendance Command Center</span>
            </div>
            <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Welcome back, {user?.username || 'Administrator'}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Today is <span className="font-semibold text-slate-700 dark:text-slate-300">{currentDateStr}</span>. Automated face verification is operational.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/attendance/live"
              className="flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-sky-500 active:scale-95 transition"
            >
              <Camera className="h-4 w-4" />
              <span>Start Live Attendance</span>
            </Link>

            <Link
              to="/session/new"
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <PlusCircle className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <span>New Session</span>
            </Link>

            <Link
              to="/students"
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <UserPlus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Add Student</span>
            </Link>

            <button
              onClick={fetchDashboardData}
              title="Refresh Data"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Active Session Notification Card */}
      {activeSession && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-50/70 p-4 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Active Class Lecture Session
                </span>
                <span className="rounded bg-emerald-200/60 dark:bg-emerald-800/60 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                  {activeSession.sessionId}
                </span>
              </div>
              <p className="text-sm font-semibold mt-0.5">
                {activeSession.subject} &bull; {activeSession.branch} ({activeSession.year}) &bull; Section {activeSession.section}
              </p>
            </div>
          </div>
          <Link
            to="/attendance/live"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
          >
            <span>Enter Live Feed</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* 4 Clean Metric Cards (No Graphs) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Students */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Enrolled
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{total}</span>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Registered in registry</span>
              <Link to="/students" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
                View list &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Present Today */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Present Today
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{present}</span>
              <span className="text-xs font-medium text-slate-400">of {total}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Verified by facial recognition
            </p>
          </div>
        </div>

        {/* Absent Today */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Absent Today
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <UserX className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold tracking-tight text-rose-500">{absent}</span>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Unmarked in today's sessions
            </p>
          </div>
        </div>

        {/* Attendance Rate */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Attendance Rate
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Percent className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold tracking-tight text-sky-600 dark:text-sky-400">{pct}%</span>
            {/* Clean Progress Bar */}
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">Target: 75% minimum turn-out</p>
          </div>
        </div>
      </div>

      {/* Middle Section: Department Breakdown + 7-Day Audit Log (Clean Lists, Zero Graphs) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Department / Branch Turnout Table */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Department Turnout</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Today's attendance breakdown by academic branch</p>
              </div>
              <Building2 className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/80">
              {stats?.branchStats && stats.branchStats.length > 0 ? (
                stats.branchStats.map((br) => {
                  const bPct = br.percentage;
                  return (
                    <div key={br.branch} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                            {br.branch}
                          </span>
                          <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                            {br.present} / {br.total} Present
                          </span>
                        </div>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            bPct >= 75
                              ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                              : bPct >= 50
                              ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                              : 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                          }`}
                        >
                          {bPct}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            bPct >= 75 ? 'bg-emerald-500' : bPct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, bPct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No department attendance registered yet today.
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">Need detailed department breakdown?</span>
            <Link to="/reports" className="font-semibold text-sky-600 hover:underline dark:text-sky-400">
              View Monthly Reports &rarr;
            </Link>
          </div>
        </div>

        {/* 7-Day Roll Audit Summary (Clean Tabular Overview, NO GRAPH) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">7-Day Attendance Audit</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Day-by-day attendance history over the past week</p>
              </div>
              <Calendar className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2 px-2.5">Date</th>
                    <th className="py-2 px-2.5">Day</th>
                    <th className="py-2 px-2.5 text-center">Present</th>
                    <th className="py-2 px-2.5 text-center">Absent</th>
                    <th className="py-2 px-2.5 text-right">Turnout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                  {stats?.trend && stats.trend.length > 0 ? (
                    stats.trend.slice().reverse().map((t, idx) => (
                      <tr key={t.date} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-2.5 font-semibold text-slate-800 dark:text-slate-200">
                          {idx === 0 ? (
                            <span className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              <span>Today ({t.date.slice(5)})</span>
                            </span>
                          ) : (
                            t.date
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 text-slate-500">{t.day}</td>
                        <td className="py-2.5 px-2.5 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                          {t.present}
                        </td>
                        <td className="py-2.5 px-2.5 text-center text-slate-400">
                          {t.absent}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-bold text-slate-700 dark:text-slate-300">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] ${
                              t.percentage >= 75
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : t.percentage > 0
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {t.percentage}%
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No audit records available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">Export audit spreadsheet?</span>
            <Link to="/reports" className="font-semibold text-sky-600 hover:underline dark:text-sky-400">
              Download Excel & CSV &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Section: Live Attendance Feed Table with Search */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Recent Verified Attendance</h2>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                {filteredRecent.length} Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Students authenticated via biometric facial recognition</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search attendee or roll no..."
                value={feedSearch}
                onChange={(e) => setFeedSearch(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sky-400"
              />
            </div>

            <Link
              to="/attendance"
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400"
            >
              <span>Full Archive</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {filteredRecent.length > 0 ? (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Roll Number</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Match Confidence</th>
                  <th className="py-2.5 px-3">Session ID</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {filteredRecent.map((rec, idx) => {
                  const conf = rec.confidencePercent || Math.round((rec.confidence || 0) * 100);
                  const initial = rec.studentName ? rec.studentName.charAt(0).toUpperCase() : 'S';
                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700 font-bold text-xs dark:bg-sky-950 dark:text-sky-300">
                            {initial}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {rec.studentName || rec.studentId}
                            </span>
                            <span className="block text-[11px] text-slate-400 font-mono">
                              ID: {rec.studentId}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-600 dark:text-slate-300">
                        {rec.rollNumber || '-'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold">
                          {rec.branch || 'General'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span>{rec.time}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
                          <ShieldCheck className="h-3 w-3" />
                          <span>{conf}% Match</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                        {rec.sessionId || 'Direct'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{rec.status || 'Present'}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
            <Calendar className="mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No attendance marked yet today</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Launch the live camera kiosk to start scanning registered student faces.
            </p>
            <Link
              to="/attendance/live"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 transition"
            >
              <Camera className="h-4 w-4" />
              <span>Launch Live Camera</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
