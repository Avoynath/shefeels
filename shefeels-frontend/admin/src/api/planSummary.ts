import { useQuery } from '@tanstack/react-query'
import { apiService } from '../services/api'

export function usePlansQuery() {
  return useQuery({
    queryKey: ['pricing-plans'],
    queryFn: async () => {
      try {
        const res = await apiService.getPricingPlans()
        // Normalize to simple identifiers or names
        if (!res) return []
        if (Array.isArray(res)) {
          // If items are objects, map to readable strings
          return res.map((p: any) => (typeof p === 'string' ? p : (p.name || p.identifier || p.id || String(p))))
        }
        if (typeof res === 'object') {
          // try common shapes
          const items = (res.items || res.plans || res.data || [])
          return Array.isArray(items) ? items.map((p: any) => (typeof p === 'string' ? p : (p.name || p.identifier || p.id || String(p)))) : []
        }
        return []
      } catch (e) {
        console.error('usePlansQuery failed', e)
        return []
      }
    },
  })
}

export default usePlansQuery
