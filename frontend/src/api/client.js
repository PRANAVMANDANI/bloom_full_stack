import axios from 'axios';
import useStore from '../store/useStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bloom_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Credential endpoints where a 401 means "bad credentials/code/token", not
// "expired session". Everything else (including /api/auth/me and
// /api/auth/logout-all) should go through the refresh flow.
const CREDENTIAL_ENDPOINTS = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/google',
  '/api/auth/refresh',
  '/api/auth/verify-otp',
  '/api/auth/resend-verification',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

// Single-flight refresh: when several requests 401 at once (e.g. dashboard
// widgets loading in parallel after the access token expires), only the first
// one performs the refresh; the rest await the same promise and retry with
// the new token instead of firing duplicate refresh calls.
let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    const refreshToken = localStorage.getItem('bloom_refresh_token');
    if (!refreshToken) return Promise.reject(new Error('No refresh token'));

    refreshPromise = axios
      .post(`${API_BASE_URL}/api/auth/refresh`, { refresh_token: refreshToken })
      .then((res) => {
        const { access_token, refresh_token, user } = res.data;
        useStore.getState().updateTokens(access_token, refresh_token);
        if (user) useStore.getState().setUser(user);
        return access_token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Response interceptor: transparently refresh the session on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isCredentialEndpoint = CREDENTIAL_ENDPOINTS.some((p) =>
      originalRequest.url?.includes(p)
    );

    if (error.response?.status === 401 && !isCredentialEndpoint && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const accessToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token missing/expired/revoked — the session is truly over.
        useStore.getState().logout();
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL };
