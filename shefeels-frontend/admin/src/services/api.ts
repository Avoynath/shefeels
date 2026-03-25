import axios from 'axios';
import { toast } from 'react-hot-toast';

const BASE = (import.meta.env.VITE_API_BASE_URL || '') as string;

function buildBase() {
	if (BASE && BASE !== '') return BASE.replace(/\/$/, '');
	if (typeof window !== 'undefined') return `${window.location.origin}/api/v1`;
	return '';
}

const baseURL = buildBase();
console.log('[API] Base URL:', baseURL);

const instance = axios.create({
	baseURL,
	withCredentials: true,
});

// Add auth token interceptor
instance.interceptors.request.use((config) => {
	try {
		const stored = localStorage.getItem('pornily:auth:token') ||
			localStorage.getItem('pornily:auth:access_token') ||
			localStorage.getItem('access_token');
		if (stored) {
			const tokenOnly = stored.replace(/^bearer\s+/i, '').trim();
			config.headers['Authorization'] = `Bearer ${tokenOnly}`;
		}
	} catch (e) {
		console.error('Auth token error:', e);
	}
	return config;
}, (error) => {
	return Promise.reject(error);
});

// Add response interceptor for error handling
instance.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response?.status === 401) {
			console.error('Unauthorized - clearing auth');
			try {
				localStorage.removeItem('pornily:auth:token');
				localStorage.removeItem('pornily:auth:access_token');
				localStorage.removeItem('access_token');
				localStorage.removeItem('pornily:auth:raw');
			} catch (e) { }
		}

		// Toast Error Handling
		const status = error.response?.status;
		const data = error.response?.data;

		if (status && status >= 400 && status < 500) {
			// 4xx: Try to show 'detail' if present
			if (data?.detail) {
				toast.error(data.detail);
			}
		} else if (status && status >= 500) {
			// 5xx: Generic message
			toast.error('Something went wrong. Please try again later.');
		}

		console.error('API Error:', error.response?.data || error.message);
		return Promise.reject(error);
	}
);

export type PaginatedCharacters = { items: any[]; total: number; page: number; per_page: number };

class APIService {
	// Users
	async getUsers(page = 1, per_page = 20, filters: Record<string, any> = {}, forceRefresh: boolean = false) {
		try {
			console.log('[API] Fetching users...', { page, per_page, filters });
			const params: Record<string, string> = { _t: String(Date.now()), page: String(page), per_page: String(per_page) };
			if (filters.search) params.search = String(filters.search);
			if (filters.role) params.role = String(filters.role);
			if (filters.status) params.status = String(filters.status);
			if (filters.is_active !== undefined) params.is_active = String(filters.is_active);
			const qs = new URLSearchParams(params).toString();
			const endpoint = forceRefresh ? `/admin/users/all-users?${qs}&_t=${Date.now()}` : `/admin/users/all-users?${qs}`;
			const res = await instance.get(endpoint);
			const raw = res.data;
			// Backend may return either a paginated object { items, total, page, per_page }
			// or a plain array of users. Handle both shapes.
			if (Array.isArray(raw)) {
				return {
					items: raw,
					total: raw.length,
					page: page,
					per_page: per_page,
				};
			}
			const safe = raw || {};
			// Log a small sample of raw users so we can debug missing status cases
			try {
				const sample = (safe.items || safe.users || Array.isArray(safe) ? (safe.items || safe.users || safe).slice(0, 5) : []).map((x: any) => x);
				console.log('[API] Raw users sample:', sample);
			} catch (e) {
				// ignore logging errors
			}

			// Normalize user items so `status` is present when possible
			const rawItems = safe.items || safe.users || [];
			const items = (rawItems || []).map((u: any) => {
				const normalized = { ...u };

				// Candidate fields that may contain status information
				const candidates = [
					normalized.status,
					normalized.account_status,
					normalized.accountStatus,
					normalized.user_status,
					normalized.userStatus,
					normalized.state,
					normalized.accountState,
					normalized.status_text,
					normalized.statusText,
					normalized.active,
				];

				let statusVal: any = undefined;
				for (const c of candidates) {
					if (c === undefined || c === null) continue;
					const s = String(c).trim();
					if (s === '' || s === '-' || s.toLowerCase() === 'unknown') continue;
					statusVal = s;
					break;
				}

				// Fall back to boolean flags
				if (statusVal === undefined) {
					if (normalized.is_active === true || normalized.active === true || normalized.isActive === true) statusVal = 'active';
					else if (normalized.is_active === false || normalized.active === false || normalized.isActive === false) statusVal = 'banned';
				}

				if (statusVal !== undefined) {
					const s = String(statusVal).toLowerCase();
					if (s === '1' || s === 'true' || s === 'yes') normalized.status = 'active';
					else if (s === '0' || s === 'false' || s === 'no') normalized.status = 'banned';
					else normalized.status = s;
				}

				return normalized;
			});

			return {
				items,
				total: Number(safe.total || safe.count || items.length) || 0,
				page: Number(safe.page) || page,
				per_page: Number(safe.per_page) || per_page,
			};
		} catch (error) {
			console.error('[API] Failed to fetch users:', error);
			throw error;
		}
	}

