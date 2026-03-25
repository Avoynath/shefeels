import * as React from 'react';

import { buildApiUrl } from '../utils/apiBase';

export type PromotionalConfig = {
  offer_timer_minutes: number;
  offer_discount_percentage?: string;
  offer_enabled?: boolean;
  premium_button_text?: string;
  offer_badge_text?: string;
};

type UsePromotionalConfigOptions = {
  refetchIntervalMs?: number;
};

export function usePromotionalConfig(options: UsePromotionalConfigOptions = {}) {
  const { refetchIntervalMs = 60_000 } = options;
  const [promoConfig, setPromoConfig] = React.useState<PromotionalConfig | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchPromoConfig = React.useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(buildApiUrl('/api/v1/promotional-config'), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch promo config (${response.status})`);
      }

      const data = (await response.json()) as PromotionalConfig;
      setPromoConfig(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch promo config');
    }
  }, []);

  // Initial fetch
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchPromoConfig();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPromoConfig]);

  // Periodic refetch
  React.useEffect(() => {
    if (!refetchIntervalMs || refetchIntervalMs <= 0) return;
    const id = window.setInterval(() => {
      fetchPromoConfig();
    }, refetchIntervalMs);
    return () => window.clearInterval(id);
  }, [fetchPromoConfig, refetchIntervalMs]);

  // Refetch when tab regains focus / becomes visible
  React.useEffect(() => {
    const onFocus = () => fetchPromoConfig();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchPromoConfig();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchPromoConfig]);

  return { promoConfig, error, refetch: fetchPromoConfig };
}
