import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sprout, MailCheck, Moon, Sun } from 'lucide-react';
import useStore from '../store/useStore';
import * as endpoints from '../api/endpoints';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await endpoints.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <button
        className="auth-theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {submitted ? (
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-title">
            <h1><Sprout size={28} strokeWidth={2.2} /> BLOOM</h1>
          </div>
          <div style={{ padding: 'var(--space-sm) 0' }}>
            <MailCheck size={48} style={{ color: 'var(--color-sage, #5a8f69)', marginBottom: 'var(--space-md)' }} />
            <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-sm)' }}>Check your email</h2>
            <p style={{ lineHeight: 1.6, marginBottom: 'var(--space-lg)' }}>
              If an account exists for <strong>{email}</strong>, we've sent a link to reset your password.
              It expires in 1 hour.
            </p>
            <div className="auth-footer">
              <Link to="/login">Back to sign in</Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="auth-card">
          <div className="auth-title">
            <h1><Sprout size={28} strokeWidth={2.2} /> BLOOM</h1>
            <p>Enter your email and we'll send you a reset link.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && (
              <div style={{
                padding: '0.75rem 1rem',
                background: 'var(--color-rose-dim)',
                border: '1px solid rgba(189, 93, 93, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-rose)',
                fontSize: '0.875rem',
              }}>
                {error}
              </div>
            )}

            <div className="input-group">
              <label className="input-label" htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>

          <div className="auth-footer">
            <Link to="/login">Back to sign in</Link>
          </div>
        </div>
      )}
    </div>
  );
}
