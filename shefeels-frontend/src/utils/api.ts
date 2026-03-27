/**
 * API Client for  AI Friend Chatbot
 * 
 * This module provides a comprehensive API service layer that handles:
 * - Authentication with Bearer tokens stored securely in memory
 * - Automatic token refresh fallback (prompts re-login on 401)
 * - Error handling with user-friendly messages
 * - Request/response types based on backend API endpoints
 * - Streaming support for chat responses
 */

// =============================================================================
// Types based on backend API endpoints
// =============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserRead;
}

export interface UserCreate {
  email: string;
  password: string;
  full_name?: string;
}

export interface UserRead {
  id: number;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_email_verified: boolean;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface SetPasswordRequest {
  uid: number;
  token: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordConfirm {
  email: string;
  uid: string;
  token: string;
  new_password: string;
}

export interface CharacterCreate {
  username: string;
  name: string;
  bio?: string;
  gender: string;
  style?: string;
  ethnicity?: string;
  age?: number;
  eye_colour?: string;
  hair_style?: string;
  hair_colour?: string;
  body_type?: string;
  breast_size?: string;
  butt_size?: string;
  dick_size?: string;
  personality?: string;
  voice_type?: string;
  relationship_type?: string;
  clothing?: string;
  special_features?: string;
  hobbies?: string;
  enhanced_prompt?: boolean;
}

export interface CharacterRead {
  id: number;
  user_id: number;
  username: string;
  name: string;
  bio?: string;
  gender: string;
  style?: string;
  ethnicity?: string;
  age?: number;
  eye_colour?: string;
  hair_style?: string;
  hair_colour?: string;
  body_type?: string;
  breast_size?: string;
  butt_size?: string;
  dick_size?: string;
  personality?: string;
  voice_type?: string;
  relationship_type?: string;
  clothing?: string;
  special_features?: string;
  hobbies?: string;
  enhanced_prompt?: boolean;
  image_url_s3?: string; // Will be converted to presigned URL
  gif_url_s3?: string;
  animated_webp_url_s3?: string;
  webp_image_url_s3?: string;
  created_at: string;
  updated_at: string;
}

export interface ImageCreate {
  character_id: number;
  name: string;
  pose: string;
  background: string;
  outfit: string;
  orientation: string;
  positive_prompt?: string;
  negative_prompt?: string;
  num_images: number;
  image_s3_url: string;
}

export interface ChatCreate {
  session_id: string;
  character_id: number;
  user_query: string;
  client_timestamp?: string; // ISO 8601 timestamp from client
}

export interface MessageCreate {
  content: string;
  is_voice?: boolean;
}

export interface MessageRead {
  id: number;
  chat_id: number;
  user_id: number;
  character_id: number;
  content: string;
  sender_type: string;
  created_at: string;
}

export interface PricingPlanRead {
  id: number;
  plan_name: string;
  pricing_id: string;
  currency: string;
  price: number;
  discount: number;
  billing_cycle: string;
  coin_reward: number;
  status: string;
}

export interface PromoVerifyRequest {
  promo_code: string;
  pricing_id: string;
}

export interface CheckoutSessionRequest {
  price_id: string;
  coupon?: string;
  discount_applied?: number;
  subtotal_at_apply?: number;
}

export interface SubscriptionStatusResponse {
  status: boolean;
  subscription?: any;
  coins?: number;
}

export interface ProfileRead {
  email: string;
  full_name: string;
  username?: string;
  gender?: string;
  birth_date?: string;
  profile_image_url?: string;
  created_at?: string;
  updated_at?: string;
  profile_id?: number;
}

// =============================================================================
// API Configuration
// =============================================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Resolve the current window origin when running in the browser.
 * Falls back to localhost when executed in non-DOM environments (tests/SSR).
 */
function getRuntimeOrigin(): string {
  try {
    if (typeof window !== 'undefined' && window.location) {
      return `${window.location.protocol}//${window.location.host}`;
    }
  } catch {
    // ignore and fall through to fallback
  }

  try {
    const globalLocation = (globalThis as any)?.location;
    if (globalLocation?.origin) {
      return globalLocation.origin as string;
    }
    if (globalLocation?.protocol && globalLocation?.host) {
      return `${globalLocation.protocol}//${globalLocation.host}`;
    }
  } catch {
    // ignore and fallback
  }

  return 'http://localhost:8000';
}

/**
 * Normalize the configured base URL so we always end up with an absolute URL.
 * This ensures values like `/api/v1` work the same as `https://api.example.com/api/v1`.
 */
function resolveBaseURL(base?: string): string {
  const trimmed = (base || '').trim();
  if (!trimmed) {
    return getRuntimeOrigin();
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    const origin = getRuntimeOrigin();
    const protocol = origin.startsWith('https') ? 'https:' : 'http:';
    return `${protocol}${trimmed}`;
  }

  const origin = getRuntimeOrigin();
  if (trimmed.startsWith('/')) {
    return `${origin}${trimmed}`;
  }

  return `${origin}/${trimmed}`;
}

// =============================================================================
// Error Classes
// =============================================================================

export class APIError extends Error {
  public status: number;
  public code?: string;

  constructor(
    message: string,
    status: number,
    code?: string
  ) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
  }
}

export class AuthenticationError extends APIError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTH_ERROR');
  }
}

