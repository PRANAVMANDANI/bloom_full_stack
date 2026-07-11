import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { Sprout, MailCheck, ShieldCheck } from 'lucide-react';
import useStore from '../store/useStore';
import * as endpoints from '../api/endpoints';
import OtpInput from '../components/OtpInput';

const RESEND_COOLDOWN = 30; // seconds

/**
 * OTP verification screen. Reached from:
 *  - Signup (email passed via router state)
 *  - Login with an unverified account (state.fromLogin triggers an auto-resend)
 *  - A direct visit with ?email= (fallback)
 */
export default function VerifyEmail() {
  const location = useLocation();
  const [params] = useSearchParams();
  const email = location.state?.email || params.get('email') || '';
  const fromLogin = !!location.state?.fromLogin;

  const [code, setCode] = useState('');
  const [status, setStatus] = useState('idle'); // idle | verifying | success
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const login = useStore((s) => s.login);
  const navigate = useNavigate();
  const autoResent = useRef(false);

  // Coming from login means the old code is likely long expired — send a
  // fresh one automatically so the user isn't stuck on a dead screen.
  useEffect(() => {
    if (fromLogin && email && !autoResent.current) {
      autoResent.current = true;
      endpoints.resendVerification(email).then(() => {
        setInfo('We just emailed you a fresh code.');
        setCooldown(RESEND_COOLDOWN);
      }).catch(() => { /* rate-limited or offline — user can retry manually */ });
    }
  }, [fromLogin, email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async (fullCode) => {
    if (status === 'verifying' || status === 'success') return;
    setError('');
    setStatus('verifying');
    try {
      const res = await endpoints.verifyOtp(email, fullCode);
      const { access_token, refresh_token, user } = res.data;
      login(user, access_token, refresh_token);
      setStatus('success');
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (err) {
      setStatus('idle');
      setCode('');
      setError(err.response?.data?.detail || 'That code didn’t work. Please try again.');
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    try {
      await endpoints.resendVerification(email);
      setInfo('New code sent! Check your inbox (and spam folder).');
      setCooldown(RESEND_COOLDOWN);
      setCode('');
    } catch {
      setError('Could not resend right now. Please wait a moment and try again.');
    }
  };

  if (!email) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-title">
            <h1><Sprout size={28} strokeWidth={2.2} /> BLOOM</h1>
          </div>
          <p style={{ marginBottom: 'var(--space-lg)' }}>
            We don't know which email to verify. Please sign up or sign in first.
          </p>
          <div className="auth-footer">
            <Link to="/signup">Create an account</Link> · <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-title">
          <h1><Sprout size={28} strokeWidth={2.2} /> BLOOM</h1>
        </div>

        {status === 'success' ? (
          <div className="auth-success-pop" style={{ padding: 'var(--space-lg) 0' }}>
            <ShieldCheck size={48} style={{ color: 'var(--color-sage)', marginBottom: 'var(--space-md)' }} />
            <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-sm)' }}>You're all set! 🌱</h2>
            <p>Your email is verified. Taking you to your dashboard...</p>
          </div>
        ) : (
          <>
            <MailCheck size={40} style={{ color: 'var(--color-sage)', marginBottom: 'var(--space-sm)' }} />
            <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-sm)' }}>Check your email</h2>
            <p style={{ lineHeight: 1.6, marginBottom: 'var(--space-lg)' }}>
              We sent a 6-digit code to <strong>{email}</strong>.
              <br />Enter it below to activate your account.
            </p>

            {error && (
              <div className="auth-alert" role="alert">{error}</div>
            )}
            {info && !error && (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-sage)', marginBottom: 'var(--space-md)' }}>
                {info}
              </p>
            )}

            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={handleVerify}
              disabled={status === 'verifying'}
              error={!!error}
            />

            <button
              className="btn btn-primary btn-lg w-full"
              style={{ marginTop: 'var(--space-lg)' }}
              onClick={() => handleVerify(code)}
              disabled={code.length !== 6 || status === 'verifying'}
            >
              {status === 'verifying' ? 'Verifying...' : 'Verify email'}
            </button>

            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-lg)' }}>
              Didn't get it?{' '}
              {cooldown > 0 ? (
                <span>Resend available in {cooldown}s</span>
              ) : (
                <button type="button" className="link-button" onClick={handleResend}>
                  Resend code
                </button>
              )}
            </p>

            <div className="auth-footer">
              <Link to="/login">Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
