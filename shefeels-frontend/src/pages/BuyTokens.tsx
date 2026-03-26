import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import tokenIcon from '../assets/token.svg';
import upiIcon from '../assets/payments/UPI.svg';
import tokenBenefitCheck from '../assets/payments/token-benefit-check.svg';
import { buildApiUrl } from '../utils/apiBase';
import fetchWithAuth from '../utils/fetchWithAuth';
import apiClient from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

type PricingPlan = {
  id?: string | number;
  pricing_id?: string;
  pricingId?: string;
  price?: number | string;
  currency?: string;
  discount?: number | string;
  billing_cycle?: string;
  billingCycle?: string;
  coin_reward?: number | string;
  coinReward?: number | string;
};

const FIGMA_PACKS = [
  { amount: 200, price: 799, badge: undefined },
  { amount: 400, price: 1999, badge: undefined },
  { amount: 550, price: 2999, badge: '10% Bonus' },
  { amount: 1100, price: 6999, badge: '10% Bonus' },
] as const;

type OptionTileProps = {
  amount: number;
  priceLabel: string;
  badge?: string;
  isSelected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
};

function formatAmount(value: number) {
  return value.toLocaleString('en-IN');
}

function formatPrice(price: number, currency = 'USD') {
  const normalized = String(currency || 'USD').toUpperCase();
  if (normalized === 'INR') return `₹ ${price.toLocaleString('en-IN')}`;
  if (normalized === 'USD') return `$ ${price.toLocaleString('en-US')}`;
  return `${normalized} ${price.toLocaleString()}`;
}

