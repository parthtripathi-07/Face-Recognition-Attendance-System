import React, { useEffect, useState } from 'react';
import {
  ClipboardList, Search, Calendar, Filter, Download,
  RefreshCw, FileSpreadsheet, FileText, UserCheck,
} from 'lucide-react';
import { attendanceAPI, reportsAPI } from '../services/api';

export default function AttendanceHistoryPage() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [page, setPage] = useState(0);
  const limit = 25;

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = {
        skip: page * limit,
        limit,
      };
      if (search.trim()) params.search = search.trim();
      if (dateFilter) params.date = dateFilter;
      if (branchFilter) params.branch = branchFilter;

      const res = await attendanceAPI.getHistory(params);
      setRecords(res.data.attendance || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Error fetching attendance history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page, dateFilter, branchFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      fetchHistory();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const handleExportCsv = () => {
    const params = {};
    if (dateFilter) params.date = dateFilter;
    if (branchFilter) params.branch = branchFilter;
    window.open(reportsAPI.getExportCsvUrl(params), '_blank');
  };

  const handleExportExcel = () => {
    const params = {};
    if (dateFilter) params.date = dateFilter;
    if (branchFilter) params.branch = branchFilter;
    window.open(reportsAPI.getExportExcelUrl(params), '_blank');
  };

  const handleExportMonthlyRegister = () => {
    const params = {};
    if (dateFilter) {
      params.month = dateFilter.slice(0, 7);
    } else {
      params.month = new Date().toISOString().slice(0, 7);
    }
    if (branchFilter) params.branch = branchFilter;
    window.open(reportsAPI.getExportMonthlyRegisterExcelUrl(params), '_blank');
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Attendance History</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Full chronological archive of recognized student attendance records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchHistory}
            title="Refresh"
            className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-sky-500' : ''}`} />
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition shadow-sm"
          >
            <FileText className="h-4 w-4 text-sky-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportMonthlyRegister}
            title="Download Monthly Attendance Register (P/A Matrix Sheet matching college ledger)"
            className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm shadow-emerald-600/25"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Monthly Register (.xlsx)</span>
          </button>
          <button
            onClick={handleExportExcel}
            title="Export raw timestamp logs"
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Logs Excel</span>
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name, roll number, or ID..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
            />
          </div>

          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <div>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">All Branches</option>
              <option value="CSE">CSE</option>
              <option value="IT">IT</option>
              <option value="AI-ML">AI-ML</option>
              <option value="AI-DS">AI-DS</option>
              <option value="ECE">ECE</option>
              <option value="EE">EE</option>
              <option value="ME">ME</option>
              <option value="CE">CE</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Found {total} records</span>
          {(search || dateFilter || branchFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setDateFilter('');
                setBranchFilter('');
              }}
              className="text-sky-600 hover:underline dark:text-sky-400"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-white text-slate-500 font-semibold dark:border-slate-800 dark:bg-slate-800/40">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Session ID</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium dark:divide-slate-800/60">
              {records.length > 0 ? (
                records.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">{r.date}</td>
                    <td className="py-3.5 px-4 text-slate-500">{r.time}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {r.studentName || r.studentId}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-sky-600 dark:text-sky-400 font-semibold">
                      {r.rollNumber || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{r.branch || '-'}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-200">
                      {r.confidencePercent || Math.round((r.confidence || 0) * 100)}%
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">{r.sessionId || '-'}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                        <UserCheck className="h-3 w-3" />
                        <span>{r.status || 'Present'}</span>
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <ClipboardList className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-700" />
                    <p className="text-sm font-semibold">No attendance records found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 p-4 dark:border-slate-800 text-xs">
            <span className="text-slate-500">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
