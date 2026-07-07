import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sprout, Eye, EyeOff, Moon, Sun, MailCheck } from 'lucide-react';
import useStore from '../store/useStore';
import * as endpoints from '../api/endpoints';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false); // shows the "check your email" screen
  const [resendMsg, setResendMsg] = useState('');
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await endpoints.signup({ name, email, password });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendMsg('');
    try {
      await endpoints.resendVerification(email);
      setResendMsg('Sent! Check your inbox (and spam folder).');
    } catch {
      setResendMsg('Could not resend right now. Please try again in a bit.');
    } finally {
      setResending(false);
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
        <div className="auth-card">
          <div className="auth-title">
            <h1><Sprout size={28} strokeWidth={2.2} /> BLOOM</h1>
          </div>
          <div style={{ textAlign: 'center', padding: 'var(--space-sm) 0' }}>
            <MailCheck size={48} style={{ color: 'var(--color-sage, #5a8f69)', marginBottom: 'var(--space-md)' }} />
            <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-sm)' }}>Check your email</h2>
            <p style={{ lineHeight: 1.6, marginBottom: 'var(--space-md)' }}>
              We sent a verification link to <strong>{email}</strong>. Click it to activate your
              account, then sign in.
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: 'var(--space-lg)' }}>
              Didn't get it? Check your spam folder, or resend below.
            </p>
            {resendMsg && (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-sage, #5a8f69)', marginBottom: 'var(--space-md)' }}>
                {resendMsg}
              </p>
            )}
            <button className="btn btn-secondary w-full" onClick={handleResend} disabled={resending} style={{ marginBottom: 'var(--space-sm)' }}>
              {resending ? 'Resending...' : 'Resend verification email'}
            </button>
            <div className="auth-footer">
              <Link to="/login">Back to sign in</Link>
            </div>
          </div>
        </div>
      ) : (
      <div className="auth-card">
        <div className="auth-title">
          <h1><Sprout size={28} strokeWidth={2.2} /> BLOOM</h1>
          <p>Start your growth journey today.</p>
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
            <label className="input-label" htmlFor="signup-name">Your Name</label>
            <input
              id="signup-name"
              className="input"
              type="text"
              placeholder="Alex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="signup-password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="signup-password"
                className="input"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ width: '100%', paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <GoogleSignInButton onError={setError} />

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
      )}
    </div>
  );
}
