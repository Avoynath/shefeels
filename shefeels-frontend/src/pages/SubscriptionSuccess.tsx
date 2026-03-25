import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useThemeStyles } from "../utils/theme";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../utils/api";
import { buildApiUrl } from '../utils/apiBase';
import fetchWithAuth from '../utils/fetchWithAuth';

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const { components } = useThemeStyles();
  const [loading, setLoading] = useState(true);
  const { setUser } = useAuth();

  const refreshUser = useCallback(async () => {
    if (!setUser) return;
    try {
      const profile = await apiClient.getProfile();
      setUser({
        name: (profile as any)?.full_name || undefined,
        email: (profile as any)?.email || undefined,
        avatar: (profile as any)?.profile_image_url || undefined,
        role: (profile as any)?.user_role || (profile as any)?.role || undefined,
        hasActiveSubscription: Boolean(
          (profile as any)?.hasActiveSubscription ||
          (profile as any)?.subscription_status === "active"
        ),
        tokenBalance: Number((profile as any)?.tokenBalance || (profile as any)?.coin_balance || 0),
        subscription_coin_reward: Number((profile as any)?.subscription_coin_reward || 0),
        subscription_plan_name: (profile as any)?.subscription_plan_name || undefined,
      });
    } catch (err) {
      console.error("Failed to refresh profile after subscription", err);
    }
  }, [setUser]);

  useEffect(() => {
    // Give TagadaPay webhook a moment to process
      const timer = setTimeout(() => {
        // Try to verify - check if it's a subscription or token purchase
        const subUrl = buildApiUrl('/api/v1/tagada/subscription/me');
        fetchWithAuth(subUrl)
          .then(async (r) => {
            if (!r.ok) throw new Error('Not a subscription');
            const data = await r.json();
            if (data && data.subscription_id) {
              // Success! Subscription confirmed
              void refreshUser();
              setLoading(false);
              setTimeout(() => navigate('/profile'), 3000);
            } else {
              // No subscription found - likely a token purchase
              throw new Error('No subscription');
            }
          })
          .catch(() => {
            // Not a subscription purchase - assume token purchase and just verify payment success
            void refreshUser();
            setLoading(false);
            // Auto-redirect after 3 seconds
            setTimeout(() => navigate('/profile'), 3000);
        });
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className={components.cardBase + " p-8 text-center"}>
        {loading ? (
          <>
            <div className="mb-4">
              <svg className="animate-spin h-12 w-12 mx-auto text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Processing Your Payment</h2>
            <p className="text-gray-400">Please wait while we confirm your payment...</p>
          </>
        ) : (
          <>
            <div className="mb-4 text-emerald-500 text-5xl">✓</div>
            <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
            <p className="text-gray-400 mb-4">Your payment was processed successfully. Check your profile for updated balance.</p>
            <p className="text-sm text-gray-500">Redirecting to your profile in 3 seconds...</p>
            <button
              onClick={() => navigate('/profile')}
              className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
            >
              Go to Profile Now
            </button>
          </>
        )}
      </div>
    </main>
  );
}
