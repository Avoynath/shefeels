import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { RefreshCw } from 'lucide-react'

import { useFilters } from '../context/FiltersContext'
import { apiService, type CountryFunnelResponse, type CountryFunnelRow } from '../services/api'
import { cn } from '../lib/utils'
import { Button } from './ui/button'

const hasDisplayNames = typeof Intl !== 'undefined' && typeof (Intl as any).DisplayNames === 'function'

interface CountryFunnelProps {
  startDate?: string
  endDate?: string
  className?: string
  maxCountries?: number
}

type ChartMode = 'funnel' | 'bars'

const MODE_ORDER: ChartMode[] = ['funnel', 'bars']
const MODE_LABEL: Record<ChartMode, string> = {
  funnel: 'Top Country Funnel',
  bars: 'Country Comparison',
}

const formatInteger = (value: number) => value.toLocaleString('en-US')

const formatRate = (value?: number | null) => {
  if (value == null || Number.isNaN(Number(value))) return '0%'
  const pct = Number(value) * 100
  if (!Number.isFinite(pct)) return '0%'
  if (pct >= 100) return `${pct.toFixed(0)}%`
  if (pct >= 10) return `${pct.toFixed(1)}%`
  return `${pct.toFixed(2)}%`
}

const formatCompact = (value: number) => {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return formatInteger(value)
}

interface DecoratedCountry extends CountryFunnelRow {
  label: string
}

