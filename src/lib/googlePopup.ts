export const GOOGLE_POPUP_PATH = '/auth/google/popup';
const ATTEMPT_KEY = 'lexitable:google-popup';
export const googlePopupChannel = (attempt: string) => `lexitable:google-auth:${attempt}`;

export function handleGooglePopup(apiBaseUrl: string): boolean {
  const params = new URLSearchParams(window.location.search);
  const callback = window.location.pathname === GOOGLE_POPUP_PATH && params.get('complete') === '1';
  const launching = window.location.pathname === GOOGLE_POPUP_PATH && !callback;
  let attempt: string | null;
  try {
    attempt = launching || callback
      ? params.get('attempt')
      : sessionStorage.getItem(ATTEMPT_KEY);
  } catch {
    return false;
  }
  if (!attempt || !/^[0-9a-f-]{36}$/.test(attempt)) return false;

  const channel = new BroadcastChannel(googlePopupChannel(attempt));
  if (launching) {
    // This marker only supports older backends; the signed callback carries the ID.
    try {
      sessionStorage.setItem(ATTEMPT_KEY, attempt);
    } catch { /* OAuth can continue without storage. */ }
    window.location.replace(`${apiBaseUrl}/auth/google?popupAttempt=${attempt}`);
    channel.close();
    return true;
  }

  try { sessionStorage.removeItem(ATTEMPT_KEY); } catch { /* Storage may be blocked. */ }
  channel.postMessage('google-auth-success');
  channel.close();
  window.close();
  return window.closed;
}