	async createUser(payload: { email: string; full_name: string; role: string; password?: string }) {
		const res = await instance.post('/admin/users/create', payload);
		return res.data;
	}

	async editUser(userId: string, data: { full_name?: string; role?: string; is_active?: boolean }) {
		const res = await instance.put(`/admin/users/edit/${userId}`, data);
		return res.data;
	}

	async deleteUser(userId: string) {
		const res = await instance.post(`/admin/users/delete/${userId}`);
		return res.data;
	}

	async activateUser(userId: string) {
		const res = await instance.post(`/admin/users/activate/${userId}`);
		return res.data;
	}

	async deactivateUser(userId: string) {
		const res = await instance.post(`/admin/users/deactivate/${userId}`);
		return res.data;
	}

	async addCoins(userId: string, coins: number) {
		const res = await instance.post('/admin/users/add-subscription-coin', { user_id: userId, coins });
		return res.data;
	}

	async getUserActivityLogs(userId: string, logType?: string, page = 1, pageSize = 50, search?: string) {
		const params: Record<string, string> = { page: String(page), page_size: String(pageSize) };
		if (logType) params.log_type = logType;
		if (search) params.search = search;
		const res = await instance.get(`/admin/users/${userId}/activity-logs`, { params });
		return res.data;
	}

	async deleteUserChatLog(userId: string, chatId: string) {
		const res = await instance.delete(`/admin/users/${userId}/chat-logs/${chatId}`);
		return res.data;
	}

	async deleteUserGenerationLog(userId: string, logId: string) {
		const res = await instance.delete(`/admin/users/${userId}/generation-logs/${logId}`);
		return res.data;
	}

	// Characters
	async getCharacters(page = 1, per_page = 20, filters: Record<string, any> = {}): Promise<PaginatedCharacters> {
		const params: Record<string, string> = { _t: String(Date.now()), page: String(page), per_page: String(per_page) };
		if (filters.search) params.search = String(filters.search);
		if (filters.character_name) params.character_name = String(filters.character_name);
		if (filters.created_by) params.created_by = String(filters.created_by);
		if (filters.style) params.style = String(filters.style);
		if (filters.gender) params.gender = String(filters.gender);
		if (filters.user_id !== undefined && filters.user_id !== null && String(filters.user_id) !== '') params.user_id = String(filters.user_id);
		if (filters.start_date) params.start_date = String(filters.start_date);
		if (filters.end_date) params.end_date = String(filters.end_date);

		const qs = new URLSearchParams(params).toString();
		const res = await instance.get(`/admin/characters/get-all?${qs}`);
		const raw = res.data || {};
		return {
			items: raw.items || [],
			total: Number(raw.total) || 0,
			page: Number(raw.page) || page,
			per_page: Number(raw.per_page) || per_page,
		};
	}

	async getPresignedUrlsByIds(payload: Record<string, string>) {
		const res = await instance.post('/admin/characters/presigned-urls-by-ids', payload);
		return res.data || {};
	}

	async editCharacter(characterId: string, payload: Record<string, any>) {
		const res = await instance.post('/characters/edit-by-id', { ...payload, character_id: characterId });
		return res.data;
	}

	async createCharacter(payload: Record<string, any>) {
		const res = await instance.post('/characters/create', payload);
		return res.data;
	}

	async deleteCharacter(characterId: string) {
		const res = await instance.post(`/admin/characters/${characterId}/delete`);
		return res.data;
	}

