import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Sprout, MailCheck, CircleAlert } from 'lucide-react';
import useStore from '../store/useStore';
import * as endpoints from '../api/endpoints';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');
  const login = useStore((s) => s.login);
  const navigate = useNavigate();
  const ran = useRef(false); // guard against React 18 StrictMode double-invoke

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing its token.');
      return;
    }

    (async () => {
      try {
        const res = await endpoints.verifyEmail(token);
        const { access_token, refresh_token, user } = res.data;
        login(user, access_token, refresh_token);
        setStatus('success');
        setTimeout(() => navigate('/dashboard'), 1500);
      } catch (err) {
        setStatus('error');
        setMessage(
          err.response?.data?.detail ||
            'This verification link is invalid or has expired. Please request a new one.'
        );
      }
    })();
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-title">
          <h1><Sprout size={28} strokeWidth={2.2} /> BLOOM</h1>
        </div>

        {status === 'verifying' && (
          <div style={{ padding: 'var(--space-lg) 0' }}>
            <div className="spinner" style={{ margin: '0 auto var(--space-md)' }} />
            <p>Verifying your email...</p>
          </div>
        )}

        {status === 'success' && (
          <div style={{ padding: 'var(--space-lg) 0' }}>
            <MailCheck size={48} style={{ color: 'var(--color-sage, #5a8f69)', marginBottom: 'var(--space-md)' }} />
            <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-sm)' }}>You're all set! 🌱</h2>
            <p>Your email is verified. Taking you to your dashboard...</p>
          </div>
        )}

        {status === 'error' && (
          <div style={{ padding: 'var(--space-lg) 0' }}>
            <CircleAlert size={48} style={{ color: 'var(--color-rose, #bd5d5d)', marginBottom: 'var(--space-md)' }} />
            <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-sm)' }}>Verification failed</h2>
            <p style={{ lineHeight: 1.6, marginBottom: 'var(--space-lg)' }}>{message}</p>
            <div className="auth-footer">
              <Link to="/login">Back to sign in</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
