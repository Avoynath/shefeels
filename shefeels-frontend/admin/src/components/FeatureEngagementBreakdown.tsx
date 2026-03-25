import React, { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { SectionCard } from './SectionCard'
import { useFilters } from '../context/FiltersContext'
import { engagementApi } from '../services/engagementApi.ts'

type Row = { feature: string; total_actions: number; unique_users: number; coins_spent: number }
type SortKey = 'feature' | 'total_actions' | 'unique_users' | 'coins_spent' | 'avg_actions_per_user'
type SortDir = 'asc' | 'desc'

export const FeatureEngagementBreakdown: React.FC = () => {
  const { filters } = useFilters()
  const startDate = filters.fromISO
  const endDate = filters.toISO
  const [cohort, setCohort] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('unique_users')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['engagement-feature-breakdown', startDate, endDate, cohort],
    queryFn: () => engagementApi.getFeatureBreakdown({ startDate, endDate, cohort }),
    enabled: Boolean(startDate && endDate),
  })

  // support sidebar navigation trigger
  useEffect(() => {
    const onRefetch = () => refetch()
    window.addEventListener('dashboard:engagement:refetch', onRefetch)
    return () => window.removeEventListener('dashboard:engagement:refetch', onRefetch)
  }, [refetch])

  const rows = useMemo(() => {
    const base: Row[] = Array.isArray(data?.feature_breakdown) ? data!.feature_breakdown : []
    const withAvg = base.map(r => ({
      ...r,
      avg_actions_per_user: r.unique_users ? r.total_actions / r.unique_users : 0,
    })) as (Row & { avg_actions_per_user: number })[]
    const sorted = [...withAvg].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'feature') return dir * a.feature.localeCompare(b.feature)
      return dir * (((a as any)[sortKey] || 0) - ((b as any)[sortKey] || 0))
    })
    return sorted
  }, [data, sortKey, sortDir])

  const totals = useMemo(() => {
    return rows.reduce((acc, r) => ({
      actions: acc.actions + (r.total_actions || 0),
      users: acc.users + (r.unique_users || 0),
      coins: acc.coins + (r.coins_spent || 0),
    }), { actions: 0, users: 0, coins: 0 })
  }, [rows])

  const chartData = rows.map(r => ({
    feature: r.feature,
    total_actions: r.total_actions,
    unique_users: r.unique_users,
    coins_spent: r.coins_spent,
    avg_actions_per_user: r.unique_users ? r.total_actions / r.unique_users : 0,
  }))

  const toggleSort = (key: SortKey) => {
    setSortKey(prev => (prev === key ? prev : key))
    setSortDir(prev => (sortKey === key ? (prev === 'asc' ? 'desc' : 'asc') : 'desc'))
  }

  return (
    <SectionCard
      title="Feature Engagement Breakdown"
      description="Actions vs unique users by feature; coins spent and averages in tooltip and table"
      isLoading={isLoading}
      error={error ? String(error) : null}
    >
      {/* Small summary */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-md border p-3">
          <div className="text-muted-foreground">Total Actions</div>
          <div className="font-semibold tabular-nums">{totals.actions.toLocaleString()}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-muted-foreground">Unique Users</div>
          <div className="font-semibold tabular-nums">{totals.users.toLocaleString()}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-muted-foreground">Coins Spent</div>
          <div className="font-semibold tabular-nums">{totals.coins.toLocaleString()}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-3">
        <label className="text-sm text-muted-foreground">Cohort:</label>
        <select className="border rounded px-2 py-1 text-sm" value={cohort} onChange={e => setCohort(e.target.value)}>
          <option value="all">All</option>
          <option value="paid">Paid</option>
          <option value="free">Free</option>
        </select>
      </div>

      {/* Grouped Bar Chart */}
      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="feature" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v, n, p) => {
              const r = p?.payload as any
              if (!r) return [v, n]
              const avg = r.unique_users ? (r.total_actions / r.unique_users) : 0
              return [String(v), `${n} (coins: ${r.coins_spent}, avg actions/user: ${avg.toFixed(2)})`]
            }} />
            <Legend />
            <Bar dataKey="total_actions" name="Actions" fill="#6366F1" />
            <Bar dataKey="unique_users" name="Unique Users" fill="#10B981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-md mt-6">
        <table className="min-w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium cursor-pointer" onClick={() => toggleSort('feature')}>Feature</th>
              <th className="px-3 py-2 text-right font-medium cursor-pointer" onClick={() => toggleSort('total_actions')}>Actions</th>
              <th className="px-3 py-2 text-right font-medium cursor-pointer" onClick={() => toggleSort('unique_users')}>Unique Users</th>
        <th className="px-3 py-2 text-right font-medium cursor-pointer" onClick={() => toggleSort('coins_spent')}>Coins Spent</th>
              <th className="px-3 py-2 text-right font-medium cursor-pointer" onClick={() => toggleSort('avg_actions_per_user')}>Avg Actions/User</th>
              <th className="px-3 py-2 text-right font-medium">% of Total Users</th>
              <th className="px-3 py-2 text-right font-medium">% of Total Actions</th>
        <th className="px-3 py-2 text-right font-medium">% of Total Coins</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const avg = r.unique_users ? r.total_actions / r.unique_users : 0
              const pctUsers = totals.users ? (r.unique_users / totals.users) * 100 : 0
              const pctActions = totals.actions ? (r.total_actions / totals.actions) * 100 : 0
        const pctCoins = totals.coins ? (r.coins_spent / totals.coins) * 100 : 0
              return (
                <tr key={r.feature} className="odd:bg-background even:bg-muted/20">
                  <td className="px-3 py-1.5 whitespace-nowrap">{r.feature}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{(r.total_actions||0).toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{(r.unique_users||0).toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{(r.coins_spent||0).toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{avg.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{pctUsers.toFixed(1)}%</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{pctActions.toFixed(1)}%</td>
          <td className="px-3 py-1.5 text-right tabular-nums">{pctCoins.toFixed(1)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

export default FeatureEngagementBreakdown
