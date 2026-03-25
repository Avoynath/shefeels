import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { format, subDays } from 'date-fns'
import { useSearchParams, useLocation } from 'react-router-dom'

/** Interval granularity supported by monetization dashboard */
export type Interval = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
/** Feature scoping for metrics */
export type Feature = 'all' | 'chat' | 'image_generation' | 'video_generation' | 'character_creation'
/** Quick date range presets */
export type DatePreset = '7d' | '30d' | '90d'

export interface Filters {
  preset: DatePreset
  fromISO: string
  toISO: string
  interval: Interval
  feature: Feature
  plan: string
}

const DEFAULT_PRESET: DatePreset = '30d'
const DEFAULT_FILTERS: Omit<Filters, 'fromISO' | 'toISO'> & { fromISO?: string; toISO?: string } = {
  preset: DEFAULT_PRESET,
  interval: 'monthly',
  feature: 'all',
  plan: 'all',
}

/** Format Date -> YYYY-MM-DD */
export function toISO(date: Date): string { return format(date, 'yyyy-MM-dd') }

/** Given a preset produce inclusive from/to pair */
export function fromPreset(preset: DatePreset): { fromISO: string; toISO: string } {
  const today = new Date()
  switch (preset) {
    case '7d':
      return { fromISO: toISO(subDays(today, 6)), toISO: toISO(today) }
    case '30d':
      return { fromISO: toISO(subDays(today, 29)), toISO: toISO(today) }
    case '90d':
      return { fromISO: toISO(subDays(today, 89)), toISO: toISO(today) }
    default:
      return { fromISO: toISO(subDays(today, 29)), toISO: toISO(today) }
  }
}

interface FiltersContextValue {
  filters: Filters
  setFilters: React.Dispatch<React.SetStateAction<Filters>>
  setPreset: (preset: DatePreset) => void
  setRange: (fromISO: string, toISO: string) => void
}

const FiltersContext = createContext<FiltersContextValue | undefined>(undefined)

function coercePreset(fromISO: string, toISO: string): DatePreset | undefined {
  try {
    const from = new Date(fromISO + 'T00:00:00')
    const to = new Date(toISO + 'T00:00:00')
    const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
    if (diffDays === 7) return '7d'
    if (diffDays === 30) return '30d'
    if (diffDays === 90) return '90d'
    return undefined
  } catch {
    return undefined
  }
}

const VALID_INTERVALS: Interval[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']
const VALID_FEATURES: Feature[] = ['all', 'chat', 'image_generation', 'video_generation', 'character_creation']

function readInitial(search: URLSearchParams): Filters {
  const presetParam = search.get('preset') as DatePreset | null
  const intervalParam = search.get('interval') as Interval | null
  const featureParam = search.get('feature') as Feature | null
  const planParam = search.get('plan')
  const fromParam = search.get('from')
  const toParam = search.get('to')

  const base = { ...DEFAULT_FILTERS } as Filters
  const todayRange = fromPreset(base.preset)
  base.fromISO = todayRange.fromISO
  base.toISO = todayRange.toISO

  if (presetParam && ['7d','30d','90d'].includes(presetParam)) {
    const r = fromPreset(presetParam)
    base.preset = presetParam
    base.fromISO = r.fromISO
    base.toISO = r.toISO
  }
  if (fromParam && toParam) {
    // manual override; attempt to coerce preset
    base.fromISO = fromParam
    base.toISO = toParam
    const coerced = coercePreset(fromParam, toParam)
    if (coerced) base.preset = coerced
  }
  if (intervalParam && VALID_INTERVALS.includes(intervalParam)) base.interval = intervalParam
  if (featureParam && VALID_FEATURES.includes(featureParam)) base.feature = featureParam
  if (planParam) base.plan = planParam
  return base
}

function writeSearchParams(filters: Filters, setSearchParams: (next: URLSearchParams, opts?: { replace?: boolean }) => void) {
  const sp = new URLSearchParams()
  sp.set('preset', filters.preset)
  sp.set('from', filters.fromISO)
  sp.set('to', filters.toISO)
  sp.set('interval', filters.interval)
  sp.set('feature', filters.feature)
  sp.set('plan', filters.plan)
  setSearchParams(sp, { replace: true })
}

export const FiltersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const isDashboard = location.pathname.startsWith('/dashboard')
  const initRef = useRef<boolean>(false)
  // Only read initial search params when on the dashboard; otherwise use defaults
  const [filters, setFilters] = useState<Filters>(() => isDashboard ? readInitial(searchParams) : readInitial(new URLSearchParams()))

  // On first mount if on dashboard ensure URL has canonical params
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    if (!isDashboard) return
    // ensure URL has canonical params
    writeSearchParams(filters, setSearchParams)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDashboard])

  // When filters object changes, sync to URL
  const filtersRef = useRef(filters)
  useEffect(() => { filtersRef.current = filters })
  useEffect(() => { if (isDashboard) writeSearchParams(filters, setSearchParams) }, [filters, setSearchParams, isDashboard])

  const setPreset = useCallback((preset: DatePreset) => {
    setFilters(prev => {
      const { fromISO, toISO } = fromPreset(preset)
      return { ...prev, preset, fromISO, toISO }
    })
  }, [])

  const setRange = useCallback((fromISO: string, toISO: string) => {
    setFilters(prev => {
      const coerced = coercePreset(fromISO, toISO)
      return { ...prev, fromISO, toISO, preset: coerced ?? prev.preset }
    })
  }, [])

  const value = useMemo<FiltersContextValue>(() => ({ filters, setFilters, setPreset, setRange }), [filters, setPreset, setRange])

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext)
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider')
  return ctx
}
