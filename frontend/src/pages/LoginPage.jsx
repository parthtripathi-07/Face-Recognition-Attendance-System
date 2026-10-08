import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ScanFace, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please provide both username and password.');
      return;
    }

    try {
      setLoading(true);
      await login(username, password);
      navigate('/home');
    } catch (err) {
      console.error('Login error:', err);
      setError(
        err.response?.data?.detail ||
          'Authentication failed. Please verify your credentials or server connection.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setUsername('admin');
    setPassword('admin123');
    setError('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-950 p-4 font-sans text-slate-800 dark:text-slate-100 transition-colors">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white shadow-xl shadow-sky-500/25">
            <ScanFace className="h-9 w-9" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent">
            FaceAttend AI
          </h1>
          <p className="mt-1.5 text-xs font-semibold uppercase tracking-widest text-sky-500">
            Smart Face Recognition Attendance System
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl border border-slate-200/90 dark:border-slate-800/80 dark:bg-slate-900/90">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Teacher & Faculty Login</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Sign in with your Teacher ID & Password to manage classes, register students, and view official reports.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs font-medium text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Teacher ID / Username
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter Teacher ID or admin"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:border-sky-400 dark:focus:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:border-sky-400 dark:focus:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800"
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                onClick={fillDemo}
                className="text-sky-600 hover:underline dark:text-sky-400 font-medium"
              >
                Use Demo Login
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:brightness-105 active:scale-[0.99] disabled:opacity-50 transition"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Teacher Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-600 dark:text-amber-400">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <ShieldCheck className="h-4 w-4" />
              <span>Teacher Login Notice</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              Faculty Access: <code className="bg-amber-100 dark:bg-amber-950/60 px-1 py-0.5 rounded text-amber-700 dark:text-amber-300 font-mono">admin</code> / <code className="bg-amber-100 dark:bg-amber-950/60 px-1 py-0.5 rounded text-amber-700 dark:text-amber-300 font-mono">admin123</code>.
            </p>
          </div>

          <div className="mt-6 text-center border-t border-slate-100 dark:border-slate-800 pt-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-bold text-sky-600 hover:text-sky-500 hover:underline dark:text-sky-400"
            >
              <span>&larr; Go to Student Attendance Kiosk (No Login Required)</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
