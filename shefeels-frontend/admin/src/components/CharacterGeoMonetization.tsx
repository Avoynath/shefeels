import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts'
import { SectionCard } from './SectionCard'
import { useFilters } from '../context/FiltersContext'
import { engagementApi } from '../services/engagementApi'
import { Button } from './ui/button'

interface CharacterGeoMonetizationProps {
  limit?: number
}

interface NormalizedCountryBreakdown {
  countryCode: string
  countryLabel: string
  coinsSpent: number
}

interface NormalizedCharacterRow {
  characterId: string
  characterName: string
  totalCoins: number
  breakdown: NormalizedCountryBreakdown[]
  topCountryCode: string | null
  topCountryLabel: string | null
  topCountryShare: number
}

const COLOR_PALETTE = ['#1d4ed8', '#0ea5e9', '#22c55e', '#eab308', '#f97316', '#a855f7', '#ef4444', '#0f172a', '#14b8a6', '#9333ea']
const SUPPORTS_REGION_NAMES = typeof Intl !== 'undefined' && typeof (Intl as any).DisplayNames === 'function'

type TreemapSelection = {
  characterId: string | null
  countryCode: string | null
} | null

interface TreemapTileProps {
  depth: number
  x: number
  y: number
  width: number
  height: number
  name: string
  value: number
  payload?: any
  activeCharacterId: string | null
  activeCountry: string | null
  onSelect?: (selection: TreemapSelection) => void
}

const TreemapTile = ({ depth, x, y, width, height, name, value, payload, activeCharacterId, activeCountry, onSelect }: TreemapTileProps) => {
  if (depth === 0 || width <= 2 || height <= 2) return null
  const isCharacterNode = depth === 1
  const baseFill = payload?.fill || '#94a3b8'
  const matchesSelection = activeCountry
    ? payload?.countryCode === activeCountry
    : activeCharacterId !== null && payload?.characterId !== undefined && String(payload.characterId) === activeCharacterId
  const fillOpacity = matchesSelection ? 0.95 : isCharacterNode ? 0.3 : 0.7
  const textColor = matchesSelection ? '#111827' : '#0f172a'
  const primaryLabel = isCharacterNode ? (payload?.characterName || name) : (payload?.countryLabel || name)
  const secondaryLabel = value ? `${value.toLocaleString()} coins` : ''
  const showFullLabel = width > 140 && height > 40
  const showShortLabel = !showFullLabel && width > 80 && height > 24

  const handleClick = (event: any) => {
    event.stopPropagation()
    if (!onSelect) return
    if (isCharacterNode) {
      onSelect({
        characterId: payload?.characterId ? String(payload.characterId) : null,
        countryCode: null,
      })
    } else {
      onSelect({
        characterId: payload?.characterId ? String(payload.characterId) : null,
        countryCode: payload?.countryCode ?? null,
      })
    }
  }

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill: baseFill, stroke: '#fff', strokeWidth: 1 }}
        fillOpacity={fillOpacity}
        cursor="pointer"
        onClick={handleClick}
      />
      {showFullLabel && (
        <text x={x + 8} y={y + 20} fill={textColor} fontSize={12} pointerEvents="none">
          {primaryLabel}
        </text>
      )}
      {showFullLabel && secondaryLabel && (
        <text x={x + 8} y={y + 36} fill="#475569" fontSize={11} pointerEvents="none">
          {secondaryLabel}
        </text>
      )}
      {showShortLabel && (
        <text x={x + 6} y={y + 18} fill={textColor} fontSize={12} pointerEvents="none">
          {primaryLabel}
        </text>
      )}
    </g>
  )
}

const TreemapTooltipContent = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const node = payload[0]?.payload
  if (!node) return null
  const isLeaf = Boolean(node.countryCode)
  return (
    <div className="rounded-md border bg-white px-3 py-2 text-xs shadow">
      <p className="font-semibold text-gray-900">{isLeaf ? node.countryLabel : node.characterName || node.name}</p>
      {isLeaf && <p className="text-gray-600">Character: {node.characterName}</p>}
      <p className="text-gray-600">{(node.value || 0).toLocaleString()} coins</p>
    </div>
  )
}