	// Engagement & Analytics
	async getEngagementStats(userId: string) {
		try {
			console.log('[API] Fetching engagement stats for user:', userId);
			const res = await instance.get('/admin/users/engagement-stats', {
				params: { user_id: userId }
			});
			return res.data;
		} catch (error) {
			console.error('[API] Failed to fetch engagement stats:', error);
			throw error;
		}
	}

	async getKpiMetrics(opts: { asOfDate?: string; period?: string; startDate?: string; endDate?: string; feature?: string; plan?: string } = {}) {
		try {
			console.log('[API] Fetching KPI metrics...');
			const params: Record<string, any> = {
				as_of_date: opts.asOfDate || new Date().toISOString(),
				interval: opts.period || 'monthly',
			};
			if (opts.startDate) params.start_date = opts.startDate;
			if (opts.endDate) params.end_date = opts.endDate;
			if (opts.feature) params.feature = opts.feature;
			if (opts.plan) params.plan = opts.plan;
			const res = await instance.get('/admin/dashboard/metrics/summary', { params });
			console.log('[API] KPI response:', res.data);
			return res.data;
		} catch (error) {
			console.error('[API] Failed to fetch KPI metrics:', error);
			throw error;
		}
	}

	// Pricing management
	async getPricingPlans() {
		try {
			console.log('[API] Fetching pricing plans...');
			const res = await instance.get('/subscription/get-pricing');
			console.log('[API] Pricing plans response:', res.data);
			return res.data || [];
		} catch (error) {
			console.error('[API] Failed to fetch pricing plans:', error);
			throw error;
		}
	}

	async getCoinPricing() {
		try {
			console.log('[API] Fetching coin pricing...');
			const res = await instance.get('/subscription/get-coin-pricing');
			return res.data || [];
		} catch (error) {
			console.error('[API] Failed to fetch coin pricing:', error);
			throw error;
		}
	}

	async createPricingPlan(planData: Record<string, any>) {
		const res = await instance.post('/admin/pricing/create-pricing', planData);
		return res.data;
	}

	async updatePricingPlan(identifier: string, updates: Record<string, any>) {
		const res = await instance.put(`/admin/pricing/edit-pricing/${encodeURIComponent(String(identifier))}`, updates);
		return res.data;
	}

	async deletePricingPlan(pricingId: string) {
		const res = await instance.delete(`/admin/pricing/delete-pricing/${encodeURIComponent(String(pricingId))}`);
		return res.data;
	}

	// Promo management (paginated version is below)

	async createPromo(data: Record<string, any>) {
		const res = await instance.post('/admin/promo/create', data);
		return res.data;
	}

	async updatePromo(promoId: string, data: Record<string, any>) {
		const res = await instance.put(`/admin/promo/edit/${promoId}`, data);
		return res.data;
	}

	async deletePromo(promoId: string) {
		const res = await instance.delete(`/admin/promo/delete/${promoId}`);
		return res.data;
	}

	// Config/Settings
	async getConfigs() {
		const res = await instance.get('/admin/configs/');
		return res.data || [];
	}

	async createConfig(data: { parameter_name: string; parameter_value: string; parameter_description: string; category: string }) {
		const res = await instance.post('/admin/configs/create', data);
		return res.data;
	}

	async updateConfig(id: string, data: { parameter_value: string; parameter_description: string }) {
		const res = await instance.put(`/admin/configs/edit/${id}`, data);
		return res.data;
	}

	async deleteConfig(id: string) {
		const res = await instance.delete(`/admin/configs/delete/${id}`);
		return res.data;
	}

	// Orders & Transactions
	async getAllOrders(page = 1, per_page = 20, filters: Record<string, any> = {}, force: boolean = false) {
		const params: Record<string, string> = { _t: String(Date.now()), page: String(page), per_page: String(per_page) };
		if (filters.search) params.search = String(filters.search);
		if (filters.status) params.status = String(filters.status);
		const qs = new URLSearchParams(params).toString();
		try {
			const endpoint = force ? `/admin/pricing/all-orders?${qs}&_t=${Date.now()}` : `/admin/pricing/all-orders?${qs}`;
			const res = await instance.get(endpoint);
			const raw = res.data || {};
			return {
				items: raw.items || raw.orders || (Array.isArray(raw) ? raw : []),
				total: Number(raw.total || raw.count || (Array.isArray(raw) ? raw.length : 0)) || 0,
				page: Number(raw.page) || page,
				per_page: Number(raw.per_page) || per_page,
			};
		} catch (e) {
			console.error('[API] getAllOrders failed, falling back to array', e);
			const res = await instance.get('/admin/pricing/all-orders');
			const arr = res.data || [];
			return { items: Array.isArray(arr) ? arr : [], total: Array.isArray(arr) ? arr.length : 0, page, per_page };
		}
	}

