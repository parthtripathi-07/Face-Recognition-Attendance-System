import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import StudentPortalPage from './pages/StudentPortalPage';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import FaceRegistrationPage from './pages/FaceRegistrationPage';
import LiveAttendancePage from './pages/LiveAttendancePage';
import AttendanceHistoryPage from './pages/AttendanceHistoryPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import NewSessionPage from './pages/NewSessionPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white text-sky-600 dark:bg-slate-950 dark:text-sky-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
            Verifying Faculty Session...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* 1. PUBLIC STUDENT PORTAL (NO LOGIN REQUIRED) */}
            <Route path="/" element={<StudentPortalPage />} />
            <Route path="/kiosk" element={<StudentPortalPage />} />
            <Route path="/student" element={<StudentPortalPage />} />

            {/* 2. TEACHER / FACULTY LOGIN PORTAL */}
            <Route path="/login" element={<LoginPage />} />

            {/* 3. TEACHER PROTECTED ROUTES (REQUIRES TEACHER ID & PASSWORD) */}
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/home" element={<HomePage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/register-face/:studentId" element={<FaceRegistrationPage />} />
              <Route path="/attendance/live" element={<LiveAttendancePage />} />
              <Route path="/attendance" element={<AttendanceHistoryPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/session/new" element={<NewSessionPage />} />
            </Route>

            {/* Fallback to Student Portal */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
