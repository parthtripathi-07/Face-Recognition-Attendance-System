import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('faceattend_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isAuthRoute = error.config.url.includes('/auth/login');
      if (!isAuthRoute) {
        localStorage.removeItem('faceattend_token');
        localStorage.removeItem('faceattend_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  changePassword: (data) => api.post('/auth/change-password', data),
};

export const studentsAPI = {
  getAll: (params) => api.get('/students', { params }),
  getById: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
};

export const facesAPI = {
  register: (studentId, data) => api.post(`/faces/register/${studentId}`, data),
  delete: (studentId) => api.delete(`/faces/${studentId}`),
  getStatus: (studentId) => api.get(`/faces/${studentId}/status`),
};

export const recognitionAPI = {
  recognize: (data) => api.post('/recognition/recognize', data),
};

export const attendanceAPI = {
  mark: (data) => api.post('/attendance/mark', data),
  recognizeAndMark: (data) => api.post('/attendance/recognize-and-mark', data),
  getHistory: (params) => api.get('/attendance', { params }),
  getToday: () => api.get('/attendance/today'),
  getStudentHistory: (studentId) => api.get(`/attendance/student/${studentId}`),
  createSession: (data) => api.post('/attendance/sessions', data),
  getActiveSession: () => api.get('/attendance/sessions/active'),
  endSession: (sessionId) => api.post(`/attendance/sessions/${sessionId}/end`),
  getSessions: () => api.get('/attendance/sessions'),
};

export const reportsAPI = {
  getDashboard: () => api.get('/reports/dashboard'),
  getDaily: (params) => api.get('/reports/daily', { params }),
  getMonthly: (params) => api.get('/reports/monthly', { params }),
  getExportCsvUrl: (params) => {
    const query = new URLSearchParams(params).toString();
    return `${API_BASE_URL}/reports/export/csv${query ? `?${query}` : ''}`;
  },
  getExportExcelUrl: (params) => {
    const query = new URLSearchParams(params).toString();
    return `${API_BASE_URL}/reports/export/excel${query ? `?${query}` : ''}`;
  },
  getExportMonthlyRegisterExcelUrl: (params) => {
    const query = new URLSearchParams(params).toString();
    return `${API_BASE_URL}/reports/export/monthly-register${query ? `?${query}` : ''}`;
  },
  getExportMonthlyRegisterCsvUrl: (params) => {
    const query = new URLSearchParams(params).toString();
    return `${API_BASE_URL}/reports/export/monthly-register/csv${query ? `?${query}` : ''}`;
  },
};

export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

export default api;