	// Orders aggregation: status counts and revenue by period
	async getOrdersAggregate(startDate?: string, endDate?: string, interval = 'monthly') {
		const params: Record<string, string> = { interval };
		if (startDate) params.start_date = startDate;
		if (endDate) params.end_date = endDate;
		const res = await instance.get('/admin/dashboard/orders/aggregate', { params });
		return res.data;
	}

	async getAllCoinTransactions(page = 1, per_page = 20, filters: Record<string, any> = {}, force: boolean = false) {
		const params: Record<string, string> = { _t: String(Date.now()), page: String(page), per_page: String(per_page) };
		if (filters.search) params.search = String(filters.search);
		if (filters.transaction_type) params.transaction_type = String(filters.transaction_type);
		if (filters.source_type) params.source_type = String(filters.source_type);
		if (filters.start_date) params.start_date = String(filters.start_date);
		if (filters.end_date) params.end_date = String(filters.end_date);
		if (filters.user_email) params.user_email = String(filters.user_email);
		if (filters.country) params.country = String(filters.country);
		if (filters.city) params.city = String(filters.city);
		const qs = new URLSearchParams(params).toString();
		try {
			const endpoint = force ? `/admin/pricing/all-coin-transactions?${qs}&_t=${Date.now()}` : `/admin/pricing/all-coin-transactions?${qs}`;
			const res = await instance.get(endpoint);
			const raw = res.data || {};
			return {
				items: raw.items || raw.transactions || (Array.isArray(raw) ? raw : []),
				total: Number(raw.total || raw.count || (Array.isArray(raw) ? raw.length : 0)) || 0,
				page: Number(raw.page) || page,
				per_page: Number(raw.per_page) || per_page,
			};
		} catch (e) {
			console.error('[API] getAllCoinTransactions failed, falling back', e);
			const res = await instance.get('/admin/pricing/all-coin-transactions');
			const arr = res.data || [];
			return { items: Array.isArray(arr) ? arr : [], total: Array.isArray(arr) ? arr.length : 0, page, per_page };
		}
	}

	// Contact messages
	async getContactMessages(page = 1, per_page = 20, filters: Record<string, any> = {}, force: boolean = false) {
		const params: Record<string, string> = { _t: String(Date.now()), page: String(page), per_page: String(per_page) };
		if (filters.status) params.status = String(filters.status);
		if (filters.search) params.search = String(filters.search);
		const qs = new URLSearchParams(params).toString();
		try {
			const endpoint = force ? `/admin/contact-messages?${qs}&_t=${Date.now()}` : `/admin/contact-messages?${qs}`;
			const res = await instance.get(endpoint);
			const raw = res.data || {};
			return {
				items: raw.items || raw.messages || (Array.isArray(raw) ? raw : []),
				total: Number(raw.total || raw.count || (Array.isArray(raw) ? raw.length : 0)) || 0,
				page: Number(raw.page) || page,
				per_page: Number(raw.per_page) || per_page,
			};
		} catch (e) {
			console.error('[API] getContactMessages failed, falling back', e);
			const res = await instance.get('/admin/contact-messages');
			const arr = res.data?.messages || res.data || [];
			return { items: Array.isArray(arr) ? arr : [], total: Array.isArray(arr) ? arr.length : 0, page, per_page };
		}
	}

	// Promos (paginated)
	async getPromos(page = 1, per_page = 20, filters: Record<string, any> = {}, force: boolean = false) {
		const params: Record<string, string> = { _t: String(Date.now()), page: String(page), per_page: String(per_page) };
		if (filters.search) params.search = String(filters.search);
		const qs = new URLSearchParams(params).toString();
		try {
			const endpoint = force ? `/subscription/get-promo?${qs}&_t=${Date.now()}` : `/subscription/get-promo?${qs}`;
			const res = await instance.get(endpoint);
			const raw = res.data || {};
			return {
				items: raw.items || raw.promos || (Array.isArray(raw) ? raw : []),
				total: Number(raw.total || raw.count || (Array.isArray(raw) ? raw.length : 0)) || 0,
				page: Number(raw.page) || page,
				per_page: Number(raw.per_page) || per_page,
			};
		} catch (e) {
			console.error('[API] getPromos failed, falling back', e);
			const res = await instance.get('/subscription/get-promo');
			const arr = res.data || [];
			return { items: Array.isArray(arr) ? arr : [], total: Array.isArray(arr) ? arr.length : 0, page, per_page };
		}
	}

