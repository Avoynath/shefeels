// Minimal auth helper compatible with AdminHost usage.
export function setAuthToken(token: string | null | undefined) {
  try {
    if (token) {
      // mirror token under admin key so admin requests can use it if they look here
      localStorage.setItem('hl_token', token);
      // also expose a window var for legacy code
      // @ts-ignore
      if (typeof window !== 'undefined') window.__HL_ADMIN_TOKEN = token;
    } else {
      localStorage.removeItem('hl_token');
      // @ts-ignore
      if (typeof window !== 'undefined') window.__HL_ADMIN_TOKEN = null;
    }
  } catch (e) {
    // ignore storage errors
  }
}
