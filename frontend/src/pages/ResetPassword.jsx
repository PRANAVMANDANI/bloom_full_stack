import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Sprout, Eye, EyeOff, CircleCheck, CircleAlert } from 'lucide-react';
import * as endpoints from '../api/endpoints';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('This reset link is missing its token.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await endpoints.resetPassword(token, newPassword);
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'This reset link is invalid or has expired. Please request a new one.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: done || (!token) ? 'center' : 'left' }}>
        <div className="auth-title">
          <h1><Sprout size={28} strokeWidth={2.2} /> BLOOM</h1>
          {!done && token && <p>Choose a new password.</p>}
        </div>

        {done ? (
          <div style={{ padding: 'var(--space-sm) 0' }}>
            <CircleCheck size={48} style={{ color: 'var(--color-sage, #5a8f69)', marginBottom: 'var(--space-md)' }} />
            <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-sm)' }}>Password updated 🌱</h2>
            <p>Taking you to sign in...</p>
          </div>
        ) : !token ? (
          <div style={{ padding: 'var(--space-sm) 0' }}>
            <CircleAlert size={48} style={{ color: 'var(--color-rose, #bd5d5d)', marginBottom: 'var(--space-md)' }} />
            <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-sm)' }}>Invalid link</h2>
            <p style={{ marginBottom: 'var(--space-lg)' }}>This reset link is missing its token.</p>
            <div className="auth-footer">
              <Link to="/forgot-password">Request a new link</Link>
            </div>
          </div>
        ) : (
          <>
            <form className="auth-form" onSubmit={handleSubmit}>
              {error && <div className="auth-alert" role="alert">{error}</div>}

              <div className="input-group">
                <label className="input-label" htmlFor="new-password">New password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="new-password"
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                    style={{ width: '100%', paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    className="input-eye-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="confirm-new-password">Confirm new password</label>
                <input
                  id="confirm-new-password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}>
                {loading ? 'Updating...' : 'Reset password'}
              </button>
            </form>

            <div className="auth-footer">
              <Link to="/login">Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
