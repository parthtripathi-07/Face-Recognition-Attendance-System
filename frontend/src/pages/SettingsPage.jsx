import React, { useEffect, useState } from 'react';
import {
  Settings,
  Sliders,
  Shield,
  Building,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { settingsAPI, authAPI, attendanceAPI } from '../services/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    recognitionThreshold: 0.38,
    minFaceQuality: 0.60,
    instituteName: 'FaceAttend AI Institute of Technology',
    academicSession: '2026-2027',
    timezone: 'Asia/Kolkata',
    cooldownSeconds: 10,
    allowDuplicateSameDay: false,
  });

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Password state
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [savingPass, setSavingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState(false);
  const [passError, setPassError] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const res = await settingsAPI.get();
        if (res.data) setSettings(res.data);
      } catch (err) {
        console.error('Error loading settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setSettingsSuccess(false);
      await settingsAPI.update(settings);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating settings:', err);
      alert('Failed to update settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const [clearingToday, setClearingToday] = useState(false);
  const [clearSuccess, setClearSuccess] = useState('');

  const handleClearToday = async () => {
    if (!window.confirm("Are you sure you want to delete all attendance records for today? This will let you test marking and eye blinking fresh.")) return;
    try {
      setClearingToday(true);
      const res = await attendanceAPI.clearToday();
      setClearSuccess(res.data?.message || "Today's attendance records cleared successfully.");
      setTimeout(() => setClearSuccess(''), 4000);
    } catch (err) {
      alert("Failed to clear attendance: " + (err.response?.data?.detail || err.message));
    } finally {
      setClearingToday(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess(false);

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPassError('New passwords do not match.');
      return;
    }

    try {
      setSavingPass(true);
      await authAPI.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPassSuccess(true);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPassSuccess(false), 3500);
    } catch (err) {
      console.error('Change password error:', err);
      setPassError(err.response?.data?.detail || 'Failed to change password.');
    } finally {
      setSavingPass(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-400">
        <RefreshCw className="h-6 w-6 animate-spin text-sky-500 mr-2" />
        <span>Loading system settings...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">System Settings</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure face recognition hyperparameters, institute profile, and administrative security.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Face Recognition Settings */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Sliders className="h-5 w-5 text-sky-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Face Recognition Tuning</h2>
          </div>

          {settingsSuccess && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Settings saved successfully!</span>
            </div>
          )}

          <form onSubmit={handleSettingsSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="text-slate-700 dark:text-slate-300">Cosine Recognition Threshold</span>
                <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">{settings.recognitionThreshold}</span>
              </div>
              <input
                type="range"
                min="0.20"
                max="0.80"
                step="0.01"
                value={settings.recognitionThreshold}
                onChange={(e) => setSettings({ ...settings, recognitionThreshold: parseFloat(e.target.value) })}
                className="w-full accent-sky-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                ArcFace threshold: 0.35–0.45 recommended. Lower values increase matches; higher values prevent false positives.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="text-slate-700 dark:text-slate-300">Minimum Face Quality / Sharpness</span>
                <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">{settings.minFaceQuality}</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.90"
                step="0.05"
                value={settings.minFaceQuality}
                onChange={(e) => setSettings({ ...settings, minFaceQuality: parseFloat(e.target.value) })}
                className="w-full accent-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Recognition Cooldown (Seconds)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.cooldownSeconds}
                onChange={(e) => setSettings({ ...settings, cooldownSeconds: parseInt(e.target.value) || 10 })}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="pt-2 space-y-3 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={settings.requireEyeBlink ?? true}
                    onChange={(e) => setSettings({ ...settings, requireEyeBlink: e.target.checked })}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <span>Require Live Eye Blink Verification</span>
                  <span className="rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                    Anti-Photo
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6 mt-0.5">
                  Real student must blink their eyes naturally. Prevents attendance fraud using static photos.
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={settings.livenessEnabled ?? true}
                    onChange={(e) => setSettings({ ...settings, livenessEnabled: e.target.checked })}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <span>Enable Anti-Screen & Glare Detection</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6 mt-0.5">
                  Rejects mobile screens and tablets displaying photos or digital replays.
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={settings.allowDuplicateSameDay}
                    onChange={(e) => setSettings({ ...settings, allowDuplicateSameDay: e.target.checked })}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <span>Allow multiple attendance check-ins on same day (Testing Mode)</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6 mt-0.5">
                  When enabled, students can mark attendance repeatedly on the same day for testing eye blinks.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleClearToday}
                  disabled={clearingToday}
                  className="flex items-center justify-center gap-2 w-full rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 px-3 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{clearingToday ? 'Clearing Today...' : "Clear Today's Attendance (Reset for Testing)"}</span>
                </button>
                {clearSuccess && (
                  <p className="mt-1 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {clearSuccess}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 py-2.5 text-xs font-semibold text-white shadow-md shadow-sky-500/25 hover:brightness-105 disabled:opacity-50"
            >
              {savingSettings ? 'Saving...' : 'Save Recognition Parameters'}
            </button>
          </form>
        </div>

        {/* Institution & Campus Details */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Building className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Institution Profile</h2>
          </div>

          <form onSubmit={handleSettingsSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Institution Name
              </label>
              <input
                type="text"
                value={settings.instituteName}
                onChange={(e) => setSettings({ ...settings, instituteName: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Current Academic Session
              </label>
              <input
                type="text"
                value={settings.academicSession}
                onChange={(e) => setSettings({ ...settings, academicSession: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Timezone
              </label>
              <input
                type="text"
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="mt-2 w-full rounded-xl bg-slate-800 dark:bg-slate-700 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50"
            >
              Update Profile
            </button>
          </form>
        </div>

        {/* Change Admin Password */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 dark:border-slate-800">
            <KeyRound className="h-5 w-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Change Admin Password</h2>
          </div>

          {passSuccess && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Password updated successfully! Demo flag removed.</span>
            </div>
          )}

          {passError && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4" />
              <span>{passError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={passwords.currentPassword}
                onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                required
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                New Password (Min 6 chars)
              </label>
              <input
                type="password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                required
                minLength={6}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                required
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={savingPass}
                className="rounded-xl bg-slate-900 dark:bg-slate-700 px-6 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
              >
                {savingPass ? 'Updating Password...' : 'Save New Password'}
              </button>
            </div>
          </form>
        </div>

        {/* Biometric Privacy & Data Policy */}
        <div className="rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 dark:border-slate-800/80 dark:bg-slate-900/40 lg:col-span-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-2">
            <Shield className="h-5 w-5 text-emerald-500" />
            <h3 className="text-sm">Privacy Compliance & Biometric Retention</h3>
          </div>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            This institution enforces strict biometric privacy standards. Face data is strictly converted to 128-dimensional mathematical embeddings; raw camera images are never retained on disk. Authorized administrators can permanently purge a student's biometric signature at any time from the Student Management directory.
          </p>
        </div>
      </div>
    </div>
  );
}
