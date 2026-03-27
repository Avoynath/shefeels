import React, { useState, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import HidePasswordIcon from "../assets/auth/HidePasswordIcon.svg";
import GoogleIcon from "../assets/auth/GoogleIcon.svg";
import { buildApiUrl } from '../utils/apiBase';
import fetchWithAuth from '../utils/fetchWithAuth';
import { useToastActions } from '../contexts/ToastContext';
import { DirectSend } from 'iconsax-react';
import Button from "../components/Button";

const card = "relative mx-auto w-full max-w-md overflow-hidden rounded-[20px] border border-[rgba(198,244,214,0.3)] bg-black p-6 shadow-[0_24px_60px_rgba(0,0,0,0.55)] sm:p-8";

const inputClass =
  "mt-1 w-full rounded-[14px] border border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.08)] px-3 py-2 text-sm font-normal leading-[28px] text-white placeholder:text-[rgba(255,255,255,0.3)] outline-none transition focus:border-[#7F5AF0] focus:shadow-[0_0_0_3px_rgba(127,90,240,0.15)]";

const loginButtonStyle = {
  background: 'linear-gradient(90deg, #d9b2ff 0%, #7f5af0 38%, #9d66ff 64%, #f48db5 100%)',
  boxShadow: 'inset 0 0 8.078px rgba(227,222,255,0.2), inset 0 20px 20.196px rgba(202,172,255,0.3), inset 0 1px 2.222px rgba(255,255,255,1), inset 0 8px 11.31px rgba(255,255,255,0.1)',
} as const;

export default function Login({ onClose }: { onClose?: () => void } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { setToken, setUser } = useAuth();
  const { showError: showToastError, showSuccess: showToastSuccess } = useToastActions();
  const [resendAvailable, setResendAvailable] = useState(false);
  const [resendSuccessMessage, setResendSuccessMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot" | "otp" | "verification-sent">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleOAuthToken = useCallback(
    async (token: string) => {
      try {
        localStorage.setItem("hl_token", token);
        flushSync(() => {
          setToken(token);
        });
        const res = await fetchWithAuth(buildApiUrl("/me"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch Google profile");
        const user = await res.json();
        localStorage.setItem("hl_user", JSON.stringify(user));
        flushSync(() => {
          setUser(user);
        });
        showToastSuccess("Welcome!", "Signed in with Google");
        if (onClose) {
          onClose();
        } else {
          const state: any = (location && (location as any).state) || {};
          const from = state.from || null;
          if (from) navigate(from);
          else navigate("/");
        }
      } catch (err: any) {
        console.error("Google OAuth auto-login error:", err);
        showToastError("Sign in failed", "Unable to complete Google sign-in");
      }
    },
    [location, navigate, onClose, setToken, setUser, showToastError, showToastSuccess]
  );

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token=")) {
      const match = hash.match(/access_token=([^&]+)/);
      if (match) {
        const token = match[1];
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage({ type: "google-oauth-token", token }, window.location.origin);
          } catch (err) {
            console.error("Failed to post Google token to opener:", err);
          }
          window.close();
        } else {
          void handleGoogleOAuthToken(token);
        }
      }
    }

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "google-oauth-token" && typeof event.data.token === "string") {
        void handleGoogleOAuthToken(event.data.token);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [handleGoogleOAuthToken]);

  const startGoogleOAuth = useCallback(() => {
    try {
      const popup = window.open(buildApiUrl("/auth/google/start"), "google-oauth", "width=500,height=650");
      if (!popup) throw new Error("Popup blocked");
      popup.focus?.();
    } catch (err) {
      showToastError?.("Google sign in", "Unable to start Google sign-in");
    }
  }, [showToastError]);

  function showStandardPopup(status: number | undefined, detail: string | null, defaultTitle: string) {
    if (!status) return null;
    const trimmedDetail = detail?.trim() || null;
    if (status >= 400 && status < 500) {
      const message = trimmedDetail || defaultTitle;
      try { showToastError(defaultTitle, message); } catch { }
      return message;
    }
    if (status >= 500) {
      const message = "Unable to process your request currently.";
      try { showToastError(defaultTitle, message); } catch { }
      return message;
    }
    return null;
  }

  async function submitSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetchWithAuth(buildApiUrl('/auth/login'), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        const popupMessage = showStandardPopup(res.status, body?.detail ?? body?.message ?? null, "Sign in failed");
        throw new Error(popupMessage || body?.detail || body?.message || "Sign in failed");
      }
      const t = body.access_token ?? body.token ?? null;
      if (t) {
        try { localStorage.setItem("hl_token", t); } catch { }
        flushSync(() => { setToken(t); });
      }
      if (body.user) {
        try { localStorage.setItem("hl_user", JSON.stringify(body.user)); } catch { }
        flushSync(() => { setUser(body.user); });
      }
      if (onClose) {
        onClose();
      } else {
        const state: any = (location && (location as any).state) || {};
        const from = state.from || null;
        if (from) navigate(from);
        else navigate('/');
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function submitSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResendAvailable(false);
    try {
      const res = await fetchWithAuth(buildApiUrl('/auth/signup'), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        const popupMessage = showStandardPopup(res.status, body?.detail ?? body?.message ?? null, "Sign up failed");
        const detail = (body?.detail || body?.message || "").toString().toLowerCase();
        if (detail.includes('verification') || detail.includes('already sent') || detail.includes('check your inbox')) {
          setResendAvailable(true);
        }
        throw new Error(popupMessage || body?.detail || body?.message || "Sign up failed");
      }

      const t = body.access_token ?? body.token ?? null;
      if (t) {
        try { localStorage.setItem("hl_token", t); } catch { }
        flushSync(() => { setToken(t); });
        if (body.user) {
          try { localStorage.setItem("hl_user", JSON.stringify(body.user)); } catch { }
          flushSync(() => { setUser(body.user); });
        }
        if (onClose) {
          onClose();
        } else {
          const state: any = (location && (location as any).state) || {};
          const from = state.from || null;
          if (from) navigate(from);
          else navigate('/');
        }
      } else {
        setMode("verification-sent");
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResendSuccessMessage(null);
    setLoading(true);
    try {
      const res = await fetchWithAuth(buildApiUrl('/auth/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        const popupMessage = showStandardPopup(res.status, body?.detail ?? body?.message ?? null, 'Resend failed');
        const detail = (body?.detail || body?.message || "").toString().toLowerCase();
        if (detail.includes('verification') || detail.includes('already sent') || detail.includes('check your inbox')) {
          setResendAvailable(true);
        }
        throw new Error(popupMessage || body?.detail || body?.message || 'Resend failed');
      }
      setResendSuccessMessage('Verification email sent if the account exists');
      setResendAvailable(false);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetchWithAuth(buildApiUrl('/auth/password-reset/request'), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        const popupMessage = showStandardPopup(res.status, body?.detail ?? body?.message ?? null, "Reset request failed");
        throw new Error(popupMessage || body?.detail || body?.message || "Reset request failed");
      }
      try {
        showToastSuccess('Password Reset', 'If the email exists, a new password has been sent to your email. Please check your inbox.');
      } catch { }
      setMode("sign-in");
      setPassword("");
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 py-12">
      <div className={card} data-modal-card>
        {mode === "sign-in" && (
          <div className="mx-auto w-full">
            <h2 className="text-xl font-medium text-[#7F5AF0] text-center">Sign In</h2>
            <form onSubmit={submitSignIn} className="mt-6 space-y-4">
              <label className="flex flex-col text-sm">
                <span className="text-xs font-normal text-white">Email Id</span>
                <input autoFocus value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter email" className={inputClass} />
              </label>

              <label className="flex flex-col text-sm">
                <span className="text-xs font-normal text-white">Password</span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter email"
                    className={`${inputClass} pr-14`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-5 top-1/2 -translate-y-1/2"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <img src={HidePasswordIcon} alt="toggle" className="h-4 w-4 opacity-90" />
                  </button>
                </div>
              </label>

              <div className="flex items-center justify-between gap-4 pt-[9px]">
                <label className="flex items-center gap-1 text-[16px] font-normal leading-[28px] text-white">
                  <input type="checkbox" className="h-5 w-5 rounded-[4px] border border-white/80 bg-transparent accent-[#7F5AF0]" /> Remember Me
                </label>
                <button type="button" onClick={() => setMode("forgot")} className="text-[16px] font-normal leading-[28px] text-[#7F5AF0] transition hover:text-[#9b7cf8]">Forgot password?</button>
              </div>

              <button
                disabled={loading}
                type="submit"
                className="mt-6 py-3 w-full rounded-[14px] border border-white/10 px-6 text-base font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                style={loginButtonStyle}
              >
                {loading ? 'Signing in…' : 'Login'}
              </button>
            </form>

            {error && <div className="mt-3 text-sm text-red-400 text-center">{error}</div>}

            <div className="mt-4 flex items-center gap-4 text-center text-sm font-normal text-white">
              <span className="h-px flex-1 bg-white/18" />
              <span>Or</span>
              <span className="h-px flex-1 bg-white/18" />
            </div>

            <button
              onClick={startGoogleOAuth}
              type="button"
              className="mt-3 inline-flex py-2 w-full items-center justify-center gap-[10px] rounded-[14px] bg-white px-5 text-sm font-medium text-[#292929] transition hover:brightness-95"
            >
              <img src={GoogleIcon} alt="Google" className="h-5 w-5" />
              <span>Continue with Google</span>
            </button>

            <div className="mt-6 text-center text-sm font-normal text-white">Don’t have an account? <button className="font-medium text-[#7F5AF0] hover:underline" onClick={() => setMode("sign-up")}>Sign Up</button></div>
          </div>
        )}

        {mode === "sign-up" && (
          <div className="mx-auto w-full">
            <h2 className="text-xl font-medium text-[#7F5AF0] text-center">Create an Account</h2>
            <form onSubmit={submitSignUp} className="mt-6 space-y-4">
              <label className="flex flex-col text-sm">
                <span className="text-xs font-normal text-white">Email Id</span>
                <input
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter email"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="text-xs font-normal text-white">Password</span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter email"
                    className={`${inputClass} pr-14`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-5 top-1/2 -translate-y-1/2"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <img src={HidePasswordIcon} alt="toggle" className="h-4 w-4 opacity-90" />
                  </button>
                </div>
              </label>
              <button
                disabled={loading}
                type="submit"
                className="mt-6 py-3 w-full rounded-[14px] border border-white/10 px-6 text-base font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                style={loginButtonStyle}
              >
                {loading ? 'Creating...' : 'Sign Up'}
              </button>
            </form>

            {error && (
              <div className="mt-3 text-center text-sm text-red-400">
                {error}
                {resendAvailable && (
                  <div className="mt-2 text-xs text-white/60">
                    Check your inbox, including spam.
                  </div>
                )}
              </div>
            )}

            {resendAvailable && (
              <button
                onClick={resendVerification}
                disabled={loading}
                className="mt-4 w-full text-sm text-[#7F5AF0] hover:underline"
              >
                {loading ? 'Sending...' : 'Resend Verification Email'}
              </button>
            )}

            {resendSuccessMessage && (
              <div className="mt-2 text-center text-sm text-[#27C460]">
                {resendSuccessMessage}
              </div>
            )}

            <div className="mt-4 flex items-center gap-4 text-center text-sm font-normal text-white">
              <span className="h-px flex-1 bg-white/18" />
              <span>Or</span>
              <span className="h-px flex-1 bg-white/18" />
            </div>

            <button
              onClick={startGoogleOAuth}
              type="button"
              className="mt-3 inline-flex py-2 w-full items-center justify-center gap-[10px] rounded-[14px] bg-white px-5 text-sm font-medium text-[#292929] transition hover:brightness-95"
            >
              <img src={GoogleIcon} alt="Google" className="h-5 w-5" />
              <span>Continue with Google</span>
            </button>

            <div className="mt-6 text-center text-sm font-normal text-white">
              Have an account?{" "}
              <button className="font-medium text-[#7F5AF0] hover:underline" onClick={() => setMode("sign-in")}>
                Sign In
              </button>
            </div>
          </div>
        )}

        {mode === "verification-sent" && (
          <div className="py-4 text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-(--primary)/10 text-(--primary)">
                <DirectSend size="44" variant="Bulk" />
              </div>
            </div>
            <h2 className="mb-3 text-2xl font-bold text-white">Check Your Email</h2>
            <p className="mb-8 text-sm leading-relaxed text-white/70">
              We've sent a verification link to <span className="font-semibold text-white">{email}</span>.
              Please click the link in that email to activate your account.
            </p>

            <div className="space-y-4">
              <Button
                onClick={() => onClose?.() || navigate('/')}
                type="button"
                variant="primary"
                className="w-full py-3 font-semibold"
              >
                Got it
              </Button>

              <button
                onClick={resendVerification}
                disabled={loading}
                className="w-full text-sm text-white/50 transition-colors hover:text-white"
              >
                {loading ? 'Sending...' : "Didn't receive an email? Resend"}
              </button>
              {resendSuccessMessage && (
                <div className="mt-2 text-center text-sm text-[#27C460]">
                  {resendSuccessMessage}
                </div>
              )}
            </div>

            <button
              onClick={() => setMode("sign-in")}
              className="mt-8 text-xs text-(--primary) hover:underline"
            >
              Back to Sign In
            </button>
          </div>
        )}

        {mode === "forgot" && (
          <div className="mx-auto w-full">
            <div className="space-y-[10px]">
              <h2 className="text-xl font-medium text-[#7F5AF0] text-center">Forgot Password</h2>
              <p className="text-sm font-normal text-[#C2C2C2] text-center">
                Please enter your email to reset the password
              </p>
            </div>

            <form onSubmit={sendReset} className="mt-6 space-y-4">
              <label className="flex flex-col text-sm">
                <span className="text-xs font-normal text-white">Email Id</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter email"
                  className={inputClass}
                />
              </label>

              <button
                disabled={loading}
                type="submit"
                className="py-3 w-full rounded-[14px] border border-white/10 px-6 text-base font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                style={loginButtonStyle}
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </form>

            {error && <div className="mt-3 text-center text-sm text-red-400">{error}</div>}

            <div className="mt-6 text-center text-sm font-normal text-white">
              <button className="font-medium text-[#7F5AF0] hover:underline" onClick={() => setMode("sign-in")}>
                Back to Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
