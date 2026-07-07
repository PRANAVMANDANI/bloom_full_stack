import { create } from 'zustand';
import api from '../api/client';

// Apply the theme to the document root as early as possible.
const initialTheme = localStorage.getItem('bloom_theme') || 'light';
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', initialTheme);
}

const useStore = create((set, get) => ({
  // --- Theme State ---
  theme: initialTheme,

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('bloom_theme', next);
    document.documentElement.setAttribute('data-theme', next);
    set({ theme: next });
  },

  // --- Auth State ---
  user: JSON.parse(localStorage.getItem('bloom_user') || 'null'),
  accessToken: localStorage.getItem('bloom_access_token') || null,
  refreshToken: localStorage.getItem('bloom_refresh_token') || null,
  isAuthenticated: !!localStorage.getItem('bloom_access_token'),

  login: (userData, accessToken, refreshToken) => {
    localStorage.setItem('bloom_user', JSON.stringify(userData));
    localStorage.setItem('bloom_access_token', accessToken);
    localStorage.setItem('bloom_refresh_token', refreshToken);
    set({
      user: userData,
      accessToken,
      refreshToken,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem('bloom_user');
    localStorage.removeItem('bloom_access_token');
    localStorage.removeItem('bloom_refresh_token');
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  updateTokens: (accessToken, refreshToken) => {
    localStorage.setItem('bloom_access_token', accessToken);
    localStorage.setItem('bloom_refresh_token', refreshToken);
    set({ accessToken, refreshToken });
  },

  setUser: (userData) => {
    localStorage.setItem('bloom_user', JSON.stringify(userData));
    set({ user: userData });
  },

  // Refreshes the cached user from the server so fields added after a user's
  // last login (e.g. auth_provider) are never stale. Silently no-ops on failure.
  refreshUser: async () => {
    try {
      const res = await api.get('/api/auth/me');
      localStorage.setItem('bloom_user', JSON.stringify(res.data));
      set({ user: res.data });
    } catch {
      /* ignore — interceptor handles auth failures separately */
    }
  },

  // --- Dashboard State ---
  dashboard: null,
  dashboardLoading: false,

  fetchDashboard: async () => {
    set({ dashboardLoading: true });
    try {
      const res = await api.get('/api/dashboard');
      set({ dashboard: res.data, dashboardLoading: false });
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
      set({ dashboardLoading: false });
    }
  },

  // --- Toast ---
  toast: null,
  showToast: (message, type = 'success') => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },
}));

export default useStore;