export function CountryFunnel({ startDate, endDate, className, maxCountries = 10 }: CountryFunnelProps) {
  const { filters } = useFilters()
  const effectiveStart = startDate ?? filters.fromISO
  const effectiveEnd = endDate ?? filters.toISO

  const [mode, setMode] = useState<ChartMode>('funnel')

  const regionDisplay = useMemo(() => {
    if (!hasDisplayNames) return null
    return new Intl.DisplayNames(['en'], { type: 'region' })
  }, [])

  const resolveCountryLabel = useCallback((code?: string) => {
    if (!code) return 'Unknown'
    const upper = code.toUpperCase()
    try {
      return regionDisplay?.of(upper) ?? upper
    } catch {
      return upper
    }
  }, [regionDisplay])

  const { data, isLoading, error, refetch, isFetching } = useQuery<CountryFunnelResponse>({
    queryKey: ['country-funnel', effectiveStart, effectiveEnd],
    queryFn: () => apiService.getCountryFunnel({ startDate: effectiveStart, endDate: effectiveEnd }),
    enabled: Boolean(effectiveStart && effectiveEnd),
    staleTime: 5 * 60 * 1000,
  })

  const decoratedCountries = useMemo<DecoratedCountry[]>(() => {
    if (!data?.items?.length) return []
    return data.items.map((item) => ({
      ...item,
      label: resolveCountryLabel(item.country_code),
    }))
  }, [data?.items, resolveCountryLabel])

  const sortedByPayers = useMemo(() => {
    return [...decoratedCountries].sort((a, b) => b.payers - a.payers)
  }, [decoratedCountries])

  const topCountry = sortedByPayers[0]
  const comparisonCountries = sortedByPayers.slice(0, maxCountries)

  const funnelOption = useMemo<EChartsOption | undefined>(() => {
    if (!topCountry) return undefined
    const steps = [
      { name: 'Visitors', value: topCountry.visitors },
      { name: 'Signups', value: topCountry.signups },
      { name: 'Payers', value: topCountry.payers },
    ]
    const maxValue = Math.max(...steps.map(step => step.value), 0)
    return {
      tooltip: {
        trigger: 'item',
        formatter: () => {
          return [
            `<strong>${topCountry.label}</strong>`,
            `Visitors: ${formatInteger(topCountry.visitors)}`,
            `Signups: ${formatInteger(topCountry.signups)} (${formatRate(topCountry.signup_rate)})`,
            `Payers: ${formatInteger(topCountry.payers)} (${formatRate(topCountry.pay_rate)})`,
          ].join('<br/>')
        },
      },
      legend: { data: steps.map(step => step.name) },
      series: [
        {
          name: `${topCountry.label} Funnel`,
          type: 'funnel',
          top: 20,
          height: '80%',
          left: '15%',
          width: '70%',
          min: 0,
          max: maxValue || 1,
          sort: 'descending',
          gap: 8,
          label: {
            formatter: '{b}: {c}',
            fontSize: 12,
          },
          labelLine: { length: 14, lineStyle: { color: '#4b5563' } },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 2,
          },
          data: steps.map((step, idx) => ({
            ...step,
            itemStyle: {
              color: ['#c7d2fe', '#a5b4fc', '#7c3aed'][idx] || '#7c3aed',
            },
          })),
        },
      ],
    }
  }, [topCountry])

  const barsOption = useMemo<EChartsOption | undefined>(() => {
    if (!comparisonCountries.length) return undefined
    const visitorsSeries = comparisonCountries.map(country => country.visitors)
    const signupsSeries = comparisonCountries.map(country => country.signups)
    const payersSeries = comparisonCountries.map(country => country.payers)
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          if (!params?.length) return ''
          const idx = params[0].dataIndex ?? 0
          const country = comparisonCountries[idx]
          const lines = [`<strong>${country.label}</strong>`]
          params.forEach((series: any) => {
            lines.push(`${series.marker}${series.seriesName}: ${formatInteger(Number(series.value) || 0)}`)
          })
          lines.push(`Signup Rate: ${formatRate(country.signup_rate)}`)
          lines.push(`Pay Rate: ${formatRate(country.pay_rate)}`)
          return lines.join('<br/>')
        },
      },
      legend: {
        data: ['Visitors', 'Signups', 'Payers'],
        bottom: 0,
      },
      grid: { left: 110, right: 24, top: 10, bottom: 70 },
      xAxis: {
        type: 'value',
        axisLabel: {
          formatter: (val: number) => formatCompact(val),
        },
        splitLine: {
          show: true,
          lineStyle: { color: '#e5e7eb' },
        },
      },
      yAxis: {
        type: 'category',
        data: comparisonCountries.map(country => country.label),
        axisLabel: {
          fontSize: 12,
        },
      },
      series: [
        {
          name: 'Visitors',
          type: 'bar',
          stack: 'total',
          barWidth: 14,
          data: visitorsSeries,
          itemStyle: { color: '#c7d2fe' },
        },
        {
          name: 'Signups',
          type: 'bar',
          stack: 'total',
          barWidth: 14,
          data: signupsSeries,
          itemStyle: { color: '#a5b4fc' },
        },
        {
          name: 'Payers',
          type: 'bar',
          stack: 'total',
          barWidth: 14,
          data: payersSeries,
          itemStyle: { color: '#7c3aed' },
        },
      ],
    }
  }, [comparisonCountries])

  const totals = data?.total

  const chartContent = (() => {
    if (isLoading) {
      return <div className="h-[320px] flex items-center justify-center text-sm text-gray-500">Loading funnel data...</div>
    }
    if (error) {
      const message = error instanceof Error ? error.message : 'Unable to load funnel data.'
      return <div className="h-[320px] flex items-center justify-center text-sm text-red-500">{message}</div>
    }
    if (!decoratedCountries.length) {
      return <div className="h-[320px] flex items-center justify-center text-sm text-gray-500">No funnel data for this range.</div>
    }
    if (mode === 'funnel' && funnelOption) {
      return <ReactECharts option={funnelOption} style={{ height: 340 }} notMerge lazyUpdate />
    }
    if (mode === 'bars' && barsOption) {
      return <ReactECharts option={barsOption} style={{ height: 420 }} notMerge lazyUpdate />
    }
    return <div className="h-[320px] flex items-center justify-center text-sm text-gray-500">No chart data for the selected mode.</div>
  })()

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Revenue Funnel by Country</p>
          <p className="text-xs text-gray-500">Visitors → Signups → Payers · Range: {effectiveStart} → {effectiveEnd}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border bg-white">
            {MODE_ORDER.map(option => {
              const active = mode === option
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMode(option)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition',
                    active ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {MODE_LABEL[option]}
                </button>
              )
            })}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading || isFetching}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-2', isFetching && 'animate-spin')} />
            {isFetching ? 'Refreshing' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-gray-50/60">
        {chartContent}
      </div>

      {totals && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-center">
          <SummaryTile label="Total Visitors" value={formatInteger(totals.visitors)} />
          <SummaryTile label="Total Signups" value={formatInteger(totals.signups)} subValue={`Signup Rate ${formatRate(totals.signup_rate)}`} />
          <SummaryTile label="Total Payers" value={formatInteger(totals.payers)} subValue={`Pay Rate ${formatRate(totals.pay_rate)}`} />
          <SummaryTile label="Countries" value={decoratedCountries.length.toString()} />
        </div>
      )}
    </div>
  )
}

interface SummaryTileProps {
  label: string
  value: string
  subValue?: string
}

function SummaryTile({ label, value, subValue }: SummaryTileProps) {
  return (
    <div className="border rounded-lg p-3 bg-white shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
      {subValue && <p className="text-[11px] text-gray-500 mt-1">{subValue}</p>}
    </div>
  )
}
