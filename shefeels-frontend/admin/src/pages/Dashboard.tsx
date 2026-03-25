import { useEffect, useState, useCallback } from 'react';
import { apiService } from '../services/api';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import KpiCard from '../components/KpiCard';
import FilterBar from '../components/FilterBar';
// ChartCard removed - replaced by inline recharts components
import { GeoRevenueMap } from '../components/GeoRevenueMap';
import { ArpuAovByGeo } from '../components/ArpuAovByGeo';
import { CoinsPurchasedSummary } from '../components/CoinsPurchasedSummary';
import { CoinsByFeature } from '../components/CoinsByFeature';
import { CoinsPurchasedVsSpent } from '../components/CoinsPurchasedVsSpent';
import { CoinsGeoFeature } from '../components/CoinsGeoFeature';
import { FeatureEngagementBreakdown } from '../components/FeatureEngagementBreakdown';
import { TopCharacters } from '../components/TopCharacters';
import { CharacterGeoMonetization } from '../components/CharacterGeoMonetization';
import { TopActiveUsersTable } from '../components/TopActiveUsersTable';
import { PromotionsPerformance } from '../components/PromotionsPerformance';
import { TopSpendersTable } from '../components/TopSpendersTable';
import { UserLtvPanel } from '../components/UserLtvPanel';

