import axios from 'axios'
import { toast } from 'react-hot-toast'

export interface PromotionPerformanceRow {
  promo_code: string
  promo_name?: string | null
  times_redeemed: number
  coin_purchase_count: number
  subscription_count: number
  total_discount_given: number
  total_revenue_generated: number
  avg_revenue_per_use: number
  new_customers_acquired?: number | null
  status?: 'active' | 'expired' | string
}

export interface PromotionsPerformanceResponse {
  start_date?: string
  end_date?: string
  status?: 'active' | 'expired' | 'all'
  promotions: PromotionPerformanceRow[]
}

export interface TopSpenderRow {
  user_id: number | string
  user_email?: string | null
  subscription_plan: string | null
  total_revenue: number
  subscription_fees?: number | null
  coin_purchase_revenue?: number | null
  coins_purchased?: number | null
  coins_spent?: number | null
  avatar_url?: string | null
}

export interface TopSpendersResponse {
  start_date?: string
  end_date?: string
  metric?: 'revenue'
  top_spenders: TopSpenderRow[]
}

// New interface for the specific API response format as per user requirements
export interface SimpleTopSpenderData {
  user_id: string
  user_name?: string | null
  user_email?: string | null
  total_revenue: number
  coins_spent: number
}

export interface SimpleTopSpendersResponse {
  start_date: string
  end_date: string
  limit: number
  top_spenders: SimpleTopSpenderData[]
}

export interface UserLifetimeValueResponse {
  user_id: number
  total_revenue: number
  coins_purchase_value: number
  subscription_value: number
  total_coins_acquired: number
  total_coins_spent: number
  lifetime_duration_months: number | null
}

export interface DetailedUserLifetimeValueResponse {
  user_id?: number
  total_revenue: number
  total_coins_acquired: number
  total_coins_spent: number
  lifetime_duration_months: number | null
  details?: {
    revenue_breakdown?: {
      orders_count: number
      first_order_at?: string
      last_order_at?: string
    }
    coins_over_time?: Array<{
      period: string
      credits: number
      debits: number
    }>
    activity?: {
      orders_count: number
      coin_transactions_count: number
      last_active_at?: string
    }
  }
  // Backward compatibility fields for existing components
  coins_purchase_value?: number
  subscription_value?: number
}

export interface AggregateLtvResponse {
  average_ltv: number
  total_revenue_all_users: number
  total_users: number
}

const client = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_BASE_URL || window.location.origin,
  timeout: 20000,
})

// Normalize URLs to avoid duplicate /api/v1 when the base contains the prefix
import { attachUrlNormalizer } from './axiosHelpers'
attachUrlNormalizer(client)

client.interceptors.request.use((config) => {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('pornily:auth:token') : null
    if (stored) {
      const tokenOnly = stored.replace(/^bearer\s+/i, '').trim()
      const h = (config.headers ?? {}) as any
      h['Authorization'] = `bearer ${tokenOnly}`
      config.headers = h
    }
  } catch { }
  return config
})

