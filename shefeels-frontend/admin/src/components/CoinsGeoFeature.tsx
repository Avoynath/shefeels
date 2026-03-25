import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { SectionCard } from './SectionCard'
import { Button } from './ui/button'
import { RefreshCw } from 'lucide-react'
import {
  coinsApi,
  type CoinsFeatureKey,
  type CoinsGeoFeatureResponse,
  type CoinsGeoTimeseriesPoint,
} from '../services/coinsApi.ts'
import { useFilters } from '../context/FiltersContext'

const CANONICAL_FEATURES: CoinsFeatureKey[] = ['chat', 'chat_image', 'image', 'video', 'private_content']

interface HeatmapCell {
  feature: string
  value: number
  spent: number
  activeUsers: number
}

interface HeatmapRow {
  country: string
  cells: HeatmapCell[]
  totalSpent: number
}

export function CoinsGeoFeature() {
  const { filters } = useFilters()
  const startDate = filters.fromISO
  const endDate = filters.toISO
  const interval = filters.interval || 'monthly'
  const [selectedFeature, setSelectedFeature] = useState<CoinsFeatureKey>('all')
  const [selectedCountry, setSelectedCountry] = useState<string>('')

  const { data, isLoading, error, refetch, isFetching } = useQuery<CoinsGeoFeatureResponse>({
    queryKey: ['coins-geo-feature', startDate, endDate, interval, 'all-features'],
    queryFn: () => coinsApi.getGeoFeature({ startDate, endDate, interval, feature: 'all' }),
    staleTime: 60_000,
    enabled: Boolean(startDate && endDate),
  })

  useEffect(() => {
    const handler = () => {
      refetch()
    }
    window.addEventListener('dashboard:navigate:coins', handler)
    window.addEventListener('dashboard:coins:refetch', handler)
    return () => {
      window.removeEventListener('dashboard:navigate:coins', handler)
      window.removeEventListener('dashboard:coins:refetch', handler)
    }
  }, [refetch])

  const countryOptions = useMemo(() => {
    return (data?.countries || []).map((c) => c.toUpperCase()).filter(Boolean)
  }, [data])

  useEffect(() => {
    if (!countryOptions.length) return
    if (!selectedCountry || !countryOptions.includes(selectedCountry)) {
      setSelectedCountry(countryOptions[0])
    }
  }, [countryOptions, selectedCountry])

  const normalizedFeatureOrder = useMemo<string[]>(() => {
    return (data?.features || [])
      .map((f) => (f ? f.toLowerCase() : ''))
      .filter((f): f is string => Boolean(f))
  }, [data])

  const heatmapFeatures: string[] = normalizedFeatureOrder.length
    ? normalizedFeatureOrder
    : (CANONICAL_FEATURES as string[])

  const { chartPoints, aggregatedTotals } = useMemo(() => {
    const normalizedCountry = selectedCountry?.toUpperCase()
    const timeseriesByCountry = data?.timeseries_by_country || {}
    const seriesForCountry = normalizedCountry
      ? timeseriesByCountry[normalizedCountry] || timeseriesByCountry[selectedCountry || ''] || []
      : []

    const baseSeries = (seriesForCountry as CoinsGeoFeatureResponse['timeseries'])?.length
      ? seriesForCountry
      : data?.timeseries || []

    const chartData = (baseSeries || []).map((point: CoinsGeoTimeseriesPoint) => ({
      period: point.period,
      coins_purchased: Number(point.coins_purchased || 0),
      coins_spent: Number(point.coins_spent || 0),
    }))

    const purchased = chartData.reduce((sum, pt) => sum + pt.coins_purchased, 0)
    const spent = chartData.reduce((sum, pt) => sum + pt.coins_spent, 0)

    return {
      chartPoints: chartData,
      aggregatedTotals: {
        coins_purchased: purchased,
        coins_spent: spent,
        net: purchased - spent,
        purchase_spend_ratio: spent > 0 ? purchased / spent : 0,
      },
    }
  }, [data, selectedCountry])

  const selectedCountryTotals = useMemo(() => {
    if (!data?.totals || !selectedCountry) return null
    const normalized = selectedCountry.toUpperCase()
    return data.totals[normalized] || data.totals[selectedCountry] || null
  }, [data, selectedCountry])

  const totals = selectedCountryTotals ?? aggregatedTotals

  const { heatmapRows, maxCellValue } = useMemo(() => {
    const countries = (data?.countries || []).map((c) => c.toUpperCase())
    const matrix = data?.matrix || []
    if (!countries.length || !heatmapFeatures.length || !matrix.length) {
      return { heatmapRows: [] as HeatmapRow[], maxCellValue: 0 }
    }

    let maxValue = 0
    const rows: HeatmapRow[] = countries.map((country, rowIdx) => {
      const rowValues = matrix[rowIdx] || []
      const cells: HeatmapCell[] = heatmapFeatures.map((featureKey, featureIdx) => {
        const orderIndex = normalizedFeatureOrder.length
          ? normalizedFeatureOrder.indexOf(featureKey)
          : featureIdx
        const resolvedIndex = orderIndex >= 0 ? orderIndex : featureIdx
        const value = Number(rowValues[resolvedIndex] ?? 0)
        if (value > maxValue) maxValue = value
        return {
          feature: featureKey,
          value,
          spent: value,
          activeUsers: value > 0 ? 1 : 0,
        }
      })

      return {
        country,
        cells,
        totalSpent: cells.reduce((sum, cell) => sum + cell.value, 0),
      }
    })

    rows.sort((a, b) => b.totalSpent - a.totalSpent)

    return { heatmapRows: rows, maxCellValue: maxValue }
  }, [data, heatmapFeatures, normalizedFeatureOrder])

  const formatFeatureLabel = (feature: string) => {
    if (feature === 'private_content') return 'Private Content'
    if (feature === 'chat_image') return 'Chat + Image'
    if (feature === 'other') return 'Other'
    return feature.charAt(0).toUpperCase() + feature.slice(1)
  }

  const getCellColor = (value: number) => {
    if (maxCellValue <= 0 || value <= 0) return 'rgba(148, 163, 184, 0.25)'
    const ratio = Math.min(1, value / maxCellValue)
    const alpha = 0.2 + ratio * 0.6
    return `rgba(59, 130, 246, ${alpha.toFixed(2)})`
  }

  const safeTotals = totals || {
    coins_purchased: 0,
    coins_spent: 0,
    net: 0,
    purchase_spend_ratio: 0,
  }
  const coinsPurchased = safeTotals.coins_purchased
  const coinsSpent = safeTotals.coins_spent
  const net = safeTotals.net ?? coinsPurchased - coinsSpent
  const ratio = safeTotals.purchase_spend_ratio ?? (coinsSpent > 0 ? coinsPurchased / coinsSpent : 0)
  const ratioWarning = ratio < 1 && coinsSpent > 0

  const hasData = Boolean((data?.countries?.length || 0) > 0 && (data?.matrix?.length || 0) > 0)

  return (
    <SectionCard
      title="Coins Purchased vs Spent (Geo Feature)"
      description="Compare purchase volume and spending intensity by country and feature"
      isLoading={isLoading}
      error={error ? String(error) : null}
    >
      {!hasData ? (
        <p className="text-sm text-muted-foreground">No geographic coin data available for this interval yet.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Feature</label>
              <select
                className="border rounded-md px-2 py-1 text-sm"
                value={selectedFeature}
                onChange={(e) => setSelectedFeature(e.target.value as CoinsFeatureKey)}
              >
                <option value="all">All features</option>
                {heatmapFeatures.map((feature: string) => (
                  <option key={feature} value={feature}>
                    {formatFeatureLabel(feature)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Country</label>
              <select
                className="border rounded-md px-2 py-1 text-sm"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
              >
                {countryOptions.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
                {isFetching ? 'Refreshing' : 'Refresh'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 border rounded-md bg-indigo-50/80">
                  <p className="text-xs text-indigo-800 uppercase tracking-wide">Coins purchased</p>
                  <p className="text-2xl font-semibold text-indigo-900 tabular-nums">
                    {coinsPurchased.toLocaleString()}
                  </p>
                </div>
                <div className={`p-3 border rounded-md ${ratioWarning ? 'bg-red-50' : 'bg-emerald-50/70'}`}>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Purchase / spend</p>
                  <p className={`text-2xl font-semibold tabular-nums ${ratioWarning ? 'text-red-700' : 'text-emerald-700'}`}>
                    {ratio ? ratio.toFixed(2) : '0.00'}
                  </p>
                  {ratioWarning && (
                    <p className="text-[11px] text-red-700 mt-1">Spending exceeds purchases in this market.</p>
                  )}
                </div>
                <div className="p-3 border rounded-md bg-rose-50/70">
                  <p className="text-xs uppercase tracking-wide text-rose-700">Coins spent</p>
                  <p className="text-2xl font-semibold text-rose-700 tabular-nums">
                    {coinsSpent.toLocaleString()}
                  </p>
                </div>
                <div className={`p-3 border rounded-md ${net >= 0 ? 'bg-emerald-50/80' : 'bg-rose-50/80'}`}>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Net</p>
                  <p className={`text-2xl font-semibold tabular-nums ${net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {net.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="h-[340px]">
                {chartPoints.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartPoints}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="coins_purchased" name="Coins Purchased" stackId="1" stroke="#2563EB" fill="rgba(37, 99, 235, 0.45)" strokeWidth={2} />
                      <Area type="monotone" dataKey="coins_spent" name="Coins Spent" stackId="1" stroke="#DC2626" fill="rgba(220, 38, 38, 0.45)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground border rounded-md">
                    No time-series data for this selection.
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border rounded-md">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-3 py-2 text-left font-semibold">Country</th>
                    {heatmapFeatures.map((feature: string) => (
                      <th key={feature} className="px-2 py-2 text-center font-semibold whitespace-nowrap">
                        {formatFeatureLabel(feature)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapRows.length === 0 && (
                    <tr>
                      <td colSpan={heatmapFeatures.length + 1} className="px-3 py-4 text-center text-muted-foreground">
                        Not enough activity to render heatmap yet.
                      </td>
                    </tr>
                  )}
                  {heatmapRows.map((row) => (
                    <tr key={row.country} className="odd:bg-white even:bg-muted/20">
                      <td className="px-3 py-2 font-medium text-gray-900">{row.country}</td>
                      {heatmapFeatures.map((feature: string, idx: number) => {
                        const cell = row.cells[idx] || {
                          feature,
                          value: 0,
                          spent: 0,
                          activeUsers: 0,
                        }
                        const color = getCellColor(cell.value)
                        const isDimmed = selectedFeature !== 'all' && selectedFeature !== feature
                        return (
                          <td key={`${row.country}-${feature}`} className="px-2 py-1">
                            <div
                              className="h-10 rounded flex items-center justify-center text-[11px] font-medium"
                              style={{
                                backgroundColor: color,
                                color: cell.value / (maxCellValue || 1) > 0.55 ? '#fff' : '#111827',
                                opacity: isDimmed ? 0.35 : 1,
                              }}
                              title={`${formatFeatureLabel(feature)} • ${cell.value.toFixed(1)} coins / active user`}
                            >
                              {cell.value ? cell.value.toFixed(1) : '—'}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-muted-foreground mt-2">
                Cell values represent coins spent per active user (aggregated across the selected interval). Darker cells indicate higher spend intensity.
              </p>
            </div>
          </div>
        </>
      )}
    </SectionCard>
  )
}

export default CoinsGeoFeature
