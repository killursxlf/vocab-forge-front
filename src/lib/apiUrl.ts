export function resolveApiUrl(value: string | undefined, required = false): string {
  if (!value?.trim()) {
    if (required) throw new Error('Set VITE_API_BASE_URL before building the app');
    return 'http://localhost:3000';
  }
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('VITE_API_BASE_URL must be an HTTP(S) URL without credentials, query or hash');
  }
  return url.href.replace(/\/$/, '');
}