function OptionTile({ amount, priceLabel, badge, isSelected, disabled, onSelect }: OptionTileProps) {
  const handleClick = () => {
    if (disabled) return;
    onSelect?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.();
    }
  };

  return (
    <div
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect && !disabled ? 0 : undefined}
      aria-disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`relative flex min-h-[160px] w-full flex-col justify-between overflow-hidden rounded-2xl border px-5 pb-7 pt-6 transition-all ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
      style={{
        borderColor: isSelected ? 'rgba(166, 130, 255, 0.95)' : 'rgba(158, 130, 243, 0.35)',
        background: `
          radial-gradient(120% 120% at 100% 0%, rgba(127, 90, 240, 0.32) 0%, rgba(127, 90, 240, 0) 38%),
          radial-gradient(120% 120% at 0% 100%, rgba(229, 49, 112, 0.18) 0%, rgba(229, 49, 112, 0) 42%),
          linear-gradient(180deg, rgba(18, 15, 28, 0.94) 0%, rgba(12, 10, 19, 0.96) 100%)
        `,
        boxShadow: isSelected
          ? '0 0 0 1px rgba(166, 130, 255, 0.2), 0 18px 40px rgba(0, 0, 0, 0.28)'
          : '0 16px 36px rgba(0, 0, 0, 0.18)',
      }}
    >
      {badge ? (
        <div
          className="absolute right-0 top-0 flex h-[34px] min-w-[118px] items-center justify-center rounded-bl-2xl rounded-tr-2xl px-4 text-[13px] font-medium tracking-[0.2px] text-white/85"
          style={{
            background: 'linear-gradient(180deg, #7F5AF0 0%, #E53170 100%)',
          }}
        >
          {badge}
        </div>
      ) : null}

      <div className="flex items-center gap-[10px]">
        <img src={tokenIcon} alt="token" className="h-[34px] w-[34px] shrink-0" />
        <span className="text-[34px] font-bold leading-10 tracking-[0.68px] text-white">
          {formatAmount(amount)}
        </span>
      </div>

      <div className="flex items-center gap-1 text-white">
        <img src={upiIcon} alt="" aria-hidden className="h-6 w-6 shrink-0 rounded-[6px] bg-white object-contain p-[2px]" />
        <span className="text-[26px] font-normal leading-9 tracking-[0.52px]">
          {priceLabel}
        </span>
      </div>
    </div>
  );
}

export default function BuyTokens() {
  const [selectedTokens, setSelectedTokens] = React.useState<number | undefined>(FIGMA_PACKS[0].amount);
  const [plans, setPlans] = React.useState<PricingPlan[]>([]);
  const [payLoading, setPayLoading] = React.useState(false);
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await apiClient.getCoinPricing();
        if (!mounted) return;
        setPlans(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load coin pricing', error);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const displayedPlans = React.useMemo(() => {
    const normalizedPlans = plans
      .map((plan) => ({
        raw: plan,
        amount: Number(plan.coin_reward || plan.coinReward || 0),
        pricingId: plan.pricing_id || plan.pricingId || plan.id,
        currency: String(plan.currency || 'INR'),
      }))
      .filter((plan) => plan.amount > 0 && plan.pricingId)
      .sort((a, b) => a.amount - b.amount)
      .slice(0, 4);

    return FIGMA_PACKS.map((pack, index) => {
      const matchedPlan = normalizedPlans[index] || null;
      return {
        raw: matchedPlan?.raw ?? null,
        amount: pack.amount,
        price: pack.price,
        badge: pack.badge,
        currency: matchedPlan?.currency || 'INR',
        pricingId: matchedPlan?.pricingId || null,
      };
    });
  }, [plans]);

  const selectedPlan = displayedPlans.find((plan) => plan.amount === selectedTokens) || displayedPlans[0] || null;
  const canPurchase = Boolean((user as any)?.hasActiveSubscription);

  const handlePay = async () => {
    if (!selectedPlan) {
      try { window.alert('Please select a token pack first'); } catch {}
      return;
    }

    if (!selectedPlan.pricingId) {
      try { window.alert('This pack is unavailable right now. Please refresh and try again.'); } catch {}
      return;
    }

    if (!user || !token) {
      navigate('/login', { state: { background: location } });
      return;
    }

    setPayLoading(true);
    try {
      const url = buildApiUrl('/api/v1/tagada/checkout/create-session');
      const tokenOnly = String(token).replace(/^bearer\s+/i, '').trim();

      const payload = {
        price_id: selectedPlan.pricingId,
        currency: selectedPlan.currency || 'USD',
      };

      const res = await fetchWithAuth(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `bearer ${tokenOnly}`,
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text().catch(() => '');
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error('Invalid JSON from server');
      }

      if (!res.ok) {
        throw new Error(data?.message || data?.detail || data?.error || `HTTP ${res.status}`);
      }

      if (!data.checkout_url) {
        throw new Error('No checkout URL returned');
      }

      window.location.href = data.checkout_url;
    } catch (error: any) {
      console.error('Token checkout failed', error);
      try { window.alert(error?.message || 'Failed to create checkout session'); } catch {}
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0E16] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1480px]">
        <h1 className="mb-8 text-[32px] font-bold leading-[1.15] text-white sm:text-[40px]">
          Buy Tokens
        </h1>

        <section
          className="relative overflow-hidden rounded-[26px] border px-8 py-8 sm:px-10 sm:py-10 lg:px-[32px] lg:py-[32px]"
          style={{
            borderColor: 'rgba(158, 130, 243, 0.3)',
            background: `
              radial-gradient(95% 80% at 22% 18%, rgba(127, 90, 240, 0.22) 0%, rgba(127, 90, 240, 0) 46%),
              radial-gradient(90% 90% at 18% 100%, rgba(229, 49, 112, 0.18) 0%, rgba(229, 49, 112, 0) 48%),
              linear-gradient(180deg, rgba(20, 16, 31, 0.98) 0%, rgba(19, 14, 28, 0.98) 100%)
            `,
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.18)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background: `
                radial-gradient(40% 45% at 71% 14%, rgba(127, 90, 240, 0.34) 0%, rgba(127, 90, 240, 0) 52%),
                radial-gradient(32% 30% at 78% 68%, rgba(229, 49, 112, 0.18) 0%, rgba(229, 49, 112, 0) 58%)
              `,
            }}
          />

          <div className="relative grid gap-10 lg:grid-cols-[minmax(320px,1fr)_minmax(520px,674px)] lg:items-start lg:gap-12">
            <div className="max-w-[520px]">
              <h2 className="max-w-[648px] text-[32px] font-semibold leading-[1.15] text-white sm:text-[38px] sm:leading-[46px]">
                Get an <span className="text-[#7F5AF0]">exclusive Package</span> discount only now!
              </h2>

              <div
                className="mt-10 max-w-[451px] rounded-2xl border border-white/[0.03] bg-white/[0.04] px-7 py-6"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
              >
                <h3 className="text-[26px] font-medium leading-[34px] tracking-[0.52px] text-[#7F5AF0]">
                  Token Benefits
                </h3>

                <div className="mt-[18px] space-y-[6px]">
                  {['Create AI Girlfriend', 'Voice Messages', 'AI Image generation'].map((benefit) => (
                    <div key={benefit} className="flex items-center gap-3">
                      <img src={tokenBenefitCheck} alt="" aria-hidden className="h-5 w-5 shrink-0" />
                      <span className="text-[18px] font-normal leading-[34px] tracking-[0.36px] text-white">
                        {benefit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="w-full">
              {displayedPlans.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-6 py-8 text-white/60">
                  Loading packs...
                </div>
              ) : (
                <>
                  <div className="grid gap-[26px] sm:grid-cols-2">
                    {displayedPlans.map((plan) => (
                      <OptionTile
                        key={`${plan.amount}-${plan.price}`}
                        amount={plan.amount}
                        priceLabel={formatPrice(plan.price, 'INR')}
                        badge={plan.badge}
                        isSelected={selectedPlan?.amount === plan.amount}
                        disabled={!plan.pricingId}
                        onSelect={() => setSelectedTokens(plan.amount)}
                      />
                    ))}
                  </div>

                  <div className="mt-[26px]">
                    <Button
                      onClick={handlePay}
                      disabled={!selectedPlan || !selectedPlan.pricingId || !canPurchase || payLoading}
                      className="flex h-[70px] w-full items-center justify-center rounded-xl border-0 px-6 text-[18px] font-semibold text-white shadow-none transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        background: 'linear-gradient(90deg, rgba(215,184,255,0.95) 0%, rgba(127,90,240,0.95) 58%, rgba(200,162,255,0.95) 100%)',
                      }}
                    >
                      <span className="inline-flex items-center gap-3">
                        <span>{payLoading ? 'Processing...' : 'Pay with UPI'}</span>
                        <img src={upiIcon} alt="UPI" className="h-[30px] w-[74px] rounded-[7px] bg-white px-[9px] py-[5px]" />
                      </span>
                    </Button>

                    {!canPurchase ? (
                      <p className="mt-3 text-sm text-white/55">
                        Activate Premium first to purchase token packs.
                      </p>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
