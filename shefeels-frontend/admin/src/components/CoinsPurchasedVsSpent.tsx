import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SectionCard } from './SectionCard'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts'
import { useFilters } from '../context/FiltersContext'
import { coinsApi, type CoinTrendsResponse, type CoinTrendsRow } from '../services/coinsApi.ts'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { RefreshCw } from 'lucide-react'

export function CoinsPurchasedVsSpent() {
  const { filters, setFilters } = useFilters()
  const startDate = filters.fromISO
  const endDate = filters.toISO
  const interval = filters.interval
  type IntervalOpt = 'daily' | 'weekly' | 'monthly' | 'quarterly'
  // local interval control (defaults to global filter interval, stays in sync)
  const [localInterval, setLocalInterval] = useState<IntervalOpt>(interval as IntervalOpt)
  useEffect(() => { setLocalInterval(filters.interval as IntervalOpt) }, [filters.interval])
  const [shadeRanges, setShadeRanges] = useState<Array<{ start: number; end: number }>>([])

  const { data, isLoading, error, refetch, isFetching } = useQuery<CoinTrendsResponse>({
    queryKey: ['coins-trends', startDate, endDate, localInterval],
    queryFn: () => coinsApi.getTrends({ startDate, endDate, interval: localInterval }),
    enabled: !!startDate && !!endDate,
  })

  // Ensure interval weekly by default when navigating here, and refetch
  useEffect(() => {
    const handler = () => {
      let changed = false
      setFilters(prev => {
        if (prev.interval !== 'weekly') { changed = true; return { ...prev, interval: 'weekly' } }
        return prev
      })
      if (!changed) refetch()
      // also ask sibling sections to refetch
      try { window.dispatchEvent(new CustomEvent('dashboard:coins:refetch')) } catch {}
    }
    window.addEventListener('dashboard:navigate:coins', handler)
    return () => window.removeEventListener('dashboard:navigate:coins', handler)
  }, [refetch, setFilters])

  const rows: CoinTrendsRow[] = useMemo(() => Array.isArray(data?.coin_trends) ? data!.coin_trends : [], [data])

  useEffect(() => {
    // compute contiguous ranges where coins_spent > coins_purchased for shading
    const ranges: Array<{ start: number; end: number }> = []
    let runStart: number | null = null
    rows.forEach((r, i) => {
      const overspend = (r.coins_spent || 0) > (r.coins_purchased || 0)
      if (overspend && runStart === null) runStart = i
      if (!overspend && runStart !== null) { ranges.push({ start: runStart, end: i - 1 }); runStart = null }
    })
    if (runStart !== null) ranges.push({ start: runStart, end: rows.length - 1 })
    setShadeRanges(ranges)
  }, [rows])

  const net = data?.net_coins_change ?? 0
  const ratio = data?.purchase_to_spend_ratio ?? 0
  const ratioBad = ratio < 1

  return (
    <SectionCard
      title="Coins Purchased vs Spent"
      description="Time series of coin purchases and spending"
      isLoading={isLoading}
      error={error ? String(error) : null}
    >
      {/* Stat chips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="p-3 border rounded-md bg-gradient-to-br from-indigo-50 to-white">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Net Coins Change</p>
          <p className="text-2xl font-bold mt-1">{net.toLocaleString()}</p>
        </div>
        <div className={`p-3 border rounded-md ${ratioBad ? 'bg-red-50' : 'bg-emerald-50'}`}>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Purchase / Spend Ratio</p>
          <p className={`text-2xl font-bold mt-1 ${ratioBad ? 'text-red-700' : 'text-emerald-700'}`}>{Number(ratio).toFixed(2)}</p>
          {ratioBad && <p className="text-xs text-red-700 mt-1">Warning: users are spending faster than buying</p>}
        </div>
      </div>

      {/* Chart */}
      {/* Controls: interval buttons + refresh */}
      <div className="flex items-center justify-end gap-2 mb-4">
        {(['daily','weekly','monthly','quarterly'] as IntervalOpt[]).map(opt => {
          const active = localInterval === opt
          const label = opt === 'daily' ? 'Daily' : opt === 'weekly' ? 'Weekly' : opt === 'monthly' ? 'Monthly' : 'Quarterly'
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setLocalInterval(opt)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md border transition', active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')}
            >{label}</button>
          )
        })}
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="ml-1">
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1', isFetching && 'animate-spin')} />
          {isFetching ? 'Refreshing' : 'Refresh'}
        </Button>
      </div>
      <div className="h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="coins_purchased" stroke="#3B82F6" name="Coins Purchased" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="coins_spent" stroke="#EF4444" name="Coins Spent" strokeWidth={2} dot={{ r: 3 }} />
            {shadeRanges.map((r, idx) => (
              <ReferenceArea key={idx} x1={rows[r.start]?.period} x2={rows[r.end]?.period} y1={0} y2={Infinity} fill="#FEE2E2" fillOpacity={0.35} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  )
}

export default CoinsPurchasedVsSpent
