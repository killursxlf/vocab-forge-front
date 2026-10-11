export const GOOGLE_POPUP_PATH = '/auth/google/popup';
const ATTEMPT_KEY = 'lexitable:google-popup';
export const googlePopupChannel = (attempt: string) => `lexitable:google-auth:${attempt}`;

// Session storage survives the OAuth navigation even when COOP severs window.opener.
export function handleGooglePopup(apiBaseUrl: string): boolean {
  const launching = window.location.pathname === GOOGLE_POPUP_PATH;
  let attempt: string | null;
  try {
    attempt = launching
      ? new URLSearchParams(window.location.search).get('attempt')
      : sessionStorage.getItem(ATTEMPT_KEY);
  } catch {
    return false;
  }
  if (!attempt || !/^[0-9a-f-]{36}$/.test(attempt)) return false;

  const channel = new BroadcastChannel(googlePopupChannel(attempt));
  if (launching) {
    try {
      sessionStorage.setItem(ATTEMPT_KEY, attempt);
      window.location.replace(apiBaseUrl + '/auth/google');
    } catch {
      channel.postMessage('google-auth-error');
      window.close();
    }
    channel.close();
    return true;
  }

  sessionStorage.removeItem(ATTEMPT_KEY);
  channel.postMessage('google-auth-success');
  channel.close();
  window.close();
  return window.closed;
}
