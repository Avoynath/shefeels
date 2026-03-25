import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SectionCard } from './SectionCard'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { coinsApi, type UsageByFeatureResponse } from '../services/coinsApi.ts'
import { useFilters } from '../context/FiltersContext'

const SPEND_COLOR = '#ef4444' // red/rose
const CREDIT_COLOR = '#10b981' // green/emerald
const NEUTRAL_COLORS = ['#6366F1', '#8B5CF6', '#06B6D4', '#F59E0B']
const COLORS = [SPEND_COLOR, CREDIT_COLOR, ...NEUTRAL_COLORS]

type SortKey = 'feature' | 'coins_spent' | 'coins_credited' | 'percentage'
type SortDir = 'asc' | 'desc'

export function CoinsByFeature() {
  const { filters, setFilters } = useFilters()
  const startDate = filters.fromISO
  const endDate = filters.toISO
  const [feature, setFeature] = useState<string>(filters.feature || 'all')
  const [flow, setFlow] = useState<'spent' | 'credited' | 'both'>('spent')
  const [sortKey, setSortKey] = useState<SortKey>('coins_spent')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const { data, isLoading, error, refetch } = useQuery<UsageByFeatureResponse>({
    queryKey: ['coins-usage-by-feature', startDate, endDate, feature, flow],
    queryFn: () => coinsApi.getUsageByFeature({ startDate, endDate, feature, flow }),
    enabled: !!startDate && !!endDate,
  })

  // ensure backend is called when flow changes (even if same value clicked)
  useEffect(() => {
    refetch()
  }, [flow, refetch])

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


  // normalize backend responses into a consistent internal shape
  const { rows, totalSpent, totalCredited } = useMemo(() => {
    const raw = Array.isArray((data as any)?.by_feature) ? (data as any).by_feature : []
    let ts = 0
    let tc = 0
  type RawRow = any
  const mapped: Array<{ feature: string; coins_spent: number; coins_credited: number; percentage?: number; transactions?: number }> = raw.map((r: RawRow) => {
      const feature = r.feature
      const coins_spent = r.coins_spent ?? r.spent ?? (flow === 'spent' ? r.coins ?? 0 : 0)
      const coins_credited = r.coins_credited ?? r.credited ?? (flow === 'credited' ? r.coins ?? 0 : 0)
      const percentage = r.percentage ?? r.share_pct ?? r.share_pct
      const transactions = r.transactions ?? r.transaction_count
      ts += Number(coins_spent || 0)
      tc += Number(coins_credited || 0)
      return { feature, coins_spent: Number(coins_spent || 0), coins_credited: Number(coins_credited || 0), percentage: typeof percentage === 'number' ? percentage : undefined, transactions }
    })
    // totals from different response shapes
    if ((data as any)?.totals) {
      ts = Number((data as any).totals.spent || ts)
      tc = Number((data as any).totals.credited || tc)
    }
    if ((data as any)?.total_coins) {
      // single-number responses use total_coins for credited or spent depending on flow
      if (flow === 'credited') tc = Number((data as any).total_coins)
      else ts = Number((data as any).total_coins)
    }
    if ((data as any)?.total_coins_spent) ts = Number((data as any).total_coins_spent)
    if ((data as any)?.total_coins_credited) tc = Number((data as any).total_coins_credited)

    // ensure percentage exists for single modes when missing
  const enhanced = mapped.map(r => ({
      ...r,
      percentage: r.percentage ?? (flow === 'credited' ? (tc ? (r.coins_credited / tc) * 100 : 0) : (ts ? (r.coins_spent / ts) * 100 : 0)),
    }))

    const sorted = [...enhanced].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'feature') return dir * a.feature.localeCompare(b.feature)
      return dir * (((a as any)[sortKey] || 0) - ((b as any)[sortKey] || 0))
    })
    return { rows: sorted, totalSpent: ts, totalCredited: tc }
  }, [data, sortKey, sortDir, flow])

  const donutData = rows.map(r => ({ name: r.feature, value: flow === 'credited' ? (r.coins_credited || 0) : (r.coins_spent || 0) }))
  const barData = rows.map(r => ({ feature: r.feature, coins_spent: r.coins_spent || 0, coins_credited: r.coins_credited || 0, coins_spent_neg: -(r.coins_spent || 0) }))

  const toggleSort = (key: SortKey) => {
    setSortKey(prev => (prev === key ? prev : key))
    setSortDir(prev => (sortKey === key ? (prev === 'asc' ? 'desc' : 'asc') : 'desc'))
  }

  return (
    <SectionCard
      title={flow === 'spent' ? 'Coins Usage by Feature' : flow === 'credited' ? 'Coins Credits by Source' : 'Coins Inflow vs Outflow by Feature'}
      description={flow === 'spent' ? 'Distribution and totals of coins spent by feature' : flow === 'credited' ? 'Distribution and totals of coins credited by source' : 'Compare coins credited vs spent by feature'}
      isLoading={isLoading}
      error={error ? String(error) : null}
    >
      {/* Controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Feature:</label>
          <select
            className="border rounded-md px-2 py-1 text-sm"
            value={feature}
            onChange={(e) => {
              const val = e.target.value
              setFeature(val)
              setFilters(prev => ({ ...prev, feature: val as any }))
            }}
          >
            <option value="all">All</option>
            {/* derive options from data if present */}
            {Array.from(new Set((data?.by_feature || []).map(r => r.feature))).map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Flow:</label>
          <div className="inline-flex bg-muted/10 rounded-full p-1">
            <button
              className={`px-3 py-1 rounded-full text-sm ${flow === 'spent' ? 'bg-white shadow-sm text-red-600' : 'text-muted-foreground'}`}
              onClick={() => {
                if (flow === 'spent') refetch()
                setFlow('spent')
              }}
            >
              Spending
            </button>
            <button
              className={`px-3 py-1 rounded-full text-sm ${flow === 'credited' ? 'bg-white shadow-sm text-green-600' : 'text-muted-foreground'}`}
              onClick={() => {
                if (flow === 'credited') refetch()
                setFlow('credited')
              }}
            >
              Credits
            </button>
            <button
              className={`px-3 py-1 rounded-full text-sm ${flow === 'both' ? 'bg-white shadow-sm text-slate-700' : 'text-muted-foreground'}`}
              onClick={() => {
                if (flow === 'both') refetch()
                setFlow('both')
              }}
            >
              Both
            </button>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex gap-4 mb-4">
        <div className="px-3 py-2 bg-muted/10 rounded">
          <div className="text-xs text-muted-foreground">Total Spent</div>
          <div className="text-lg font-medium tabular-nums">{(totalSpent || 0).toLocaleString()}</div>
        </div>
        <div className="px-3 py-2 bg-muted/10 rounded">
          <div className="text-xs text-muted-foreground">Total Credited</div>
          <div className="text-lg font-medium tabular-nums">{(totalCredited || 0).toLocaleString()}</div>
        </div>
        <div className="px-3 py-2 bg-muted/10 rounded">
          <div className="text-xs text-muted-foreground">Net</div>
          <div className={`text-lg font-medium tabular-nums ${((totalCredited || 0) - (totalSpent || 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {(((totalCredited || 0) - (totalSpent || 0))).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {flow !== 'both' ? (
          <>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={2}>
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip formatter={(v: any, n: any, p: any) => [v, p?.payload?.name || n]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="feature" tick={{ fontSize: 12 }} width={140} />
                  <Tooltip formatter={(v: any) => [v, flow === 'credited' ? 'Coins Credited' : 'Coins Spent']} />
                  <Bar dataKey={flow === 'credited' ? 'coins_credited' : 'coins_spent'} fill={flow === 'credited' ? CREDIT_COLOR : SPEND_COLOR} name={flow === 'credited' ? 'Coins Credited' : 'Coins Spent'} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          // both: diverging bar chart + side-by-side donuts
          <>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="feature" tick={{ fontSize: 12 }} width={140} />
                  <Tooltip formatter={(v: any, name: any) => [Math.abs(v).toLocaleString(), name]} />
                  {/* spent as negative to the left (mapped to coins_spent_neg) */}
                  <Bar dataKey="coins_spent_neg" fill={SPEND_COLOR} name="Spent" />
                  <Bar dataKey="coins_credited" fill={CREDIT_COLOR} name="Credited" />
                  <ReferenceLine x={0} stroke="#999" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-[320px] flex gap-2">
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={rows.map(r => ({ name: r.feature, value: r.coins_spent || 0 }))} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                      {rows.map((_, i) => (
                        <Cell key={i} fill={SPEND_COLOR} />
                      ))}
                    </Pie>
                    <RTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={rows.map(r => ({ name: r.feature, value: r.coins_credited || 0 }))} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                      {rows.map((_, i) => (
                        <Cell key={i} fill={CREDIT_COLOR} />
                      ))}
                    </Pie>
                    <RTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-md mt-6">
        <table className="min-w-full text-xs">
          <thead className="bg-muted/40">
            {flow !== 'both' ? (
              <tr>
                <th className="px-3 py-2 text-left font-medium cursor-pointer" onClick={() => toggleSort('feature')}>Feature</th>
                <th className="px-3 py-2 text-right font-medium cursor-pointer" onClick={() => toggleSort('coins_spent')}>{flow === 'credited' ? 'Coins Credited' : 'Coins'}</th>
                <th className="px-3 py-2 text-right font-medium cursor-pointer" onClick={() => toggleSort('percentage')}>% Share</th>
                <th className="px-3 py-2 text-right font-medium">Transactions</th>
              </tr>
            ) : (
              <tr>
                <th className="px-3 py-2 text-left font-medium">Feature</th>
                <th className="px-3 py-2 text-right font-medium">Spent</th>
                <th className="px-3 py-2 text-right font-medium">Credited</th>
                <th className="px-3 py-2 text-right font-medium">Net</th>
                <th className="px-3 py-2 text-right font-medium">Spent %</th>
                <th className="px-3 py-2 text-right font-medium">Credited %</th>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.feature} className="odd:bg-background even:bg-muted/20">
                <td className="px-3 py-1.5 whitespace-nowrap">{r.feature}</td>
                {flow !== 'both' ? (
                  <>
                    <td className="px-3 py-1.5 text-right tabular-nums">{((flow === 'credited' ? r.coins_credited : r.coins_spent) || 0).toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{(r.percentage || 0).toFixed(2)}%</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">-</td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-1.5 text-right tabular-nums">{(r.coins_spent || 0).toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{(r.coins_credited || 0).toLocaleString()}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${((r.coins_credited || 0) - (r.coins_spent || 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{(((r.coins_credited || 0) - (r.coins_spent || 0))).toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{(((r.coins_spent || 0) === 0) ? '0.00' : (((r.coins_spent || 0) / (data?.total_coins_spent || rows.reduce((s, rr) => s + (rr.coins_spent || 0), 0))) * 100).toFixed(2))}%</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{(((r.coins_credited || 0) === 0) ? '0.00' : (((r.coins_credited || 0) / (data?.total_coins_credited || rows.reduce((s, rr) => s + (rr.coins_credited || 0), 0))) * 100).toFixed(2))}%</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

export default CoinsByFeature