	// AI generation logs
	async getAIGenerationLogs(page = 1, per_page = 20, filters: Record<string, any> = {}, force: boolean = false) {
		const params: Record<string, string> = { page: String(page), page_size: String(per_page) };
		if (filters.user_id) params.user_id = String(filters.user_id);
		if (filters.search) params.search_prompt = String(filters.search);
		if (filters.generation_type) params.generation_type = String(filters.generation_type);
		if (filters.status) params.status = String(filters.status);
		if (filters.start_date) params.start_date = String(filters.start_date);
		if (filters.end_date) params.end_date = String(filters.end_date);
		const qs = new URLSearchParams(params).toString();
		try {
			const endpoint = `/admin/ai-generations/logs?${qs}`;
			const res = await instance.get(endpoint);
			const raw = res.data || {};
			return {
				items: raw.logs || (Array.isArray(raw) ? raw : []),
				total: Number(raw.total) || 0,
				page: Number(raw.page) || page,
				per_page: Number(raw.page_size) || per_page,
			};
		} catch (e) {
			console.error('[API] getAIGenerationLogs failed:', e);
			return { items: [], total: 0, page, per_page };
		}
	}

	// APIs management listing (if present)
	async getAPIs(page = 1, per_page = 20, filters: Record<string, any> = {}, force: boolean = false) {
		const params: Record<string, string> = { _t: String(Date.now()), page: String(page), per_page: String(per_page) };
		const qs = new URLSearchParams(params).toString();
		try {
			const endpoint = force ? `/admin/apis?${qs}&_t=${Date.now()}` : `/admin/apis?${qs}`;
			const res = await instance.get(endpoint);
			const raw = res.data || {};
			return { items: raw.items || (Array.isArray(raw) ? raw : []), total: Number(raw.total || raw.count || 0) || 0, page: Number(raw.page) || page, per_page: Number(raw.per_page) || per_page };
		} catch (e) {
			console.error('[API] getAPIs failed, falling back', e);
			const res = await instance.get('/admin/apis');
			const arr = res.data || [];
			return { items: Array.isArray(arr) ? arr : [], total: Array.isArray(arr) ? arr.length : 0, page, per_page };
		}
	}

	// Push notifications
	async getPushNotifications(page = 1, per_page = 20, filters: Record<string, any> = {}, force: boolean = false) {
		const params: Record<string, string> = { _t: String(Date.now()), page: String(page), per_page: String(per_page) };
		if (filters.search) params.search = String(filters.search);
		const qs = new URLSearchParams(params).toString();
		try {
			const endpoint = force ? `/admin/push-notifications?${qs}&_t=${Date.now()}` : `/admin/push-notifications?${qs}`;
			const res = await instance.get(endpoint);
			const raw = res.data || {};
			return {
				items: raw.items || raw.notifications || (Array.isArray(raw) ? raw : []),
				total: Number(raw.total || raw.count || (Array.isArray(raw) ? raw.length : 0)) || 0,
				page: Number(raw.page) || page,
				per_page: Number(raw.per_page) || per_page,
			};
		} catch (e) {
			console.error('[API] getPushNotifications failed, falling back', e);
			const res = await instance.get('/admin/push-notifications');
			const arr = res.data || [];
			return { items: Array.isArray(arr) ? arr : [], total: Array.isArray(arr) ? arr.length : 0, page, per_page };
		}
	}

	// Private content - get default characters with pagination and filters
	async getDefaultCharacters(page = 1, per_page = 20, filters: Record<string, any> = {}) {
		try {
			const params: Record<string, string> = { page: String(page), per_page: String(per_page) };
			if (filters.search) params.search = String(filters.search);
			if (filters.style) params.style = String(filters.style);
			if (filters.gender) params.gender = String(filters.gender);
			const qs = new URLSearchParams(params).toString();
			const res = await instance.get(`/admin/private-content/fetch-private-content-characters?${qs}`);
			const raw = res.data || {};
			return {
				items: raw.items || [],
				total: Number(raw.total) || 0,
				page: Number(raw.page) || page,
				per_page: Number(raw.per_page) || per_page,
			};
		} catch (error) {
			console.error('[API] Failed to fetch default characters:', error);
			return { items: [], total: 0, page, per_page };
		}
	}

