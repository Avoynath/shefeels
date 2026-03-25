import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { RefreshCw, Search } from 'lucide-react'

import { SectionCard } from './SectionCard'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useFilters } from '../context/FiltersContext'
import { apiService, type ArpuAovByGeoItem, type ArpuAovByGeoResponse } from '../services/api'

const hasDisplayNames = typeof Intl !== 'undefined' && typeof (Intl as any).DisplayNames === 'function'

interface ArpuAovByGeoProps {
  startDate?: string
  endDate?: string
  maxCountries?: number
}

interface DecoratedCountry extends ArpuAovByGeoItem {
  label: string
}

export function ArpuAovByGeo({ startDate, endDate, maxCountries = 12 }: ArpuAovByGeoProps) {
  const { filters } = useFilters()
  const effectiveStart = startDate ?? filters.fromISO
  const effectiveEnd = endDate ?? filters.toISO
  const interval = filters.interval ?? 'monthly'

  const [selectedCountry, setSelectedCountry] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const regionDisplay = useMemo(() => {
    if (!hasDisplayNames) return null
    return new Intl.DisplayNames(['en'], { type: 'region' })
  }, [])

  const resolveCountryLabel = useCallback((code?: string | null) => {
    if (!code) return 'Unknown'
    const upper = code.toUpperCase()
    try {
      return regionDisplay?.of(upper) ?? upper
    } catch {
      return upper
    }
  }, [regionDisplay])

  const { data, isLoading, isFetching, error, refetch } = useQuery<ArpuAovByGeoResponse | undefined>({
    queryKey: ['arpu-aov-by-geo', effectiveStart, effectiveEnd, interval],
    queryFn: () => {
      if (!effectiveStart || !effectiveEnd) return Promise.resolve(undefined)
      return apiService.getArpuAovByGeo({ startDate: effectiveStart, endDate: effectiveEnd, interval })
    },
    enabled: Boolean(effectiveStart && effectiveEnd),
    staleTime: 5 * 60 * 1000,
  })

  const currency = data?.currency || 'USD'

  const currencySymbol = useMemo(() => {
    try {
      const parts = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        currencyDisplay: 'symbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).formatToParts(0)
      return parts.find(part => part.type === 'currency')?.value ?? currency
    } catch {
      return currency
    }
  }, [currency])

  const twoDecimalFormatter = useMemo(() => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    } catch {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }
  }, [currency])

  const formatTwoDecimals = useCallback((value: number) => {
    try {
      return twoDecimalFormatter.format(value)
    } catch {
      return value.toFixed(2)
    }
  }, [twoDecimalFormatter])

  const formatCurrencyCompact = useCallback((value: number) => {
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000) return `${currencySymbol}${(value / 1_000_000_000).toFixed(1)}B`
    if (abs >= 1_000_000) return `${currencySymbol}${(value / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${currencySymbol}${(value / 1_000).toFixed(1)}K`
    return `${currencySymbol}${value.toFixed(0)}`
  }, [currencySymbol])

  const decoratedItems = useMemo<DecoratedCountry[]>(() => {
    if (!data?.items?.length) return []
    return data.items.map(item => ({
      ...item,
      label: resolveCountryLabel(item.country_code),
    }))
  }, [data?.items, resolveCountryLabel])

  const filteredPool = useMemo<DecoratedCountry[]>(() => {
    if (!decoratedItems.length) return []
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return decoratedItems.filter(item => {
      const matchesCountry = selectedCountry === 'all' ? true : item.country_code === selectedCountry
      const matchesSearch = normalizedSearch
        ? item.label.toLowerCase().includes(normalizedSearch) || item.country_code.toLowerCase().includes(normalizedSearch)
        : true
      return matchesCountry && matchesSearch
    })
  }, [decoratedItems, searchTerm, selectedCountry])

  const visibleItems = useMemo(() => {
    if (!filteredPool.length) return []
    return [...filteredPool]
      .sort((a, b) => (b.arpu || 0) - (a.arpu || 0))
      .slice(0, maxCountries)
  }, [filteredPool, maxCountries])

  const summary = useMemo(() => {
    if (!filteredPool.length) return null
    const totals = filteredPool.reduce(
      (acc, item) => {
        acc.users += item.users || 0
        acc.orders += item.orders || 0
        acc.arpu += item.arpu || 0
        acc.aov += item.aov || 0
        if ((item.arpu || 0) > acc.top.arpu) {
          acc.top = { arpu: item.arpu || 0, label: item.label }
        }
        return acc
      },
      { users: 0, orders: 0, arpu: 0, aov: 0, top: { arpu: 0, label: '—' } }
    )
    const count = filteredPool.length || 1
    return {
      avgArpu: totals.arpu / count,
      avgAov: totals.aov / count,
      totalUsers: totals.users,
      totalOrders: totals.orders,
      topLabel: totals.top.label,
      topArpu: totals.top.arpu,
    }
  }, [filteredPool])

  const countryOptions = useMemo(() => {
    if (!decoratedItems.length) return [] as DecoratedCountry[]
    return [...decoratedItems].sort((a, b) => a.label.localeCompare(b.label))
  }, [decoratedItems])

  const chartOption = useMemo<EChartsOption | undefined>(() => {
    if (!visibleItems.length) return undefined
    const categories = visibleItems.map(item => item.label)
    const arpuValues = visibleItems.map(item => item.arpu || 0)
    const aovValues = visibleItems.map(item => item.aov || 0)

    const formatTooltip = (rawParams: any) => {
      const params = Array.isArray(rawParams) ? rawParams : [rawParams]
      if (!params.length) return ''
      const idx = params[0]?.dataIndex ?? 0
      const country = visibleItems[idx]
      const lines = [`<strong>${country?.label ?? 'Unknown'}</strong>`]
      params.forEach(entry => {
        const value = Number(entry?.value) || 0
        lines.push(`${entry.marker}${entry.seriesName}: ${formatTwoDecimals(value)}`)
      })
      if (country) {
        lines.push(`Users: ${(country.users || 0).toLocaleString('en-US')}`)
        lines.push(`Orders: ${(country.orders || 0).toLocaleString('en-US')}`)
      }
      return lines.join('<br/>')
    }

    return {
      color: ['#4f46e5', '#f97316'],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: formatTooltip,
      },
      legend: {
        data: ['ARPU', 'AOV'],
        top: 10,
      },
      grid: {
        left: 40,
        right: 24,
        top: 70,
        bottom: 80,
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          interval: 0,
          rotate: categories.length > 8 ? 30 : 0,
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => formatCurrencyCompact(value),
        },
        splitLine: {
          show: true,
          lineStyle: { color: '#e5e7eb' },
        },
      },
      series: [
        {
          name: 'ARPU',
          type: 'bar',
          data: arpuValues,
          barGap: 0,
          barWidth: visibleItems.length > 10 ? 18 : 24,
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => formatTwoDecimals(Number(params?.value) || 0),
            color: '#111827',
            fontSize: 11,
          },
        },
        {
          name: 'AOV',
          type: 'bar',
          data: aovValues,
          barWidth: visibleItems.length > 10 ? 18 : 24,
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => formatTwoDecimals(Number(params?.value) || 0),
            color: '#111827',
            fontSize: 11,
          },
        },
      ],
    }
  }, [visibleItems, formatCurrencyCompact, formatTwoDecimals])

  const cardError = error instanceof Error ? error.message : error ? String(error) : null

  const hasData = visibleItems.length > 0

  return (
    <SectionCard
      title="ARPU vs AOV by Country"
      description="Grouped monthly ARPU and average order value per market"
      isLoading={isLoading && !data}
      error={cardError}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Interval: {interval}</p>
            <p className="text-xs text-gray-500">Range · {effectiveStart} → {effectiveEnd}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-48">
              <p className="text-xs text-gray-500 mb-1">Country filter</p>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="All countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All countries</SelectItem>
                  {countryOptions.map(country => (
                    <SelectItem key={country.country_code} value={country.country_code}>
                      {country.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <p className="text-xs text-gray-500 mb-1">Search</p>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Type country name"
                  className="pl-8 pr-3 py-2 w-full border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  type="text"
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading || isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Refreshing' : 'Refresh'}
            </Button>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryStat label="Average ARPU" value={formatTwoDecimals(summary.avgArpu)} />
            <SummaryStat label="Average AOV" value={formatTwoDecimals(summary.avgAov)} />
            <SummaryStat
              label="Users (filtered)"
              value={summary.totalUsers.toLocaleString('en-US')}
              subValue={`${summary.totalOrders.toLocaleString('en-US')} orders`}
            />
            <SummaryStat
              label="Top ARPU"
              value={formatTwoDecimals(summary.topArpu)}
              subValue={summary.topLabel}
            />
          </div>
        )}

        <div className="border rounded-lg p-4 bg-gray-50/60">
          {hasData && chartOption ? (
            <ReactECharts option={chartOption} style={{ height: 420 }} notMerge lazyUpdate />
          ) : (
            <div className="h-[360px] flex items-center justify-center text-sm text-gray-500">
              {filteredPool.length
                ? 'No countries match that filter. Adjust the selector or search.'
                : 'No ARPU/AOV data for this range.'}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Values represent country-level monetization performance reported by the admin metrics service.
        </p>
      </div>
    </SectionCard>
  )
}

interface SummaryStatProps {
  label: string
  value: string
  subValue?: string
}

function SummaryStat({ label, value, subValue }: SummaryStatProps) {
  return (
    <div className="border rounded-lg p-3 bg-white shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
      {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
    </div>
  )
}
