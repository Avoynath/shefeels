import { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { CheckCircle2, ShoppingCart, ShieldCheck } from "lucide-react";
import Button from "../components/Button";
import Card from "../components/Card";
import { buildApiUrl } from '../utils/apiBase';
import fetchWithAuth from '../utils/fetchWithAuth';
import visaIcon from "../assets/payments/VISA.svg";
import mastercardIcon from "../assets/payments/mastercard.svg";
import amexIcon from "../assets/payments/AMEX.svg";
import discoverIcon from "../assets/payments/Discover.svg";
import maestroIcon from "../assets/payments/maestro.svg";
import checkboxIcon from "../assets/payments/Checkbox.svg";
import paymentBanner from "../assets/payments/PaymentNew.avif";

function mapBillingToLabel(billing: string) {
  const b = billing.toLowerCase();
  if (b.includes("month")) return "1 Month";
  if (b.includes("quarter")) return "3 Months";
  if (b.includes("year")) return "1 Year";
  return billing;
}

function formatCurrency(n: number, currency = "USD") {
  try {
    return n.toLocaleString(undefined, { style: "currency", currency });
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function getBillingDays(label: string) {
  const lower = label.toLowerCase();
  const numMatch = lower.match(/(\d+(?:\.\d+)?)/);
  const numeric = numMatch ? parseFloat(numMatch[0]) : NaN;
  const quantity = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;

  if (lower.includes("year")) return 365 * quantity;
  if (lower.includes("quarter")) return 90 * quantity;
  if (lower.includes("month")) return 30 * quantity;
  if (lower.includes("week")) return 7 * quantity;
  if (lower.includes("day")) return 1 * quantity;
  if (lower.includes("monthly")) return 30 * quantity;
  return null;
}

type Plan = {
  id: string;
  label: string;
  price: number;
  discountPct: number;
  currency: string;
  discountedPrice: number;
  pricingId?: string | number;
  coinReward: number;
};

function DiscountChip({ pct, selected }: { pct: number; selected?: boolean }) {
  const style: React.CSSProperties = selected
    ? { borderRadius: 8, background: '#ff9903', color: '#000' }
    : { borderRadius: 8, border: '1px solid #ff9903', background: 'transparent', color: '#ff9903' };

  return (
    <span style={style} className={`inline-block px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold ${selected ? 'text-black' : 'text-[#ff9903]'}`}>
      {pct}% OFF
    </span>
  );
}

function PlanRow({ plan, selected, onSelect, isDefault }: { plan: Plan; selected: boolean; onSelect: () => void; isDefault?: boolean }) {
  const discounted = plan.discountedPrice;
  const original = plan.price;
  const hasDiscount = plan.discountPct > 0 && Math.abs(discounted - original) > 0.001;
  const days = getBillingDays(plan.label);
  const perDay = days ? discounted / days : null;

  const selectedStyle: React.CSSProperties | undefined = selected
    ? { border: '2px solid #ff9903', background: '#0E0E0E', boxShadow: '0 0 15px 0 rgba(255, 153, 3, 0.20)' }
    : isDefault
    ? { border: '1px solid rgba(255, 153, 3, 0.35)', boxShadow: '0 0 10px 0 rgba(255, 153, 3, 0.12)' }
    : undefined;

  return (
    <button
      onClick={onSelect}
      style={selectedStyle}
      className={`relative w-full text-left px-3 py-3 sm:px-5 sm:py-2 transition focus-visible:outline-none rounded-[12px] min-h-[72px] mt-2 mb-3 bg-[#0E0E0E] ${selected ? 'border-[2px] border-[#ff9903]' : isDefault ? 'border-[1px] border-[#ff9903]/35 hover:border-[#ff9903]/60' : 'border-[1px] border-white/20 hover:border-white/40'}`}
    >
      <div className="flex items-center justify-between gap-2 sm:gap-6">
        {/* Left: label + discount + prices */}
        <div className="flex-1 min-w-0">
          <div className="text-xs sm:text-sm font-semibold capitalize text-white">{plan.label}</div>
          {plan.discountPct > 0 && (
            <div className="mt-1">
              <DiscountChip pct={plan.discountPct} selected={selected} />
            </div>
          )}
          <div className="mt-2 flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] flex-wrap">
            {hasDiscount ? (
              <>
                <span className="text-white/50 line-through whitespace-nowrap">{formatCurrency(original, plan.currency)}</span>
                <span className="text-white/80 whitespace-nowrap">{formatCurrency(discounted, plan.currency)}</span>
              </>
            ) : (
              <span className="text-white/80 whitespace-nowrap">{formatCurrency(original, plan.currency)}</span>
            )}
          </div>
        </div>

        {/* Center: per-day price */}
        <div className="flex-shrink-0 w-24 sm:w-36 md:w-44 text-center text-white flex items-center justify-center">
          {perDay !== null ? (
            <div className="flex items-center gap-1.5 sm:gap-3 justify-center">
              <div className="text-xl sm:text-3xl md:text-[36px] font-bold leading-none">{perDay.toFixed(2)}</div>
              <div className="flex flex-col items-start text-left">
                <div className="text-xs sm:text-sm md:text-[14px] font-semibold">{plan.currency}</div>
                <div className="text-[9px] sm:text-[10px] md:text-[11px] text-white/70 tracking-wide mt-0.5">per day</div>
              </div>
            </div>
          ) : (
            <div className="text-base sm:text-lg font-semibold">{formatCurrency(discounted, plan.currency)}</div>
          )}
        </div>

        {/* Right: radio button */}
        <div className="flex-shrink-0 pl-1 sm:pl-2">
          <div className={`h-5 w-5 sm:h-6 sm:w-6 rounded-full border-2 flex items-center justify-center transition-colors ${selected ? 'border-[#ff9903]' : 'border-white/30'}`}>
            {selected && <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-[#ff9903]" />}
          </div>
        </div>
      </div>
      {isDefault && (
        <div className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 bg-[#ff9903] text-black text-[10px] sm:text-xs font-bold px-4 py-0.5 rounded-full whitespace-nowrap shadow-md">
          MOST POPULAR
        </div>
      )}
    </button>
  );
}

function BenefitRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm text-white/90">
      <CheckCircle2 className="h-5 w-5 text-[#ff9903] flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}

export default function PaymentFunnel() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [agree, setAgree] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  const canContinue = useMemo(() => !!agree, [agree]);

  const handleContinue = async () => {
    if (!user) {
      navigate('/login', { state: { background: location } });
      return;
    }

    if (hasActiveSubscription) {
      try {
        window?.alert('You already have an active subscription. Please manage or cancel your current subscription before purchasing a new one.');
      } catch {}
      return;
    }

    const planToUse = selectedPlan ?? (plans && plans.length > 0 ? plans[0] : null);
    if (!planToUse) { console.error('No plan selected'); return; }

    const priceId = planToUse.pricingId ?? planToUse.id;
    if (!priceId) { console.error('No price_id found'); return; }

    setPayLoading(true);
    try {
      const url = buildApiUrl('/api/v1/tagada/checkout/create-session');
      const payload = { price_id: priceId, currency: planToUse.currency || 'USD' };
      console.log('Creating checkout session with payload:', payload);

      const res = await fetchWithAuth(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const txt = await res.text().catch(() => '');
      let data: any = {};
      try { data = txt ? JSON.parse(txt) : {}; } catch (err) {
        console.error('Invalid JSON from server:', txt);
        throw new Error('Invalid JSON from server');
      }

      if (!res.ok) {
        const msg = data?.message || data?.detail || data?.error || `HTTP ${res.status}`;
        console.error('Checkout creation failed:', msg);
        throw new Error(msg);
      }

      console.log('Checkout response:', data);
      if (data.checkout_url) {
        console.log('Redirecting to:', data.checkout_url);
        window.location.href = data.checkout_url;
      } else {
        console.error('No checkout_url in response');
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      console.error('PaymentFunnel checkout failed:', err);
      try { window?.alert(err?.message || 'Failed to create checkout session. Please try again.'); } catch {}
    } finally {
      setPayLoading(false);
    }
  };

  // Check subscription status
  useEffect(() => {
    let mounted = true;
    async function checkSubscription() {
      try {
        if ((user as any)?.hasActiveSubscription) setHasActiveSubscription(true);
      } catch (e) {
        console.error('Failed to check subscription', e);
      } finally {
        if (mounted) setCheckingSubscription(false);
      }
    }
    checkSubscription();
    return () => { mounted = false; };
  }, [user]);

  // Fetch pricing from backend
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetchWithAuth(buildApiUrl('/subscription/get-pricing'));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const mapped: Plan[] = (Array.isArray(data) ? data : []).map((a: any) => {
          const rawBilling = a.billing_cycle || a.billingCycle || "";
          const label = rawBilling || mapBillingToLabel(rawBilling || "");
          const price = Number(a.price || 0);
          const discountPct = Number(a.discount || 0);
          const discountedPrice = Math.max(0, +(price * (1 - discountPct / 100)).toFixed(2));
          const coinReward = Number(a.coin_reward || a.coinReward || 0);
          return {
            id: String(a.id || a.pricing_id || Math.random()),
            label, price, discountPct,
            currency: a.currency || "USD",
            discountedPrice,
            pricingId: a.pricing_id || a.id || null,
            coinReward,
          };
        });
        if (!mounted) return;
        setPlans(mapped);
        const threeMonthsPlan = mapped.find(p => p.label.toLowerCase().includes('3 month') || p.label.toLowerCase().includes('quarter'));
        if (threeMonthsPlan) setSelectedPlan(threeMonthsPlan);
        else if (mapped.length > 0) setSelectedPlan(mapped[1] ?? mapped[0]);
      } catch (e) {
        console.error("Failed to load pricing", e);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-[1200px] mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">

          {/* Left: Image + Header + Benefits */}
          <div className="flex flex-col gap-8">
            {/* Payment Banner Image */}
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <img
                src={paymentBanner}
                alt="Premium AI Girl"
                className="w-full h-auto object-cover"
              />
            </div>

            <div className="pt-1 sm:pt-2 text-center lg:text-left">
              <h1 className="text-[#ff9903] text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
                Discount Only Today!
              </h1>
              <p className="text-white text-base sm:text-lg mt-3 font-medium">
                Up to 70% off for first subscription
              </p>
            </div>

            <div className="hidden lg:block bg-[#0E0E0E] border border-white/10 rounded-2xl p-6">
              <h3 className="text-[#ff9903] font-semibold mb-4 text-base">Premium Benefits</h3>
              <ul className="space-y-3">
                <BenefitRow>Generate photos</BenefitRow>
                <BenefitRow>
                  {hasActiveSubscription
                    ? `You have ${(user as any)?.subscription_coin_reward || 0} tokens in your plan`
                    : selectedPlan
                      ? `Get ${selectedPlan.coinReward} tokens every ${selectedPlan.label.toLowerCase()}`
                      : 'Get tokens with your subscription'}
                </BenefitRow>
                <BenefitRow>Unlock chat photos</BenefitRow>
                <BenefitRow>Create your own AI Characters</BenefitRow>
                <BenefitRow>Fast response</BenefitRow>
                <BenefitRow>New features priority use</BenefitRow>
                <BenefitRow>Content privacy</BenefitRow>
                <BenefitRow>And much more!</BenefitRow>
              </ul>
            </div>
          </div>

          {/* Right: Pricing container */}
          <div className="space-y-4 sm:space-y-6">
            <Card className="bg-[#0E0E0E] border border-white/10">
              <div className="space-y-3 sm:space-y-4">
                {checkingSubscription ? (
                  <div className="text-sm text-white/50">Loading...</div>
                ) : hasActiveSubscription ? (
                  <div className="rounded-lg bg-[#ff9903]/10 border border-[#ff9903]/30 p-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-[#ff9903] font-medium mb-2">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>You have an active subscription</span>
                    </div>
                    <p className="text-sm text-white/60 mb-3">
                      You already have an active premium subscription. Manage it in your profile.
                    </p>
                    <Button variant="secondary" className="w-full" onClick={() => navigate('/profile')}>
                      Go to Profile
                    </Button>
                  </div>
                ) : plans.length === 0 ? (
                  <div className="text-sm text-white/50">Loading plans...</div>
                ) : (
                  plans.map((p, i) => (
                    <PlanRow key={p.id} plan={p} selected={!!selectedPlan && selectedPlan.id === p.id} onSelect={() => setSelectedPlan(p)} isDefault={i === 1} />
                  ))
                )}
              </div>
            </Card>

            {/* Guarantees */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-xs text-white/70 mt-4 mb-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-[#ff9903]" />
                <span>No commitment. Cancel anytime!</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#ff9903]" />
                <span>30-Day Money-Back Guarantee</span>
              </div>
            </div>

            {/* Continue Button & Agreement */}
            <div className="space-y-3 sm:space-y-4">
              <Button
                variant="primary"
                className="w-full py-3 sm:py-4 text-base sm:text-lg font-bold rounded-xl bg-[#ff9903] hover:bg-[#ffaa33] text-black border-none"
                onClick={handleContinue}
                data-test="premium-continue"
                disabled={!canContinue || payLoading || hasActiveSubscription}
                aria-disabled={!canContinue || payLoading || hasActiveSubscription}
                style={{ background: '#ff9903', color: '#000' }}
              >
                {payLoading ? 'Processing...' : hasActiveSubscription ? 'Already Subscribed' : 'Continue'}
              </Button>

              <label className="flex items-start gap-2 text-[11px] text-white/70 cursor-pointer">
                <input type="checkbox" checked={agree} onChange={() => setAgree((s) => !s)} className="sr-only" />
                <span className="relative flex h-4 w-4 items-center justify-center mt-0.5 flex-shrink-0">
                  <span className={`h-4 w-4 rounded border border-white/30 ${agree ? "opacity-0" : "opacity-100"}`} aria-hidden />
                  <img
                    src={checkboxIcon}
                    alt=""
                    className={`absolute h-4 w-4 transition-opacity duration-150 ${agree ? "opacity-100" : "opacity-0"}`}
                    aria-hidden
                  />
                </span>
                <span>By continuing I agree that specified payment details will be saved and used for the next purchase</span>
              </label>

              {/* Payment Methods */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 mt-2 sm:mt-3 flex-wrap">
                <img src={mastercardIcon} alt="Mastercard" className="h-5 sm:h-6" />
                <img src={visaIcon} alt="Visa" className="h-5 sm:h-6" />
                <img src={maestroIcon} alt="Maestro" className="h-5 sm:h-6" />
                <img src={amexIcon} alt="Amex" className="h-5 sm:h-6" />
                <img src={discoverIcon} alt="Discover" className="h-5 sm:h-6" />
              </div>

              {/* Terms */}
              <p className="text-[10px] sm:text-[11px] leading-relaxed text-white/40 text-center mt-2 sm:mt-3">
                By continuing, you confirm that you are at least 18 years old and agree to an introductory payment for your chosen plan. If you do not cancel at least 24 hours before the end of the introductory period, you will be charged the subsequent period until you cancel. By clicking Continue, you also confirm that you agree to our <Link to="/terms-of-service" className="text-white/60 underline underline-offset-2">Terms &amp; Conditions</Link>.
              </p>
            </div>

            {/* Mobile Benefits */}
            <div className="block lg:hidden bg-[#0E0E0E] border border-white/10 rounded-2xl p-4 sm:p-6 mt-6">
              <h3 className="text-[#ff9903] font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Premium Benefits</h3>
              <ul className="space-y-2 sm:space-y-3">
                <BenefitRow>Generate photos</BenefitRow>
                <BenefitRow>
                  {hasActiveSubscription
                    ? `You have ${(user as any)?.subscription_coin_reward || 0} tokens in your plan`
                    : selectedPlan
                      ? `Get ${selectedPlan.coinReward} tokens every ${selectedPlan.label.toLowerCase()}`
                      : 'Get tokens with your subscription'}
                </BenefitRow>
                <BenefitRow>Unlock chat photos</BenefitRow>
                <BenefitRow>Create your own AI Characters</BenefitRow>
                <BenefitRow>Fast response</BenefitRow>
                <BenefitRow>New features priority use</BenefitRow>
                <BenefitRow>Content privacy</BenefitRow>
                <BenefitRow>And much more!</BenefitRow>
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
