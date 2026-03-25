import React from 'react'
import { useQuery } from '@tanstack/react-query'
// ...existing code...
import { marketingApi } from '../services/marketingApi'
import type { DetailedUserLifetimeValueResponse, AggregateLtvResponse } from '../services/marketingApi'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, XAxis, YAxis } from 'recharts'

export interface UserLtvPanelProps {
  userId?: number | string | null
  userQuery?: string | null
  open?: boolean
  onClose?: () => void
  startDate?: string
  endDate?: string
}

const COLORS = ['#22C55E', '#6366F1'] // coins (green) vs subscriptions (indigo)

function currency(n: number, cur = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n || 0)
}

export const UserLtvPanel: React.FC<UserLtvPanelProps> = ({ userId, userQuery, open = true, startDate, endDate }) => {
  const normalizedUserId = userId === null ? undefined : userId === '' ? undefined : userId
  const normalizedUserQuery = userQuery === null ? undefined : userQuery === '' ? undefined : userQuery
  const isAggregateView = !normalizedUserId && !normalizedUserQuery

  // Use different query functions for aggregate vs user-specific data
  const { data: userData, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ['user-ltv-detail', normalizedUserId ?? normalizedUserQuery, startDate, endDate],
    queryFn: () => marketingApi.getDetailedUserLifetimeValue({ userId: normalizedUserId as any, userQuery: normalizedUserQuery as any, startDate, endDate }),
    enabled: Boolean(open && (normalizedUserId || normalizedUserQuery)),
  })

  const { data: aggregateData, isLoading: aggregateLoading, error: aggregateError } = useQuery({
    queryKey: ['user-ltv-aggregate', startDate, endDate],
    queryFn: () => marketingApi.getAggregateLtv({ startDate, endDate }),
    enabled: Boolean(open && isAggregateView),
  })

  const isLoading = isAggregateView ? aggregateLoading : userLoading
  const error = isAggregateView ? aggregateError : userError
  const isError = Boolean(error)

  // For user-specific data
  const d = userData as DetailedUserLifetimeValueResponse | undefined
  // For aggregate data  
  const agg = aggregateData as AggregateLtvResponse | undefined

  const total = d?.total_revenue || 0
  const pieData = [
    { name: 'Coins', value: d?.coins_purchase_value ?? 0 },
    { name: 'Subscriptions', value: d?.subscription_value ?? total },
  ]

  if (!open) return null

  return (
    <div className="bg-white rounded-lg shadow p-4 md:p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">Per-User LTV {userId ? `— User ${userId}` : ''}</h3>
      </div>
      {isLoading && (
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded w-40" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="h-64 bg-gray-100 rounded" />
            <div className="lg:col-span-2 space-y-3">
              <div className="h-10 bg-gray-100 rounded w-64" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-14 bg-gray-100 rounded" />
                <div className="h-14 bg-gray-100 rounded" />
                <div className="h-14 bg-gray-100 rounded" />
                <div className="h-14 bg-gray-100 rounded" />
              </div>
              <div className="h-24 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      )}

      {isError && (
        <div className="text-red-600">Failed to load lifetime value.</div>
      )}
      
      {/* Render aggregate data when no user ID is provided */}
      {isAggregateView && agg && !isLoading && !error && (
        <div className="space-y-6">
          <div className="text-sm text-gray-600">Aggregate LTV Summary</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border bg-linear-to-br from-indigo-50 to-white shadow-sm">
              <div className="text-xs text-gray-500">Average LTV</div>
              <div className="text-xl font-semibold">{currency(agg.average_ltv)}</div>
            </div>
            <div className="p-4 rounded-lg border bg-linear-to-br from-emerald-50 to-white shadow-sm">
              <div className="text-xs text-gray-500">Total Revenue (all users)</div>
              <div className="text-xl font-semibold">{currency(agg.total_revenue_all_users)}</div>
            </div>
            <div className="p-4 rounded-lg border bg-linear-to-br from-rose-50 to-white shadow-sm">
              <div className="text-xs text-gray-500">Total Users</div>
              <div className="text-xl font-semibold">{agg.total_users.toLocaleString()}</div>
            </div>
          </div>
          <div className="text-sm text-gray-500 mt-4">
            Enter a name or email above to view detailed individual user metrics.
          </div>
        </div>
      )}

      {/* Render user-specific data when user ID is provided */}
      {!isAggregateView && !isLoading && !error && !d && (
        <div className="space-y-4">
          <div className="text-sm text-gray-600">Per-user Lifetime Value</div>
          <div className="p-6 border rounded bg-white text-center">
            <div className="text-lg font-semibold text-gray-800">No LTV data available for this user</div>
            <div className="text-sm text-gray-500 mt-2">This user has no recorded revenue or coin transactions in the selected date range.</div>
            <div className="text-sm text-gray-500 mt-3">Try widening the date range or search another user.</div>
          </div>
        </div>
      )}

      {!isAggregateView && d && !isLoading && !error && (
        <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border rounded p-4">
              <h4 className="text-sm font-medium text-gray-600 mb-2">Revenue Split</h4>
              {total === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-gray-500">No transactions yet for this user</div>
              ) : (
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => currency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="text-center mt-2 text-xs text-gray-500">Coins vs Subscriptions</div>
            </div>

            <div className="lg:col-span-2">
              <div className="mb-3">
                <div className="text-sm text-gray-600">Total Revenue</div>
                <div className="text-3xl font-semibold">{currency(total)}</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Coins Value" value={currency(d?.coins_purchase_value ?? 0)} color="text-emerald-600" />
                <Stat label="Subscription Value" value={currency(d?.subscription_value ?? 0)} color="text-indigo-600" />
                <Stat label="Coins Acquired" value={(d?.total_coins_acquired??0).toLocaleString()} color="text-cyan-600" />
                <Stat label="Coins Spent" value={(d?.total_coins_spent??0).toLocaleString()} color="text-rose-600" />
              </div>
              <div className="mt-4 text-sm text-gray-600">
                Lifetime Duration: <span className="font-medium text-gray-900">{d?.lifetime_duration_months == null ? '—' : `${d?.lifetime_duration_months} months`}</span>
              </div>

              {/* Removed non-functional "Open user timeline" link per UX feedback */}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-90">
            <div className="border rounded p-3 bg-white">
              <div className="text-xs text-gray-500 mb-2">Revenue Breakdown</div>
              {d?.details?.revenue_breakdown ? (
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="text-gray-600">Total orders</td>
                      <td className="text-right font-medium">{d.details.revenue_breakdown.orders_count}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-600">First order</td>
                      <td className="text-right font-medium">{d.details.revenue_breakdown.first_order_at ? new Date(d.details.revenue_breakdown.first_order_at).toLocaleString() : '—'}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-600">Last order</td>
                      <td className="text-right font-medium">{d.details.revenue_breakdown.last_order_at ? new Date(d.details.revenue_breakdown.last_order_at).toLocaleString() : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="text-sm text-gray-500">No revenue breakdown available</div>
              )}
            </div>

            <div className="border rounded p-3 bg-white">
              <div className="text-xs text-gray-500 mb-2">Coins Over Time</div>
              {(!d?.details?.coins_over_time || d.details.coins_over_time.length === 0) ? (
                <div className="h-32 flex items-center justify-center text-sm text-gray-500">No transactions yet for this user</div>
              ) : (
                <div style={{ width: '100%', height: 160 }}>
                  <ResponsiveContainer>
                    <AreaChart data={d.details.coins_over_time.map(r => ({ period: r.period, credits: r.credits, debits: r.debits }))}>
                      <defs>
                        <linearGradient id="credits" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22C55E" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="debits" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="credits" stroke="#22C55E" fillOpacity={1} fill="url(#credits)" />
                      <Area type="monotone" dataKey="debits" stroke="#6366F1" fillOpacity={1} fill="url(#debits)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="border rounded p-3 bg-white">
              <div className="text-xs text-gray-500 mb-2">Activity</div>
              {d?.details?.activity ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Orders</span><span className="font-medium">{d.details.activity.orders_count}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Coin txns</span><span className="font-medium">{d.details.activity.coin_transactions_count}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Last active</span><span className="font-medium">{d.details.activity.last_active_at ? new Date(d.details.activity.last_active_at).toLocaleString() : '—'}</span></div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No activity data</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const Stat: React.FC<{ label: string; value: string | number; color?: string }> = ({ label, value, color }) => {
  // infer a gradient by looking for a color keyword in the provided color class
  const variant = color?.includes('emerald') ? 'emerald' : color?.includes('indigo') ? 'indigo' : color?.includes('cyan') ? 'cyan' : color?.includes('rose') ? 'rose' : 'gray'
  const gradientByVariant: any = {
    indigo: 'from-indigo-50 to-white',
    emerald: 'from-emerald-50 to-white',
    cyan: 'from-cyan-50 to-white',
    rose: 'from-rose-50 to-white',
    gray: 'from-gray-50 to-white',
  }
  const gradient = gradientByVariant[variant] || gradientByVariant.gray
  return (
    <div className={`p-3 rounded-lg border bg-linear-to-br ${gradient} shadow-sm`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-semibold ${color ?? 'text-gray-900'}`}>{value}</div>
    </div>
  )
}

export default UserLtvPanel
