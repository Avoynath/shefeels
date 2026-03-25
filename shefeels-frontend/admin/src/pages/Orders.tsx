import { useEffect, useState, useMemo } from 'react';
import { apiService } from '../services/api';
import Pagination from '../components/Pagination';
import { DatePicker } from '../components/DatePicker';

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [discountTypeFilter, setDiscountTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique countries from orders data
  const uniqueCountries = useMemo(() => {
    const countries = new Set<string>();
    orders.forEach(o => {
      const country = o.country_code;
      if (country) countries.add(country);
    });
    return Array.from(countries).sort();
  }, [orders]);

  // Extract unique cities from orders data (filtered by selected country if applicable)
  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    orders.forEach(o => {
      // If a country is selected, only include cities from that country
      if (countryFilter !== 'all') {
        if (o.country_code !== countryFilter) return;
      }
      if (o.city) cities.add(o.city);
    });
    return Array.from(cities).sort();
  }, [orders, countryFilter]);

  const fetchOrders = async (p = page, pp = perPage, force = false) => {
    setLoading(true);
    try {
      const data = await apiService.getAllOrders(p, pp, { search: searchQuery || undefined, status: statusFilter !== 'all' ? statusFilter : undefined }, force);
      const items = data.items || [];
      // Ensure newest orders are shown first by default
      items.sort((a: any, b: any) => {
        const da = new Date(a.created_at || a.createdAt || a.applied_at).getTime();
        const db = new Date(b.created_at || b.createdAt || b.applied_at).getTime();
        return db - da;
      });
      setOrders(items);
      setTotal(data.total || 0);
      setPage(data.page || p);
      setPerPage(data.per_page || pp);
    } catch (e) {
      console.error('getAllOrders', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  useEffect(() => {
    setPage(1);
    fetchOrders(1, perPage, true);
  }, [searchQuery, discountTypeFilter, statusFilter, perPage]);

  useEffect(() => {
    let filtered = [...orders];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        String(o.user_email || '').toLowerCase().includes(q) ||
        String(o.order_id || '').toLowerCase().includes(q)
      );
    }

    if (discountTypeFilter !== 'all') {
      filtered = filtered.filter(o => o.discount_type === discountTypeFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }

    // Country filter
    if (countryFilter !== 'all') {
      filtered = filtered.filter(o => o.country_code === countryFilter);
    }

    // City filter
    if (cityFilter !== 'all') {
      filtered = filtered.filter(o => o.city === cityFilter);
    }

    // Date filtering (mm/dd/yy format)
    if (fromDate) {
      try {
        const from = new Date(fromDate);
        if (!isNaN(from.getTime())) {
          filtered = filtered.filter(o => {
            const orderDate = new Date(o.created_at);
            return orderDate >= from;
          });
        }
      } catch (e) {
        console.warn('Invalid fromDate:', fromDate);
      }
    }

    if (toDate) {
      try {
        const to = new Date(toDate);
        if (!isNaN(to.getTime())) {
          // Set to end of day
          to.setHours(23, 59, 59, 999);
          filtered = filtered.filter(o => {
            const orderDate = new Date(o.created_at);
            return orderDate <= to;
          });
        }
      } catch (e) {
        console.warn('Invalid toDate:', toDate);
      }
    }

    setFilteredOrders(filtered);
  }, [orders, searchQuery, discountTypeFilter, statusFilter, countryFilter, cityFilter, fromDate, toDate]);

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">Order History</h1>
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
          <select value={discountTypeFilter} onChange={(e) => setDiscountTypeFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">Order Type ↓</option>
            <option value="coin_purchase">Coin Purchase</option>
            <option value="subscription_monthly">Subscription Monthly</option>
            <option value="subscription_quarterly">Subscription Quarterly</option>
            <option value="subscription_semiannual">Subscription Semiannual</option>
            <option value="subscription_annual">Subscription Annual</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">Status ↓</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
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
            onClick={() => {
              setDiscountTypeFilter('all');
              setStatusFilter('all');
              setFromDate('');
              setToDate('');
              setCountryFilter('all');
              setCityFilter('all');
              setSearchQuery('');
            }}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Merchant Transaction ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Merchant Payment ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created At</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={12} className="px-6 py-12 text-center text-gray-500">Loading orders...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={12} className="px-6 py-12 text-center text-gray-500">No orders found</td></tr>
              ) : (
                filteredOrders.map((order, idx) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{idx + 1}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{order.user_email || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{order.order_id || order.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{order.tagada_transaction_id || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{order.tagada_payment_id || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">${(order.subtotal_at_apply || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${order.status === 'success' || order.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : order.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                        }`}>
                        {order.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.discount_type || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{order.discount || 0}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.country_code || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.city || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.created_at ? new Date(order.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} perPage={perPage} total={total} onPageChange={(p) => { setPage(p); fetchOrders(p, perPage); }} onPerPageChange={(pp) => { setPerPage(pp); setPage(1); fetchOrders(1, pp); }} />
    </div>
  );
}
