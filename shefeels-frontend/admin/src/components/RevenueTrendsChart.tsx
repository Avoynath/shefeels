import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
} from 'recharts'
import { useFilters } from '../context/FiltersContext'
import { SectionCard } from './SectionCard'
import { formatCurrency, downloadCSV, toCSV } from '../lib/utils'
import { apiService } from '../services/api'
import { Button } from './ui/button'
import { cn } from '../lib/utils'
import { RefreshCw } from 'lucide-react'

interface RevenueTrendRow {
  period: string
  coin_revenue: number
  subscription_revenue?: number
  total_revenue?: number
}

interface RevenueTrendsApiResponse {
  data: RevenueTrendRow[]
  total_coin_revenue: number
  total_subscription_revenue?: number
  total_revenue_all_periods?: number
  avg_monthly_revenue: number
  currency?: string
}

const SERIES: Array<{ key: keyof RevenueTrendRow; label: string; color: string; enabledByDefault: boolean }> = [
  { key: 'coin_revenue', label: 'Coin Revenue', color: '#10B981', enabledByDefault: true },
  { key: 'subscription_revenue', label: 'Subscription Revenue', color: '#3B82F6', enabledByDefault: true },
]

const STORAGE_KEY = 'dashboard:revenue_trends:visible'

export function RevenueTrendsChart() {
  const { filters, setFilters } = useFilters()
  const [visibleSeries, setVisibleSeries] = useState<string[]>(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      if (raw) return JSON.parse(raw)
    } catch {}
    return SERIES.filter(s => s.enabledByDefault).map(s => s.key as string)
  })
  const [yDomainType, setYDomainType] = useState<'auto' | 'fit'>('auto')

  const startDate = filters.fromISO
  const endDate = filters.toISO
  const interval = filters.interval

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleSeries)) } catch {}
  }, [visibleSeries])

  const { data, isLoading, error, refetch, isFetching } = useQuery<RevenueTrendsApiResponse>({
    queryKey: ['revenue-trends', startDate, endDate, interval],
    queryFn: () => apiService.getRevenueTrends({ startDate, endDate, interval }),
    enabled: !!startDate && !!endDate,
    // Ensure we always fetch fresh revenue trends instead of using a possibly cached result
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  // Refetch when monetization nav explicitly clicked
  useEffect(() => {
    const handler = () => {
      // Force aggregation interval to monthly before fetching
      let changed = false
      setFilters((prev: any) => {
        if (prev.interval !== 'monthly') {
          changed = true
          return { ...prev, interval: 'monthly' }
        }
        return prev
      })
      // If already monthly, refetch immediately; otherwise allow query key change to trigger fetch
      if (!changed) refetch()
    }
    window.addEventListener('dashboard:navigate:monetization', handler)
    return () => window.removeEventListener('dashboard:navigate:monetization', handler)
  }, [refetch, setFilters])

  const handleExport = () => {
    if (!data?.data) return
    const csv = toCSV(data.data)
    downloadCSV('revenue-trends.csv', csv)
  }

  // toggleSeries logic inlined by using setVisibleSeries directly where needed

  // Using loose typing for Recharts tooltip to avoid generic mismatch noise
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white/95 backdrop-blur border rounded-md p-3 shadow-lg text-xs space-y-1">
        <p className="font-medium text-xs mb-1">{label}</p>
        {payload.filter((p: any) => p.dataKey && visibleSeries.includes(p.dataKey as string)).map((entry: any, i: number) => (
          <p key={i} className="flex justify-between gap-3" style={{ color: entry.color }}>
            <span>{entry.name}</span>
            <span className="font-medium">{formatCurrency(Number(entry.value)||0)}</span>
          </p>
        ))}
      </div>
    )
  }

  const tableRows: RevenueTrendRow[] = useMemo(() => Array.isArray(data?.data) ? data!.data : [], [data])
  const hasData = !!tableRows.length

  const yAxisDomain = useMemo(() => {
    if (yDomainType === 'auto' || !hasData) return undefined
    // Fit: compute max visible value across visible series
    let max = 0
    tableRows.forEach(r => {
      visibleSeries.forEach(k => {
        const v = (r as any)[k] ?? 0
        if (v > max) max = v
      })
    })
    return [0, Math.ceil(max * 1.05)] as [number, number]
  }, [yDomainType, tableRows, visibleSeries, hasData])

  if (isLoading || error || !data) {
    return (
      <SectionCard
        title="Revenue Trends"
        description="Revenue over time"
        onExport={handleExport}
        isLoading={isLoading}
        error={error?.toString()}
      />
    )
  }

  return (
    <SectionCard
      title="Revenue Trends"
      description="Revenue over time"
      onExport={handleExport}
    >
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Series toggles with clear active state */}
          <div className="flex flex-wrap gap-2">
            {SERIES.map(s => {
              const active = visibleSeries.includes(s.key as string)
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setVisibleSeries(prev => active ? prev.filter(v => v !== s.key) : [...prev, s.key as string])
                  }}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md border transition focus:outline-none focus:ring-2 focus:ring-offset-1',
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm hover:bg-indigo-600/90'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  )}
                  style={{ boxShadow: active ? '0 1px 2px rgba(0,0,0,0.18)' : undefined }}
                >
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: s.color, opacity: active ? 1 : 0.4 }} />
                  {s.label}
                </button>
              )
            })}
          </div>
          {/* Y scale segmented control + refresh */}
          <div className="flex items-center gap-3">
            <div className="flex items-stretch rounded-md border overflow-hidden">
              <span className="px-2 py-1.5 text-[11px] font-medium bg-gray-50 border-r select-none text-gray-600">Y Scale</span>
              {(['auto','fit'] as const).map(opt => {
                const active = yDomainType === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setYDomainType(opt)}
                    className={cn('px-2.5 py-1.5 text-xs font-medium transition border-l first:border-l-0',
                      active ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50')}
                  >{opt === 'auto' ? 'Auto' : 'Fit'}</button>
                )
              })}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading || isFetching} className="relative min-w-[84px]">
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1', (isFetching) && 'animate-spin')} />
              {isFetching ? 'Refreshing' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.data} margin={{ left: 12, right: 12, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => formatCurrency(value as number, 'USD')} tick={{ fontSize: 12 }} domain={yAxisDomain as any} />
              <Tooltip content={<CustomTooltip />} wrapperStyle={{ outline: 'none' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {visibleSeries.includes('coin_revenue') && Array.isArray(data?.data) && (
                <Area type="monotone" dataKey="coin_revenue" stroke="#10B981" fill="#10B981" fillOpacity={0.55} name="Coin Revenue" />
              )}
              {visibleSeries.includes('subscription_revenue') && Array.isArray(data?.data) && (
                <Area type="monotone" dataKey="subscription_revenue" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.55} name="Subscription Revenue" />
              )}
              <ReferenceLine y={0} stroke="#aaa" />
              {Array.isArray(data?.data) && data.data.length > 20 && (
                <Brush height={24} travellerWidth={10} gap={2} stroke="#6366F1" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto border rounded-md">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Period</th>
                {SERIES.map(s => (
                  <th key={s.key} className={cn('px-3 py-2 font-medium text-right', !visibleSeries.includes(s.key) && 'opacity-40')}>{s.label}</th>
                ))}
                <th className="px-3 py-2 font-medium text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(r => (
                <tr key={r.period} className="odd:bg-background even:bg-muted/20">
                  <td className="px-3 py-1.5 whitespace-nowrap font-medium">{r.period}</td>
                  {SERIES.map(s => (
                    <td key={s.key} className={cn('px-3 py-1.5 text-right tabular-nums', !visibleSeries.includes(s.key) && 'opacity-40')}>
                      {formatCurrency((r as any)[s.key] as number)}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(r.total_revenue || ((r.coin_revenue || 0) + (r.subscription_revenue || 0)))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40 border-t">
                <td className="px-3 py-2 font-semibold">Totals</td>
                {SERIES.map(s => {
                  const total = tableRows.reduce((sum, r) => sum + ((r as any)[s.key] as number || 0), 0)
                  return <td key={s.key} className={cn('px-3 py-2 text-right font-semibold', !visibleSeries.includes(s.key) && 'opacity-40')}>{formatCurrency(total)}</td>
                })}
                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(tableRows.reduce((sum, r) => sum + (r.total_revenue || ((r.coin_revenue || 0) + (r.subscription_revenue || 0))), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
          <div className="text-center p-3 border rounded-md bg-linear-to-br from-emerald-50 to-white">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Coin Revenue (All Periods)</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(data.total_coin_revenue, data.currency || 'USD')}</p>
          </div>
          <div className="text-center p-3 border rounded-md bg-linear-to-br from-emerald-50 to-white">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Subscription Revenue (All Periods)</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(data.total_subscription_revenue || 0, data.currency || 'USD')}</p>
          </div>
          <div className="text-center p-3 border rounded-md bg-linear-to-br from-emerald-50 to-white">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Revenue (All Periods)</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(data.total_revenue_all_periods || 0, data.currency || 'USD')}</p>
          </div>
          <div className="text-center p-3 border rounded-md bg-linear-to-br from-emerald-50 to-white">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg Monthly Revenue</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(data.avg_monthly_revenue || 0, data.currency || 'USD')}</p>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
