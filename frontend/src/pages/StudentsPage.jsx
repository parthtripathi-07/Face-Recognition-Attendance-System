import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Search, Camera, Trash2, Edit2,
  CheckCircle2, XCircle, AlertCircle, X, RefreshCw, Phone, Mail, GraduationCap,
} from 'lucide-react';
import { studentsAPI } from '../services/api';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [faceFilter, setFaceFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    rollNumber: '',
    email: '',
    phone: '',
    branch: 'CSE',
    year: '3rd Year',
    section: 'A',
    studentId: '',
  });

  const navigate = useNavigate();

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (branchFilter) params.branch = branchFilter;
      if (yearFilter) params.year = yearFilter;
      if (faceFilter !== '') params.faceRegistered = faceFilter === 'true';

      const res = await studentsAPI.getAll(params);
      setStudents(res.data.students);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, branchFilter, yearFilter, faceFilter]);

  const openAddModal = () => {
    setEditingStudent(null);
    setFormData({
      name: '',
      rollNumber: '',
      email: '',
      phone: '',
      branch: 'CSE',
      year: '3rd Year',
      section: 'A',
      studentId: '',
    });
    setModalError('');
    setModalOpen(true);
  };

  const openEditModal = (student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      rollNumber: student.rollNumber,
      email: student.email || '',
      phone: student.phone || '',
      branch: student.branch,
      year: student.year,
      section: student.section || '',
      studentId: student.studentId,
    });
    setModalError('');
    setModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!formData.name.trim() || !formData.rollNumber.trim()) {
      setModalError('Full Name and Roll Number are required.');
      return;
    }

    try {
      setModalLoading(true);
      if (editingStudent) {
        await studentsAPI.update(editingStudent.studentId, formData);
        setModalOpen(false);
        fetchStudents();
      } else {
        const res = await studentsAPI.create(formData);
        setModalOpen(false);
        fetchStudents();
        if (confirm(`Student "${res.data.name}" added successfully!
Proceed to register their face using camera now?`)) {
          navigate(`/register-face/${res.data.studentId}`);
        }
      }
    } catch (err) {
      console.error('Save student error:', err);
      setModalError(err.response?.data?.detail || 'Failed to save student.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (studentId) => {
    try {
      await studentsAPI.delete(studentId);
      setDeleteConfirmId(null);
      fetchStudents();
    } catch (err) {
      console.error('Delete error:', err);
      alert(err.response?.data?.detail || 'Failed to delete student.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Student Management</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage student records, enrollment directory, and biometric face registrations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchStudents}
            title="Refresh List"
            className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-sky-500' : ''}`} />
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:brightness-105 active:scale-95 transition"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, roll no, student ID, email..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
            />
          </div>

          <div>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-700 transition focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200"
            >
              <option value="">All Branches</option>
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

          <div>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-700 transition focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200"
            >
              <option value="">All Academic Years</option>
              <option value="1st Year">1st Year (1st / 2nd Sem)</option>
              <option value="2nd Year">2nd Year (3rd / 4th Sem)</option>
              <option value="3rd Year">3rd Year (5th / 6th Sem)</option>
              <option value="4th Year">4th Year (7th / 8th Sem)</option>
            </select>
          </div>

          <div>
            <select
              value={faceFilter}
              onChange={(e) => setFaceFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-700 transition focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200"
            >
              <option value="">Face: All</option>
              <option value="true">Face Registered Only</option>
              <option value="false">Pending Face Registration</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Total Students: {total}</span>
          {(search || branchFilter || yearFilter || faceFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setBranchFilter('');
                setYearFilter('');
                setFaceFilter('');
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
                <th className="py-3 px-4">Student ID</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">Branch & Year</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Face Biometric</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium dark:divide-slate-800/60">
              {students.length > 0 ? (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                      {student.studentId}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 dark:text-white block">{student.name}</span>
                      {student.section && (
                        <span className="text-[10px] text-slate-400">Sec: {student.section}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {student.rollNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 mr-1.5">
                        {student.branch}
                      </span>
                      <span className="text-slate-500 text-[11px]">{student.year}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {student.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span>{student.email}</span>
                        </div>
                      )}
                      {student.phone && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{student.phone}</span>
                        </div>
                      )}
                      {!student.email && !student.phone && '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      {student.faceRegistered ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Registered ({student.samplesCount || 1})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Not Registered</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/register-face/${student.studentId}`}
                          title={student.faceRegistered ? 'Re-register Face' : 'Register Face'}
                          className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold transition ${
                            student.faceRegistered
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                              : 'bg-sky-500 text-white hover:bg-sky-600 shadow-sm shadow-sky-500/20'
                          }`}
                        >
                          <Camera className="h-3.5 w-3.5" />
                          <span>{student.faceRegistered ? 'Update Face' : 'Scan Face'}</span>
                        </Link>
                        <button
                          onClick={() => openEditModal(student)}
                          title="Edit Student"
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(student.studentId)}
                          title="Delete Student"
                          className="rounded-xl p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <GraduationCap className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-700" />
                    <p className="text-sm font-semibold">No students found matching your search/filters.</p>
                    <button
                      onClick={openAddModal}
                      className="mt-3 text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400"
                    >
                      + Add a new student
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingStudent ? `Edit Student: ${editingStudent.name}` : 'Add New Student'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Rahul Kumar"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Roll Number *
                  </label>
                  <input
                    type="text"
                    value={formData.rollNumber}
                    onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                    placeholder="e.g. CSE101"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Student ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    placeholder="Auto-generated if blank (e.g. ST001)"
                    disabled={!!editingStudent}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Branch / Department *
                  </label>
                  <select
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Year *
                  </label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Section
                  </label>
                  <input
                    type="text"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    placeholder="e.g. A"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. rahul@example.com"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-sky-500/25 hover:brightness-105 disabled:opacity-50"
                >
                  {modalLoading ? 'Saving...' : editingStudent ? 'Update Details' : 'Create & Register Face'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Student?</h3>
            <p className="mt-1 text-xs text-slate-400">
              This action permanently deletes student <span className="font-mono font-bold text-slate-200">{deleteConfirmId}</span> and all associated biometric face embeddings.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="rounded-xl bg-rose-500 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-rose-500/25 hover:bg-rose-600"
              >
                Delete Student
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

