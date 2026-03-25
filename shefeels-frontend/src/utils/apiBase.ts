const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

let cachedResolvedBase: string | null = null;
// cachedOrigin may be a string when resolved, null when resolution failed, or undefined
// before we've attempted resolution.
let cachedOrigin: string | null | undefined = undefined;

function computeRuntimeOrigin(): string {
  try {
    if (typeof window !== 'undefined' && window.location) {
      return `${window.location.protocol}//${window.location.host}`;
    }
  } catch {
    // ignore and fall through to globalThis checks
  }

  try {
    const loc = (globalThis as any)?.location;
    if (loc?.origin) return loc.origin as string;
    if (loc?.protocol && loc?.host) {
      return `${loc.protocol}//${loc.host}`;
    }
  } catch {
    // ignore and fall through to fallback
  }

  return 'http://localhost:8000';
}

/**
 * Normalize an API base string so we always end up with an absolute URL.
 * Accepts values like `/api/v1`, `//api.example.com`, or full URLs.
 */
export function resolveApiBaseURL(base: string = RAW_API_BASE_URL): string {
  const trimmed = (base || '').trim();
  if (!trimmed) {
    return computeRuntimeOrigin();
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    const origin = computeRuntimeOrigin();
    const protocol = origin.startsWith('https') ? 'https:' : 'http:';
    return `${protocol}${trimmed}`;
  }

  const origin = computeRuntimeOrigin();
  if (trimmed.startsWith('/')) {
    return `${origin}${trimmed}`;
  }

  return `${origin}/${trimmed}`;
}

export function getApiBaseUrl(): string {
  if (cachedResolvedBase) return cachedResolvedBase;
  cachedResolvedBase = resolveApiBaseURL(RAW_API_BASE_URL);
  return cachedResolvedBase;
}

/**
 * Return the origin portion (scheme + host + optional port) of the API base URL.
 */
export function getApiOrigin(): string | null {
  if (cachedOrigin !== undefined) return cachedOrigin;
  try {
    cachedOrigin = new URL(getApiBaseUrl()).origin;
  } catch {
    cachedOrigin = null;
  }
  return cachedOrigin;
}

/**
 * Build a full API URL for a given path, automatically removing duplicate `/api/vN`
 * fragments when the base already includes the version prefix.
 */
export function buildApiUrl(path = '', base?: string): string {
  const resolvedBase = base ? resolveApiBaseURL(base) : getApiBaseUrl();
  if (!path) return resolvedBase;

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const cleanBase = resolvedBase.replace(/\/+$/g, '');
  let cleanPath = path.replace(/^\/+/, '');

  if (/\/api\/v\d+$/.test(cleanBase) && /^api\/v\d+\//.test(cleanPath)) {
    cleanPath = cleanPath.replace(/^api\/v\d+\//, '');
  }

  return `${cleanBase}/${cleanPath}`;
}

export const API_BASE_URL = getApiBaseUrl();
