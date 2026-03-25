import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useThemeStyles } from "../utils/theme";
import { useTheme } from "../contexts/ThemeContext";
import { buildApiUrl } from '../utils/apiBase';
import fetchWithAuth from '../utils/fetchWithAuth';
import Button from "../components/Button";

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const { components } = useThemeStyles();
  const cardBase = components.cardBase;
  if (!open) return null;
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <div className="fixed inset-0 z-50">
      <div className={`absolute inset-0 ${isDark ? 'bg-black/70' : 'bg-white/70'} backdrop-blur-sm`} onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,92vw)]">
        <div className={`${cardBase} p-8`}>
          {title ? <div className="text-xl font-bold mb-3">{title}</div> : null}
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Verify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pricingId = searchParams.get("pricing_id");
  const location = useLocation();

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [promoList, setPromoList] = useState<any[]>([]);
  const [selectedPromo, setSelectedPromo] = useState<any | null>(null);
  const [selectedPromoKey, setSelectedPromoKey] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any | null>(null);
  const [pricingObj, setPricingObj] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState({ open: false, title: "", message: "" });
  const [createLoading, setCreateLoading] = useState(false);
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const url = buildApiUrl('/subscription/get-promo');
    fetchWithAuth(url)
      .then(async (r) => {
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          throw new Error(`HTTP ${r.status} ${r.statusText} - ${txt.slice(0, 200)}`);
        }
        const txt = await r.text();
        try {
          return JSON.parse(txt);
        } catch (err) {
          throw new Error(`Invalid JSON response from ${url}: ${txt.slice(0,200)}`);
        }
      })
      .then((data) => { if (mounted) setPromoList(data || []); })
      .catch((err) => { if (mounted) setError(err.message || "Failed to load promos"); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // fetch pricing details for pricingId so we can compute subtotal/discount
  useEffect(() => {
    if (!pricingId) return;
    let mounted = true;
    const url = buildApiUrl('/subscription/get-pricing');
    fetchWithAuth(url)
      .then(async (r) => {
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          throw new Error(`HTTP ${r.status} ${r.statusText} - ${txt.slice(0,200)}`);
        }
        const txt = await r.text();
        try {
          return JSON.parse(txt);
        } catch (err) {
          throw new Error(`Invalid JSON from ${url}`);
        }
      })
      .then((data) => {
        if (!mounted) return;
        const found = Array.isArray(data) ? data.find((p: any) => String(p.pricing_id) === String(pricingId)) : null;
        if (mounted) setPricingObj(found || null);
      })
      .catch((err) => {
        console.warn('Failed to fetch pricing for verify page', err);
      });
    return () => { mounted = false; };
  }, [pricingId]);

  const applyPromo = (promo: any) => {
    const promoKey = promo?.promo_id ?? promo?.coupon ?? promo?.promo_name ?? null;
    setSelectedPromo(promo);
    setSelectedPromoKey(promoKey);
    setVerifyResult(null);
    if (!promo) return;
    const url = buildApiUrl('/subscription/verify-promo');

    let mounted = true;
    setVerifyLoading(true);
    const payload = { promo_code: promo.coupon || promo.promo_name, pricing_id: pricingId || "" };
    const headers: Record<string,string> = { "Content-Type": "application/json" };
    const stored = localStorage.getItem("pronily:auth:token");
    if (!stored) {
      navigate('/login', { state: { background: location } });
      return;
    }
    const tokenOnly = stored.replace(/^bearer\s+/i, "").trim();
    headers["Authorization"] = `bearer ${tokenOnly}`;

    fetchWithAuth(url, { method: "POST", headers, body: JSON.stringify(payload) })
      .then(async (r) => {
        const txt = await r.text().catch(() => "");
        try {
          const json = txt ? JSON.parse(txt) : {};
          if (!r.ok) throw new Error(json?.reason || `HTTP ${r.status}`);
          return json;
        } catch (err) {
          throw new Error(`Invalid JSON response from ${url}: ${txt.slice(0,200)}`);
        }
      })
      .then((data) => {
        if (!mounted) return;
        const ok = !!data.valid;
        setVerifyResult({ ok, data });
        if (!ok) {
          const reason = data && (data.reason || data.message || data.detail) || 'Promo is not valid.';
          setModal({ open: true, title: 'Promo invalid', message: reason });
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setVerifyResult({ ok: false, error: err.message });
      })
      .finally(() => mounted && setVerifyLoading(false));

    return () => (mounted = false);
  };

  const resetPromo = () => {
    setSelectedPromo(null);
    setSelectedPromoKey(null);
    setVerifyResult(null);
    setVerifyLoading(false);
    setModal({ open: false, title: '', message: '' });
  };

  const confirm = () => {
  setCreateLoading(true);
    (async () => {
      setVerifyResult(null);
      setVerifyLoading(false);
      try {
        if (!pricingId) throw new Error("Missing pricing_id");
        
        // Use TagadaPay hosted checkout
        const url = buildApiUrl('/api/v1/tagada/checkout/create-session');

        const stored = localStorage.getItem("pronily:auth:token");
        if (!stored) {
          navigate('/login', { state: { background: location } });
          return;
        }
        const tokenOnly = stored.replace(/^bearer\s+/i, "").trim();

        const payload = {
          price_id: pricingId,
          currency: pricingObj ? (pricingObj.currency || 'USD') : 'USD',
        };

        const res = await fetchWithAuth(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `bearer ${tokenOnly}`,
          },
          body: JSON.stringify(payload),
        });

        const txt = await res.text().catch(() => "");
        let data = {} as any;
        try {
          data = txt ? JSON.parse(txt) : {};
        } catch (err) {
          throw new Error(`Invalid JSON from server: ${txt.slice(0,200)}`);
        }

        if (!res.ok) {
          const errorMsg = data?.message || data?.detail || data?.error || `HTTP ${res.status}`;
          throw new Error(errorMsg);
        }

        // Redirect to TagadaPay hosted checkout
        if (data.checkout_url) {
          window.location.href = data.checkout_url;
        } else {
          throw new Error('No checkout URL received from server');
        }

      } catch (err: any) {
        console.error('Checkout creation failed', err);
        setModal({
          open: true,
          title: 'Checkout Failed',
          message: err.message || 'Failed to create checkout session. Please try again.'
        });
        setCreateLoading(false);
      }
    })();
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h2 className="text-2xl font-bold mb-4">Verify &amp; Confirm</h2>

      <section className="rounded-lg border border-white/10 bg-white/3 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Apply a promo</h3>
          {(selectedPromo || verifyResult) && (
            <Button type="button" variant="ghost" size="sm" onClick={resetPromo} className="min-w-0 px-2 py-1 text-sm text-emerald-400 hover:underline">
              Reset
            </Button>
          )}
        </div>
        {loading ? (
          <div>Loading promos…</div>
        ) : error ? (
          <div className="text-red-400">{error}</div>
        ) : promoList.length === 0 ? (
          <div className={`text-sm ${isDark ? 'text-white/70' : 'text-gray-700'}`}>No promos available</div>
        ) : (
          <div className="space-y-2">
            {promoList.map((p, idx) => {
              const promoKey = p.promo_id ?? p.coupon ?? p.promo_name ?? `promo-${idx}`;
              const inputId = `promo-${promoKey}`;
              const isSelected = selectedPromoKey ? String(selectedPromoKey) === String(promoKey) : false;
              return (
                <label key={promoKey} htmlFor={inputId} className={`flex items-center justify-between gap-4 rounded-md border p-3 ${isSelected ? "bg-emerald-700/20 border-emerald-500" : "bg-transparent"}`}>
                  <div>
                    <div className="font-semibold">{p.promo_name} <span className="ml-2 text-xs text-white/70">{p.coupon}</span></div>
                    <div className={`text-sm ${isDark ? 'text-white/70' : 'text-gray-700'}`}>{p.percent_off}% off — expires {new Date(p.expiry_date).toLocaleDateString()}</div>
                  </div>
                  <input
                    id={inputId}
                    type="radio"
                    name="promo"
                    value={p.promo_id ?? p.coupon ?? ''}
                    checked={!!isSelected}
                    onClick={() => applyPromo(p)}
                  />
                </label>
              );
            })}
          </div>
        )}
      </section>

      <div className="mb-4">
        {verifyLoading ? (
            <div className={`text-sm ${isDark ? 'text-white/70' : 'text-gray-700'}`}>Checking promo…</div>
        ) : verifyResult ? (
          verifyResult.ok ? (
            <div className="rounded-md border border-emerald-600 bg-emerald-900/20 p-3 text-emerald-300">
              <div>Promo valid: {selectedPromo ? `${selectedPromo.coupon} — ${selectedPromo.percent_off}% off` : ''}</div>
            </div>
          ) : (
            <div className="rounded-md border border-red-600 bg-red-900/20 p-3 text-red-300">
              {verifyResult.data && verifyResult.data.reason ? verifyResult.data.reason : verifyResult.error || 'Promo is not valid.'}
            </div>
          )
        ) : null}
      </div>

      {pricingObj && (
        (() => {
          const priceValue = Number(pricingObj.price || 0);
          const promoPercentUsed = (selectedPromo && verifyResult && verifyResult.ok) ? Number(selectedPromo.percent_off || 0) : 0;
          const globalPercent = Number(pricingObj.discount || 0) || 0;
          const percent = promoPercentUsed || globalPercent || 0;
          const discountApplied = +(priceValue * (percent / 100));
          const subtotal = +(priceValue - discountApplied);
          const cycle = String(pricingObj.billing_cycle || '').toLowerCase();
          const period = cycle.includes('year') ? 'year' : cycle.includes('month') ? 'month' : 'period';
          return (
            <div className="mb-4 text-sm text-emerald-200">
              Initial payment: <span className="font-semibold">${subtotal.toFixed(2)}</span>
              &nbsp;&amp;&nbsp;Rebill: <span className="font-semibold">${priceValue.toFixed(2)}</span> every {period}
            </div>
          );
        })()
      )}

      <div className="flex gap-3">
      </div>

      <div className="flex gap-3">
        <Button
          onClick={confirm}
          disabled={createLoading}
          type="button"
          variant="primary"
          aria-busy={createLoading ? 'true' : 'false'}
          className={`px-4 py-2 font-semibold text-white flex items-center gap-2 ${createLoading ? 'cursor-not-allowed opacity-70' : ''}`}>
          {createLoading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true"></span>
          ) : null}
          {createLoading ? 'Processing…' : 'Confirm & Pay'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => navigate(-1)} className="px-4 py-2">
          Back
        </Button>
      </div>
      <Modal open={modal.open} title={modal.title} onClose={() => setModal({ open: false, title: '', message: '' })}>
        {modal.message}
      </Modal>
    </main>
  );
}
