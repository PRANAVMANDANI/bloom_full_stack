import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import * as endpoints from '../api/endpoints';

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/** Load the Google Identity Services script once, shared across mounts. */
function loadGsiScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Renders Google's official Sign-In button. On success it exchanges the Google
 * credential for BLOOM tokens and navigates to the dashboard.
 * Renders nothing if VITE_GOOGLE_CLIENT_ID isn't configured.
 */
export default function GoogleSignInButton({ onError }) {
  const buttonRef = useRef(null);
  const [ready, setReady] = useState(false);
  const login = useStore((s) => s.login);
  const theme = useStore((s) => s.theme);
  const navigate = useNavigate();

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    const handleCredential = async (response) => {
      try {
        const res = await endpoints.googleAuth(response.credential);
        const { access_token, refresh_token, user } = res.data;
        login(user, access_token, refresh_token);
        navigate('/dashboard');
      } catch (err) {
        onError?.(err.response?.data?.detail || 'Google sign-in failed. Please try again.');
      }
    };

    loadGsiScript()
      .then(() => {
        if (cancelled || !buttonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: handleCredential,
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'center',
        });
        setReady(true);
      })
      .catch(() => onError?.('Could not load Google sign-in.'));

    return () => {
      cancelled = true;
    };
    // Re-render the button when the theme changes so it matches light/dark.
  }, [theme]);

  if (!CLIENT_ID) return null;

  return (
    <div style={{ marginTop: 'var(--space-md)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        margin: '0 0 var(--space-md)', color: 'var(--color-text-muted)', fontSize: '0.8rem',
      }}>
        <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
        or
        <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
      </div>
      <div ref={buttonRef} style={{ display: 'flex', justifyContent: 'center', minHeight: ready ? 'auto' : '44px' }} />
    </div>
  );
}