export default function Dashboard() {
  const [kpis, setKpis] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [coinsTrends, setCoinsTrends] = useState<any[]>([]);
  const [subscriptionsHistory, setSubscriptionsHistory] = useState<any[]>([]);
  const [revenueTrends, setRevenueTrends] = useState<any[]>([]);
  const [orderStatusCounts, setOrderStatusCounts] = useState<{ success: number; failed: number; refunded: number }>({ success: 0, failed: 0, refunded: 0 });
  const [funnelTotals, setFunnelTotals] = useState<{ visitors: number; signups: number; payers: number }>({ visitors: 0, signups: 0, payers: 0 });
  const [arpuAovSeries, setArpuAovSeries] = useState<any[]>([]);
  const [cohortLtv, setCohortLtv] = useState<any | null>(null);
  const [plansSummary, setPlansSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<any>({});
  const [ltvUserId, setLtvUserId] = useState('');

  const loadKpis = useCallback(async (filt: any) => {
    setLoading(true);
    try {
      const asOfDate = filt?.endDate ? new Date(filt.endDate).toISOString() : new Date().toISOString();
      const period = filt?.interval || 'monthly';
      const startDate = filt?.startDate || '';
      const endDate = filt?.endDate || '';
      const feature = filt?.feature && filt.feature !== 'All Features' ? filt.feature : undefined;
      const plan = filt?.plan && filt.plan !== 'All Plan' ? filt.plan : undefined;

      if (apiService && typeof apiService.getKpiMetrics === 'function') {
        const data = await apiService.getKpiMetrics({ asOfDate, period, startDate, endDate, feature, plan });
        setKpis(data);
      } else {
        setKpis(null);
      }
      // Fetch coins, subscription and revenue trends for additional charts
      try {
        const [coinsRes, subsRes, revenueResp] = await Promise.all([
          apiService.getCoinsTrends(filt?.startDate, filt?.endDate, period, feature, plan),
          apiService.getSubscriptionsHistory(filt?.startDate, filt?.endDate, 'active_count', period),
          apiService.getRevenueTrends({ startDate: filt?.startDate || '', endDate: filt?.endDate || '', interval: period, feature, plan }),
        ]);
        setCoinsTrends(Array.isArray(coinsRes.coin_trends || coinsRes.trends) ? (coinsRes.coin_trends || coinsRes.trends) : []);
        setSubscriptionsHistory(Array.isArray(subsRes.history) ? subsRes.history : []);
        setRevenueTrends(Array.isArray(revenueResp.data) ? revenueResp.data : []);
      } catch (e) {
        console.warn('Failed to fetch additional analytics:', e);
      }

      // Fetch ARPU/AOV series and country funnel + cohort data + plans summary
      try {
        const [arpuResp, funnelResp, subsPlanResp] = await Promise.all([
          apiService.getArpuAovByGeo({ startDate: filt?.startDate, endDate: filt?.endDate, interval: period }),
          apiService.getCountryFunnel({ startDate: filt?.startDate, endDate: filt?.endDate }),
          apiService.getSubscriptionsPlanSummary(filt?.endDate),
        ]);

        // Aggregate ARPU/AOV across geo items into a time series
        const periodMap: Record<string, { period: string; arpu: number; aov: number }> = {};
        if (arpuResp?.items && Array.isArray(arpuResp.items)) {
          for (const item of arpuResp.items) {
            const periods = item.periods || [];
            for (const p of periods) {
              const key = String(p.period || '');
              if (!periodMap[key]) periodMap[key] = { period: key, arpu: 0, aov: 0 };
              periodMap[key].arpu += Number(p.arpu || 0);
              periodMap[key].aov += Number(p.aov || 0);
            }
          }
        }
        const series = Object.values(periodMap).sort((a, b) => a.period.localeCompare(b.period));
        setArpuAovSeries(series);

        // funnel aggregate
        if (funnelResp) {
          const totalVisitors = funnelResp.items.reduce((s: number, r: any) => s + (r.visitors || 0), 0);
          const totalSignups = funnelResp.items.reduce((s: number, r: any) => s + (r.signups || 0), 0);
          const totalPayers = funnelResp.items.reduce((s: number, r: any) => s + (r.payers || 0), 0);
          setFunnelTotals({ visitors: totalVisitors, signups: totalSignups, payers: totalPayers });
        }

        // plans
        if (subsPlanResp && Array.isArray(subsPlanResp.plans || subsPlanResp.items || subsPlanResp)) {
          const rawPlans = subsPlanResp.plans || subsPlanResp.items || subsPlanResp;
          setPlansSummary(Array.isArray(rawPlans) ? rawPlans : []);
        }

        // cohort / LTV attempt (using same method with different endpoint if needed)
        try {
          const cohortResp = await apiService.getRevenueTrends({ startDate: filt?.startDate || '', endDate: filt?.endDate || '', interval: period, feature, plan });
          setCohortLtv(cohortResp || null);
        } catch (e) {
          setCohortLtv(null);
        }
      
        // Orders: use aggregated endpoint for status counts and revenue by period
        try {
          const agg = await apiService.getOrdersAggregate(filt?.startDate, filt?.endDate, period);
          if (agg && agg.status_counts) {
            setOrderStatusCounts({
              success: Number(agg.status_counts.success || 0),
              failed: Number(agg.status_counts.failed || 0),
              refunded: Number(agg.status_counts.refunded || 0),
            });
          }
          if (agg && Array.isArray(agg.revenue_by_period) && agg.revenue_by_period.length) {
            // map to revenueTrends-compatible shape if revenueTrends is empty
            const mapped = agg.revenue_by_period.map((r: any) => ({ period: r.period, total_revenue: Number(r.revenue || 0), coin_revenue: Number(r.revenue || 0) }));
            if (!revenueTrends || revenueTrends.length === 0) setRevenueTrends(mapped);
          }
        } catch (e) {
          console.warn('Failed to fetch aggregated orders:', e);
        }
      } catch (e) {
        console.warn('Failed to fetch arpu/funnel/plans:', e);
      }
    } catch (e) {
      console.warn('Dashboard load error', e);
      setError('Unable to load KPIs');
      // Do not populate dummy/sample data; keep UI empty and show error
      setRevenueData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // initial load
    loadKpis(filters);
  }, [loadKpis]);

  const formatCurrency = (value: any, currency='USD') => {
    if (!value && value !== 0) return '$0.00';
    return new Intl.NumberFormat('en-US', {style: 'currency', currency}).format(value);
  };

  const formatChange = (value: any) => {
    if (!value && value !== 0) return '0.0% vs prev';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}% vs prev`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
      </div>

      {/* Filter Bar */}
      <FilterBar onFilterChange={(f) => { setFilters(f); loadKpis(f); }} />

      {/* KPI Section */}
      <section id="kpis" className="scroll-mt-24">
        <h2 className="text-lg font-semibold text-blue-600 mb-4">Key Performance Indicators</h2>
        
        {loading && (
          <div className="text-gray-600 py-8 text-center">Loading metrics...</div>
        )}
        
        {error && (
          <div className="bg-red-50 text-red-600 rounded-lg p-4 mb-4">{error}</div>
        )}
        
        {!loading && !error && kpis && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard 
              title="ARPU"
              value={formatCurrency(kpis?.ARPU || kpis?.arpu || 0)}
              change={kpis?.previous_period?.ARPU !== undefined && (kpis.ARPU || kpis.arpu) > 0 && kpis.previous_period.ARPU > 0 ? formatChange(((kpis.ARPU || kpis.arpu) - kpis.previous_period.ARPU) / kpis.previous_period.ARPU * 100) : '0.0% vs prev'}
              variant="blue"
            />
            <KpiCard 
              title="Total Revenue"
              value={formatCurrency(kpis?.total_revenue || 0)}
              change={kpis?.previous_period?.total_revenue !== undefined && kpis.total_revenue > 0 && kpis.previous_period.total_revenue > 0 ? formatChange((kpis.total_revenue - kpis.previous_period.total_revenue) / kpis.previous_period.total_revenue * 100) : '0.0% vs prev'}
              variant="dark"
            />
            <KpiCard 
              title="Coin Revenue"
              value={formatCurrency(kpis?.coin_revenue || 0)}
              change={kpis?.previous_period?.coin_revenue !== undefined && kpis.coin_revenue > 0 && kpis.previous_period.coin_revenue > 0 ? formatChange((kpis.coin_revenue - kpis.previous_period.coin_revenue) / kpis.previous_period.coin_revenue * 100) : '0.0% vs prev'}
              variant="blue"
            />
            <KpiCard 
              title="Subscription Revenue"
              value={formatCurrency(kpis?.subscription_revenue || 0)}
              change={kpis?.previous_period?.subscription_revenue !== undefined && kpis.subscription_revenue > 0 && kpis.previous_period.subscription_revenue > 0 ? formatChange((kpis.subscription_revenue - kpis.previous_period.subscription_revenue) / kpis.previous_period.subscription_revenue * 100) : '0.0% vs prev'}
              variant="dark"
            />
            <KpiCard 
              title="Conversion Rate"
              value={`${(kpis?.conversion_rate || 0).toFixed(1)}%`}
              change={kpis?.previous_period?.conversion_rate !== undefined && kpis.conversion_rate > 0 && kpis.previous_period.conversion_rate > 0 ? formatChange((kpis.conversion_rate - kpis.previous_period.conversion_rate) / kpis.previous_period.conversion_rate * 100) : '0.0% vs prev'}
              variant="dark"
            />
            <KpiCard 
              title="Paying Users"
              value={(kpis?.paying_users || 0).toLocaleString()}
              change={kpis?.previous_period?.paying_users !== undefined && kpis.paying_users > 0 && kpis.previous_period.paying_users > 0 ? formatChange((kpis.paying_users - kpis.previous_period.paying_users) / kpis.previous_period.paying_users * 100) : '0.0% vs prev'}
              variant="blue"
            />
            <KpiCard 
              title="Active Users"
              value={(kpis?.active_users || 0).toLocaleString()}
              change={kpis?.previous_period?.active_users !== undefined && kpis.active_users > 0 && kpis.previous_period.active_users > 0 ? formatChange((kpis.active_users - kpis.previous_period.active_users) / kpis.previous_period.active_users * 100) : '0.0% vs prev'}
              variant="dark"
            />
            <KpiCard 
              title="Avg Order Value"
              value={formatCurrency(kpis?.avg_order_value || 0)}
              change={kpis?.previous_period?.avg_order_value !== undefined && kpis.avg_order_value > 0 && kpis.previous_period.avg_order_value > 0 ? formatChange((kpis.avg_order_value - kpis.previous_period.avg_order_value) / kpis.previous_period.avg_order_value * 100) : '0.0% vs prev'}
              variant="blue"
            />
          </div>
        )}
      </section>

      {/* Monetization Overview */}
      <AnchorSection id="monetization" title="Monetization Overview">
        <section id="revenue-trends" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trends</h3>
          <div className="mb-4 flex gap-3">
            <button onClick={() => loadKpis(filters)} className="px-3 py-2 border rounded text-sm">Refresh</button>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueTrends.length ? revenueTrends : revenueData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total_revenue" stroke="#0ea5a4" name="Total Revenue" strokeWidth={2} />
              <Line type="monotone" dataKey="coin_revenue" stroke="#3b82f6" name="Coin Revenue" strokeWidth={2} />
              <Line type="monotone" dataKey="subscription_revenue" stroke="#8b5cf6" name="Subscription Revenue" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </section>
        
        <section id="revenue-geo" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <GeoRevenueMap />
        </section>
        
        <section id="arpu-aov-geo" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <ArpuAovByGeo />
        </section>
        <section id="arpu-aov-series" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">ARPU & AOV Over Time</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={arpuAovSeries}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="arpu" stroke="#ef4444" name="ARPU" strokeWidth={2} />
              <Line type="monotone" dataKey="aov" stroke="#f59e0b" name="AOV" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section id="order-status" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Status Breakdown</h3>
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div style={{ width: 260, height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ name: 'Success', value: orderStatusCounts.success }, { name: 'Failed', value: orderStatusCounts.failed }, { name: 'Refunded', value: orderStatusCounts.refunded }]} dataKey="value" nameKey="name" outerRadius={80} fill="#8884d8">
                    <Cell key="cell-success" fill="#10b981" />
                    <Cell key="cell-failed" fill="#ef4444" />
                    <Cell key="cell-refunded" fill="#f59e0b" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">Total orders sampled: {(orderStatusCounts.success + orderStatusCounts.failed + orderStatusCounts.refunded).toLocaleString()}</p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between"><span>Success</span><strong>{orderStatusCounts.success}</strong></div>
                <div className="flex items-center justify-between"><span>Failed</span><strong>{orderStatusCounts.failed}</strong></div>
                <div className="flex items-center justify-between"><span>Refunded</span><strong>{orderStatusCounts.refunded}</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section id="conversion-funnel" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel (aggregate)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={[{ step: 'Visitors', value: funnelTotals.visitors }, { step: 'Signups', value: funnelTotals.signups }, { step: 'Payers', value: funnelTotals.payers }]}> 
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="step" tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </AnchorSection>

      {/* Coins & Virtual Currency */}
      <AnchorSection id="coins" title="Coins & Virtual Currency">
        <section id="coins-purchased" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <CoinsPurchasedSummary />
        </section>
        
        <section id="coins-by-feature" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <CoinsByFeature />
        </section>
        
        <section id="coins-trends" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <CoinsPurchasedVsSpent />
        </section>
        
        <section id="coins-geo-feature" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <CoinsGeoFeature />
        </section>
      </AnchorSection>

      {/* Engagement & Usage */}
      <AnchorSection id="engagement" title="Engagement & Usage">
        <section id="top-active" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <TopActiveUsersTable />
        </section>
        
        <section id="feature-engagement" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <FeatureEngagementBreakdown />
        </section>
        
        <section id="top-characters" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <TopCharacters />
        </section>
        
        <section id="character-geo" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <CharacterGeoMonetization />
        </section>
      </AnchorSection>

      {/* Subscriptions & Retention */}
      <AnchorSection id="subscriptions" title="Subscriptions & Retention">
        <section id="subscriptions-history" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Subscriptions Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={subscriptionsHistory}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#8b5cf6" name="Active Subscriptions" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section id="cohort-ltv" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cohort LTV (preview)</h3>
          {cohortLtv && cohortLtv.data && Array.isArray(cohortLtv.data) ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cohortLtv.data.periods || cohortLtv.data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip />
                <Legend />
                {/* attempt to plot multiple cohort lines if present */}
                {Array.isArray(cohortLtv.data.cohorts || cohortLtv.data) ? (cohortLtv.data.cohorts || []).map((c: any, idx: number) => (
                  <Line key={`cohort-${idx}`} type="monotone" dataKey={String(c.key || `cohort_${idx}`)} data={c.periods} name={c.key || `Cohort ${idx}`} stroke={['#3b82f6','#ef4444','#f59e0b','#10b981'][idx % 4]} strokeWidth={2} />
                )) : (
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-600">Cohort LTV data unavailable for selected range.</p>
          )}
        </section>
        
        <section id="plans-summary" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Plans Summary</h3>
          {plansSummary && plansSummary.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={plansSummary.map(p => ({ name: p.name || p.plan_name || p.identifier || 'Plan', value: Number(p.active_count || p.count || p.users || 0), revenue: Number(p.revenue || p.total_revenue || 0) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="Active" fill="#8b5cf6" />
                <Bar dataKey="revenue" name="Revenue" fill="#0ea5a4" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-600">No plans summary data available.</p>
          )}
        </section>
        
        <section id="coins-trends-advanced" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Coins Purchased vs Spent</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={coinsTrends}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="coins_purchased" stroke="#3b82f6" name="Purchased" strokeWidth={2} />
              <Line type="monotone" dataKey="coins_spent" stroke="#ef4444" name="Spent" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      </AnchorSection>

      {/* Promotions & Marketing */}
      <AnchorSection id="promotions" title="Promotions & Marketing">
        <section id="promotions-performance" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <PromotionsPerformance />
        </section>
        
        <section id="top-spenders" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <TopSpendersTable />
        </section>
        
        <section id="per-user-ltv" className="scroll-mt-24 bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Lifetime Value Analysis</h3>
            <div className="flex items-center gap-2">
              <input 
                value={ltvUserId} 
                onChange={(e) => setLtvUserId(e.target.value)} 
                placeholder="Enter name or email (optional)" 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                style={{width: 220}} 
              />
              {ltvUserId && (
                <button 
                  className="bg-gray-500 text-white text-sm px-3 py-2 rounded-lg hover:bg-gray-600" 
                  onClick={() => setLtvUserId('')}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            {ltvUserId ? 
              `Viewing detailed analysis for ${ltvUserId} (search by name or email)` : 
              'Showing aggregate LTV data for all users. Enter a name or email above to view individual metrics.'
            }
          </p>
          <UserLtvPanel userQuery={ltvUserId} />
        </section>
      </AnchorSection>
    </div>
  );
}

function AnchorSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="space-y-6 scroll-mt-24">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}
