import React, { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SectionCard } from './SectionCard'
import { useFilters } from '../context/FiltersContext'
import { marketingApi } from '../services/marketingApi'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type StatusOpt = 'all' | 'active' | 'expired'

function currency(n: number, cur = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n || 0)
}

export const PromotionsPerformance: React.FC = () => {
  const { filters } = useFilters()
  const [status, setStatus] = useState<StatusOpt>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['promotions-performance', filters.fromISO, filters.toISO, status],
    queryFn: () => marketingApi.getPromotionsPerformance({ startDate: filters.fromISO, endDate: filters.toISO, status }),
    enabled: Boolean(filters.fromISO && filters.toISO),
  })

  useEffect(() => {
    const onRefetch = () => refetch()
    window.addEventListener('dashboard:promotions:refetch', onRefetch)
    return () => window.removeEventListener('dashboard:promotions:refetch', onRefetch)
  }, [refetch])

  const rows = useMemo(() => {
    const list = Array.isArray((data as any)?.promotions) ? (data as any).promotions : []
    return list
      .filter((p: any) => !search || String(p.promo_code).toLowerCase().includes(search.toLowerCase()))
      .sort((a: any, b: any) => (b.total_revenue_generated || 0) - (a.total_revenue_generated || 0))
  }, [data, search])

  const chartData = useMemo(() => rows.slice(0, 10).map((r: any) => ({ code: r.promo_code, revenue: r.total_revenue_generated })), [rows])

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!rows.length) return null
    
    return {
      totalRedemptions: rows.reduce((sum: number, r: any) => sum + (r.times_redeemed || 0), 0),
      totalDiscountGiven: rows.reduce((sum: number, r: any) => sum + (r.total_discount_given || 0), 0),
      totalRevenueGenerated: rows.reduce((sum: number, r: any) => sum + (r.total_revenue_generated || 0), 0),
      averageRevenuePerUse: rows.reduce((sum: number, r: any) => sum + (r.avg_revenue_per_use || 0), 0) / rows.length
    }
  }, [rows])

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code)
  }

  const openPromo = (code: string) => {
    // Navigate to promo management page with query param if exists
    try {
      const url = `/admin/promo?code=${encodeURIComponent(code)}`
      window.open(url, '_blank')
    } catch {}
  }

  return (
    <SectionCard
      title="Promotions Performance"
      description="Track promo usage, revenue impact, and acquisition"
      isLoading={isLoading}
      error={error ? String(error) : null}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Status:</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusOpt)} className="border rounded px-2 py-1 text-sm">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Search code:</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. SPRING50" className="border rounded px-2 py-1 text-sm" />
        </div>
        <div className="text-xs text-gray-500">Range: {filters.fromISO} → {filters.toISO}</div>
      </div>

      {/* Summary Statistics */}
      {summaryStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">{summaryStats.totalRedemptions.toLocaleString()}</div>
            <div className="text-sm text-blue-700 font-medium">Total Redemptions</div>
          </div>
          <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-600">{currency(summaryStats.totalDiscountGiven)}</div>
            <div className="text-sm text-red-700 font-medium">Total Discounts</div>
          </div>
          <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{currency(summaryStats.totalRevenueGenerated)}</div>
            <div className="text-sm text-green-700 font-medium">Total Revenue</div>
          </div>
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600">{currency(summaryStats.averageRevenuePerUse)}</div>
            <div className="text-sm text-purple-700 font-medium">Avg Revenue/Use</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 overflow-x-auto border rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Code</th>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-right font-semibold">Times Redeemed</th>
                <th className="px-4 py-3 text-right font-semibold">Discount Given</th>
                <th className="px-4 py-3 text-right font-semibold">Revenue Generated</th>
                <th className="px-4 py-3 text-right font-semibold">Avg Revenue/Use</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                      </div>
                      <div className="text-gray-500 font-medium">No promotions found</div>
                      <div className="text-sm text-gray-400">
                        {search ? `No promotions match "${search}"` : 'No promotion data available for the selected date range'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((r: any) => (
                  <tr key={r.promo_code} className="odd:bg-background even:bg-muted/20 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-sm font-semibold text-indigo-600">{r.promo_code}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{r.promo_name || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{(r.times_redeemed||0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-red-600">{currency(r.total_discount_given||0)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-green-600">{currency(r.total_revenue_generated||0)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{currency(r.avg_revenue_per_use||0)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <button className="text-indigo-600 hover:text-indigo-800 hover:underline text-sm font-medium transition-colors" onClick={() => copyCode(r.promo_code)}>
                          Copy Code
                        </button>
                        <button className="text-slate-600 hover:text-slate-800 hover:underline text-sm font-medium transition-colors" onClick={() => openPromo(r.promo_code)}>
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white border rounded-md p-4">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Revenue Performance</h4>
          {chartData.length > 0 ? (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20, top: 12, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    type="number" 
                    tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="code" 
                    width={100} 
                    tick={{ fontSize: 11, fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                  />
                  <Tooltip 
                    formatter={(v: any) => [currency(Number(v)), 'Revenue']}
                    labelStyle={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 'bold' }}
                    contentStyle={{ 
                      backgroundColor: '#f8fafc', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '13px'
                    }}
                  />
                  <Bar 
                    dataKey="revenue" 
                    fill="#4f46e5" 
                    radius={[0,6,6,0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="text-sm font-medium">No chart data available</div>
              <div className="text-xs text-gray-400 mt-1">Add promotions to see revenue performance</div>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  )
}

export default PromotionsPerformance