	// Revenue trends for dashboard (unified method)
	async getRevenueTrends(params: {
		startDate: string;
		endDate: string;
		interval?: string;
		feature?: string;
		plan?: string;
	}): Promise<{
		data: Array<{
			period: string;
			coin_revenue: number;
			subscription_revenue?: number;
			total_revenue?: number;
		}>;
		total_coin_revenue: number;
		total_subscription_revenue?: number;
		total_revenue_all_periods?: number;
		avg_monthly_revenue: number;
		currency?: string;
	}> {
		try {
			const paramsWithCacheBust: Record<string, any> = {
				start_date: params.startDate,
				end_date: params.endDate,
				interval: params.interval || 'monthly',
				_cb: Date.now(),
			};
			if (params.feature) paramsWithCacheBust.feature = params.feature;
			if (params.plan) paramsWithCacheBust.plan = params.plan;

			const response = await instance.get('/admin/dashboard/revenue/trends', { params: paramsWithCacheBust });
			const raw = response.data as any;
			const rows: any[] = Array.isArray(raw?.revenue_trends)
				? raw.revenue_trends
				: Array.isArray(raw?.data)
					? raw.data
					: [];

			const totalCoin = Number(raw.total_coin_revenue) || rows.reduce((s, r) => s + (Number(r.coin_revenue) || 0), 0);
			const totalSubscription = Number(raw.total_subscription_revenue) || rows.reduce((s, r) => s + (Number(r.subscription_revenue) || 0), 0);
			const totalAll = Number(raw.total_revenue_all_periods) || rows.reduce((s, r) => s + (Number(r.total_revenue) || (Number(r.coin_revenue) || 0) + (Number(r.subscription_revenue) || 0)), 0);

			return {
				data: rows.map(r => ({
					period: r.period,
					coin_revenue: Number(r.coin_revenue) || 0,
					subscription_revenue: Number(r.subscription_revenue) || 0,
					total_revenue: Number(r.total_revenue) || (Number(r.coin_revenue) || 0) + (Number(r.subscription_revenue) || 0),
				})),
				total_coin_revenue: totalCoin,
				total_subscription_revenue: totalSubscription,
				total_revenue_all_periods: totalAll,
				avg_monthly_revenue: Number(raw.avg_monthly_revenue) || 0,
				currency: raw.currency,
			};
		} catch (e) {
			console.error('[API] getRevenueTrends failed', e);
			throw e;
		}
	}

	// Country funnel for dashboard
	async getCountryFunnel(params: { startDate?: string; endDate?: string }): Promise<CountryFunnelResponse> {
		try {
			const query: Record<string, any> = { _cb: Date.now() };
			if (params.startDate) query.start_date = params.startDate;
			if (params.endDate) query.end_date = params.endDate;

			const response = await instance.get('/admin/dashboard/funnel/by-country', { params: query });
			const payload = response.data;
			const rawItems = Array.isArray(payload?.items)
				? payload.items
				: Array.isArray(payload)
					? payload
					: [];

			const normalized: CountryFunnelRow[] = rawItems.map((item: any) => ({
				country_code: String(item.country_code || item.country || 'UNKNOWN').toUpperCase(),
				visitors: Number(item.visitors) || 0,
				signups: Number(item.signups) || 0,
				payers: Number(item.payers) || 0,
				signup_rate:
					typeof item.signup_rate === 'number'
						? item.signup_rate
						: item.signup_rate != null
							? Number(item.signup_rate) || 0
							: 0,
				pay_rate:
					typeof item.pay_rate === 'number'
						? item.pay_rate
						: item.pay_rate != null
							? Number(item.pay_rate) || 0
							: 0,
			}));

			const totalIndex = normalized.findIndex(row => row.country_code.toUpperCase() === 'TOTAL');
			const total = totalIndex >= 0 ? normalized[totalIndex] : undefined;
			const items = totalIndex >= 0 ? normalized.filter((_, idx) => idx !== totalIndex) : normalized;

			return { items, total };
		} catch (error) {
			console.error('[apiService.getCountryFunnel] failed', error);
			throw error;
		}
	}

