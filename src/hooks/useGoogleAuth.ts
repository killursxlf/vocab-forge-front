import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL, getProfile } from '@/lib/api';
import { GOOGLE_POPUP_PATH, googlePopupChannel } from '@/lib/googlePopup';
import i18n from '@/i18n';

export function useGoogleAuth() {
  const popup = useRef<Window | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const listener = useRef<((event: MessageEvent) => void) | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const cleanup = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    channel.current?.close();
    channel.current = null;
    if (listener.current) window.removeEventListener('message', listener.current);
    listener.current = null;
    request.current?.abort();
    request.current = null;
    popup.current?.close();
    popup.current = null;
  }, []);
  const cancel = () => {
    cleanup();
    setPending(false);
  };
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
    const receive = async (message: unknown) => {
      if (controller.signal.aborted) return;
      if (message === 'google-auth-error') { fail('auth.login.errors.googleError'); return; }
      if (message !== 'google-auth-success' || checking) return;
      checking = true;
      try {
        await getProfile(controller.signal);
        if (controller.signal.aborted) return;
        cleanup();
        window.location.assign('/app');
      } catch {
        fail('auth.login.errors.googleError');
      }
    };
    const attempt = crypto.randomUUID();
    channel.current = new BroadcastChannel(googlePopupChannel(attempt));
    channel.current.onmessage = event => { void receive(event.data); };
    listener.current = event => {
      if (event.origin !== new URL(API_BASE_URL).origin || !popup.current || event.source !== popup.current) return;
      void receive(event.data);
    };
    window.addEventListener('message', listener.current);
    // A severed WindowProxy reports closed while the OAuth window is still open.
    timeout.current = setTimeout(() => fail('auth.login.errors.googleTimeout'), 120_000);
    popup.current = window.open(`${GOOGLE_POPUP_PATH}?attempt=${attempt}`, '_blank', 'width=500,height=600');
    if (!popup.current) { cleanup(); window.location.assign(url); }
  };
  return { start, cancel, pending, error };
}
