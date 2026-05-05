import axios from 'axios';
import { getToken, clearAuth } from '../utils/token.ts';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthRequest = url.includes('/auth/login') || url.includes('/auth/verify-sa-password');
    // 401 = token missing/expired/invalid → session is broken, force re-login.
    // 403 = authenticated but the specific action is denied (e.g. first-article gate,
    //   role mismatch). Let the caller surface error.response.data.detail to the user;
    //   do NOT clear the session or navigate.
    if (error.response?.status === 401 && !isAuthRequest) {
      clearAuth();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