	// Revenue by geo for dashboard
	async getRevenueByGeo(params: {
		level: GeoRevenueLevel;
		interval?: string;
		startDate?: string;
		endDate?: string;
		countryCode?: string;
	}): Promise<GeoRevenueResponse> {
		try {
			const query: Record<string, any> = {
				level: params.level,
				interval: params.interval || 'monthly',
				_cb: Date.now(),
			};
			if (params.startDate) query.start_date = params.startDate;
			if (params.endDate) query.end_date = params.endDate;
			if (params.countryCode) query.country_code = params.countryCode;

			const response = await instance.get('/admin/dashboard/revenue/by-geo', { params: query });
			const raw = response.data || {};
			const items = Array.isArray(raw.items) ? raw.items : [];

			return {
				level: (raw.level || params.level) as GeoRevenueLevel,
				interval: raw.interval || query.interval,
				currency: raw.currency || raw.currency_code || raw.currencyCode,
				items: items.map((item: any) => ({
					geo_key: String(item.geo_key || item.country_code || item.city || 'UNKNOWN'),
					periods: Array.isArray(item.periods)
						? item.periods.map((p: any) => ({
							period: String(p.period || p.date || ''),
							revenue: Number(p.revenue ?? p.amount ?? 0) || 0,
						}))
						: [],
					total_revenue: Number(item.total_revenue ?? item.totalRevenue ?? 0) || 0,
					growth_vs_prev_period:
						typeof item.growth_vs_prev_period === 'number'
							? item.growth_vs_prev_period
							: item.growth_vs_prev_period != null
								? Number(item.growth_vs_prev_period) || 0
								: undefined,
				})),
			};
		} catch (error) {
			console.error('[apiService.getRevenueByGeo] failed', error);
			throw error;
		}
	}

	// ARPU and AOV by geo for dashboard
	async getArpuAovByGeo(params: { interval?: string; startDate?: string; endDate?: string } = {}): Promise<ArpuAovByGeoResponse> {
		try {
			const query: Record<string, any> = {
				interval: params.interval || 'monthly',
				_cb: Date.now(),
			};
			if (params.startDate) query.start_date = params.startDate;
			if (params.endDate) query.end_date = params.endDate;

			const response = await instance.get('/admin/dashboard/metrics/arpu-by-geo', { params: query });
			const raw = response.data || {};
			const items = Array.isArray(raw.items) ? raw.items : [];

			const normalized: ArpuAovByGeoItem[] = items.map((item: any) => ({
				country_code: String(item.country_code || item.country || 'UNKNOWN').toUpperCase(),
				users: Number(item.users) || 0,
				revenue: Number(item.revenue) || 0,
				orders: Number(item.orders) || 0,
				arpu: Number(item.arpu) || 0,
				aov: Number(item.aov ?? item.avg_order_value ?? 0) || 0,
				periods: Array.isArray(item.periods)
					? item.periods.map((period: any) => ({
						period: String(period.period || period.date || ''),
						users: Number(period.users) || 0,
						revenue: Number(period.revenue) || 0,
						orders: Number(period.orders) || 0,
						arpu: Number(period.arpu) || 0,
						aov: Number(period.aov ?? period.avg_order_value ?? 0) || 0,
					}))
					: [],
			}));

			return {
				interval: raw.interval || query.interval,
				items: normalized,
				currency: raw.currency || raw.currency_code || raw.currencyCode,
			};
		} catch (error) {
			console.error('[apiService.getArpuAovByGeo] failed', error);
			throw error;
		}
	}

	// Analytics endpoints
	async getAnalyticsMetricsSummary(asOfDate?: string, interval = 'monthly') {
		const params: Record<string, string> = { interval };
		if (asOfDate) params.as_of_date = asOfDate;
		const res = await instance.get('/admin/dashboard/metrics/summary', { params });
		return res.data;
	}

	async getCoinsTrends(startDate?: string, endDate?: string, interval = 'weekly', feature?: string, plan?: string) {
		const params: Record<string, any> = { interval };
		if (startDate) params.start_date = startDate;
		if (endDate) params.end_date = endDate;
		if (feature) params.feature = feature;
		if (plan) params.plan = plan;
		const res = await instance.get('/admin/dashboard/coins/trends', { params });
		return res.data;
	}