// Add response interceptor for error handling
client.interceptors.response.use(
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

export const marketingApi = {
  async getPromotionsPerformance(params: { startDate: string; endDate: string; status?: 'active' | 'expired' | 'all' }): Promise<PromotionsPerformanceResponse> {
    const res = await client.get('/api/v1/admin/dashboard/promotions/performance', {
      params: {
        start_date: params.startDate,
        end_date: params.endDate,
        status: params.status && params.status !== 'all' ? params.status : undefined,
      },
    })
    const data = (res.data || {}) as PromotionsPerformanceResponse
    data.promotions = Array.isArray((data as any).promotions) ? (data as any).promotions.map((p: any) => ({
      promo_code: String(p.promo_code ?? p.code ?? ''),
      promo_name: p.promo_name ?? p.name ?? null,
      times_redeemed: Number(p.times_redeemed ?? p.redemptions ?? 0) || 0,
      coin_purchase_count: Number(p.coin_purchase_count ?? 0) || 0,
      subscription_count: Number(p.subscription_count ?? 0) || 0,
      total_discount_given: Number(p.total_discount_given ?? p.discount_total ?? 0) || 0,
      total_revenue_generated: Number(p.total_revenue_generated ?? p.revenue_generated ?? 0) || 0,
      avg_revenue_per_use: Number(p.avg_revenue_per_use ?? 0) || 0,
      new_customers_acquired: p.new_customers_acquired === undefined ? null : Number(p.new_customers_acquired) || 0,
      status: p.status,
    })) : []
    return data
  },

  async getTopSpenders(params: { startDate: string; endDate: string; limit?: number; metric?: 'revenue'; plan?: string | null }): Promise<TopSpendersResponse> {
    const res = await client.get('/api/v1/admin/dashboard/users/top-spenders', {
      params: {
        start_date: params.startDate,
        end_date: params.endDate,
        limit: params.limit ?? 20,
        metric: params.metric || 'revenue',
        plan: params.plan && params.plan !== 'all' ? params.plan : undefined,
      },
    })
    const data = (res.data || {}) as TopSpendersResponse
    data.top_spenders = Array.isArray((data as any).top_spenders) ? (data as any).top_spenders.map((u: any) => ({
      user_id: u.user_id,
      user_email: u.user_email ?? null,
      subscription_plan: u.subscription_plan ?? null,
      total_revenue: Number(u.total_revenue ?? 0) || 0,
      subscription_fees: u.subscription_fees === undefined ? null : Number(u.subscription_fees) || 0,
      coin_purchase_revenue: u.coin_purchase_revenue === undefined ? null : Number(u.coin_purchase_revenue) || 0,
      coins_purchased: u.coins_purchased === undefined ? null : Number(u.coins_purchased) || 0,
      coins_spent: u.coins_spent === undefined ? null : Number(u.coins_spent) || 0,
      avatar_url: u.avatar_url ?? null,
    })) : []
    return data
  },

  async getUserLifetimeValue(params: { userId?: number | string; userQuery?: string }): Promise<UserLifetimeValueResponse> {
    // Prefer an explicit userQuery if provided (email/name). Otherwise decide whether
    // the provided identifier looks like an internal id (numeric or UUID).
    const queryParams: any = {}
    if (params.userQuery) {
      queryParams.user_query = params.userQuery
    } else {
      const raw = String(params.userId ?? '')
      const looksLikeId = /^\d+$/.test(raw) || /^[0-9a-fA-F\-]{8,36}$/.test(raw)
      if (looksLikeId) queryParams.user_id = params.userId
      else if (params.userId) queryParams.user_query = params.userId
    }
    const res = await client.get('/api/v1/admin/dashboard/users/lifetime-value', { params: queryParams })
    const d = res.data || {}
    return {
      user_id: Number(d.user_id ?? params.userId),
      total_revenue: Number(d.total_revenue ?? 0) || 0,
      coins_purchase_value: Number(d.coins_purchase_value ?? 0) || 0,
      subscription_value: Number(d.subscription_value ?? 0) || 0,
      total_coins_acquired: Number(d.total_coins_acquired ?? 0) || 0,
      total_coins_spent: Number(d.total_coins_spent ?? 0) || 0,
      lifetime_duration_months: d.lifetime_duration_months == null ? null : Number(d.lifetime_duration_months) || 0,
    }
  },

  // New API method for the specific top spenders endpoint
  async getTopSpendersSimple(params: { startDate: string; endDate: string; limit?: number }): Promise<SimpleTopSpendersResponse> {
    try {
      // use full admin API path consistent with other calls
      const res = await client.get('/api/v1/admin/dashboard/users/top-spenders', {
        params: {
          start_date: params.startDate,
          end_date: params.endDate,
          limit: params.limit ?? 20,
        },
      })

      const data = res.data || {}

      // Ensure we have the correct structure
      return {
        start_date: data.start_date || params.startDate,
        end_date: data.end_date || params.endDate,
        limit: data.limit || params.limit || 20,
        top_spenders: Array.isArray(data.top_spenders) ? data.top_spenders.map((item: any) => ({
          user_id: String(item.user_id ?? ''),
          user_name: item.user_name ?? item.user_name ?? null,
          user_email: item.user_email ?? item.email ?? null,
          total_revenue: Number(item.total_revenue || 0),
          coins_spent: Number(item.coins_spent || 0),
        })) : []
      }
    } catch (error) {
      console.error('Error fetching top spenders:', error)
      throw error
    }
  },

  // Detailed user lifetime value with additional breakdown data
  async getDetailedUserLifetimeValue(params: { userId?: number | string; userQuery?: string; startDate?: string; endDate?: string }): Promise<DetailedUserLifetimeValueResponse> {
    try {
      // Build explicit params: prefer userQuery over userId
      const queryParams: any = {
        start_date: params.startDate,
        end_date: params.endDate,
        detailed: true,
      }
      if (params.userQuery) {
        queryParams.user_query = params.userQuery
      } else if (params.userId != null) {
        const raw = String(params.userId ?? '')
        const looksLikeId = /^\d+$/.test(raw) || /^[0-9a-fA-F\-]{8,36}$/.test(raw)
        if (looksLikeId) queryParams.user_id = params.userId
        else queryParams.user_query = params.userId
      }

      const res = await client.get('/api/v1/admin/dashboard/users/lifetime-value', { params: queryParams })

      const data = res.data || {}

      return {
        user_id: Number(data.user_id ?? params.userId),
        total_revenue: Number(data.total_revenue ?? 0) || 0,
        total_coins_acquired: Number(data.total_coins_acquired ?? 0) || 0,
        total_coins_spent: Number(data.total_coins_spent ?? 0) || 0,
        lifetime_duration_months: data.lifetime_duration_months == null ? null : Number(data.lifetime_duration_months) || 0,
        details: data.details ? {
          revenue_breakdown: data.details.revenue_breakdown ? {
            orders_count: Number(data.details.revenue_breakdown.orders_count ?? 0),
            first_order_at: data.details.revenue_breakdown.first_order_at,
            last_order_at: data.details.revenue_breakdown.last_order_at,
          } : undefined,
          coins_over_time: Array.isArray(data.details.coins_over_time) ? data.details.coins_over_time.map((item: any) => ({
            period: String(item.period ?? ''),
            credits: Number(item.credits ?? 0),
            debits: Number(item.debits ?? 0),
          })) : undefined,
          activity: data.details.activity ? {
            orders_count: Number(data.details.activity.orders_count ?? 0),
            coin_transactions_count: Number(data.details.activity.coin_transactions_count ?? 0),
            last_active_at: data.details.activity.last_active_at,
          } : undefined,
        } : undefined,
        // Backward compatibility - preserve existing fields if present. If not present,
        // prefer to surface the raw totals the backend provides.
        coins_purchase_value: data.coins_purchase_value === undefined ? 0 : Number(data.coins_purchase_value || 0),
        subscription_value: data.subscription_value === undefined ? Number(data.total_revenue ?? 0) || 0 : Number(data.subscription_value || 0),
      }
    } catch (error) {
      console.error('Error fetching detailed user lifetime value:', error)
      throw error
    }
  },

  // Get aggregate LTV data for all users
  async getAggregateLtv(params: { startDate?: string; endDate?: string }): Promise<AggregateLtvResponse> {
    try {
      const res = await client.get('/api/v1/admin/dashboard/users/lifetime-value', {
        params: {
          start_date: params.startDate,
          end_date: params.endDate,
          detailed: true,
        },
      })

      const data = res.data || {}

      return {
        average_ltv: Number(data.average_ltv ?? 0),
        total_revenue_all_users: Number(data.total_revenue_all_users ?? 0),
        total_users: Number(data.total_users ?? 0),
      }
    } catch (error) {
      console.error('Error fetching aggregate LTV:', error)
      throw error
    }
  },
}

export default marketingApi