export class ValidationError extends APIError {
  constructor(message = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NetworkError extends APIError {
  constructor(message = 'Network error occurred') {
    super(message, 0, 'NETWORK_ERROR');
  }
}

// =============================================================================
// API Client Class
// =============================================================================

class ApiClient {
  private accessToken: string | null = null;
  private baseURL: string;
  // Simple in-memory presigned URL cache: key -> { url, expiresAt }
  private presignedCache: Map<string, { url: string; expiresAt: number }> = new Map();

  private hydrateAccessTokenFromStorage(): string | null {
    try {
      if (this.accessToken) return this.accessToken;
      if (typeof window === 'undefined' || !window.localStorage) return null;

      const keys = [
        'hl_token',
        'access_token',
        'token',
        'auth_token',
        'pornily:auth:token',
        'pornily:auth:access_token',
      ];

      for (const key of keys) {
        const value = window.localStorage.getItem(key);
        if (value && typeof value === 'string' && value.trim().length > 0) {
          this.accessToken = value.trim();
          return this.accessToken;
        }
      }
    } catch {
      // ignore storage failures
    }
    return null;
  }

  private isExpiredPresignedUrl(url: string | null | undefined): boolean {
    try {
      if (!url || typeof url !== 'string') return false;
      if (!url.includes('X-Amz-') && !url.includes('Expires=')) return false;

      const parsed = new URL(url);
      const params = parsed.searchParams;

      const amzDate = params.get('X-Amz-Date');
      const amzExpires = params.get('X-Amz-Expires');
      if (amzDate && amzExpires) {
        const match = amzDate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
        const ttlSeconds = Number(amzExpires);
        if (match && Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
          const signedAt = Date.UTC(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3]),
            Number(match[4]),
            Number(match[5]),
            Number(match[6])
          );
          if (Number.isFinite(signedAt)) {
            const expiresAt = signedAt + ttlSeconds * 1000;
            return Date.now() >= expiresAt;
          }
        }
      }

      // Some signed URLs expose unix epoch in `Expires`.
      const exp = params.get('Expires');
      if (exp && /^\d+$/.test(exp)) {
        return Date.now() >= Number(exp) * 1000;
      }
    } catch {
      // If URL parsing fails, treat as non-expired and let normal image loading handle it.
    }
    return false;
  }

  private hasExpiredCharacterMedia(list: CharacterRead[]): boolean {
    try {
      if (!Array.isArray(list) || list.length === 0) return false;
      const isAbsoluteMediaUrl = (value?: string | null): boolean => {
        if (!value) return true;
        return /^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:');
      };

      return list.some((item) => {
        const urls = [
          item?.image_url_s3,
          item?.gif_url_s3,
          item?.animated_webp_url_s3,
          item?.webp_image_url_s3,
        ];
        return urls.some((u) => {
          if (u && !isAbsoluteMediaUrl(u)) return true;
          return this.isExpiredPresignedUrl(u || undefined);
        });
      });
    } catch {
      return false;
    }
  }

