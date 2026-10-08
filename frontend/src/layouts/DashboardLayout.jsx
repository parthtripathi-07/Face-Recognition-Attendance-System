import React, { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  LayoutDashboard,
  Users,
  Camera,
  ClipboardList,
  FileSpreadsheet,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  ScanFace,
  ChevronRight,
  ShieldCheck,
  MoreVertical,
  MoreHorizontal,
  Maximize2,
  Minimize2,
  Volume2,
  Download,
  UserCheck,
  Video,
  Keyboard,
  Server,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { attendanceAPI } from '../services/api';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Desktop Collapsible Sidebar state (like ChatGPT / Claude)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('faceattend_sidebar_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [extraFeaturesOpen, setExtraFeaturesOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Manual roll-call check-in state
  const [manualRoll, setManualRoll] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualResult, setManualResult] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('faceattend_sidebar_open', String(next));
      } catch {}
      return next;
    });
  };

  // Keyboard shortcut: Ctrl + B or Ctrl + \ to toggle sidebar like ChatGPT
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B' || e.key === '\\')) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems = [
    { label: 'Campus Home', path: '/home', icon: Home },
    { label: 'Student Kiosk (Public)', path: '/', icon: ScanFace },
    { label: 'Live Attendance', path: '/attendance/live', icon: Camera, badge: 'Live' },
    { label: 'Analytics Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Students', path: '/students', icon: Users },
    { label: 'Attendance History', path: '/attendance', icon: ClipboardList },
    { label: 'Reports & Export', path: '/reports', icon: FileSpreadsheet },
    { label: 'System Settings', path: '/settings', icon: Settings },
  ];

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen error:', err);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Audio chime test
  const testAudioChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      console.warn('Audio test error:', e);
    }
  };

  // Instant attendance backup download
  const handleDownloadBackup = async () => {
    try {
      const res = await attendanceAPI.getToday();
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `attendance_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Backup error:', err);
      alert('Failed to generate backup.');
    }
  };

  // Manual roll call check-in
  const handleManualCheckIn = async (e) => {
    e.preventDefault();
    if (!manualRoll.trim()) return;
    try {
      setManualLoading(true);
      setManualResult(null);
      const res = await attendanceAPI.mark({
        studentId: manualRoll.trim(),
        confidence: 0.99,
      });
      setManualResult({
        success: true,
        message: res.data.message || `Attendance marked for ${manualRoll.trim()}`,
      });
      setManualRoll('');
    } catch (err) {
      setManualResult({
        success: false,
        message: err.response?.data?.detail || 'Student roll number not found.',
      });
    } finally {
      setManualLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden font-sans">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden animate-fadeIn"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ========================================================================= */}
      {/* SIDEBAR NAVIGATION (COLLAPSIBLE LIKE CHATGPT / CLAUDE)                   */}
      {/* ========================================================================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900/95 transition-all duration-300 ease-in-out lg:static ${
          // Mobile state
          mobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0 '
        } ${
          // Desktop state (ChatGPT collapsible style)
          sidebarOpen
            ? 'lg:w-72 lg:opacity-100'
            : 'lg:w-0 lg:opacity-0 lg:pointer-events-none lg:overflow-hidden lg:border-r-0'
        }`}
      >
        <div className="w-72 flex flex-col h-full">
          {/* Brand Header with Collapse Button */}
          <div className="flex h-16 items-center justify-between px-5 border-b border-slate-100 dark:border-slate-800/80">
            <Link to="/home" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm group-hover:bg-sky-500 transition">
                <ScanFace className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                    FaceAttend
                  </span>
                  <span className="rounded bg-sky-50 dark:bg-sky-950/80 px-1.5 py-0.2 text-[9px] font-black uppercase text-sky-600 dark:text-sky-400">
                    AI
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Smart Biometrics</p>
              </div>
            </Link>

            {/* Desktop Collapse Button (ChatGPT style) */}
            <button
              type="button"
              onClick={toggleSidebar}
              title="Hide Sidebar (Ctrl+B)"
              className="hidden lg:flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>

            {/* Mobile Close Button */}
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/home' && location.pathname.startsWith(item.path));
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sky-50/90 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 font-semibold border-l-4 border-sky-600 pl-3'
                      : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 transition-colors ${
                        isActive
                          ? 'text-sky-600 dark:text-sky-400'
                          : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}

            {/* Three Dots Extra Features Item */}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setExtraFeaturesOpen(true);
              }}
              className="w-full group mt-3 flex items-center justify-between rounded-xl border border-dashed border-sky-400/40 bg-sky-50/40 dark:bg-sky-950/30 px-3.5 py-2.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100/60 dark:hover:bg-sky-900/40 transition"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-4 w-4 text-sky-500" />
                <span>Extra Features & Tools</span>
              </div>
              <MoreHorizontal className="h-4 w-4 text-sky-500" />
            </button>
          </nav>

          {/* User Card & Settings */}
          <div className="border-t border-slate-100 dark:border-slate-800 p-3.5">
            <div className="mb-2.5 flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5 border border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 font-bold text-xs">
                  {user?.username ? user.username.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="truncate">
                  <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {user?.username || 'Administrator'}
                  </p>
                  <p className="text-[10px] text-slate-400 capitalize">{user?.role || 'Admin'}</p>
                </div>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={toggleTheme}
                  title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-700 transition"
                >
                  {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-slate-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => setExtraFeaturesOpen(true)}
                  title="Extra Features (...)"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-sky-100 hover:text-sky-600 dark:hover:bg-slate-700 dark:hover:text-sky-400 transition"
                >
                  <MoreVertical className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                </button>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200/70 dark:border-red-900/30 bg-red-50/40 dark:bg-red-950/20 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100/60 dark:hover:bg-red-900/30 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA                                                         */}
      {/* ========================================================================= */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200/70 bg-white px-4 sm:px-6 dark:border-slate-800/80 dark:bg-slate-900/80 transition-colors">
          <div className="flex items-center gap-3">
            {/* Desktop Sidebar Toggle Button (ChatGPT style: Show / Hide Sidebar) */}
            <button
              type="button"
              onClick={toggleSidebar}
              title={sidebarOpen ? "Hide Sidebar (Ctrl+B)" : "Show Sidebar (Ctrl+B)"}
              className="hidden lg:flex items-center gap-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 transition shadow-sm"
            >
              {sidebarOpen ? (
                <>
                  <PanelLeftClose className="h-4 w-4 text-slate-500" />
                  <span className="text-[11px]">Hide</span>
                </>
              ) : (
                <>
                  <PanelLeftOpen className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  <span className="text-[11px] text-sky-600 dark:text-sky-400 font-bold">Sidebar</span>
                </>
              )}
            </button>

            {/* Mobile Drawer Hamburger Button */}
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300 hidden sm:inline">FaceAttend AI</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 hidden sm:inline" />
              <span className="font-medium text-sky-600 dark:text-sky-400 capitalize">
                {location.pathname.split('/')[1] || 'Home'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-500/20 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>PostgreSQL 18 Online</span>
            </div>

            <Link
              to="/"
              title="Open Student Attendance Kiosk (No Login Required)"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
            >
              <ScanFace className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <span className="hidden sm:inline">Student Kiosk</span>
            </Link>

            <Link
              to="/attendance/live"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition active:scale-95"
            >
              <Camera className="h-4 w-4" />
              <span className="hidden sm:inline">Launch Live Camera</span>
            </Link>

            {/* THREE DOTS BUTTON IN TOPBAR */}
            <button
              type="button"
              onClick={() => setExtraFeaturesOpen(true)}
              title="Extra Features & Tools (...)"
              className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-sm"
            >
              <MoreVertical className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto bg-white p-4 sm:p-6 lg:p-8 dark:bg-slate-950">
          <Outlet />
        </main>
      </div>

      {/* ========================================================================= */}
      {/* THREE DOTS (...) EXTRA FEATURES SLIDE-OVER DRAWER / MODAL                */}
      {/* ========================================================================= */}
      {extraFeaturesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/50 backdrop-blur-sm animate-fadeIn"
          onClick={() => setExtraFeaturesOpen(false)}
        >
          <div
            className="h-full w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200/90 dark:border-slate-800 shadow-2xl p-6 overflow-y-auto flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400 font-bold">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Extra Features & Tools
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Quick operations, diagnostics & kiosk controls
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExtraFeaturesOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Feature 1: Manual Roll Call Check-in */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/40 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <UserCheck className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Manual Roll Call Override
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                  Mark attendance for a student manually by Roll Number if camera is unavailable.
                </p>

                <form onSubmit={handleManualCheckIn} className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 64, 73, or 2024-IT-101"
                      value={manualRoll}
                      onChange={(e) => setManualRoll(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={manualLoading || !manualRoll.trim()}
                      className="rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition"
                    >
                      {manualLoading ? 'Marking...' : 'Mark'}
                    </button>
                  </div>

                  {manualResult && (
                    <div
                      className={`text-[11px] p-2 rounded-lg flex items-center gap-1.5 ${
                        manualResult.success
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {manualResult.success ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>{manualResult.message}</span>
                    </div>
                  )}
                </form>
              </div>

              {/* Feature 2: Fullscreen Kiosk Mode */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Fullscreen Kiosk Mode
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Wall display / tablet full screen
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  {isFullscreen ? 'Exit' : 'Enable'}
                </button>
              </div>

              {/* Feature 3: Audio Chime Test */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                    <Volume2 className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Verification Chime Test
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Play success face audio
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={testAudioChime}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Play
                </button>
              </div>

              {/* Feature 4: Download JSON Backup */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                    <Download className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Backup Attendance Logs
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Instant JSON snapshot download
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Backup
                </button>
              </div>

              {/* Feature 5: System Specs & Diagnostics */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/40 p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <Server className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  <span className="font-bold text-slate-800 dark:text-slate-200">System Architecture</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 border-b border-slate-200/60 dark:border-slate-700/60 pb-1">
                  <span>Database:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">PostgreSQL 18</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 border-b border-slate-200/60 dark:border-slate-700/60 pb-1">
                  <span>Detector:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">OpenCV YuNet CNN</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 border-b border-slate-200/60 dark:border-slate-700/60 pb-1">
                  <span>Extractor:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">ArcFace / SFace 128-d</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Timezone:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Asia/Kolkata</span>
                </div>
              </div>

              {/* Feature 6: Keyboard Shortcuts */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/40 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <Keyboard className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Keyboard Shortcuts
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Toggle Sidebar (Hide / Show):</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-slate-700 dark:text-slate-200">
                    Ctrl + B
                  </kbd>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Toggle Fullscreen:</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-slate-700 dark:text-slate-200">
                    F
                  </kbd>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Close Drawer:</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-slate-700 dark:text-slate-200">
                    Esc
                  </kbd>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
              <span className="text-[11px] text-slate-400">
                FaceAttend AI Enterprise &bull; v2.4
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
