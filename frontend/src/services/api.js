import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
  withCredentials: false,
});

// ── Request Interceptor ──────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('idToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // منع الكاش
    config.params = { ...config.params, _t: Date.now() };
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor ─────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      error.message = 'لا يمكن الاتصال بالخادم. تأكد من تشغيل Backend.';
    } else {
      const status = error.response.status;
      const backendMsg = error.response.data?.error;

      const messages = {
        401: 'انتهت جلسة العمل. يرجى تسجيل الدخول مرة أخرى.',
        403: 'ليس لديك صلاحية للوصول لهذا المورد.',
        404: 'الخدمة المطلوبة غير متوفرة.',
        429: 'تجاوزت الحد المسموح للطلبات. يرجى الانتظار.',
        500: backendMsg || 'حدث خطأ في الخادم. يرجى المحاولة لاحقاً.',
        400: backendMsg || 'بيانات الطلب غير صحيحة.',
      };

      if (status === 401) localStorage.removeItem('idToken');
      error.message = messages[status] || backendMsg || 'حدث خطأ غير متوقع.';
    }

    return Promise.reject(error);
  }
);

// ── API Methods ──────────────────────────────────────────────────────

export const signup          = (email, uid, fullName) => api.post('/signup', { email, uid, fullName }).then(r => r.data);
export const login           = (email, password)      => api.post('/login', { email, password }).then(r => r.data);
export const encryptData     = (data)                 => api.post('/encrypt', { data }).then(r => r.data);
export const decryptData     = (token, key)           => api.post('/decrypt', { token, key }).then(r => r.data);
export const sendEncryptionKey = ()                   => api.post('/send-key').then(r => r.data);
export const getUserKey      = ()                     => api.get('/user/key').then(r => r.data);
export const requestOTP      = ()                     => api.post('/request-otp').then(r => r.data);
export const verifyOTP       = (otp)                  => api.post('/verify-otp', { otp }).then(r => r.data);
export const getHistory      = (limit = 50)           => api.get('/history', { params: { limit } }).then(r => r.data);
export const getEncryptedFiles = ()                   => api.get('/files').then(r => r.data);
export const healthCheck     = ()                     => api.get('/health').then(r => r.data);
export const getStats        = ()                     => api.get('/stats').then(r => r.data);

export const uploadFileEncrypt = (formData, onProgress) =>
  api.post('/upload-encrypt', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress && e.total && onProgress(Math.round((e.loaded * 100) / e.total)),
  }).then(r => r.data);

export const downloadFileDecrypt = (fileId) =>
  api.get(`/download-decrypt/${fileId}`, { responseType: 'blob' }).then(r => r.data);

// Profile edit requests
export const requestProfileEdit = (data)       => api.post('/user/request-edit', data).then(r => r.data);
export const getUserEditRequest  = ()           => api.get('/user/edit-request').then(r => r.data);
export const getAdminEditRequests = ()          => api.get('/admin/edit-requests').then(r => r.data);
export const handleEditRequest   = (id, action) => api.post(`/admin/edit-requests/${id}`, { action }).then(r => r.data);

export default api;