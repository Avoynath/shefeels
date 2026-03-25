import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import worldMapJson from '../data/world.geojson?raw'

import { SectionCard } from './SectionCard'
import { Button } from './ui/button'
import { Drawer } from './Drawer'
import { useFilters } from '../context/FiltersContext'
import { apiService, type GeoRevenueItem, type GeoRevenueResponse } from '../services/api'
import { formatCurrency } from '../lib/utils'
import { CountryFunnel } from './CountryFunnel'

const WORLD_GEOJSON = (() => {
  const normalizeCode = (value: unknown) => {
    if (typeof value !== 'string' && typeof value !== 'number') return undefined
    const str = String(value).trim()
    return str ? str.toUpperCase() : undefined
  }

  try {
    const parsed = JSON.parse(worldMapJson)
    // Ensure polygons expose ISO codes so the series can join on iso_a2 values
    if (parsed?.features && Array.isArray(parsed.features)) {
      parsed.features = parsed.features.map((feature: any) => {
        const props = feature?.properties ?? {}
        const isoA2 = normalizeCode(
          props.iso_a2 ??
          props.isoA2 ??
          props.ISO_A2 ??
          props.ISO_a2 ??
          props['ISO3166-1-Alpha-2']
        )
        const isoA3 = normalizeCode(
          props.iso_a3 ??
          props.isoA3 ??
          props.ISO_A3 ??
          props.ISO_a3 ??
          props['ISO3166-1-Alpha-3']
        )
        const name = props.name ?? props.NAME ?? feature?.name

        return {
          ...feature,
          id: isoA2 || feature?.id || isoA3 || name,
          properties: {
            ...props,
            name,
            iso_a2: isoA2 ?? props.iso_a2 ?? props.isoA2,
            iso_a3: isoA3 ?? props.iso_a3 ?? props.isoA3,
          },
        }
      })
    }
    return parsed
  } catch (error) {
    console.error('Failed to parse embedded world geojson', error)
    return null
  }
})()

type SelectedCountry = { code: string; label: string }

interface GeoRevenueMapProps {
  startDate?: string
  endDate?: string
  onSelect?: (countryCode: string) => void
}

const hasDisplayNames = typeof Intl !== 'undefined' && typeof (Intl as any).DisplayNames === 'function'

