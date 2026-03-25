import axios from 'axios'
import { toast } from 'react-hot-toast'
import { attachUrlNormalizer } from './axiosHelpers'

export interface PurchasesBreakdownRow { date: string; coins_purchased: number }
export interface PurchasesSummaryResponse {
  start_date: string
  end_date: string
  total_purchase_transactions: number
  total_coins_purchased: number
  breakdown?: PurchasesBreakdownRow[]
}

export interface UsageByFeatureRow {
  feature: string
  // may contain spent and/or credited depending on flow
  coins_spent?: number
  coins_credited?: number
  // generic percentage (single-mode) if provided
  percentage?: number
}
export interface UsageByFeatureResponse {
  start_date: string
  end_date: string
  total_coins_spent?: number
  total_coins_credited?: number
  by_feature: UsageByFeatureRow[]
}

export interface CoinTrendsRow { period: string; coins_purchased: number; coins_spent: number }
export interface CoinTrendsResponse {
  interval: string
  coin_trends: CoinTrendsRow[]
  net_coins_change: number
  purchase_to_spend_ratio: number
}

export type CoinsFeatureKey = 'chat' | 'image' | 'video' | 'private_content' | 'all' | string

export interface CoinsGeoTimeseriesPoint {
  period: string
  coins_purchased: number
  coins_spent: number
}

export interface CoinsGeoTotals {
  coins_purchased: number
  coins_spent: number
  net: number
  purchase_spend_ratio: number
}

export interface CoinsGeoFeatureResponse {
  interval?: string
  feature?: string
  countries: string[]
  features: string[]
  matrix: number[][]
  totals?: Record<string, CoinsGeoTotals>
  timeseries?: CoinsGeoTimeseriesPoint[]
  timeseries_by_country?: Record<string, CoinsGeoTimeseriesPoint[]>
}

const coinsClient = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_BASE_URL || window.location.origin,
  timeout: 15000,
})

// Normalize URL to avoid double '/api/v1' when the configured base already contains it
attachUrlNormalizer(coinsClient)

coinsClient.interceptors.request.use((config) => {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('pornily:auth:token') : null
    if (stored) {
      const tokenOnly = stored.replace(/^bearer\s+/i, '').trim()
        ; (config.headers as any) = (config.headers as any) || {}
        ; (config.headers as any)['Authorization'] = `bearer ${tokenOnly}`
    }
  } catch { }
  return config
})

// Add response interceptor for error handling
coinsClient.interceptors.response.use(
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

export const coinsApi = {
  async getPurchasesSummary(params: { startDate: string; endDate: string; interval?: string }): Promise<PurchasesSummaryResponse> {
    const res = await coinsClient.get('/admin/dashboard/coins/purchases-summary', {
      params: {
        start_date: params.startDate,
        end_date: params.endDate,
        ...(params.interval ? { interval: params.interval } : {}),
      },
    })
    return res.data
  },

  async getUsageByFeature(params: { startDate: string; endDate: string; feature?: string; flow?: 'spent' | 'credited' | 'both' }): Promise<UsageByFeatureResponse> {
    const res = await coinsClient.get('/admin/dashboard/coins/usage-by-feature', {
      params: {
        start_date: params.startDate,
        end_date: params.endDate,
        ...(params.feature && params.feature !== 'all' ? { feature: params.feature } : {}),
        ...(params.flow ? { flow: params.flow } : {}),
      },
    })
    return res.data
  },

  async getTrends(params: { startDate: string; endDate: string; interval?: string }): Promise<CoinTrendsResponse> {
    const res = await coinsClient.get('/admin/dashboard/coins/trends', {
      params: {
        start_date: params.startDate,
        end_date: params.endDate,
        ...(params.interval ? { interval: params.interval } : {}),
      },
    })
    return res.data
  },

  async getGeoFeature(
    params: { startDate?: string; endDate?: string; interval?: string; feature?: CoinsFeatureKey } = {}
  ): Promise<CoinsGeoFeatureResponse> {
    const res = await coinsClient.get('/admin/dashboard/coins/geo-feature', {
      params: {
        interval: params.interval || 'monthly',
        feature: params.feature || 'all',
        ...(params.startDate ? { start_date: params.startDate } : {}),
        ...(params.endDate ? { end_date: params.endDate } : {}),
      },
    })
    return res.data
  },
}

export default coinsApi
