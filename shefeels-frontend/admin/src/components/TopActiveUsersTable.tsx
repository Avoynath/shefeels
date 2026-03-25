import React, { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SectionCard } from './SectionCard'
import { useFilters } from '../context/FiltersContext'
import { engagementApi } from '../services/engagementApi.ts'

function toCSV(rows: any[]) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: any) => {
    const s = String(v ?? '')
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n')
}

export const TopActiveUsersTable: React.FC = () => {
  const { filters } = useFilters()
  const [metric, setMetric] = useState<'coins_spent' | 'actions'>('coins_spent')
  const [feature, setFeature] = useState<string>('all')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['engagement-top-active-users', filters.fromISO, filters.toISO, metric, feature],
    queryFn: () => engagementApi.getTopActiveUsers({ startDate: filters.fromISO, endDate: filters.toISO, metric, feature, limit: 20 }),
    enabled: Boolean(filters.fromISO && filters.toISO),
  })

  useEffect(() => {
    const onRefetch = () => refetch()
    window.addEventListener('dashboard:engagement:refetch', onRefetch)
    return () => window.removeEventListener('dashboard:engagement:refetch', onRefetch)
  }, [refetch])

  const rows = useMemo(() => Array.isArray((data as any)?.top_active_users) ? (data as any).top_active_users : [], [data])

  const exportCSV = () => {
    const out = rows.map((r: any, i: number) => ({
      rank: i + 1,
      user_name: r.user_name ?? '',
      user_email: r.user_email ?? '',
      total_actions: r.total_actions,
      total_coins_spent: r.total_coins_spent,
      avg_coins_per_action: r.avg_coins_per_action ?? (r.total_actions ? (r.total_coins_spent / r.total_actions) : 0),
      most_used_feature: r.most_used_feature ?? '',
      most_spent_feature: r.most_spent_feature ?? '',
      most_spent_feature_coins: r.most_spent_feature_coins ?? 0,
    }))
    const csv = toCSV(out)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `top_active_users_${filters.fromISO}_${filters.toISO}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const featureOptions = useMemo(() => {
    const set = new Set<string>(['all'])
    // infer from most_used_feature present in rows
    rows.forEach((r: any) => { if (r.most_used_feature) set.add(String(r.most_used_feature)) })
    return Array.from(set)
  }, [rows])

  return (
    <SectionCard
      title="Top Active Users"
      description="Leaderboard of most active users"
      isLoading={isLoading}
      error={error ? String(error) : null}
      onExport={rows.length ? exportCSV : undefined}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Metric:</label>
          <select className="border rounded px-2 py-1 text-sm" value={metric} onChange={e => setMetric(e.target.value as any)}>
            <option value="coins_spent">Coins Spent</option>
            <option value="actions">Actions</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Feature:</label>
          <select className="border rounded px-2 py-1 text-sm" value={feature} onChange={e => setFeature(e.target.value)}>
            {featureOptions.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Rank</th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Email</th>
              <th className="px-3 py-2 text-right font-medium">Total Actions</th>
              <th className="px-3 py-2 text-right font-medium">Coins Spent</th>
              <th className="px-3 py-2 text-right font-medium">Avg Coins/Action</th>
              <th className="px-3 py-2 text-left font-medium">Most Used Feature</th>
              <th className="px-3 py-2 text-left font-medium">Most Spent Feature</th>
              <th className="px-3 py-2 text-right font-medium">Most Spent Coins</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any, idx: number) => (
              <tr key={r.user_email ?? r.user_name ?? idx} className="odd:bg-background even:bg-muted/20">
                <td className="px-3 py-1.5">{idx + 1}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{r.user_name ?? (r.user_email ?? `User ${r.user_id ?? idx}`)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{r.user_email ?? '—'}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{(r.total_actions||0).toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{(r.total_coins_spent||0).toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{(r.avg_coins_per_action ?? ((r.total_coins_spent||0)/((r.total_actions||1)))).toFixed(2)}</td>
                <td className="px-3 py-1.5">
                  {r.most_used_feature ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                      {r.most_used_feature}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  {r.most_spent_feature ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                      {r.most_spent_feature}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{(r.most_spent_feature_coins ?? 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

export default TopActiveUsersTable
