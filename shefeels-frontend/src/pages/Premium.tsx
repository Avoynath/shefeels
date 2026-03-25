import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Button from "../components/Button";
import { buildApiUrl } from "../utils/apiBase";
import fetchWithAuth from "../utils/fetchWithAuth";
import visaIcon from "../assets/payments/VISA.svg";
import mastercardIcon from "../assets/payments/mastercard.svg";
import amexIcon from "../assets/payments/AMEX.svg";
import discoverIcon from "../assets/payments/Discover.svg";
import maestroIcon from "../assets/payments/maestro.svg";
import checkboxIcon from "../assets/payments/Checkbox.svg";
import noCommitmentIcon from "../assets/payments/NoCommitment.svg";
import moneyBackIcon from "../assets/payments/MoneyBack.svg";
import googlePayIcon from "../assets/payments/GooglePayIcon.svg";
import paymentBanner from "../assets/payments/Background.png";

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
  if (lower.includes("day")) return quantity;
  return null;
}

function getPlanPriority(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("1 month") || lower === "monthly") return 0;
  if (lower.includes("12 month") || lower.includes("year")) return 1;
  if (lower.includes("3 month") || lower.includes("quarter")) return 2;
  return 99;
}

function getPlanDisplayLabel(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("1 month") || lower === "monthly") return "1 month";
  if (lower.includes("12 month") || lower.includes("year")) return "12 months";
  if (lower.includes("3 month") || lower.includes("quarter")) return "3 months";
  return label;
}

function getPlanDisplayPerDay(plan: Plan) {
  const priority = getPlanPriority(plan.label);
  if (priority === 0) return "0.66";
  if (priority === 1) return "0.33";
  if (priority === 2) return "0.48";
  const days = getBillingDays(plan.label);
  return days ? (plan.discountedPrice / days).toFixed(2) : plan.discountedPrice.toFixed(2);
}

function getDefaultSelectedPlan(plans: Plan[]) {
  return plans.find((p) => getPlanPriority(p.label) === 1) ?? plans[0] ?? null;
}

function PlanOption({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
}) {
  const perDay = getPlanDisplayPerDay(plan);
  const displayLabel = getPlanDisplayLabel(plan.label);
  const isPopular = getPlanPriority(plan.label) === 1;
  const hasDiscount = plan.discountPct > 0 && Math.abs(plan.discountedPrice - plan.price) > 0.001;

  return (
    <label
      className={`relative block w-full cursor-pointer rounded-[16px] border text-left transition duration-200 ${
        selected
          ? "scale-[1.02] border-[#9B7CFF] bg-[linear-gradient(180deg,rgba(112,83,201,0.5)_0%,rgba(84,61,147,0.5)_100%)] shadow-[0_0_0_1px_rgba(129,92,240,0.72),0_0_28px_rgba(129,92,240,0.32)]"
          : "border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] hover:border-[rgba(129,92,240,0.45)]"
      }`}
    >
      <input
        type="radio"
        name="premium-plan"
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5 sm:py-[18px]">
        <div className="min-w-0">
          <p className="text-[16px] font-semibold capitalize leading-6 text-white">{displayLabel}</p>
          {plan.discountPct > 0 && (
            <div className="mt-1.5 inline-flex rounded-[7px] bg-[#5ED6F4] px-2 py-0.5 text-[12px] font-bold leading-4 text-white">
              {plan.discountPct}% OFF
            </div>
          )}
          <div className="mt-2 flex items-center gap-2 text-[11px] leading-4">
            {hasDiscount && <span className="text-white/40 line-through">{formatCurrency(plan.price, plan.currency)}</span>}
            <span className="text-white/65">{formatCurrency(plan.discountedPrice, plan.currency)}</span>
          </div>
        </div>

        <div className="flex items-center text-white">
          <span className="text-[34px] font-bold leading-none sm:text-[46px]">{perDay}</span>
          <div className="ml-2 flex flex-col items-start leading-none">
            <span className="text-[13px] font-semibold uppercase">{plan.currency}</span>
            <span className="mt-1 text-[11px] text-white/70">per day</span>
          </div>
        </div>
      </div>

      {isPopular && (
        <div className="absolute inset-x-0 -bottom-[13px] flex justify-center">
          <span className="rounded-full bg-[#815CF0] px-5 py-1 text-[11px] font-bold uppercase tracking-[0.02em] text-white">
            Most Popular
          </span>
        </div>
      )}
    </label>
  );
}

function BenefitRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-[10px] text-[16px] leading-[1.2] text-white">
      <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#815CF0]" />
      <span>{children}</span>
    </li>
  );
}

export default function Premium() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [agree, setAgree] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => getPlanPriority(a.label) - getPlanPriority(b.label));
  }, [plans]);

  const planToUse = selectedPlan ?? (sortedPlans.length > 0 ? getDefaultSelectedPlan(sortedPlans) : null);

  const canContinue = useMemo(() => {
    return !!agree && !hasActiveSubscription && !!planToUse;
  }, [agree, hasActiveSubscription, planToUse]);

  const handleContinue = async () => {
    if (!user) {
      navigate("/login", { state: { background: location } });
      return;
    }

    if (hasActiveSubscription) {
      try {
        window.alert("You already have an active subscription. Please manage or cancel your current subscription before purchasing a new one.");
      } catch {}
      return;
    }

    if (!planToUse) {
      return;
    }

    const priceId = planToUse.pricingId ?? planToUse.id;
    if (!priceId) return;

    setPayLoading(true);
    try {
      const url = buildApiUrl("/api/v1/tagada/checkout/create-session");
      const res = await fetchWithAuth(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price_id: priceId,
          currency: planToUse.currency || "USD",
        }),
      });

      const txt = await res.text().catch(() => "");
      let data: any = {};
      try {
        data = txt ? JSON.parse(txt) : {};
      } catch {
        throw new Error("Invalid JSON from server");
      }

      if (!res.ok) {
        throw new Error(data?.message || data?.detail || data?.error || `HTTP ${res.status}`);
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      console.error("Premium checkout failed:", err);
      try {
        window.alert(err?.message || "Failed to create checkout session. Please try again.");
      } catch {}
    } finally {
      setPayLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function checkSubscription() {
      try {
        if ((user as any)?.hasActiveSubscription) {
          setHasActiveSubscription(true);
        }
      } catch (e) {
        console.error("Failed to check subscription", e);
      } finally {
        if (mounted) setCheckingSubscription(false);
      }
    }
    checkSubscription();
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetchWithAuth(buildApiUrl("/subscription/get-pricing"));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const mapped: Plan[] = (Array.isArray(data) ? data : []).map((a: any) => {
          const rawBilling = a.billing_cycle || a.billingCycle || "";
          const price = Number(a.price || 0);
          const discountPct = Number(a.discount || 0);
          return {
            id: String(a.id || a.pricing_id || Math.random()),
            label: rawBilling,
            price,
            discountPct,
            currency: a.currency || "USD",
            discountedPrice: Math.max(0, +(price * (1 - discountPct / 100)).toFixed(2)),
            pricingId: a.pricing_id || a.id || null,
            coinReward: Number(a.coin_reward || a.coinReward || 0),
          };
        });

        if (!mounted) return;
        const ordered = mapped.sort((a, b) => getPlanPriority(a.label) - getPlanPriority(b.label));
        setPlans(ordered);
        setSelectedPlan(getDefaultSelectedPlan(ordered));
      } catch (e) {
        console.error("Failed to load pricing", e);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedPlanSummary = planToUse;
  const originalPrice = selectedPlanSummary?.price ?? 0;
  const discountedPrice = selectedPlanSummary?.discountedPrice ?? 0;
  const savedAmount = Math.max(0, +(originalPrice - discountedPrice).toFixed(2));

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto w-full max-w-[1602px] px-0 py-[34px]">
        <section className="overflow-hidden rounded-[12px] border border-[rgba(219,176,239,0.4)] bg-[radial-gradient(circle_at_50%_23%,rgba(149,113,255,0.18)_0%,rgba(0,0,0,0.92)_34%,rgba(0,0,0,0.98)_56%,rgba(72,12,34,0.95)_100%)] shadow-[0_35px_90px_rgba(0,0,0,0.45)]">
          <div className="grid gap-10 px-6 py-8 lg:grid-cols-[minmax(0,551px)_minmax(0,673px)] lg:justify-center lg:gap-[94px] lg:px-[104px] lg:py-[50px]">
            <div className="flex flex-col gap-[44px]">
              <div className="flex flex-col gap-[57px]">
                <div className="max-w-[434px] text-[34px] font-bold leading-[1.14] text-white sm:text-[44px]">
                  <span>Get Exclusive</span>
                  <br />
                  <span>Discount Only Today!</span>
                </div>

                <div className="max-w-[327px]">
                  <h2 className="text-[26px] font-bold leading-[1.2] text-[#815CF0]">Premium Benefits</h2>
                  <ul className="mt-[14px] space-y-[13px]">
                    <BenefitRow>Generate photos</BenefitRow>
                    <BenefitRow>Get 100 tokens every month</BenefitRow>
                    <BenefitRow>Unlock chat photos</BenefitRow>
                    <BenefitRow>Create your own AI Characters</BenefitRow>
                    <BenefitRow>Fast response</BenefitRow>
                    <BenefitRow>New features priority use</BenefitRow>
                    <BenefitRow>Content privacy</BenefitRow>
                    <BenefitRow>And much more!</BenefitRow>
                  </ul>
                </div>
              </div>

              <div className="w-full max-w-[551px]">
                <h3 className="text-[26px] font-semibold leading-[1.2] text-white">Payment Information</h3>

                <div className="mt-6">
                  <button
                    type="button"
                    className="flex h-16 w-full items-center justify-center gap-3 rounded-[14px] bg-white text-[20px] font-medium text-[#292929]"
                  >
                    <img src={googlePayIcon} alt="Google Pay" className="h-8 w-8" />
                    <span>Pay</span>
                  </button>

                  <div className="mt-5 flex items-center gap-4">
                    <div className="h-px flex-1 bg-white/20" />
                    <span className="text-[18px] text-white">Or</span>
                    <div className="h-px flex-1 bg-white/20" />
                  </div>
                </div>

                <div className="mt-[22px]">
                  <p className="text-[22px] font-semibold leading-[1.2] text-white">Proceed with card</p>

                  <div className="mt-[14px] space-y-4">
                    <div>
                      <label className="block text-[16px] leading-[26px] text-white">Credit or Debit Card Number</label>
                      <input
                        readOnly
                        value="XXXX XXXX XXXX XXXX"
                        className="mt-2 h-16 w-full rounded-[14px] border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.04)] px-5 text-[16px] text-[rgba(255,255,255,0.3)] outline-none"
                      />
                    </div>

                    <div className="grid gap-[23px] sm:grid-cols-2">
                      <div>
                        <label className="block text-[16px] leading-[26px] text-white">Expiry Date</label>
                        <input
                          readOnly
                          value="MM/YY"
                          className="mt-2 h-16 w-full rounded-[14px] border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.04)] px-5 text-[16px] text-[rgba(255,255,255,0.3)] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[16px] leading-[26px] text-white">CVV/CVC</label>
                        <input
                          readOnly
                          value="CVV"
                          className="mt-2 h-16 w-full rounded-[14px] border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.04)] px-5 text-[16px] text-[rgba(255,255,255,0.3)] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={handleContinue}
                    disabled={!canContinue || payLoading}
                    className="mt-[31px] h-16 w-full rounded-[12px] border-none bg-[#34C759] text-[18px] font-semibold text-white"
                    style={{ background: "#34C759", borderColor: "rgba(255,255,255,0.45)" }}
                  >
                    {payLoading ? "Processing..." : "Continue"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="w-full max-w-[673px]">
              <div className="text-center">
                <h2 className="text-[34px] font-bold leading-[1.14] text-white">Choose your plan</h2>
                <div className="mt-2 inline-flex items-center gap-[6px] text-[16px] text-white/70">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00E6A7] text-[13px] text-black">✓</span>
                  <span>Your payment is 100% anonymous!</span>
                </div>
              </div>

              <div
                className="mt-[30px] overflow-hidden rounded-[10px] border border-[rgba(255,166,0,0.12)] bg-[rgba(71,37,8,0.92)] bg-cover bg-center bg-no-repeat px-4 py-2 text-center text-[14px] text-[#FBB03B]"
                style={{ backgroundImage: `url(${paymentBanner})` }}
              />

              <div className="mt-4 space-y-3 pb-[18px]">
                {checkingSubscription ? (
                  <div className="rounded-[16px] border border-white/10 bg-[rgba(255,255,255,0.04)] px-5 py-6 text-center text-white/60">
                    Loading...
                  </div>
                ) : hasActiveSubscription ? (
                  <div className="rounded-[16px] border border-[#815CF0]/40 bg-[rgba(129,92,240,0.08)] px-5 py-6 text-center">
                    <div className="flex items-center justify-center gap-2 text-[#CFA8F9]">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">You already have an active subscription</span>
                    </div>
                    <p className="mt-2 text-sm text-white/65">Please manage your current subscription from your profile.</p>
                  </div>
                ) : (
                  sortedPlans.map((plan) => (
                    <PlanOption
                      key={plan.id}
                      plan={plan}
                      selected={!!selectedPlan && selectedPlan.id === plan.id}
                      onSelect={() => setSelectedPlan(plan)}
                    />
                  ))
                )}
              </div>

              <div className="flex flex-col items-center justify-center gap-4 text-[15px] text-white/75 sm:flex-row sm:gap-9">
                <div className="flex items-center gap-[6px]">
                  <img src={noCommitmentIcon} alt="" className="h-[22px] w-[22px]" />
                  <span>No commitment. Cancel anytime!</span>
                </div>
                <div className="flex items-center gap-[6px]">
                  <img src={moneyBackIcon} alt="" className="h-[22px] w-[22px]" />
                  <span>30-Day Money-Back Guarantee</span>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleContinue}
                disabled={!canContinue || payLoading}
                className="mt-4 h-16 w-full rounded-[12px] border-none bg-[#7F5AF0] text-[18px] font-semibold text-white"
                style={{ background: "#7F5AF0", borderColor: "rgba(255,255,255,0.45)" }}
              >
                {payLoading ? "Processing..." : hasActiveSubscription ? "Already Subscribed" : "Continue"}
              </Button>

              <label className="mt-[18px] flex items-start gap-[6px] text-[12px] leading-[1.25] text-white/55">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={() => setAgree((prev) => !prev)}
                  className="sr-only"
                />
                <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  <span className={`h-4 w-4 rounded border border-white/25 ${agree ? "opacity-0" : "opacity-100"}`} />
                  <img src={checkboxIcon} alt="" className={`absolute h-4 w-4 ${agree ? "opacity-100" : "opacity-0"}`} />
                </span>
                <span>By continuing I agree that specified payment details will be saved and used for the next purchase</span>
              </label>

              <div className="mt-5 rounded-[12px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-[18px] py-5">
                <div className="mx-auto max-w-[507px]">
                  <h3 className="text-[18px] font-medium text-white">Order Summary</h3>
                  <div className="mt-4 space-y-[8px] text-[15px] text-white/70">
                    <div className="flex items-center justify-between gap-4">
                      <span>Product</span>
                      <span>{selectedPlanSummary ? `${getPlanDisplayLabel(selectedPlanSummary.label)} subscription` : "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Discount</span>
                      <span>{selectedPlanSummary ? `-${selectedPlanSummary.discountPct}%` : "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Your offer</span>
                      <span className="flex items-center gap-2">
                        <span className="text-[#E15454] line-through">{selectedPlanSummary ? formatCurrency(originalPrice, selectedPlanSummary.currency) : "-"}</span>
                        <span className="text-[#34C759]">{selectedPlanSummary ? formatCurrency(discountedPrice, selectedPlanSummary.currency) : "-"}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>You just saved</span>
                      <span>{selectedPlanSummary ? formatCurrency(savedAmount, selectedPlanSummary.currency) : "-"}</span>
                    </div>
                  </div>

                  <div className="my-4 h-px bg-white/10" />

                  <div className="flex items-center justify-between gap-4 text-[18px] font-medium text-white">
                    <span>Total to pay</span>
                    <span>{selectedPlanSummary ? formatCurrency(discountedPrice, selectedPlanSummary.currency) : "-"}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <img src={mastercardIcon} alt="Mastercard" className="h-9" />
                <img src={visaIcon} alt="Visa" className="h-9" />
                <img src={maestroIcon} alt="Maestro" className="h-9" />
                <img src={amexIcon} alt="Amex" className="h-9" />
                <img src={discoverIcon} alt="Discover" className="h-9" />
              </div>

              <p className="mx-auto mt-8 max-w-[673px] text-center text-[14px] leading-5 text-[#9B9B9B]">
                By continuing, you confirm that you are at least 18 years old and agree to an introductory payment of{" "}
                {selectedPlanSummary ? formatCurrency(discountedPrice, selectedPlanSummary.currency) : "the selected amount"} for your chosen plan. If you do not cancel at least 24 hours before the end of the introductory period, you will automatically be charged{" "}
                {selectedPlanSummary ? formatCurrency(originalPrice, selectedPlanSummary.currency) : "the standard price"} for each subsequent period until you cancel. By clicking Continue, you also confirm that you agree to our{" "}
                <Link to="/terms-of-service" className="underline underline-offset-2 text-white/80">
                  Terms &amp; Conditions
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