  private async refreshExpiredCharacterMedia(list: CharacterRead[]): Promise<CharacterRead[]> {
    try {
      if (!Array.isArray(list) || list.length === 0) return list;

      const expiredItems = list
        .filter((item) => this.hasExpiredCharacterMedia([item]))
        .filter((item) => item && item.id !== undefined && item.id !== null)
        .slice(0, 24); // Safety cap to avoid excessive per-item requests.

      if (expiredItems.length === 0) return list;

      const refreshedPairs = await Promise.all(
        expiredItems.map(async (item) => {
          try {
            const id = item.id as string | number;
            const response = await this.getCharacterById(id);
            const fresh = response?.character;
            if (fresh && !this.hasExpiredCharacterMedia([fresh])) {
              return [String(id), fresh] as const;
            }
          } catch {
            // keep original item on any refresh failure
          }
          return null;
        })
      );

      const replacementMap = new Map<string, CharacterRead>();
      for (const pair of refreshedPairs) {
        if (!pair) continue;
        replacementMap.set(pair[0], pair[1]);
      }

      if (replacementMap.size === 0) return list;

      return list.map((item) => {
        const key = String(item?.id ?? '');
        return replacementMap.get(key) || item;
      });
    } catch {
      return list;
    }
  }

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = resolveBaseURL(baseURL);
    this.hydrateAccessTokenFromStorage();
  }

  /**
   * Frontend in-memory presigned cache helpers
   */
  getCachedPresigned(key: string): string | null {
    try {
      if (!key) return null;
      const entry = this.presignedCache.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        this.presignedCache.delete(key);
        return null;
      }
      return entry.url;
    } catch {
      return null;
    }
  }

  setCachedPresigned(key: string, url: string, ttlSeconds: number = 300) {
    try {
      if (!key || !url) return;
      const expiresAt = Date.now() + Math.max(1000, ttlSeconds * 1000);
      this.presignedCache.set(key, { url, expiresAt });
    } catch {
      // ignore cache failures
    }
  }

  /**
   * Set the access token for authenticated requests
   */
  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Build request headers with authentication if available
   */
  private getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    if (!this.accessToken) {
      this.hydrateAccessTokenFromStorage();
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  /**
   * Handle API response and parse errors
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      let errorBody: any = null;

      try {
        errorBody = await response.json();
        errorMessage = errorBody.message || errorBody.detail || errorMessage;
      } catch {
        // If response body is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }

      if (response.status === 401) {
        try {
          // Only dispatch a global auth-required event when we believe the
          // client was authenticated (access token present). This prevents
          // background 401s from public pages (anonymous visitors) from
          // forcing a login modal.
          if (this.accessToken && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('hl_auth_required', { detail: { message: errorMessage } }));
          }
        } catch { }

        // If the current token is invalid/expired, clear it so we don't keep
        // sending unauthorized requests in a loop.
        try {
          if (this.accessToken && typeof window !== 'undefined' && window.localStorage) {
            const keys = [
              'hl_token',
              'access_token',
              'token',
              'auth_token',
              'pornily:auth:token',
              'pornily:auth:access_token',
            ];
            for (const key of keys) {
              try { window.localStorage.removeItem(key); } catch { }
            }
            this.accessToken = null;
          }
        } catch { }

        const authErr = new AuthenticationError(errorMessage);
        try { (authErr as any).body = errorBody; } catch { }
        throw authErr;
      } else if (response.status === 400) {
        const valErr = new ValidationError(errorMessage);
        try {
          (valErr as any).body = errorBody;
          if (errorBody && errorBody.errors) (valErr as any).errors = errorBody.errors;
        } catch { }
        throw valErr;
      } else {
        const apiErr = new APIError(errorMessage, response.status);
        try { (apiErr as any).body = errorBody; } catch { }
        throw apiErr;
      }
    }

    try {
      return await response.json();
    } catch {
      return {} as T;
    }
  }

  /**
   * Make a generic API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Build absolute URL safely to avoid duplicating path segments (e.g. when
    // VITE_API_BASE_URL already contains '/api/v1' and endpoint also starts
    // with '/api/v1'). Allow passing an absolute URL directly as well.
    let url = '';
    if (/^https?:\/\//i.test(endpoint)) {
      url = endpoint;
    } else {
      // remove trailing slashes from base and leading slashes from endpoint
      const cleanBase = this.baseURL.replace(/\/+$/g, '');
      let ep = endpoint.replace(/^\/+/, '');

      // If base ends with an api version (e.g. /api/v1) and endpoint starts
      // with the same prefix (api/v1/...), strip it from the endpoint to
      // prevent duplication.
      try {
        if (/\/api\/v\d+$/.test(cleanBase) && /^api\/v\d+\//.test(ep)) {
          ep = ep.replace(/^api\/v\d+\//, '');
        }
      } catch { }

      url = `${cleanBase}/${ep}`;
    }

    try {
      const response = await fetch(url, {
        credentials: 'include', // Important for refresh token cookies
        headers: this.getHeaders(options.headers as Record<string, string>),
        ...options,
      });

      return await this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new NetworkError(`Failed to connect to ${url}`);
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: Record<string, string>, init?: RequestInit): Promise<T> {
    // Construct absolute URL using the same normalization logic as request()
    const cleanBase = this.baseURL.replace(/\/+$/g, '');
    let ep = endpoint.replace(/^\/+/, '');

    // If endpoint is already absolute, use it directly
    if (/^https?:\/\//i.test(endpoint)) {
      const url = new URL(endpoint);
      if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
      return this.request<T>(url.toString(), init);
    }

    // strip duplicate api/v* prefix when base already contains it
    if (/\/api\/v\d+$/.test(cleanBase) && /^api\/v\d+\//.test(ep)) {
      ep = ep.replace(/^api\/v\d+\//, '');
    }

    const url = new URL(`${cleanBase}/${ep}`);
    if (params) Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

    return this.request<T>(url.toString(), init);
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  /**
   * Upload files with multipart/form-data
   */
  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          // Don't set Content-Type for FormData - browser will set it with boundary
          ...(this.accessToken && { 'Authorization': `Bearer ${this.accessToken}` }),
        },
        body: formData,
      });

      return await this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new NetworkError(`Failed to upload to ${url}`);
    }
  }

  // ==========================================================================
  // Authentication Endpoints
  // ==========================================================================

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.post<LoginResponse>('/api/v1/auth/login', credentials);

    // Store the access token
    this.setAccessToken(response.access_token);

    return response;
  }

  async signup(userData: UserCreate): Promise<{ message: string; emailcontent?: string }> {
    return this.post('/api/v1/auth/signup', userData);
  }

  async verifyEmail(token: string, uid: string): Promise<{ message: string }> {
    return this.get('/api/v1/auth/verify-email', { token, uid });
  }

  async setPassword(data: SetPasswordRequest): Promise<{ message: string }> {
    return this.post('/api/v1/auth/set-password', data);
  }

  async requestPasswordReset(data: ForgotPasswordRequest): Promise<{ message: string; emailcontent?: string }> {
    return this.post('/api/v1/auth/password-reset/request', data);
  }

  async confirmPasswordReset(data: ResetPasswordConfirm): Promise<{ message: string }> {
    return this.post('/api/v1/auth/password-reset/confirm', data);
  }

  logout() {
    this.setAccessToken(null);
  }

  // ==========================================================================
  // Character Management Endpoints
  // ==========================================================================

  async createCharacter(data: CharacterCreate): Promise<{ message: string; image_path: string }> {
    return this.post('/api/v1/characters/create', data);
  }

  async editCharacter(characterId: number, data: CharacterCreate): Promise<{ message: string; image_path: string }> {
    return this.post(`/api/v1/characters/edit-by-id/${characterId}`, data);
  }

  async getUserCharacters(): Promise<CharacterRead[]> {
    // Use POST to avoid backend GET caching; backend expects a POST without payload
    try {
      if (!this.accessToken) return [];
      const res: any = await this.post('/api/v1/characters/fetch-loggedin-user');
      // Backend may return the array directly or wrap it in { characters: [...] } or { data: [...] }
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.characters)) return res.characters;
      if (res && Array.isArray(res.data)) return res.data;
      // fallback: sometimes backend nests under result or results
      if (res && Array.isArray(res.result)) return res.result;
      if (res && Array.isArray(res.results)) return res.results;
      return [] as CharacterRead[];
    } catch (err) {
      // If call fails, surface the error to caller
      throw err;
    }
  }

  /**
   * OPTIMIZATION: Session-cached default characters with stale-while-revalidate pattern.
   * Returns cached data instantly (if available) to improve perceived performance,
   * while fetching fresh data in background for subsequent requests.
   */
  async getDefaultCharacters(): Promise<CharacterRead[]> {
    const CACHE_KEY = 'hl_characters_cache';
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    // Helper to parse API response
    const parseResponse = (res: any): CharacterRead[] => {
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.items)) return res.items;
      if (res && Array.isArray(res.characters)) return res.characters;
      if (res && Array.isArray(res.data)) return res.data;
      if (res && Array.isArray(res.result)) return res.result;
      if (res && Array.isArray(res.results)) return res.results;
      return [] as CharacterRead[];
    };

    // Try to get cached data
    let cachedData: CharacterRead[] | null = null;
    let cacheValid = false;
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL && Array.isArray(data)) {
          const normalized = data as CharacterRead[];
          // Do not serve stale presigned URLs from cache.
          if (!this.hasExpiredCharacterMedia(normalized)) {
            cachedData = normalized;
            cacheValid = true;
          } else {
            try { sessionStorage.removeItem(CACHE_KEY); } catch { }
          }
        }
      }
    } catch { /* ignore cache errors */ }

    // If cache is valid, return immediately and refresh in background
    if (cacheValid && cachedData) {
      // Background refresh (fire-and-forget)
      this.get('/api/v1/characters/fetch-default?per_page=100')
        .then(async (res) => {
          const fresh = parseResponse(res);
          const normalizedFresh = await this.refreshExpiredCharacterMedia(fresh);
          if (normalizedFresh.length > 0) {
            try {
              sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: normalizedFresh, timestamp: Date.now() }));
            } catch { /* ignore storage errors */ }
          }
        })
        .catch(() => { /* silent background refresh */ });

      return cachedData;
    }

    // No valid cache - fetch fresh data
    const res: any = await this.get('/api/v1/characters/fetch-default?per_page=100');
    const parsedData = parseResponse(res);
    const data = await this.refreshExpiredCharacterMedia(parsedData);

    // Cache the result
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch { /* ignore storage errors (e.g., private mode quota) */ }

    return data;
  }

  /**
   * Get likes and message counts for an array of character IDs.
   * Backend expects a JSON array of string IDs.
   */
  async getLikesMessageCount(characterIds: Array<string | number>): Promise<any[]> {
    // Backend requires a JSON array of string IDs. Deduplicate and drop empties to keep payload small.
    const payload = Array.from(
      new Set(
        (characterIds || [])
          .map((id) => String(id ?? '').trim())
          .filter((id) => id && id !== 'undefined')
      )
    );

    if (payload.length === 0) return [] as any[];

    // Use explicit API version path to avoid ambiguity with base URL normalization.
    try {
      return await this.post('/api/v1/characters/likes-message-count', payload);
    } catch (err) {
      // On server errors, return empty array to avoid noisy console errors in the UI.
      // The UI will handle missing data gracefully.
      return [] as any[];
    }
  }

  /**
   * Check whether the current user has liked a character.
   */
  async getCharacterLikeStatus(characterIds: Array<string | number>): Promise<Array<{ character_id: number | string; is_liked: boolean }>> {
    // Use explicit API version path to avoid baseURL normalization mismatches
    const ids = Array.from(new Set(
      (characterIds || []).map((id) => String(id ?? '').trim()).filter((id) => id)
    ));
    if (ids.length === 0) return [];
    return this.post('/api/v1/characters/like-status-by-user', { character_ids: ids });
  }

  /**
   * Like a character on behalf of the current user.
   */
  async likeCharacter(characterId: string | number): Promise<any> {
    // Use explicit API version path to avoid baseURL normalization mismatches
    return this.post('/api/v1/characters/like', { character_id: String(characterId) });
  }

  async getCharacterById(characterId: string | number): Promise<{ character: CharacterRead }> {
    return this.get(`/api/v1/characters/fetch-by-id/${characterId}`);
  }

  async getCharacterBySlug(slug: string): Promise<{ character: CharacterRead }> {
    // Slugs already contain url-safe chars, but encode to be safe
    return this.get(`/api/v1/characters/by-slug/${encodeURIComponent(slug)}`);
  }

  async getCharactersByUserId(userId: number): Promise<{ characters: { character: CharacterRead }[] }> {
    return this.get(`/api/v1/characters/fetch-by-user-id/${userId}`);
  }

  // ==========================================================================
  // Character Media Endpoints
  // ==========================================================================

  async createCharacterImage(data: ImageCreate): Promise<{ message: string; image_paths: string[] }> {
    return this.post('/api/v1/characters/media/create-image', data);
  }

  async createVideo(data: {
    character_id: string;
    name: string;
    prompt?: string;
    duration: number;
    image_url?: string;
    pose_name?: string;
    character_name?: string;
    character_gender?: string;
    character_style?: string;
  }): Promise<{ message: string; job_id: string; status: string; info: string }> {
    return this.post('/api/v1/characters/media/create-video', data);
  }

  async getUserCharacterMedia(): Promise<{ images: any[] }> {
    return this.get('/api/v1/characters/media/get-users-character-media');
  }

  /**
   * Fetch chat-related media for a specific character.
   * Backend expects a GET request with query param `character_id` and
   * returns `{ media: [...] }`.
   */
  async getUserCharacterChatMedia(characterId: string | number): Promise<{ media: any[] }> {
    // Ensure character_id is always sent as a string to match backend expectations
    const payload = { character_id: String(characterId) };
    try {
      return await this.post('/api/v1/characters/media/get-users-character-chat-media', payload);
    } catch (err: any) {
      // If backend responds with 404 (no media), return empty media array instead of throwing.
      if (err && err.status === 404) return { media: [] } as { media: any[] };
      throw err;
    }
  }

  async getDefaultCharacterImages(): Promise<{ images: any[] }> {
    return this.get('/api/v1/characters/media/get-default-character-images');
  }

  // ==========================================================================
  // Chat Endpoints
  // ==========================================================================

  async getAllChats(userId?: number): Promise<MessageRead[]> {
    const params = userId ? { user_id: userId.toString() } : undefined;
    return this.get('/api/v1/chats/all', params);
  }

  async getChatsSummary(limit?: number): Promise<any[]> {
    const params = limit ? { limit: String(limit) } : undefined;
    return this.get('/api/v1/chats/summary', params);
  }

  /**
   * Fetch paginated messages for a single chat (characterId).
   * Returns { messages: [...], next_cursor: string | null }
   */
  async getChatMessages(characterId: string | number, limit: number = 200, cursor?: string | null, signal?: AbortSignal): Promise<{ messages: any[]; next_cursor: string | null }> {
    const params: Record<string, string> = { limit: String(limit) };
    if (cursor) params.cursor = cursor;
    const endpoint = `/api/v1/chats/${encodeURIComponent(String(characterId))}/messages`;
    return this.get(endpoint, params, { signal }) as Promise<{ messages: any[]; next_cursor: string | null }>;
  }

  async sendChatMessage(data: ChatCreate): Promise<{
    message_id: string;
    chat_response: string;
    is_media_available: boolean;
    media_type: string | null;
    s3_url_media: string | null;
    is_image_request: boolean;
    image_job_id: string | null;
    character: {
      id: string | null;
      username: string | null;
    };
  }> {
    return this.post('/api/v1/chats/', data);
  }

  /**
   * Image job status response from the backend
   */
  async getImageJobStatus(jobId: string): Promise<{
    job_id: string;
    status: 'queued' | 'generating' | 'completed' | 'failed';
    image_url: string | null;
    error: string | null;
  }> {
    return this.get(`/api/v1/chats/image-status/${encodeURIComponent(jobId)}`);
  }

  /**
   * Stream chat messages using fetch with ReadableStream
   * Since EventSource can't set Authorization headers, we use fetch
   */
  async streamChatMessage(chatId: number, content: string, clientTimestamp?: string): Promise<ReadableStream<Uint8Array>> {
    let url = `${this.baseURL}/api/v1/chats/${chatId}/messages/stream?content=${encodeURIComponent(content)}`;
    if (clientTimestamp) {
      url += `&client_timestamp=${encodeURIComponent(clientTimestamp)}`;
    }

    const response = await fetch(url, {
      credentials: 'include',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new APIError(`Failed to start stream: ${response.statusText}`, response.status);
    }

    if (!response.body) {
      throw new NetworkError('Response body is null');
    }

    return response.body;
  }

  /**
   * Helper to read streaming chat response as text chunks
   */
  async *readStreamingResponse(stream: ReadableStream<Uint8Array>): AsyncGenerator<string, void, unknown> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        yield chunk;
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ==========================================================================
  // Subscription & Payment Endpoints
  // ==========================================================================

  async getPricingPlans(): Promise<PricingPlanRead[]> {
    return this.get('/api/v1/subscription/get-pricing');
  }

  async getCoinPricing(): Promise<PricingPlanRead[]> {
    return this.get('/api/v1/subscription/get-coin-pricing');
  }

  /**
   * Fetch coin cost for features (chat, character, image, voice, video)
   * Backend returns JSON like:
   * {
   *   chat_cost: number,
   *   character_cost: number,
   *   image_cost: number,
   *   video_cost_5_sec: number,
   *   video_cost_10_sec: number,
   *   voice_cost: number
   * }
   */
  async getCoinCost(): Promise<any> {
    return this.get('/api/v1/subscription/coin-cost');
  }

  async getPromoData(): Promise<any[]> {
    return this.get('/api/v1/subscription/get-promo');
  }

  async verifyPromo(data: PromoVerifyRequest): Promise<{ valid: boolean; reason_or_promo: string | any }> {
    return this.post('/api/v1/subscription/verify-promo', data);
  }

  async getUserCoin(): Promise<any> {
    return this.get('/api/v1/subscription/get-user-coin');
  }

  async createCheckoutSession(data: CheckoutSessionRequest): Promise<{ session_id: string }> {
    return this.post('/api/v1/subscription/create-checkout-session', data);
  }

  async getSubscriptionStatus(): Promise<SubscriptionStatusResponse> {
    return this.get('/api/v1/subscription/status');
  }

  async topUpTokens(data: any): Promise<any> {
    return this.post('/api/v1/tokens/topup', data);
  }

  // ==========================================================================
  // TagadaPay Subscription & Token Purchase
  // ==========================================================================

  /**
   * Create a TagadaPay recurring subscription
   */
  async createTagadaSubscription(data: {
    price_id: string;
    payment_instrument_id?: string;
    currency?: string;
  }): Promise<{
    subscription_id: string;
    status: string;
    plan_name?: string;
    current_period_end?: string;
    cancel_at_period_end: boolean;
    total_coins_rewarded: number;
    created_at: string;
  }> {
    return this.post('/api/v1/tagada/subscription/create', data);
  }

  /**
   * Cancel active TagadaPay subscription
   */
  async cancelTagadaSubscription(data: {
    cancel_at_period_end?: boolean;
  }): Promise<{
    success: boolean;
    status: string;
    message: string;
  }> {
    return this.post('/api/v1/tagada/subscription/cancel', data);
  }

  /**
   * Get current user's TagadaPay subscription details
   */
  async getTagadaSubscription(): Promise<{
    subscription_id: string;
    status: string;
    plan_name?: string;
    current_period_end?: string;
    cancel_at_period_end: boolean;
    total_coins_rewarded: number;
    created_at: string;
  } | null> {
    return this.get('/api/v1/tagada/subscription/me');
  }

  /**
   * Purchase token pack via TagadaPay (requires active subscription)
   */
  async purchaseTagadaTokens(data: {
    token_package_id: string;
    payment_instrument_id?: string;
  }): Promise<{
    success: boolean;
    tokens_credited: number;
    new_balance: number;
    order_id?: string;
    message: string;
  }> {
    return this.post('/api/v1/tagada/tokens/purchase', data);
  }

  // ==========================================================================
  // Analytics (Admin)
  // ==========================================================================

  async getAnalyticsOverview(): Promise<any> {
    return this.get('/api/v1/analytics/overview');
  }

  // ==========================================================================
  // User / Profile
  // ==========================================================================

  /**
   * Fetch the logged-in user's profile. Backend returns fields like `full_name` and `profile_image_url`.
   */
  async getProfile(): Promise<ProfileRead> {
    // Avoid hitting protected endpoints when no bearer token is available.
    if (!this.accessToken) {
      this.hydrateAccessTokenFromStorage();
    }
    if (!this.accessToken) {
      return {} as ProfileRead;
    }

    // Merge legacy profile endpoint with billing summary (/api/v1/me) when available.
    // This keeps backward compatibility while providing token balance and subscription status.
    // call the full backend path for the user profile endpoint
    const profilePromise = this.get('/api/v1/user/get-profile').catch(() => null);
    const billingPromise = this.get('/api/v1/me').catch(() => null);
    const [profileRes, billingRes] = await Promise.all([profilePromise, billingPromise]);

    const profile = profileRes || {};
    // Attach billing info if available
    if (billingRes && typeof billingRes === 'object') {
      try {
        const b = billingRes as any;
        (profile as any).hasActiveSubscription = !!b.hasActiveSubscription;
        (profile as any).tokenBalance = Number(b.tokenBalance || 0);
        (profile as any).subscription_coin_reward = Number(b.subscription_coin_reward || 0);
        (profile as any).subscription_plan_name = b.subscription_plan_name || null;
      } catch { }
    }

    return profile as ProfileRead;
  }



  /**
   * OPTIMIZATION: Fetch active hero banner by category with session caching.
   * Returns banner data including image_url (S3), heading, subheading, cta_text, cta_link.
   * Caches results for 2 minutes to reduce network requests during navigation.
   */


  // ==========================================================================
  // Private Content / Media Packs
  // ==========================================================================

  /**
   * Get list of character IDs that have media packs.
   * Returns { character_ids: string[] }
   */
  async getCharactersWithPacks(): Promise<{ character_ids: string[] }> {
    try {
      return await this.get('/api/v1/private-content/get-characters-with-packs');
    } catch (err) {
      console.error('Failed to fetch characters with packs:', err);
      return { character_ids: [] };
    }
  }

  /**
   * Get packs for multiple characters in a single batch request.
   * Returns a list of mappings: [{ character_id: [pack, ...] }, ...]
   */
  async getPacksForCharacters(characterIds: string[]): Promise<Array<Record<string, any[]>>> {
    if (!characterIds || characterIds.length === 0) return [];
    try {
      return await this.post('/api/v1/private-content/get-pack', { character_ids: characterIds });
    } catch (err) {
      console.error('Failed to fetch packs for characters:', err);
      return [];
    }
  }
}

// =============================================================================
// Default API Client Instance
// =============================================================================

export const apiClient = new ApiClient();

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if error is an authentication error that requires re-login
 */
export function isAuthError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Get user-friendly error message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof APIError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

/**
 * Extract the base URL for the frontend (used in Stripe redirects)
 */
export function getFrontendBaseURL(): string {
  return `${window.location.protocol}//${window.location.host}`;
}

// =============================================================================
// Exports
// =============================================================================

export default apiClient;
