import React, { useEffect, useState } from 'react';
import {
  Calendar, Filter, FileSpreadsheet, FileText,
  UserCheck, UserX, Percent, Users, RefreshCw, Clock,
  CheckCircle2, Download, Table, List, Sparkles, Layers,
} from 'lucide-react';
import { reportsAPI } from '../services/api';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('monthly'); // Default to monthly to showcase the register
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [branch, setBranch] = useState('');
  const [matrixMode, setMatrixMode] = useState('active'); // 'active' or 'all_month'
  const [monthlyView, setMonthlyView] = useState('matrix'); // 'matrix' or 'summary'
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    try {
      setLoading(true);
      if (activeTab === 'daily') {
        const res = await reportsAPI.getDaily({ date, branch: branch || undefined });
        setReportData(res.data);
      } else {
        const res = await reportsAPI.getMonthly({
          month,
          branch: branch || undefined,
          mode: matrixMode,
        });
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, date, month, branch, matrixMode]);

  // Export 1: Official Monthly Attendance Register Matrix (.xlsx) matching user image
  const handleExportMonthlyRegister = () => {
    const params = {
      month,
      mode: matrixMode,
    };
    if (branch) params.branch = branch;
    window.open(reportsAPI.getExportMonthlyRegisterExcelUrl(params), '_blank');
  };

  // Export 2: Monthly Register Matrix as CSV
  const handleExportMonthlyRegisterCsv = () => {
    const params = {
      month,
      mode: matrixMode,
    };
    if (branch) params.branch = branch;
    window.open(reportsAPI.getExportMonthlyRegisterCsvUrl(params), '_blank');
  };

  // Export 3: Standard Logs Excel (Transaction Rows)
  const handleExportExcelLogs = () => {
    const params = {};
    if (activeTab === 'daily') {
      params.date = date;
    } else {
      params.startDate = `${month}-01`;
      params.endDate = `${month}-31`;
    }
    if (branch) params.branch = branch;
    window.open(reportsAPI.getExportExcelUrl(params), '_blank');
  };

  // Export 4: Standard Logs CSV
  const handleExportCsvLogs = () => {
    const params = {};
    if (activeTab === 'daily') {
      params.date = date;
    } else {
      params.startDate = `${month}-01`;
      params.endDate = `${month}-31`;
    }
    if (branch) params.branch = branch;
    window.open(reportsAPI.getExportCsvUrl(params), '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Export Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Attendance Reports</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Generate and export monthly student attendance registers (P/A sheets) and daily roll audits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchReport}
            title="Refresh Report"
            className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-sky-500' : ''}`} />
          </button>

          {/* PRIMARY BUTTON: Monthly Register Sheet (.xlsx) - EXACT USER IMAGE FORMAT */}
          <button
            onClick={handleExportMonthlyRegister}
            title="Export Monthly Register with P/A columns, total attendance and percentage"
            className="flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-emerald-600/30 transition active:scale-95"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Monthly Register (.xlsx)</span>
          </button>

          {/* Standard Excel Logs */}
          <button
            onClick={handleExportExcelLogs}
            title="Export standard flat row transaction log"
            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Logs Excel</span>
          </button>

          {/* CSV Export */}
          <button
            onClick={activeTab === 'monthly' ? handleExportMonthlyRegisterCsv : handleExportCsvLogs}
            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition shadow-sm"
          >
            <FileText className="h-3.5 w-3.5 text-sky-500" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Feature Helper Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-emerald-500/25 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-600/20">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-white text-xs block">
              Official College Monthly Attendance Register (P/A Matrix Format)
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Includes S NO, Roll Number, Student Name, Day-by-Day P (Present) and A (Absent) turnout, Total Attendance count, and Percentage.
            </p>
          </div>
        </div>

        <button
          onClick={handleExportMonthlyRegister}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Download Register (.xlsx)</span>
        </button>
      </div>

      {/* Filter and Tab Bar */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`rounded-xl px-4 py-2 transition ${
              activeTab === 'monthly'
                ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-900 dark:text-sky-400 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Monthly Register & Aggregate
          </button>
          <button
            onClick={() => setActiveTab('daily')}
            className={`rounded-xl px-4 py-2 transition ${
              activeTab === 'daily'
                ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-900 dark:text-sky-400 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Daily Roll Call
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {activeTab === 'daily' ? (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          ) : (
            <>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 font-semibold"
              />

              {/* Mode: Active session dates vs All days 1-31 */}
              <select
                value={matrixMode}
                onChange={(e) => setMatrixMode(e.target.value)}
                title="Select Date Columns Mode"
                className="rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 font-medium"
              >
                <option value="active">Dates with Attendance</option>
                <option value="all_month">All Days of Month (1 to 31)</option>
              </select>

              {/* View Switcher: Matrix vs Summary */}
              <div className="flex rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setMonthlyView('matrix')}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition ${
                    monthlyView === 'matrix'
                      ? 'bg-white shadow-xs text-sky-600 font-bold dark:bg-slate-900 dark:text-sky-400'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="P/A Ledger Grid View (Image Format)"
                >
                  <Table className="h-3.5 w-3.5" />
                  <span>P/A Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMonthlyView('summary')}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition ${
                    monthlyView === 'summary'
                      ? 'bg-white shadow-xs text-sky-600 font-bold dark:bg-slate-900 dark:text-sky-400'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Summary List View"
                >
                  <List className="h-3.5 w-3.5" />
                  <span>Summary</span>
                </button>
              </div>
            </>
          )}

          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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

      {/* KPI Stat Cards */}
      {reportData && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Enrolled</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {reportData.totalStudents || reportData.studentsCount || 0}
              </span>
              <Users className="h-5 w-5 text-indigo-500" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {activeTab === 'daily' ? 'Present Today' : 'Attendance Sessions'}
            </span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-2xl font-black text-sky-600 dark:text-sky-400">
                {activeTab === 'daily' ? reportData.present : reportData.totalClasses}
              </span>
              <UserCheck className="h-5 w-5 text-sky-500" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {activeTab === 'daily' ? 'Absent Today' : 'Selected Department'}
            </span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-2xl font-black text-rose-500">
                {activeTab === 'daily' ? reportData.absent : (branch || 'All Branches')}
              </span>
              <UserX className="h-5 w-5 text-rose-500" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Turnout Ratio</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {activeTab === 'daily'
                  ? `${reportData.percentage}%`
                  : `${reportData.matrix?.overallPercentage || reportData.percentage || 0}%`}
              </span>
              <Percent className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900 overflow-hidden">
        {/* Table Header Bar with 1-click Download */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span>
            {activeTab === 'daily'
              ? `Daily Record for ${reportData?.date || date} (${reportData?.branch || 'All Branches'})`
              : `${reportData?.matrix?.title || 'MONTHLY ATTENDANCE'} &bull; ${reportData?.month || month}`}
          </span>

          {activeTab === 'monthly' && (
            <button
              onClick={handleExportMonthlyRegister}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 transition"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Download Excel Ledger (.xlsx)</span>
            </button>
          )}
        </div>

        {/* View 1: Daily Table */}
        {activeTab === 'daily' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold dark:border-slate-800 dark:bg-slate-800/40">
                  <th className="py-3 px-4">Student ID</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Time Verified</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium dark:divide-slate-800/60">
                {reportData?.students?.length > 0 ? (
                  reportData.students.map((st, i) => (
                    <tr key={`${st.studentId || ''}_${i}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">{st.studentId}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{st.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">{st.rollNumber}</td>
                      <td className="py-3 px-4 text-slate-500">{st.branch}</td>
                      <td className="py-3 px-4 text-slate-500">{st.time}</td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {st.confidence ? `${st.confidence}%` : '-'}
                      </td>
                      <td className="py-3 px-4">
                        {st.status === 'Present' ? (
                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                            Present
                          </span>
                        ) : (
                          <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-bold text-rose-500 dark:bg-rose-500/20">
                            Absent
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-10 text-center text-slate-400">
                      No records found for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* View 2: Monthly College Register Matrix (EXACT USER IMAGE FORMAT) */}
        {activeTab === 'monthly' && monthlyView === 'matrix' && (
          <div className="overflow-x-auto">
            {reportData?.matrix && reportData.matrix.rows?.length > 0 ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  {/* Top Sheet Banner matching image header */}
                  <tr>
                    <th
                      colSpan={3 + reportData.matrix.dates.length + 2}
                      className="py-2.5 px-4 text-center font-extrabold text-xs tracking-wider uppercase bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700"
                    >
                      {reportData.matrix.title}
                    </th>
                  </tr>

                  {/* Header Row: S NO | ROLL NO | NAME | DATES... | TOTAL ATT. (N) | PERCENTAGE */}
                  <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-700 font-bold dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                    <th className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-800 w-12">
                      S NO
                    </th>
                    <th className="py-2.5 px-3 text-center font-mono border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                      ROLL NO
                    </th>
                    <th className="py-2.5 px-4 text-left border-r border-slate-200 dark:border-slate-800 min-w-[180px]">
                      NAME
                    </th>

                    {/* Date Columns */}
                    {reportData.matrix.dates.map((d, dIdx) => (
                      <th
                        key={d}
                        className="py-2.5 px-2 text-center font-mono border-r border-slate-200 dark:border-slate-800 whitespace-nowrap text-[11px]"
                      >
                        {reportData.matrix.formattedDates[dIdx] || d}
                      </th>
                    ))}

                    <th className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-800 font-bold whitespace-nowrap bg-slate-200/50 dark:bg-slate-700/50">
                      TOTAL ATT. ({reportData.matrix.dates.length})
                    </th>
                    <th className="py-2.5 px-3 text-center font-bold whitespace-nowrap bg-slate-200/50 dark:bg-slate-700/50">
                      PERCENTAGE
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                  {reportData.matrix.rows.map((row) => (
                    <tr
                      key={`${row.studentId || ''}_${row.sno}_${row.rollNumber}`}
                      className="hover:bg-sky-50/30 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* S NO */}
                      <td className="py-2 px-3 text-center border-r border-slate-100 dark:border-slate-800/80 text-slate-500">
                        {row.sno}
                      </td>

                      {/* ROLL NO */}
                      <td className="py-2 px-3 text-center font-mono border-r border-slate-100 dark:border-slate-800/80 text-slate-800 dark:text-slate-200">
                        {row.rollNumber}
                      </td>

                      {/* NAME */}
                      <td className="py-2 px-4 border-r border-slate-100 dark:border-slate-800/80 font-bold text-slate-900 dark:text-white uppercase truncate max-w-[220px]">
                        {row.name}
                      </td>

                      {/* P / A Cells */}
                      {reportData.matrix.dates.map((d) => {
                        const status = row.attendance[d] || 'A';
                        const isP = status === 'P';
                        return (
                          <td
                            key={d}
                            className={`py-2 px-2 text-center border-r border-slate-100 dark:border-slate-800/80 font-bold text-xs ${
                              isP
                                ? 'text-sky-600 dark:text-sky-400 bg-sky-50/20'
                                : 'text-rose-500 dark:text-rose-400 bg-rose-50/10'
                            }`}
                          >
                            {status}
                          </td>
                        );
                      })}

                      {/* TOTAL ATT. */}
                      <td className="py-2 px-3 text-center border-r border-slate-100 dark:border-slate-800/80 font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/30">
                        {row.totalPresent}
                      </td>

                      {/* PERCENTAGE */}
                      <td className="py-2 px-3 text-center font-bold bg-slate-50/50 dark:bg-slate-800/30">
                        <span
                          className={`${
                            row.percentage >= 75
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : row.percentage >= 50
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {row.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}

                  {/* BOTTOM SUMMARY ROW (TOTAL PRESENT ON EACH DATE) */}
                  <tr className="bg-slate-100/80 dark:bg-slate-800/80 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                    <td colSpan={3} className="py-2.5 px-4 text-center border-r border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
                      TOTAL PRESENT
                    </td>

                    {reportData.matrix.dates.map((d) => (
                      <td
                        key={d}
                        className="py-2.5 px-2 text-center border-r border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-300 text-xs"
                      >
                        {reportData.matrix.dateTotals[d] || 0}
                      </td>
                    ))}

                    <td className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                      {reportData.matrix.totalPresentAll}
                    </td>

                    <td className="py-2.5 px-3 text-center text-emerald-700 dark:text-emerald-400">
                      {reportData.matrix.overallPercentage}%
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                No attendance matrix records found for this period.
              </div>
            )}
          </div>
        )}

        {/* View 3: Monthly Aggregate Summary (Cards / List View) */}
        {activeTab === 'monthly' && monthlyView === 'summary' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold dark:border-slate-800 dark:bg-slate-800/40">
                  <th className="py-3 px-4">Student ID</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4 text-center">Total Sessions</th>
                  <th className="py-3 px-4 text-center">Present</th>
                  <th className="py-3 px-4 text-center">Absent</th>
                  <th className="py-3 px-4">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium dark:divide-slate-800/60">
                {reportData?.summary?.length > 0 ? (
                  reportData.summary.map((st, i) => (
                    <tr key={`${st.studentId || ''}_${i}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">{st.studentId}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{st.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">{st.rollNumber}</td>
                      <td className="py-3 px-4 text-slate-500">{st.branch}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-slate-300">
                        {st.totalClasses}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-sky-600 dark:text-sky-400">{st.present}</td>
                      <td className="py-3 px-4 text-center font-bold text-rose-500">{st.absent}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                st.percentage >= 75
                                  ? 'bg-emerald-500'
                                  : st.percentage >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${st.percentage}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">{st.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="py-10 text-center text-slate-400">
                      No monthly records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