	async getTopActiveUsers(startDate?: string, endDate?: string, limit = 20, metric = 'coins_spent') {
		const params: Record<string, string> = { limit: String(limit), metric };
		if (startDate) params.start_date = startDate;
		if (endDate) params.end_date = endDate;
		const res = await instance.get('/admin/dashboard/users/top-active', { params });
		return res.data;
	}

	async getEngagementFeatureBreakdown(startDate?: string, endDate?: string, detail = false) {
		const params: Record<string, string> = { detail: String(detail) };
		if (startDate) params.start_date = startDate;
		if (endDate) params.end_date = endDate;
		const res = await instance.get('/admin/dashboard/engagement/feature-breakdown', { params });
		return res.data;
	}

	async getTopCharacters(startDate?: string, endDate?: string, limit = 10, metric = 'coins_spent') {
		const params: Record<string, string> = { limit: String(limit), metric };
		if (startDate) params.start_date = startDate;
		if (endDate) params.end_date = endDate;
		const res = await instance.get('/admin/dashboard/engagement/top-characters', { params });
		return res.data;
	}

	async getCoinsPurchasesSummary(startDate?: string, endDate?: string, interval?: string) {
		const params: Record<string, string> = {};
		if (startDate) params.start_date = startDate;
		if (endDate) params.end_date = endDate;
		if (interval) params.interval = interval;
		const res = await instance.get('/admin/dashboard/coins/purchases-summary', { params });
		return res.data;
	}

	async getCoinsUsageByFeature(startDate?: string, endDate?: string, feature?: string, flow: 'spent' | 'credited' | 'both' = 'spent') {
		const params: Record<string, string> = { flow: String(flow) };
		if (startDate) params.start_date = startDate;
		if (endDate) params.end_date = endDate;
		if (feature) params.feature = feature;
		const res = await instance.get('/admin/dashboard/coins/usage-by-feature', { params });
		return res.data;
	}

	async getTopSpenders(startDate?: string, endDate?: string, limit = 10) {
		const params: Record<string, string> = { limit: String(limit) };
		if (startDate) params.start_date = startDate;
		if (endDate) params.end_date = endDate;
		const res = await instance.get('/admin/dashboard/users/top-spenders', { params });
		return res.data;
	}

	async getSubscriptionsPlanSummary(asOfDate?: string, include_inactive = false) {
		const params: Record<string, string> = { include_inactive: String(include_inactive) };
		if (asOfDate) params.as_of_date = asOfDate;
		const res = await instance.get('/admin/dashboard/subscriptions/plan-summary', { params });
		return res.data;
	}

	async getSubscriptionsHistory(startDate?: string, endDate?: string, metric = 'active_count', interval = 'monthly') {
		const params: Record<string, string> = { metric, interval };
		if (startDate) params.start_date = startDate;
		if (endDate) params.end_date = endDate;
		const res = await instance.get('/admin/dashboard/subscriptions/history', { params });
		return res.data;
	}
}

export interface CountryFunnelRow {
	country_code: string;
	visitors: number;
	signups: number;
	payers: number;
	signup_rate: number;
	pay_rate: number;
}

export interface CountryFunnelResponse {
	items: CountryFunnelRow[];
	total?: CountryFunnelRow | null;
}

export type GeoRevenueLevel = 'country' | 'city';

export interface GeoRevenuePeriod {
	period: string;
	revenue: number;
}

export interface GeoRevenueItem {
	geo_key: string;
	periods: GeoRevenuePeriod[];
	total_revenue: number;
	growth_vs_prev_period?: number;
}

export interface GeoRevenueResponse {
	level: GeoRevenueLevel;
	interval: string;
	items: GeoRevenueItem[];
	currency?: string;
}

export interface ArpuAovByGeoPeriod {
	period: string;
	users: number;
	revenue: number;
	orders: number;
	arpu: number;
	aov: number;
}

export interface ArpuAovByGeoItem {
	country_code: string;
	users: number;
	revenue: number;
	orders: number;
	arpu: number;
	aov: number;
	periods: ArpuAovByGeoPeriod[];
}

export interface ArpuAovByGeoResponse {
	interval: string;
	items: ArpuAovByGeoItem[];
	currency?: string;
}

export const apiService = new APIService();

export default apiService;


