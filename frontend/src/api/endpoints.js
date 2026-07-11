import api from './client';

// Auth
export const signup = (data) => api.post('/api/auth/signup', data);
export const login = (data) => api.post('/api/auth/login', data);
export const googleAuth = (credential) => api.post('/api/auth/google', { credential });
export const getMe = () => api.get('/api/auth/me');
export const verifyOtp = (email, code) => api.post('/api/auth/verify-otp', { email, code });
export const resendVerification = (email) => api.post('/api/auth/resend-verification', { email });
export const refreshTokens = (refresh_token) => api.post('/api/auth/refresh', { refresh_token });
export const logoutAll = () => api.post('/api/auth/logout-all');
export const forgotPassword = (email) => api.post('/api/auth/forgot-password', { email });
export const resetPassword = (token, new_password) => api.post('/api/auth/reset-password', { token, new_password });

// Dashboard
export const getDashboard = () => api.get('/api/dashboard');

// Bloom Garden
export const getGarden = (weeks = 12) => api.get('/api/garden', { params: { weeks } });

// Goals
export const getGoals = () => api.get('/api/goals');
export const createGoal = (data) => api.post('/api/goals', data);
export const updateGoal = (id, data) => api.put(`/api/goals/${id}`, data);
export const deleteGoal = (id) => api.delete(`/api/goals/${id}`);
export const completeGoal = (id) => api.post(`/api/goals/${id}/complete`);
export const toggleGoalDate = (id, date) => api.post(`/api/goals/${id}/toggle-date`, { date });
export const freezeGoalDate = (id, date) => api.post(`/api/goals/${id}/freeze-date`, { date });
export const getMonthlyGoalStats = (year, month) => api.get('/api/goals/stats/monthly', { params: { year, month } });

// Habits
export const getHabits = () => api.get('/api/habits');
export const createHabit = (data) => api.post('/api/habits', data);
export const deleteHabit = (id) => api.delete(`/api/habits/${id}`);
export const logRelapse = (id) => api.post(`/api/habits/${id}/relapse`);

// Urge Logs
export const getUrgeLogs = (habitId) => api.get('/api/urge-logs', { params: { habit_id: habitId } });
export const createUrgeLog = (data) => api.post('/api/urge-logs', data);

// Mood Logs
export const getMoodLogs = (limit = 30) => api.get('/api/mood-logs', { params: { limit } });
export const createMoodLog = (data) => api.post('/api/mood-logs', data);

// Journal
export const getJournalEntries = (limit = 20, q = '') => api.get('/api/journal', { params: { limit, ...(q ? { q } : {}) } });
export const createJournalEntry = (data) => api.post('/api/journal', data);
export const deleteJournalEntry = (id) => api.delete(`/api/journal/${id}`);

// Insights
export const getInsights = (limit = 10) => api.get('/api/insights', { params: { limit } });
export const generateInsights = () => api.post('/api/insights/generate');
export const getWeeklyReview = () => api.get('/api/insights/weekly-review');
export const generateWeeklyReview = () => api.post('/api/insights/weekly-review/generate');

// Milestones
export const getMilestones = () => api.get('/api/milestones');

// Settings
export const exportData = () => api.get('/api/settings/export');
export const deleteAccount = () => api.delete('/api/settings/account');
export const updateProfile = (profileData) => api.put('/api/settings/profile', profileData);
export const changePassword = (data) => api.put('/api/settings/password', data);
export const getReminderSettings = () => api.get('/api/settings/reminders');
export const updateReminderSettings = (data) => api.put('/api/settings/reminders', data);

// Chat Sessions
export const getChatSessions = () => api.get('/api/chat/sessions');
export const renameChatSession = (sessionId, name) => api.put(`/api/chat/sessions/${sessionId}/rename`, { name });
export const deleteChatSession = (sessionId) => api.delete(`/api/chat/sessions/${sessionId}`);
