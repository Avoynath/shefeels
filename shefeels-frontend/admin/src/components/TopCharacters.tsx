import React, { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { SectionCard } from './SectionCard'
import { useFilters } from '../context/FiltersContext'
import { engagementApi } from '../services/engagementApi.ts'

type SourceMetric = string
type ApiResult = {
  metric: string
  source_types: string[]
  results: Array<{
    character_id: number | null
    character_name: string | null
    totals: Record<SourceMetric, number>
    breakdown: Record<string, Record<SourceMetric, number>>
  }>
}

interface Props {
  data?: ApiResult
  metric?: SourceMetric
  percentageMode?: boolean
  maxBars?: number
  limit?: number
}

const DEFAULT_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#A78BFA', '#F97316', '#06B6D4']

export const TopCharacters: React.FC<Props> = ({ limit = 10, metric: metricProp, percentageMode: percentageModeProp, maxBars }) => {
  const { filters } = useFilters()
  const startDate = filters.fromISO
  const endDate = filters.toISO
  const [metric, setMetric] = useState<SourceMetric>((metricProp as SourceMetric) || 'coins_spent')
  const [percentageMode, setPercentageMode] = useState<boolean>(percentageModeProp ?? false)

  useEffect(() => {
    if (metricProp) setMetric(metricProp)
  }, [metricProp])

  useEffect(() => {
    if (typeof percentageModeProp === 'boolean') setPercentageMode(percentageModeProp)
  }, [percentageModeProp])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['engagement-top-characters-breakdown', startDate, endDate, limit, 'active_count', 'daily'],
    // backend expects metric=active_count and interval=daily per request
    queryFn: () => engagementApi.getTopCharactersBreakdown({ startDate, endDate, metric: 'active_count', interval: 'daily', limit }),
    enabled: Boolean(startDate && endDate),
  })

  useEffect(() => {
    const onRefetch = () => refetch()
    window.addEventListener('dashboard:engagement:refetch', onRefetch)
    return () => window.removeEventListener('dashboard:engagement:refetch', onRefetch)
  }, [refetch])

  const api = data as ApiResult | undefined
  const sourceTypes = useMemo(() => (api?.source_types && Array.isArray(api.source_types)) ? api.source_types : [], [api])

  // prepare rows and slice top N
  const rows = useMemo(() => {
    const r = Array.isArray(api?.results) ? api!.results.slice() : []
    // sort by totals[metric] desc
    r.sort((a, b) => (Number(b.totals?.[metric] || 0) - Number(a.totals?.[metric] || 0)))
    const sliced = typeof maxBars === 'number' ? r.slice(0, maxBars) : r.slice(0, limit ?? 10)
    return sliced
  }, [api, metric, maxBars, limit])

  // build chart data: one entry per character with breakdown values per source type
  const chartData = useMemo(() => {
    return rows.map((row) => {
      const base: any = {
        character_id: row.character_id,
        character_name: row.character_name || 'Unnamed',
      }
      let totalForMetric = Number(row.totals?.[metric] || 0)
      sourceTypes.forEach((s) => {
        const val = Number(row.breakdown?.[s]?.[metric] || 0)
        base[s] = val
      })
      if (percentageMode) {
        // convert to percent of totalForMetric; avoid division by zero
        sourceTypes.forEach((s) => {
          const v = Number(row.breakdown?.[s]?.[metric] || 0)
          base[s] = totalForMetric ? (v / totalForMetric) * 100 : 0
        })
      }
      base._total = totalForMetric
      return base
    })
  }, [rows, sourceTypes, metric, percentageMode])

  // colors mapped to source types
  const colors = sourceTypes.map((_, i) => DEFAULT_COLORS[i % DEFAULT_COLORS.length])

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

  const exportCSV = () => {
    const rowsOut = (api?.results || []).map((r: any, i: number) => {
      const out: any = {
        rank: i + 1,
        character_id: r.character_id ?? '',
        character_name: r.character_name ?? '',
      }
      // include totals and breakdown
      out.total = r.totals?.[metric] ?? ''
      sourceTypes.forEach((s: string) => {
        out[s] = r.breakdown?.[s]?.[metric] ?? 0
      })
      return out
    })
    const csv = toCSV(rowsOut)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `top_characters_${filters.fromISO}_${filters.toISO}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <SectionCard
      title="Top Characters"
      description={`Ranked by ${metric.replace('_', ' ')}`}
      isLoading={isLoading}
      error={error ? String(error) : null}
      onExport={api?.results && api.results.length ? exportCSV : undefined}
    >
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Metric:</label>
          <select value={metric} onChange={(e) => setMetric(e.target.value as SourceMetric)} className="border rounded px-2 py-1 text-sm">
            <option value="coins_spent">Coins Spent</option>
            <option value="interactions">Interactions</option>
            <option value="unique_users">Unique Users</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">100% mode</label>
          <input type="checkbox" checked={percentageMode} onChange={(e) => setPercentageMode(e.target.checked)} />
        </div>
      </div>

      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 12 }} domain={[0, 'dataMax']} tickFormatter={(v) => percentageMode ? `${Number(v).toFixed(0)}%` : v} />
            <YAxis type="category" dataKey="character_name" width={180} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: any, name: any) => {
              if (percentageMode) return [typeof value === 'number' ? `${value.toFixed(1)}%` : value, name]
              return [value, name]
            }} />
            <Legend />
            {sourceTypes.map((s, i) => (
              <Bar key={s} dataKey={s} stackId="a" name={s} fill={colors[i]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-md bg-white shadow-sm mt-6">
        <table className="min-w-full text-xs divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600 uppercase tracking-wider text-[11px]">Character</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600 uppercase tracking-wider text-[11px]">Total</th>
              {sourceTypes.map((s) => (
                <th key={s} className="px-4 py-2 text-right font-medium text-gray-600 uppercase tracking-wider text-[11px]">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartData.map((r: any) => (
              <tr key={`${r.character_id}-${r.character_name}`} className="bg-white hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-semibold">
                    {(r.character_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium">{r.character_name}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{percentageMode ? `${(r._total ? r._total.toFixed ? r._total.toFixed(2) : r._total : 0)}%` : (r._total || 0).toLocaleString()}</td>
                {sourceTypes.map((s) => (
                  <td key={s} className="px-4 py-3 text-right tabular-nums">{percentageMode ? `${(r[s]||0).toFixed(1)}%` : (r[s]||0).toLocaleString()}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

export default TopCharacters
