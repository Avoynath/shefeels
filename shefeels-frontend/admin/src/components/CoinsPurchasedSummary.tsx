import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SectionCard } from './SectionCard'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useFilters } from '../context/FiltersContext'
import { coinsApi, type PurchasesSummaryResponse, type PurchasesBreakdownRow } from '../services/coinsApi.ts'
import { downloadCSV, toCSV } from '../lib/utils'

export function CoinsPurchasedSummary() {
  const { filters, setFilters } = useFilters()
  const startDate = filters.fromISO
  const endDate = filters.toISO
  const interval = filters.interval // use global interval

  const { data, isLoading, error, refetch } = useQuery<PurchasesSummaryResponse>({
    queryKey: ['coins-purchases-summary', startDate, endDate, interval],
    queryFn: () => coinsApi.getPurchasesSummary({ startDate, endDate, interval }),
    enabled: !!startDate && !!endDate,
  })

  // Refetch when navigating to coins section explicitly
  useEffect(() => {
    const handler = () => {
      // Ensure interval has a value (weekly default per prompt)
      let changed = false
      setFilters(prev => {
        if (prev.interval !== 'weekly') { changed = true; return { ...prev, interval: 'weekly' } }
        return prev
      })
      if (!changed) refetch()
    }
    window.addEventListener('dashboard:navigate:coins', handler)
    return () => window.removeEventListener('dashboard:navigate:coins', handler)
  }, [refetch, setFilters])

  const hasBreakdown = Array.isArray(data?.breakdown) && data!.breakdown!.length > 0

  const handleExport = () => {
    if (!hasBreakdown) return
    const csv = toCSV(data!.breakdown!)
    downloadCSV('coins-purchases-breakdown.csv', csv)
  }

  return (
    <SectionCard
      title="Coins Purchased"
      description="Summary of coin purchases for the selected range"
      onExport={hasBreakdown ? handleExport : undefined}
      isLoading={isLoading}
      error={error ? String(error) : null}
    >
      {!data ? null : data.total_purchase_transactions === 0 ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground">No purchases in this period.</div>
      ) : hasBreakdown ? (
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data!.breakdown!.map((r: PurchasesBreakdownRow) => ({ name: r.date, coins_purchased: r.coins_purchased }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => [v, 'Coins Purchased']} />
              <Bar dataKey="coins_purchased" fill="#3b82f6" name="Coins Purchased" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border bg-gradient-to-br from-blue-50 to-white">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Transactions</p>
            <p className="text-3xl font-bold mt-1">{(data.total_purchase_transactions || 0).toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-lg border bg-gradient-to-br from-indigo-50 to-white">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Coins Purchased</p>
            <p className="text-3xl font-bold mt-1">{(data.total_coins_purchased || 0).toLocaleString()}</p>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

export default CoinsPurchasedSummary
