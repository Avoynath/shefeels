import { useEffect, useState, useMemo } from 'react';
import { apiService } from '../services/api';
import Pagination from '../components/Pagination';
import { DatePicker } from '../components/DatePicker';

export default function CoinTransactions() {
  const [txns, setTxns] = useState<any[]>([]);
  const [allTxns, setAllTxns] = useState<any[]>([]); // Store all transactions for extracting unique filter values
  const [filteredTxns, setFilteredTxns] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');

  // Extract unique source types from data
  const uniqueSourceTypes = useMemo(() => {
    const sourceTypes = new Set<string>();
    allTxns.forEach(t => {
      const sourceType = t.source_type || t.type;
      if (sourceType) sourceTypes.add(sourceType);
    });
    return Array.from(sourceTypes).sort();
  }, [allTxns]);

  // Extract unique countries from data
  const uniqueCountries = useMemo(() => {
    const countries = new Set<string>();
    allTxns.forEach(t => {
      const country = t.country_code || t.country;
      if (country) countries.add(country);
    });
    return Array.from(countries).sort();
  }, [allTxns]);

  // Extract unique cities from data (filtered by selected country if applicable)
  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    allTxns.forEach(t => {
      // If a country is selected, only include cities from that country
      if (countryFilter !== 'all') {
        const txnCountry = t.country_code || t.country;
        if (txnCountry !== countryFilter) return;
      }
      if (t.city) cities.add(t.city);
    });
    return Array.from(cities).sort();
  }, [allTxns, countryFilter]);

  const fetchTxns = async (p = 1, pp = perPage) => {
    try {
      setLoading(true);
      const filters: Record<string, any> = {};
      if (searchQuery) {
        filters.search = searchQuery;
        // Also apply search as email filter for email-specific searches
        filters.user_email = searchQuery;
      }
      if (transactionTypeFilter && transactionTypeFilter !== 'all') filters.transaction_type = transactionTypeFilter;
      if (sourceTypeFilter && sourceTypeFilter !== 'all') filters.source_type = sourceTypeFilter;
      if (fromDate) filters.start_date = fromDate;
      if (toDate) filters.end_date = toDate;
      if (countryFilter && countryFilter !== 'all') filters.country = countryFilter;
      if (cityFilter && cityFilter !== 'all') filters.city = cityFilter;

      const data = await apiService.getAllCoinTransactions(p, pp, filters);
      const items = data.items || [];
      setTxns(items);
      // Store all transactions for dynamic filter options
      // On initial load (no filters), store all items for filter options
      if (!searchQuery && transactionTypeFilter === 'all' && sourceTypeFilter === 'all' &&
        !fromDate && !toDate && countryFilter === 'all' && cityFilter === 'all') {
        setAllTxns(prev => {
          // Merge new items with existing ones to build up the filter options
          const existingIds = new Set(prev.map(t => t.id));
          const newItems = items.filter((t: any) => !existingIds.has(t.id));
          return [...prev, ...newItems];
        });
      }
      setTotal(data.total || 0);
      setPage(data.page || p);
      setPerPage(data.per_page || pp);
    } catch (e) {
      console.error('getAllCoinTransactions', e);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch to populate filter options
  useEffect(() => {
    const fetchAllForFilters = async () => {
      try {
        // Fetch a larger batch to get diverse filter options
        const data = await apiService.getAllCoinTransactions(1, 100, {});
        setAllTxns(data.items || []);
      } catch (e) {
        console.error('fetchAllForFilters', e);
      }
    };
    fetchAllForFilters();
  }, []);

  useEffect(() => {
    // initial load
    fetchTxns(page, perPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // refetch when filters or perPage change, reset to page 1
    setPage(1);
    fetchTxns(1, perPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, transactionTypeFilter, sourceTypeFilter, fromDate, toDate, countryFilter, cityFilter, perPage]);

  // Reset city filter when country changes
  useEffect(() => {
    setCityFilter('all');
  }, [countryFilter]);

  // Apply client-side filtering for display
  useEffect(() => {
    let filtered = [...txns];

    // Country filter
    if (countryFilter !== 'all') {
      filtered = filtered.filter(t => (t.country_code || t.country) === countryFilter);
    }

    // City filter
    if (cityFilter !== 'all') {
      filtered = filtered.filter(t => t.city === cityFilter);
    }

    // Source type filter
    if (sourceTypeFilter !== 'all') {
      filtered = filtered.filter(t => (t.source_type || t.type) === sourceTypeFilter);
    }

    setFilteredTxns(filtered);
  }, [txns, countryFilter, cityFilter, sourceTypeFilter]);

  const resetFilters = () => {
    setSearchQuery('');
    setTransactionTypeFilter('all');
    setSourceTypeFilter('all');
    setFromDate('');
    setToDate('');
    setCountryFilter('all');
    setCityFilter('all');
  };

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">Coin Transactions</h1>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by email"
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <select value={transactionTypeFilter} onChange={(e) => setTransactionTypeFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">Transaction Type ↓</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
          </select>

          <select
            value={sourceTypeFilter}
            onChange={(e) => setSourceTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Source Type ↓</option>
            {uniqueSourceTypes.map(sourceType => (
              <option key={sourceType} value={sourceType}>
                {sourceType.charAt(0).toUpperCase() + sourceType.slice(1).replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <DatePicker value={fromDate} onChange={(date) => setFromDate(date)} placeholder="From Date" className="w-36" maxDate={toDate ? new Date(toDate) : undefined} />
          <DatePicker value={toDate} onChange={(date) => setToDate(date)} placeholder="To Date" className="w-36" minDate={fromDate ? new Date(fromDate) : undefined} />

          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="w-28 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Country ↓</option>
            {uniqueCountries.map(country => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">City ↓</option>
            {uniqueCities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>

          <button
            onClick={resetFilters}
            className="px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">S.No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created At</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">

              {loading ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">Loading transactions...</td></tr>
              ) : filteredTxns.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">No transactions found</td></tr>
              ) : (
                filteredTxns.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{(page - 1) * perPage + idx + 1}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{t.user_email || t.user_id || '—'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${t.transaction_type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {t.transaction_type || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{t.source_type || t.type || '—'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{t.coins ?? t.amount ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{t.country_code || t.country || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{t.city || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{t.created_at ? new Date(t.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={(p) => { setPage(p); fetchTxns(p, perPage); }}
        onPerPageChange={(pp) => { setPerPage(pp); setPage(1); fetchTxns(1, pp); }}
      />
    </div>
  );
}
