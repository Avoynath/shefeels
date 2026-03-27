import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/api";

type User = {
  id?: string;
  name?: string;
  email?: string;
  avatar?: string;
  role?: string;
  hasActiveSubscription?: boolean;
  tokenBalance?: number;
  subscription_coin_reward?: number;
  subscription_plan_name?: string;
} | null;

type AuthContextType = {
  user: User;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (u: User) => void;
  setToken: (t: string | null) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User>(() => {
    try {
      const raw = localStorage.getItem("sf_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("sf_token"));
  const isAuthenticated = useMemo(() => Boolean(token), [token]);

  // ensure api client knows about token
  useEffect(() => {
    try {
      apiClient.setAccessToken(token);
    } catch {}
  }, [token]);

  const refreshProfile = React.useCallback(async () => {
      if (!token) return;
      try {
        const profile = await apiClient.getProfile();
        const u = {
          name: (profile as any).full_name || undefined,
          email: (profile as any).email || undefined,
          avatar: (profile as any).profile_image_url || undefined,
          // backend returns `user_role` per sample; normalize to `role` on the client
          role: (profile as any).user_role || (profile as any).role || undefined,
          // billing info merged by api client
          hasActiveSubscription: (profile as any).hasActiveSubscription || false,
          tokenBalance: Number((profile as any).tokenBalance || 0),
          subscription_coin_reward: Number((profile as any).subscription_coin_reward || 0),
          subscription_plan_name: (profile as any).subscription_plan_name || undefined,
        } as any;
        setUser(u);
      } catch (e) {
        // On failure to fetch profile, clear user to avoid showing stale data if authorized failed
        // But if it's just network error, maybe keep old user?
        // Matching previous logic:
        try { setUser(null); } catch {}
      }
  }, [token]);

  // When token becomes available, fetch profile and set user info (name + avatar)
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Listen for server-sent events for wallet updates so token balance updates instantly
  // Live WebSocket connection to receive wallet updates (auth handshake sent on connect)
  useEffect(() => {
    if (!token) return;
    let ws: WebSocket | null = null;
    let stopped = false;
    let backoff = 1000;

    const connect = () => {
      try {
        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const url = `${proto}://${window.location.host}/api/v1/tagada/ws/wallet`;
        ws = new WebSocket(url);
      } catch (e) {
        ws = null;
      }

      if (!ws) return;

      ws.onopen = () => {
        // Reset backoff on successful connect
        backoff = 1000;
        try {
          ws && ws.send(JSON.stringify({ type: 'auth', token }));
        } catch {}
      };

      ws.onmessage = (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data || '{}');
          if (data && data.type === 'wallet_update') {
            // console.log('[WebSocket] Wallet update received:', data);
            try {
              setUser((prev: any) => {
                if (!prev) return prev;
                return { ...prev, tokenBalance: Number((data.tokenBalance ?? prev.tokenBalance) || 0) };
              });
            } catch {}
          }

          // Support subscription update messages so components can react
          if (data && data.type === 'subscription_update') {
            // console.log('[WebSocket] Subscription update received:', data);
            try {
              setUser((prev: any) => {
                if (!prev) return prev;
                // data.hasActiveSubscription expected to be boolean
                const hasActive = typeof data.hasActiveSubscription === 'boolean' ? data.hasActiveSubscription : prev.hasActiveSubscription;
                const subscriptionCoinReward = data.subscription_coin_reward !== undefined ? Number(data.subscription_coin_reward || 0) : prev.subscription_coin_reward;
                const subscriptionPlanName = data.subscription_plan_name !== undefined ? data.subscription_plan_name : prev.subscription_plan_name;
                // console.log('[WebSocket] Updating user context:', { ... });
                return { 
                  ...prev, 
                  hasActiveSubscription: hasActive,
                  subscription_coin_reward: subscriptionCoinReward,
                  subscription_plan_name: subscriptionPlanName
                };
              });
              // Also dispatch a DOM event so pages/components can refresh subscription details if needed
              try {
                window.dispatchEvent(new CustomEvent('sf_subscription_updated', { detail: data }));
              } catch {}
            } catch {}
          }
        } catch (err) {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (stopped) return;
        // reconnect with backoff
        setTimeout(() => {
          backoff = Math.min(backoff * 2, 30000);
          connect();
        }, backoff);
      };

      ws.onerror = () => {
        try { ws && ws.close(); } catch {}
      };
    };

    connect();

    return () => {
      stopped = true;
      try { ws && ws.close(); } catch {}
    };
  }, [token, setUser]);

  // Global listener for Google OAuth postMessage from popup window
  // This ensures we catch the token even if the Login modal is closed
  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      // Validate message structure
      if (event.data?.type === "google-oauth-token" && typeof event.data.token === "string") {
        const token = event.data.token;
        
        try {
          // Store token and update context
          localStorage.setItem("sf_token", token);
          setToken(token);
          
          // The useEffect watching 'token' will automatically fetch the user profile
          console.log("[AuthContext] Google OAuth token received and stored");
        } catch (err) {
          console.error("[AuthContext] Failed to handle Google OAuth token:", err);
        }
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [setToken]);

  useEffect(() => {
    try {
      if (token) localStorage.setItem("sf_token", token);
      else localStorage.removeItem("sf_token");
    } catch {}
  }, [token]);

  useEffect(() => {
    try {
      if (user) localStorage.setItem("sf_user", JSON.stringify(user));
      else localStorage.removeItem("sf_user");
    } catch {}
  }, [user]);

  function logout() {
    setToken(null);
    setUser(null);
    try {
      localStorage.removeItem("sf_token");
      localStorage.removeItem("sf_user");
    } catch {}
    navigate("/");
  }

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, setUser, setToken, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export default AuthContext;
