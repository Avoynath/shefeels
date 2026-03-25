/**
 * Custom hooks for subscription and payment functionality
 * Handles pricing plans, promotions, checkout, and subscription status
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient, getErrorMessage, isAuthError } from '../utils/api';
import type { PricingPlanRead, PromoVerifyRequest, CheckoutSessionRequest, SubscriptionStatusResponse } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

export interface UseSubscriptionResult {
  subscription: SubscriptionStatusResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing subscription status
 */
export function useSubscription(): UseSubscriptionResult {
  const { isAuthenticated, logout } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiClient.getSubscriptionStatus();
      setSubscription(data);
    } catch (err) {
      if (isAuthError(err)) {
        logout();
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [logout]);

  // Load subscription status on mount if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      refresh();
    } else {
      setSubscription(null);
    }
  }, [isAuthenticated, refresh]);

  return {
    subscription,
    loading,
    error,
    refresh,
  };
}

export interface UsePricingResult {
  plans: PricingPlanRead[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for getting pricing plans
 */
export function usePricing(): UsePricingResult {
  const [plans, setPlans] = useState<PricingPlanRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiClient.getPricingPlans();
      setPlans(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load pricing plans on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    plans,
    loading,
    error,
    refresh,
  };
}

export interface UseCheckoutResult {
  creating: boolean;
  error: string | null;
  createCheckoutSession: (request: CheckoutSessionRequest) => Promise<string | null>;
  redirectToCheckout: (sessionId: string) => void;
}

/**
 * Hook for handling Stripe checkout
 */
export function useCheckout(): UseCheckoutResult {
  const { isAuthenticated, logout } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCheckoutSession = useCallback(async (request: CheckoutSessionRequest): Promise<string | null> => {
    if (!isAuthenticated) return null;
    
    setCreating(true);
    setError(null);
    
    try {
      const response = await apiClient.createCheckoutSession(request);
      return response.session_id;
    } catch (err) {
      if (isAuthError(err)) {
        logout();
      } else {
        setError(getErrorMessage(err));
      }
      return null;
    } finally {
      setCreating(false);
    }
  }, [isAuthenticated, logout]);

  const redirectToCheckout = useCallback((sessionId: string) => {
    // Redirect to Stripe checkout
    // Note: In a real implementation, you might want to use Stripe.js for this
    const checkoutUrl = `https://checkout.stripe.com/pay/${sessionId}`;
    window.location.href = checkoutUrl;
  }, []);

  return {
    creating,
    error,
    createCheckoutSession,
    redirectToCheckout,
  };
}

export interface UsePromoResult {
  verifying: boolean;
  error: string | null;
  verifyPromo: (request: PromoVerifyRequest) => Promise<{valid: boolean; reason_or_promo: string | any} | null>;
}

/**
 * Hook for verifying promo codes
 */
export function usePromo(): UsePromoResult {
  const { isAuthenticated, logout } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyPromo = useCallback(async (request: PromoVerifyRequest) => {
    if (!isAuthenticated) return null;
    
    setVerifying(true);
    setError(null);
    
    try {
      const response = await apiClient.verifyPromo(request);
      return response;
    } catch (err) {
      if (isAuthError(err)) {
        logout();
      } else {
        setError(getErrorMessage(err));
      }
      return null;
    } finally {
      setVerifying(false);
    }
  }, [isAuthenticated, logout]);

  return {
    verifying,
    error,
    verifyPromo,
  };
}

export interface UseUserCoinsResult {
  coins: any | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for getting user coin balance
 */
export function useUserCoins(): UseUserCoinsResult {
  const { isAuthenticated, logout } = useAuth();
  const [coins, setCoins] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiClient.getUserCoin();
      setCoins(data);
    } catch (err) {
      if (isAuthError(err)) {
        logout();
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, logout]);

  // Load coins on mount if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      refresh();
    } else {
      setCoins(null);
    }
  }, [isAuthenticated, refresh]);

  return {
    coins,
    loading,
    error,
    refresh,
  };
}

/**
 * Utility function to create a checkout session and redirect
 */
export async function createAndRedirectToCheckout(
  request: CheckoutSessionRequest,
  onError?: (error: string) => void
): Promise<void> {
  try {
    const response = await apiClient.createCheckoutSession(request);
    
    // Build the Stripe checkout URL
    
  // In a real implementation, you would use Stripe.js to redirect to checkout
    // For now, we'll construct the URL manually (this won't work in production)
    // You should implement proper Stripe.js integration
    const stripeCheckoutUrl = `https://checkout.stripe.com/pay/${response.session_id}`;
    
    window.location.href = stripeCheckoutUrl;
    
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    onError?.(errorMessage);
  }
}