export function CharacterGeoMonetization({ limit = 10 }: CharacterGeoMonetizationProps) {
  const { filters } = useFilters()
  const startDate = filters.fromISO
  const endDate = filters.toISO
  const [activeSelection, setActiveSelection] = useState<TreemapSelection>(null)

  const regionDisplay = useMemo(() => {
    if (!SUPPORTS_REGION_NAMES) return null
    try {
      return new (Intl as any).DisplayNames(['en'], { type: 'region' })
    } catch {
      return null
    }
  }, [])

  const resolveCountryLabel = useCallback((code: string | null | undefined) => {
    if (!code) return 'Unknown'
    const normalized = code.toUpperCase()
    try {
      return regionDisplay?.of?.(normalized) ?? normalized
    } catch {
      return normalized
    }
  }, [regionDisplay])

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['engagement-character-geo-monetization', startDate, endDate, limit],
    queryFn: () => engagementApi.getCharacterGeoMonetization({ startDate, endDate, metric: 'coins_spent', limit }),
    enabled: Boolean(startDate && endDate),
    staleTime: 60_000,
  })

  useEffect(() => {
    const onRefetch = () => refetch()
    window.addEventListener('dashboard:engagement:refetch', onRefetch)
    return () => window.removeEventListener('dashboard:engagement:refetch', onRefetch)
  }, [refetch])

  const rows = useMemo<NormalizedCharacterRow[]>(() => {
    const list = Array.isArray(data?.results) ? data!.results : []
    return list
      .map((row, idx) => {
        const characterId = row?.character_id != null ? String(row.character_id) : `char-${idx}`
        const characterName = row?.character_name || 'Unnamed'
        const totalCoins = Number(row?.total_coins_spent || 0)
        const breakdownEntries = Array.isArray(row?.by_country) ? row.by_country : []
        const aggregated = breakdownEntries.reduce<Record<string, number>>((acc, entry) => {
          const code = (entry?.country_code || 'UNK').toUpperCase()
          const coins = Number(entry?.coins_spent || 0)
          acc[code] = (acc[code] || 0) + coins
          return acc
        }, {})
        const breakdown = Object.entries(aggregated)
          .map(([countryCode, coins]) => ({
            countryCode,
            countryLabel: resolveCountryLabel(countryCode),
            coinsSpent: coins,
          }))
          .sort((a, b) => b.coinsSpent - a.coinsSpent)
        const topCountry = breakdown[0]
        const topShare = topCountry && totalCoins > 0 ? (topCountry.coinsSpent / totalCoins) * 100 : 0
        return {
          characterId,
          characterName,
          totalCoins,
          breakdown,
          topCountryCode: topCountry?.countryCode ?? null,
          topCountryLabel: topCountry?.countryLabel ?? null,
          topCountryShare: topShare,
        }
      })
      .sort((a, b) => b.totalCoins - a.totalCoins)
  }, [data, resolveCountryLabel])

  useEffect(() => {
    if (!activeSelection?.countryCode) return
    const stillExists = rows.some(row => row.breakdown.some(b => b.countryCode === activeSelection.countryCode))
    if (!stillExists) setActiveSelection(null)
  }, [rows, activeSelection])

  const treemapData = useMemo(() => {
    const characterNodes = rows
      .filter(row => row.totalCoins > 0 && row.breakdown.length)
      .map((row, idx) => ({
        name: row.characterName,
        characterName: row.characterName,
        characterId: row.characterId,
        value: row.totalCoins,
        fill: COLOR_PALETTE[idx % COLOR_PALETTE.length],
        children: row.breakdown.map(country => ({
          name: country.countryCode,
          countryCode: country.countryCode,
          countryLabel: country.countryLabel,
          characterId: row.characterId,
          characterName: row.characterName,
          value: country.coinsSpent,
          fill: COLOR_PALETTE[idx % COLOR_PALETTE.length],
        })),
      }))
    return characterNodes.length ? [{ name: 'characters', children: characterNodes }] : []
  }, [rows])

  const totalCoins = useMemo(() => rows.reduce((sum, row) => sum + row.totalCoins, 0), [rows])

  const highlightedRowIds = useMemo(() => {
    if (!activeSelection) return new Set<string>()
    if (activeSelection.countryCode) {
      return rows
        .filter(row => row.breakdown.some(b => b.countryCode === activeSelection.countryCode))
        .reduce((set, row) => set.add(row.characterId), new Set<string>())
    }
    if (activeSelection.characterId) {
      return rows
        .filter(row => row.characterId === activeSelection.characterId)
        .reduce((set, row) => set.add(row.characterId), new Set<string>())
    }
    return new Set<string>()
  }, [rows, activeSelection])

  const hasTreemapData = treemapData.length > 0
  const activeCountryLabel = activeSelection?.countryCode ? resolveCountryLabel(activeSelection.countryCode) : null

  const clearSelection = () => setActiveSelection(null)

  const handleSelect = (selection: TreemapSelection) => {
    if (!selection) {
      setActiveSelection(null)
      return
    }
    const normalizedCharacter = selection.characterId ? String(selection.characterId) : null
    // Toggle when clicking the same target twice
    if (
      activeSelection &&
      activeSelection.characterId === normalizedCharacter &&
      activeSelection.countryCode === selection.countryCode
    ) {
      setActiveSelection(null)
      return
    }
    setActiveSelection({
      characterId: normalizedCharacter,
      countryCode: selection.countryCode ?? null,
    })
  }

  return (
    <SectionCard
      title="Character Monetization by Geography"
      description="Treemap highlights which countries drive spend for the top characters. Click any country block to spotlight matching rows."
      isLoading={isLoading}
      error={error ? String(error) : null}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Top {rows.length || limit} characters · {totalCoins.toLocaleString()} coins</p>
        {activeCountryLabel && <span>Highlighting activity in {activeCountryLabel}</span>}
        {(activeSelection) && (
          <Button variant="outline" size="sm" onClick={clearSelection} disabled={isFetching}>
            Clear highlight
          </Button>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
        <div className="min-h-[360px] rounded-lg border bg-slate-50 p-4">
          {hasTreemapData ? (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treemapData}
                  dataKey="value"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  content={(props) => (
                    <TreemapTile
                      {...props}
                      activeCharacterId={activeSelection?.characterId ?? null}
                      activeCountry={activeSelection?.countryCode ?? null}
                      onSelect={handleSelect}
                    />
                  )}
                  isAnimationActive={false}
                >
                  <Tooltip content={<TreemapTooltipContent />} />
                </Treemap>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[360px] items-center justify-center text-sm text-slate-500">
              No geographic spend data available for this selection.
            </div>
          )}
        </div>
        <div className="overflow-hidden rounded-lg border">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Character</th>
                <th className="px-4 py-2 text-right">Total Coins</th>
                <th className="px-4 py-2 text-left">Top Country</th>
                <th className="px-4 py-2 text-right">Share %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const isHighlighted = highlightedRowIds.has(row.characterId)
                return (
                  <tr key={row.characterId} className={isHighlighted ? 'bg-indigo-50/70' : 'bg-white'}>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.characterName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.totalCoins.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-700">{row.topCountryLabel || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.topCountryShare ? `${row.topCountryShare.toFixed(1)}%` : '—'}</td>
                  </tr>
                )
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No character monetization data for this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
  )
}

export default CharacterGeoMonetization
