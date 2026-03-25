import type { AxiosInstance } from 'axios'

/**
 * Attach a request interceptor to an axios instance that prevents double-prefixing
 * of the API path when VITE_API_BASE_URL already contains a '/api/v1' segment.
 *
 * Example: if baseURL is 'https://api.pornily.ai/api/v1' and a call is made to
 * '/api/v1/admin/...' this will strip the leading '/api/v1' from the request URL
 * so the final URL becomes 'https://api.pornily.ai/api/v1/admin/...'
 */
export function attachUrlNormalizer(instance: AxiosInstance) {
  instance.interceptors.request.use((config) => {
    try {
      const base = String(config.baseURL || '')
      const url = String(config.url || '')
      if (base.endsWith('/api/v1') && url.startsWith('/api/v1')) {
        // Remove the duplicate prefix from the request URL so axios will
        // concatenate base + url correctly.
        config.url = url.replace(/^\/api\/v1/, '')
      }
    } catch (e) {
      // noop - don't block request on helper failure
    }
    return config
  })
}

export default attachUrlNormalizer
