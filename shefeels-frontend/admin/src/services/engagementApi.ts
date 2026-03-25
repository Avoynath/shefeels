import axios from 'axios'
import { toast } from 'react-hot-toast'

export interface FeatureBreakdownRow { feature: string; total_actions: number; unique_users: number; coins_spent: number }
export interface FeatureBreakdownResponse {
  start_date?: string
  end_date?: string
  feature_breakdown: FeatureBreakdownRow[]
  totals?: { actions: number; users: number; coins: number }
}

export interface TopCharactersRow { character_id: string | number; character_name: string | null; coins_spent: number; interactions: number; unique_users: number }
export interface TopCharactersResponse {
  start_date?: string
  end_date?: string
  metric?: string
  top_characters: TopCharactersRow[]
}

export interface TopCharactersBreakdownResponse {
  metric: string
  source_types: string[]
  results: Array<{
    character_id: number | null
    character_name: string | null
    totals: Record<string, number>
    breakdown: Record<string, Record<string, number>>
  }>
}

export interface CharacterGeoCountryBreakdown {
  country_code: string | null
  coins_spent: number
}

export interface CharacterGeoResult {
  character_id: string | number | null
  character_name: string | null
  total_coins_spent: number
  by_country: CharacterGeoCountryBreakdown[]
}

export interface CharacterGeoMonetizationResponse {
  metric: string
  results: CharacterGeoResult[]
}

export interface TopActiveUserRow {
  user_id: number | string
  total_actions: number
  total_coins_spent: number
  avg_coins_per_action?: number
  most_used_feature?: string | null
  // new: feature where user spent the most coins and the amount spent there
  most_spent_feature?: string | null
  most_spent_feature_coins?: number
  user_email?: string | null
}
export interface TopActiveUsersResponse {
  start_date?: string
  end_date?: string
  metric?: 'coins_spent' | 'actions'
  top_active_users: TopActiveUserRow[]
}

const engagementClient = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_BASE_URL || window.location.origin,
  timeout: 15000,
})
import { attachUrlNormalizer } from './axiosHelpers'
attachUrlNormalizer(engagementClient)

engagementClient.interceptors.request.use((config) => {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('pornily:auth:token') : null
    if (stored) {
      const tokenOnly = stored.replace(/^bearer\s+/i, '').trim()
      // Ensure headers is an object and set Authorization; cast to any to satisfy AxiosHeaders typing quirks
      const h = (config.headers ?? {}) as any
      h['Authorization'] = `bearer ${tokenOnly}`
      config.headers = h
    }
  } catch { }
  return config
})

// Add response interceptor for error handling
engagementClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const data = error.response?.data

    if (status && status >= 400 && status < 500) {
      if (data?.detail) {
        toast.error(data.detail)
      }
    } else if (status && status >= 500) {
      toast.error('Something went wrong. Please try again later.')
    }
    return Promise.reject(error)
  }
)

export const engagementApi = {
  async getFeatureBreakdown(params: { startDate: string; endDate: string; cohort?: string }): Promise<FeatureBreakdownResponse> {
    const res = await engagementClient.get('/admin/dashboard/engagement/feature-breakdown', {
      params: {
        start_date: params.startDate,
        end_date: params.endDate,
        ...(params.cohort && params.cohort !== 'all' ? { cohort: params.cohort } : {}),
      },
    })
    const data = (res.data || {}) as FeatureBreakdownResponse
    const rows = Array.isArray((data as any).feature_breakdown) ? (data as any).feature_breakdown as FeatureBreakdownRow[] : []
    const totals = rows.reduce((acc, r) => ({
      actions: acc.actions + (Number(r.total_actions) || 0),
      users: acc.users + (Number(r.unique_users) || 0),
      coins: acc.coins + (Number(r.coins_spent) || 0),
    }), { actions: 0, users: 0, coins: 0 })
    return { ...data, feature_breakdown: rows, totals }
  },

  async getTopCharacters(params: { startDate: string; endDate: string; metric?: string; limit?: number }): Promise<TopCharactersResponse> {
    const res = await engagementClient.get('/admin/dashboard/engagement/top-characters', {
      params: {
        start_date: params.startDate,
        end_date: params.endDate,
        metric: params.metric || 'coins_spent',
        limit: params.limit ?? 10,
      },
    })
    const data = (res.data || {}) as TopCharactersResponse
    data.top_characters = Array.isArray((data as any).top_characters) ? (data as any).top_characters : []
    return data
  },

  async getTopCharactersBreakdown(params: { startDate: string; endDate: string; metric: string; interval: string; limit?: number }): Promise<TopCharactersBreakdownResponse> {
    const res = await engagementClient.get('/admin/dashboard/engagement/top-characters-breakdown', {
      params: {
        start_date: params.startDate,
        end_date: params.endDate,
        metric: params.metric,
        interval: params.interval,
        limit: params.limit ?? 10,
      },
    })
    const data = (res.data || {}) as TopCharactersBreakdownResponse
    // Ensure proper structure
    data.source_types = Array.isArray(data.source_types) ? data.source_types : []
    data.results = Array.isArray(data.results) ? data.results : []
    return data
  },

  async getCharacterGeoMonetization(params: { startDate: string; endDate: string; metric?: string; limit?: number }): Promise<CharacterGeoMonetizationResponse> {
    const res = await engagementClient.get('/admin/dashboard/engagement/characters-geo', {
      params: {
        start_date: params.startDate,
        end_date: params.endDate,
        metric: params.metric || 'coins_spent',
        limit: params.limit ?? 10,
      },
    })
    const data = (res.data || {}) as CharacterGeoMonetizationResponse
    data.metric = data.metric || params.metric || 'coins_spent'
    data.results = Array.isArray((data as any).results) ? (data as any).results : []
    data.results = data.results.map((row: CharacterGeoResult) => ({
      character_id: row?.character_id ?? '',
      character_name: row?.character_name ?? null,
      total_coins_spent: Number(row?.total_coins_spent || 0),
      by_country: Array.isArray((row as any)?.by_country) ? (row as any).by_country : [],
    }))
    return data
  },

  async getTopActiveUsers(params: { startDate: string; endDate: string; metric: 'coins_spent' | 'actions'; feature?: string; limit?: number }): Promise<TopActiveUsersResponse> {
    const res = await engagementClient.get('/admin/dashboard/users/top-active', {
      params: {
        start_date: params.startDate,
        end_date: params.endDate,
        limit: params.limit ?? 20,
        metric: params.metric,
        ...(params.feature && params.feature !== 'all' ? { feature: params.feature } : {}),
      },
    })
    const data = (res.data || {}) as TopActiveUsersResponse
    data.top_active_users = Array.isArray((data as any).top_active_users) ? (data as any).top_active_users : []
    return data
  },
}

export default engagementApi