export function GeoRevenueMap({ startDate, endDate, onSelect }: GeoRevenueMapProps) {
  const { filters } = useFilters()
  const effectiveStart = startDate ?? filters.fromISO
  const effectiveEnd = endDate ?? filters.toISO

  const regionDisplay = useMemo(() => {
    if (!hasDisplayNames) return null
    return new Intl.DisplayNames(['en'], { type: 'region' })
  }, [])

  const resolveCountryLabel = useCallback((code: string | undefined) => {
    if (!code) return 'Unknown'
    const upper = code.toUpperCase()
    try {
      return regionDisplay?.of(upper) ?? upper
    } catch {
      return upper
    }
  }, [regionDisplay])

  const [mapReady, setMapReady] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return !!echarts.getMap('world')
    } catch {
      return false
    }
  })
  const [mapError, setMapError] = useState<string | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<SelectedCountry | null>(null)

  useEffect(() => {
    if (mapReady || typeof window === 'undefined') return
    try {
      if (!echarts.getMap('world')) {
        if (!WORLD_GEOJSON) throw new Error('World geoJSON missing')
        echarts.registerMap('world', WORLD_GEOJSON as any)
      }
      setMapReady(true)
    } catch (err) {
      console.error('Failed to initialize ECharts world map', err)
      setMapError('Unable to load world map data')
    }
  }, [mapReady])

  const { data, isLoading, isFetching, error, refetch } = useQuery<GeoRevenueResponse | undefined>({
    queryKey: ['revenue-by-geo', effectiveStart, effectiveEnd],
    queryFn: () => {
      if (!effectiveStart || !effectiveEnd) return Promise.resolve(undefined)
      return apiService.getRevenueByGeo({
        level: 'country',
        interval: 'monthly',
        startDate: effectiveStart,
        endDate: effectiveEnd,
      })
    },
    enabled: !!(effectiveStart && effectiveEnd),
    staleTime: 5 * 60 * 1000,
  })

  const {
    data: cityData,
    isFetching: isCityLoading,
    error: cityError,
  } = useQuery<GeoRevenueResponse | undefined>({
    queryKey: ['revenue-by-geo', 'city', selectedCountry?.code, effectiveStart, effectiveEnd],
    queryFn: () => {
      if (!selectedCountry?.code || !effectiveStart || !effectiveEnd) return Promise.resolve(undefined)
      return apiService.getRevenueByGeo({
        level: 'city',
        interval: 'monthly',
        startDate: effectiveStart,
        endDate: effectiveEnd,
        countryCode: selectedCountry.code,
      })
    },
    enabled: !!(selectedCountry?.code && effectiveStart && effectiveEnd),
  })

  const mapData = useMemo(() => {
    if (!data?.items?.length) return [] as Array<{ name: string; value: number; displayName: string; code: string }>
    return data.items
      .filter(item => item.geo_key)
      .map(item => {
        const code = item.geo_key.toUpperCase()
        return {
          name: code,
          code,
          value: Number(item.total_revenue) || 0,
          displayName: resolveCountryLabel(code),
        }
      })
  }, [data, resolveCountryLabel])

  const totalRevenue = useMemo(() => mapData.reduce((sum, d) => sum + (d.value || 0), 0), [mapData])

  const topCountries = useMemo(() => {
    return [...mapData]
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [mapData])

  const chartOption = useMemo<EChartsOption | undefined>(() => {
    // Always return a chart option once the world map is ready so the
    // map outline renders even when there is no geo data.
    if (!mapReady) return undefined
    const values = mapData.map(d => d.value)
    const max = values.length ? Math.max(...values) : 1
    const min = values.length ? Math.min(...values) : 0
    return ({
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const code = params.data?.code || params.name
          const name = params.data?.displayName || resolveCountryLabel(code)
          const value = Number(params.value ?? 0) || 0
          return `${name}<br/>${formatCurrency(value, data?.currency || 'USD')}`
        },
      },
      visualMap: {
        min,
        max: max || 1,
        left: 'left',
        bottom: 0,
        text: ['High', 'Low'],
        calculable: true,
        inRange: {
          color: ['#d1fae5', '#34d399', '#065f46'],
        },
      },
      series: [
        {
          type: 'map',
          map: 'world',
          nameProperty: 'iso_a2',
          roam: true,
          zoom: 1.1,
          top: 30,
          bottom: 40,
          label: { show: false },
          itemStyle: {
            areaColor: '#ecfdf5',
            borderColor: '#a7f3d0',
          },
          emphasis: {
            label: { show: false },
            itemStyle: {
              areaColor: '#10b981',
              borderColor: '#0f766e',
              borderWidth: 1.5,
            },
          },
          // supply the (possibly empty) data array so the map still renders
          data: mapData,
          scaleLimit: { min: 1, max: 8 },
        },
      ],
    }) as EChartsOption
  }, [mapData, resolveCountryLabel, data, mapReady]);

  const handleCountrySelect = useCallback((code: string | undefined) => {
    if (!code) return
    const formattedCode = code.toUpperCase()
    const label = resolveCountryLabel(formattedCode)
    setSelectedCountry({ code: formattedCode, label })
    onSelect?.(formattedCode)
  }, [onSelect, resolveCountryLabel])

  const onMapEvents = useMemo(() => ({
    click: (params: any) => {
      const code = params?.data?.code || params?.name
      handleCountrySelect(code)
    },
  }), [handleCountrySelect])

  const sortedCities = useMemo(() => {
    if (!cityData?.items?.length) return [] as GeoRevenueItem[]
    return [...cityData.items].sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))
  }, [cityData])

  const maxTopValue = topCountries[0]?.value || 0
  const maxCityRevenue = sortedCities[0]?.total_revenue || 0
  const currency = data?.currency || cityData?.currency || 'USD'

  const drawerContent = (() => {
    if (!selectedCountry) return null
    if (isCityLoading) {
      return <div className="py-10 text-center text-sm text-gray-500">Loading city breakdown...</div>
    }
    if (cityError) {
      const message = cityError instanceof Error ? cityError.message : 'Failed to load city data.'
      return <div className="py-10 text-center text-sm text-red-500">{message}</div>
    }
    if (!sortedCities.length) {
      return <div className="py-10 text-center text-sm text-gray-500">No city level data for this range.</div>
    }
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-gray-900">City revenue breakdown</p>
          <Button variant="outline" size="sm" onClick={() => setSelectedCountry(null)}>
            Back to countries
          </Button>
        </div>
        {sortedCities.slice(0, 15).map((city, idx) => (
          <div key={city.geo_key + idx} className="border rounded-lg p-4">
            <div className="flex items-center justify-between text-sm font-medium text-gray-700">
              <span>{idx + 1}. {city.geo_key || 'Unknown City'}</span>
              <span>{formatCurrency(city.total_revenue || 0, currency)}</span>
            </div>
            <div className="mt-2 h-2 bg-gray-100 rounded">
              <div
                className="h-2 rounded bg-emerald-500"
                style={{ width: `${maxCityRevenue ? Math.max((city.total_revenue || 0) / maxCityRevenue * 100, 5) : 0}%` }}
              />
            </div>
            {city.growth_vs_prev_period != null && (
              <p className={`mt-2 text-xs ${city.growth_vs_prev_period >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {city.growth_vs_prev_period >= 0 ? '+' : ''}{(city.growth_vs_prev_period * 100).toFixed(1)}% vs prev period
              </p>
            )}
          </div>
        ))}
      </div>
    )
  })()

  const cardError = mapError ?? (error instanceof Error ? error.message : error ? String(error) : null)
  const cardLoading = ((!mapReady && !cardError) || (isLoading && !data))
  const hasCountryData = mapData.length > 0
  const mapPlaceholderMessage = mapError || (data ? (hasCountryData ? 'Loading map...' : 'No geo data for this range.') : 'Waiting for data...')

  const content = (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-gray-600">Click any country to drill into city-level revenue.</p>
          <p className="text-xs text-gray-500">Range: {effectiveStart} → {effectiveEnd}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading || isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Refreshing' : 'Refresh'}
        </Button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 min-h-[420px]">
          {mapReady && chartOption ? (
            <ReactECharts
              option={chartOption}
              style={{ height: 420 }}
              notMerge
              lazyUpdate
              theme={undefined}
              onEvents={onMapEvents}
            />
          ) : (
            <div className="h-[420px] flex items-center justify-center text-sm text-gray-500">
              {mapPlaceholderMessage}
            </div>
          )}
        </div>
        <div className="w-full lg:w-64 xl:w-72 space-y-4">
          <div className="border rounded-lg p-4 bg-gradient-to-br from-emerald-50 via-white to-white">
            <p className="text-xs uppercase tracking-wide text-emerald-600">Total Revenue</p>
            <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totalRevenue || 0, currency)}</p>
            <p className="text-xs text-gray-500 mt-1">Interval: {data?.interval ?? 'monthly'}</p>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Top Countries</p>
              <span className="text-xs text-gray-500">Revenue share</span>
            </div>
            <div className="mt-4 space-y-4">
              {topCountries.length ? topCountries.map((country, idx) => (
                <button
                  type="button"
                  key={country.code}
                  onClick={() => handleCountrySelect(country.code)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                    <span>{idx + 1}. {country.displayName}</span>
                    <span>{formatCurrency(country.value || 0, currency)}</span>
                  </div>
                  <div className="mt-2 h-2 rounded bg-emerald-100">
                    <div
                      className="h-2 rounded bg-emerald-500"
                      style={{ width: `${maxTopValue ? Math.max(country.value / maxTopValue * 100, 6) : 0}%` }}
                    />
                  </div>
                </button>
              )) : (
                <p className="text-sm text-gray-500">No country level data for this range.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-dashed border-gray-200">
        <CountryFunnel startDate={effectiveStart} endDate={effectiveEnd} />
      </div>
    </div>
  )

  return (
    <>
      <SectionCard
        title="Revenue by Geo"
        description="Monthly revenue distribution by country"
        isLoading={cardLoading}
        error={cardError}
      >
        {content}
      </SectionCard>

      <Drawer
        open={!!selectedCountry}
        onClose={() => setSelectedCountry(null)}
        title={selectedCountry ? `Top Cities · ${selectedCountry.label}` : undefined}
      >
        {drawerContent}
      </Drawer>
    </>
  )
}
