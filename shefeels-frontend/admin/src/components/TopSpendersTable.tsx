import React, { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SectionCard } from './SectionCard'
import { useFilters } from '../context/FiltersContext'
import { marketingApi, type SimpleTopSpenderData } from '../services/marketingApi'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

type SortField = 'user_name' | 'user_email' | 'total_revenue' | 'coins_spent'
type SortDirection = 'asc' | 'desc'

function currency(n: number, cur = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n || 0)
}

export const TopSpendersTable: React.FC = () => {
  const { filters } = useFilters()
  const [sortField, setSortField] = useState<SortField>('total_revenue')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['users-top-spenders', filters.fromISO, filters.toISO],
    queryFn: () => marketingApi.getTopSpendersSimple({ 
      startDate: filters.fromISO, 
      endDate: filters.toISO, 
      limit: 20 
    }),
    enabled: Boolean(filters.fromISO && filters.toISO),
  })

  // Aggregate metrics for all users (LTV style totals)
  const { data: aggregateData, error: aggError } = useQuery({
    queryKey: ['aggregate-ltv', filters.fromISO, filters.toISO],
    queryFn: () => marketingApi.getAggregateLtv({ startDate: filters.fromISO, endDate: filters.toISO }),
    enabled: Boolean(filters.fromISO && filters.toISO),
  })

  useEffect(() => {
    const onRefetch = () => refetch()
    window.addEventListener('dashboard:promotions:refetch', onRefetch)
    return () => window.removeEventListener('dashboard:promotions:refetch', onRefetch)
  }, [refetch])

  const sortedData = useMemo(() => {
    if (!data?.top_spenders) return []
    
    const spenders = [...data.top_spenders] as SimpleTopSpenderData[]
    
    spenders.sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]

      // Normalize undefined/null
      if (aValue == null) aValue = (typeof bValue === 'string') ? '' : 0
      if (bValue == null) bValue = (typeof aValue === 'string') ? '' : 0

      // If values are strings, compare case-insensitively
      if (typeof aValue === 'string' || typeof bValue === 'string') {
        const as = String(aValue).toLowerCase()
        const bs = String(bValue).toLowerCase()
        if (sortDirection === 'asc') return as < bs ? -1 : as > bs ? 1 : 0
        return as > bs ? -1 : as < bs ? 1 : 0
      }

      // Numeric compare
      const an = Number(aValue || 0)
      const bn = Number(bValue || 0)
      if (sortDirection === 'asc') return an - bn
      return bn - an
    })
    
    return spenders
  }, [data, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-4 h-4 text-gray-400" />
    }
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4 text-blue-600" /> : 
      <ChevronDown className="w-4 h-4 text-blue-600" />
  }

  return (
    <SectionCard
      title="Top Spenders"
      description="Leaderboard of users by total revenue and coins spent"
      isLoading={isLoading}
      error={error ? String(error) : null}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="text-xs text-gray-500">
          Range: {data?.start_date || filters.fromISO} → {data?.end_date || filters.toISO}
        </div>
        <div className="text-xs text-gray-500">
          Total records: {sortedData.length}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleSort('user_name')}
              >
                <div className="flex items-center gap-2">
                  Name
                  {getSortIcon('user_name')}
                </div>
              </TableHead>
              <TableHead className="hidden md:table-cell cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleSort('user_email')}>
                <div className="flex items-center gap-2">
                  Email
                  {getSortIcon('user_email')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50 transition-colors text-right"
                onClick={() => handleSort('total_revenue')}
              >
                <div className="flex items-center justify-end gap-2">
                  Total Revenue
                  {getSortIcon('total_revenue')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50 transition-colors text-right"
                onClick={() => handleSort('coins_spent')}
              >
                <div className="flex items-center justify-end gap-2">
                  Coins Spent
                  {getSortIcon('coins_spent')}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  No data available for the selected period
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((spender, index) => (
                <TableRow key={spender.user_id} className="hover:bg-gray-50/50">
                  <TableCell className="font-medium text-gray-600">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    {spender.user_name || spender.user_id}
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs text-gray-600">
                    {spender.user_email || '—'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {currency(spender.total_revenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {spender.coins_spent.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary Statistics: split into Top Spenders vs All Users */}
      {sortedData.length > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Top Spenders (shown above)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-gray-500">Total Revenue:</span>
                <div className="font-semibold">
                  {currency(sortedData.reduce((sum, s) => sum + s.total_revenue, 0))}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Total Coins Spent:</span>
                <div className="font-semibold">
                  {sortedData.reduce((sum, s) => sum + s.coins_spent, 0).toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Avg Revenue per User:</span>
                <div className="font-semibold">
                  {currency(sortedData.reduce((sum, s) => sum + s.total_revenue, 0) / sortedData.length)}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Avg Coins per User:</span>
                <div className="font-semibold">
                  {Math.round(sortedData.reduce((sum, s) => sum + s.coins_spent, 0) / sortedData.length).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">All Users (aggregate)</h4>
            {aggError ? (
              <div className="text-xs text-red-600">Unable to load aggregate metrics</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Average LTV:</span>
                  <div className="font-semibold">
                    {currency((aggregateData?.average_ltv) || 0)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Total Revenue (all users):</span>
                  <div className="font-semibold">
                    {currency((aggregateData?.total_revenue_all_users) || 0)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Total Users:</span>
                  <div className="font-semibold">
                    {(aggregateData?.total_users || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Avg Coins per User:</span>
                  <div className="font-semibold">
                    {/* Approximate avg coins per user from top-spenders data only if aggregate not available */}
                    {Math.round(sortedData.reduce((sum, s) => sum + s.coins_spent, 0) / sortedData.length).toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  )
}

export default TopSpendersTable
