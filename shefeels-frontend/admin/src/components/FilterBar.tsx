import { useEffect, useState } from 'react'
import { DatePicker } from './DatePicker'

interface Filters {
  range: '7 Days' | '30 Days' | '90 Days' | 'All Time';
  feature: 'All Features' | string;
  plan: 'All Plan' | string;
  interval: 'monthly' | 'weekly' | 'daily' | 'quarterly' | 'yearly';
  startDate?: string; // ISO yyyy-mm-dd
  endDate?: string; // ISO yyyy-mm-dd
}

interface FilterBarProps {
  initial?: Partial<Filters>;
  onFilterChange?: (filters: Filters) => void;
}

export default function FilterBar({ initial, onFilterChange }: FilterBarProps) {
  const today = new Date()
  const defaultEnd = today.toISOString().slice(0, 10)
  const defaultStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [filters, setFilters] = useState<Filters>({
    range: '7 Days',
    feature: 'All Features',
    plan: 'All Plan',
    interval: 'monthly',
    startDate: defaultStart,
    endDate: defaultEnd,
    ...initial,
  })

  useEffect(() => {
    onFilterChange?.(filters)
  }, [])

  const update = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch }
    setFilters(next)
    onFilterChange?.(next)
  }

  const handleRangeChange = (range: Filters['range']) => {
    const today = new Date()
    let start: string | undefined = undefined
    if (range === 'All Time') {
      start = ''
    } else if (range === '7 Days') {
      start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    } else if (range === '30 Days') {
      start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    } else if (range === '90 Days') {
      start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    }
    const end = today.toISOString().slice(0, 10)
    update({ range, startDate: start, endDate: end })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <select value={filters.range} onChange={(e) => handleRangeChange(e.target.value as Filters['range'])}
        className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option>7 Days</option>
        <option>30 Days</option>
        <option>90 Days</option>
        <option>All Time</option>
      </select>

      <select value={filters.feature} onChange={(e) => update({ feature: e.target.value })}
        className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option>All Features</option>
        <option>Chat</option>
        <option>Image Generation</option>
        <option>Voice</option>
      </select>

      <select value={filters.plan} onChange={(e) => update({ plan: e.target.value })}
        className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option>All Plan</option>
        <option>Free</option>
        <option>Premium</option>
      </select>

      <select value={filters.interval} onChange={(e) => update({ interval: e.target.value as Filters['interval'] })}
        className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="quarterly">Quarterly</option>
        <option value="yearly">Yearly</option>
      </select>

      <div className="flex items-center gap-2 ml-auto">
        <DatePicker
          value={filters.startDate}
          onChange={(date) => update({ startDate: date })}
          placeholder="From"
          className="w-36"
          maxDate={filters.endDate ? new Date(filters.endDate) : undefined}
        />
        <DatePicker
          value={filters.endDate}
          onChange={(date) => update({ endDate: date })}
          placeholder="To"
          className="w-36"
          minDate={filters.startDate ? new Date(filters.startDate) : undefined}
        />
      </div>
    </div>
  )
}
