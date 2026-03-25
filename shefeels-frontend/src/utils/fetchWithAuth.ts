/**
 * Lightweight fetch wrapper that dispatches a global `hl_auth_required`
 * CustomEvent when a response with status 401 is received. Callers
 * receive the original Response so existing logic continues to work.
 *
 * Optional: pass `dispatchOn401: false` in `init` to suppress the event
 * for calls like login where a 401 is expected and should not open the modal.
 */
export default async function fetchWithAuth(input: RequestInfo, init?: RequestInit & { dispatchOn401?: boolean }): Promise<Response> {
  const dispatchOn401 = init && (init as any).dispatchOn401 !== false;
  // Automatically attach Authorization header from common storage keys if not provided
  try {
    const headers = new Headers((init && init.headers) as HeadersInit | undefined);
    if (typeof window !== 'undefined') {
      const possibleKeys = ['hl_token', 'access_token', 'token', 'auth_token'];
      let token: string | null = null;
      for (const k of possibleKeys) {
        try { token = window.localStorage.getItem(k); } catch (e) { token = null; }
        if (token) break;
      }
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    const res = await fetch(input, Object.assign({}, init || {}, { headers }) as RequestInit);
    if (res && res.status === 401 && typeof window !== 'undefined' && dispatchOn401) {
      try { window.dispatchEvent(new CustomEvent('hl_auth_required', { detail: { status: 401, url: typeof input === 'string' ? input : String(input) } })); } catch {}
    }
    return res;
  } catch (err) {
    throw err;
  }
}
