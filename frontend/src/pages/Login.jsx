import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sprout, Eye, EyeOff, Moon, Sun } from 'lucide-react';
import useStore from '../store/useStore';
import * as endpoints from '../api/endpoints';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [resending, setResending] = useState(false);
  const login = useStore((s) => s.login);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResendMsg('');
    setNeedsVerification(false);
    setLoading(true);

    try {
      const res = await endpoints.login({ email, password });
      const { access_token, refresh_token, user } = res.data;
      login(user, access_token, refresh_token);
      navigate('/dashboard');
    } catch (err) {
      // 403 = correct credentials but email not yet verified.
      if (err.response?.status === 403) {
        setNeedsVerification(true);
      }
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendMsg('');
    try {
      await endpoints.resendVerification(email);
      setResendMsg('Verification email sent! Check your inbox (and spam folder).');
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
      <div className="auth-card">
        <div className="auth-title">
          <h1><Sprout size={28} strokeWidth={2.2} /> BLOOM</h1>
          <p>Welcome back. Your journey continues.</p>
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

          {needsVerification && (
            <div style={{ fontSize: '0.85rem', textAlign: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={handleResend}
                disabled={resending || !email}
              >
                {resending ? 'Resending...' : 'Resend verification email'}
              </button>
              {resendMsg && (
                <p style={{ marginTop: 'var(--space-sm)', color: 'var(--color-sage, #5a8f69)' }}>{resendMsg}</p>
              )}
            </div>
          )}

          <div className="input-group">
            <label className="input-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="login-password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                className="input"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
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
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <GoogleSignInButton onError={setError} />

        <div className="auth-footer">
          New here? <Link to="/signup">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
