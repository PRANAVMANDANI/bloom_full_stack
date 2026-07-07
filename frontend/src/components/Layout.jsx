import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import useStore from '../store/useStore';
import * as endpoints from '../api/endpoints';
import OnboardingModal from './OnboardingModal';
import {
  Home,
  Target,
  Flame,
  Smile,
  BookOpen,
  MessageCircle,
  Wind,
  Sparkles,
  Award,
  Settings,
  Menu,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Moon,
  Sun,
} from 'lucide-react';

const SproutLogo = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      color: 'var(--accent-goals)',
      display: 'inline-block',
      verticalAlign: 'middle',
      marginRight: '8px',
    }}
  >
    <path d="M12 22V8" />
    <path d="M12 8C12 8 8.5 4 4 6C4 6 4 10 12 8Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 12C12 12 15.5 8 20 10C20 10 20 14 12 12Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 2c0 1.5-1.5 2.5-3 2.5" />
  </svg>
);

const navItems = [
  { path: '/dashboard', icon: <Home size={18} />, label: 'Dashboard' },
  { path: '/goals', icon: <Target size={18} />, label: 'Goals' },
  { path: '/habits', icon: <Flame size={18} />, label: 'Habit Tracker' },
  { path: '/mood', icon: <Smile size={18} />, label: 'Mood Check-in' },
  { path: '/journal', icon: <BookOpen size={18} />, label: 'Journal' },
  { path: '/chat', icon: <MessageCircle size={18} />, label: 'Chat' },
  { path: '/breathe', icon: <Wind size={18} />, label: 'Breathe' },
  { path: '/insights', icon: <Sparkles size={18} />, label: 'Insights' },
  { path: '/achievements', icon: <Award size={18} />, label: 'Achievements' },
  { path: '/settings', icon: <Settings size={18} />, label: 'Settings' },
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const logout = useStore((s) => s.logout);
  const user = useStore((s) => s.user);
  const toast = useStore((s) => s.toast);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const navigate = useNavigate();

  const handleLogout = async () => {
    // Best-effort server-side revocation (bumps token_version) before clearing
    // local tokens. Ignore failures so logout always completes.
    try {
      await endpoints.logout();
    } catch {
      /* token may already be invalid — clear locally regardless */
    }
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile header */}
      <div className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
          <Menu size={22} />
        </button>
        <span className="sidebar-logo" style={{ display: 'flex', alignItems: 'center' }}>
          <SproutLogo size={22} /> BLOOM
        </span>
        <button
          className="mobile-menu-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <div className="app-layout">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center' }}>
              <SproutLogo size={28} /> BLOOM
            </div>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button
              className="btn btn-ghost w-full"
              onClick={toggleTheme}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '0.5rem' }}
            >
              {theme === 'dark' ? <><Sun size={16} /> Light mode</> : <><Moon size={16} /> Dark mode</>}
            </button>
            <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              {user?.name || user?.email}
            </div>
            <button className="btn btn-ghost w-full" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <LogOut size={16} /> Log out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="main-content">
          {children}
        </main>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 99,
            }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success'
            ? <CheckCircle2 size={16} style={{ color: 'var(--color-sage)', flexShrink: 0 }} />
            : <AlertCircle size={16} style={{ color: 'var(--color-rose)', flexShrink: 0 }} />}
          {toast.message}
        </div>
      )}

      {/* Onboarding Profile Modal */}
      <OnboardingModal />
    </>
  );
}
