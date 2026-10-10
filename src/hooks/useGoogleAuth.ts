import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import i18n from '@/i18n';

export function useGoogleAuth() {
  const popup = useRef<Window | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const cleanup = () => {
    if (poll.current) clearInterval(poll.current);
    poll.current = null;
    popup.current = null;
  };
  const cancel = () => {
    popup.current?.close();
    cleanup();
    setPending(false);
  };
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.origin !== new URL(API_BASE_URL).origin || !popup.current || event.source !== popup.current) return;
      if (event.data === 'google-auth-success') {
        cleanup();
        window.location.assign('/app');
      } else if (event.data === 'google-auth-error') {
        cleanup();
        setPending(false);
        setError(i18n.t('auth.login.errors.googleError'));
      }
    };
    window.addEventListener('message', listener);
    return () => { window.removeEventListener('message', listener); popup.current?.close(); cleanup(); };
  }, []);

  const start = () => {
    if (popup.current && !popup.current.closed) { popup.current.focus(); return; }
    setError('');
    setPending(true);
    const url = API_BASE_URL + '/auth/google';
    popup.current = window.open(url, 'GoogleLogin', 'width=500,height=600');
    if (!popup.current) { window.location.assign(url); return; }
    poll.current = setInterval(() => {
      if (popup.current?.closed) {
        cleanup();
        setPending(false);
        setError(i18n.t('auth.login.errors.googleClosed'));
      }
    }, 500);
  };
  return { start, cancel, pending, error };
}
