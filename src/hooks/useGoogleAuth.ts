import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL, getProfile } from '@/lib/api';
import { GOOGLE_POPUP_PATH, googlePopupChannel } from '@/lib/googlePopup';
import { useAuth } from '@/contexts/AuthContext';
import i18n from '@/i18n';

export function useGoogleAuth() {
  const { user } = useAuth();
  const popup = useRef<Window | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const request = useRef<AbortController | null>(null);
  const listener = useRef<((event: MessageEvent) => void) | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const cleanup = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    if (poll.current) clearInterval(poll.current);
    poll.current = null;
    channel.current?.close();
    channel.current = null;
    if (listener.current) window.removeEventListener('message', listener.current);
    listener.current = null;
    request.current?.abort();
    request.current = null;
    popup.current?.close();
    popup.current = null;
  }, []);
  useEffect(() => cleanup, [cleanup]);

  const start = () => {
    if (request.current) { popup.current?.focus(); return; }
    setError('');
    setPending(true);
    const url = API_BASE_URL + '/auth/google';
    if (typeof BroadcastChannel === 'undefined') { window.location.assign(url); return; }
    const controller = new AbortController();
    request.current = controller;
    const fail = (key: string) => {
      if (controller.signal.aborted) return;
      cleanup();
      setPending(false);
      setError(i18n.t(key));
    };
    let checking = false;
    let checkAfterSignal = false;
    const checkSession = async (reportError: boolean) => {
      if (controller.signal.aborted) return;
      if (checking) { checkAfterSignal ||= reportError; return; }
      checking = true;
      try {
        await getProfile(controller.signal);
        if (controller.signal.aborted) return;
        cleanup();
        window.location.assign('/app');
      } catch {
        if (reportError) fail('auth.login.errors.googleError');
      } finally {
        checking = false;
        if (checkAfterSignal && !controller.signal.aborted) {
          checkAfterSignal = false;
          void checkSession(true);
        }
      }
    };
    const receive = (message: unknown) => {
      if (controller.signal.aborted) return;
      if (message === 'google-auth-error') fail('auth.login.errors.googleError');
      else if (message === 'google-auth-success') void checkSession(true);
    };
    const attempt = crypto.randomUUID();
    channel.current = new BroadcastChannel(googlePopupChannel(attempt));
    channel.current.onmessage = event => { receive(event.data); };
    listener.current = event => {
      if (event.origin !== new URL(API_BASE_URL).origin || !popup.current || event.source !== popup.current) return;
      receive(event.data);
    };
    window.addEventListener('message', listener.current);
    // A severed WindowProxy reports closed while the OAuth window is still open.
    timeout.current = setTimeout(() => fail('auth.login.errors.googleTimeout'), 600_000);
    popup.current = window.open(`${GOOGLE_POPUP_PATH}?attempt=${attempt}`, '_blank', 'width=500,height=600');
    if (!popup.current) { cleanup(); window.location.assign(url); return; }
    // Only a newly authenticated session proves completion when popup messages are lost.
    if (!user) poll.current = setInterval(() => { void checkSession(false); }, 2_000);
  };
  return { start, pending, error };
}
