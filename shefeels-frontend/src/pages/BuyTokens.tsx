import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { buildApiUrl } from '../utils/apiBase';
import fetchWithAuth from '../utils/fetchWithAuth';
import tokenIcon from "../assets/token.svg";
import priceIcon from "../assets/payments/DollarCurrency.svg";
import Button from "../components/Button";
import backgroundImage from "../assets/payments/BuyTokenBackground.webp";
// TopUpModal temporarily disabled to remove the billing page/modal
// import TopUpModal from '../components/TopUpModal';
import apiClient from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

function OptionTile({ amount, price, badge, onSelect, disabled, isSelected }: { amount: string; price: string; badge?: string; onSelect?: () => void; disabled?: boolean; isSelected?: boolean }) {
  const handleClick = () => {
    if (disabled) return;
    onSelect?.();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.();
    }
  };

  return (
    <div
      className={`relative flex flex-col justify-center items-center w-full max-w-[180px] min-h-[150px] p-6 transition-all ${
        onSelect && !disabled ? 'cursor-pointer' : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={{
        borderRadius: '16px',
        border: isSelected ? '0.6px solid #FFC54D' : '0.6px solid #C09B62',
        background: 'linear-gradient(124deg, #000000 37.56%, rgba(255, 183, 3, 0.15) 203.74%)',
        boxShadow: isSelected 
          ? '0 0 30px rgba(255, 197, 77, 0.4), 0 4px 20px rgba(0, 0, 0, 0.2)' 
          : '0 0 20px rgba(192, 155, 98, 0.2), 0 4px 15px rgba(0, 0, 0, 0.15)',
        overflow: 'hidden',
      }}
      onClick={handleClick}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect && !disabled ? 0 : undefined}
      onKeyDown={handleKey}
      aria-disabled={disabled}
    >
      {badge && (
        <div 
          className="absolute top-0 right-0 px-3 py-1 text-[#000] text-xs font-semibold"
          style={{
            background: '#FFC54D',
            borderRadius: '0 16px 0 12px',
          }}
        >
          {badge}
        </div>
      )}

      <div className="flex items-center justify-center gap-2 mb-3">
        <img src={tokenIcon} alt="token" className="h-6 w-6" />
        <div className="text-4xl font-bold text-white">{amount}</div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <img src={priceIcon} alt="price" className="h-5 w-5" />
        <div className="text-lg font-semibold text-white/90">{price}</div>
      </div>
    </div>
  );
}

export default function BuyTokens() {
  // Top-up modal is disabled for now — keep selectedTokens for future use
  const [selectedTokens, setSelectedTokens] = React.useState<number | undefined>(undefined);
  const [plans, setPlans] = React.useState<any[]>([]);
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [payLoading, setPayLoading] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await apiClient.getCoinPricing();
        if (!mounted) return;
        const arr = Array.isArray(data) ? data : [];
        setPlans(arr);
        // If no selection yet, default to the first recurring plan (or first plan)
        if (!selectedTokens) {
          try {
            const recurring = arr.filter((p: any) => String(p.billing_cycle || p.billingCycle || '').toLowerCase().includes('one'));
            const first = recurring.length ? recurring[0] : arr[0];
            if (first) {
              const amt = Number(first.coin_reward || (first as any).coinReward || 0);
              if (amt) setSelectedTokens(amt);
            }
          } catch (e) {}
        }
      } catch (err) {
        console.error('Failed to load coin pricing', err);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);
  // Show only recurring plans (exclude one-time packs)
  const recurringPlans = plans.filter((p) => {
    try {
      return String(p.billing_cycle || p.billingCycle || '')
        .toLowerCase()
        .includes('one');
    } catch {
      return true;
    }
  });
  
  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-[#000]">

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-start pt-6 pb-10 px-2 sm:px-6">
        <div className="w-full max-w-6xl">
          <h1 className="text-4xl font-bold text-white mb-8">Buy Tokens</h1>
        </div>

        {/* Main Container */}
        <div 
          className="w-full max-w-6xl py-6 px-2 sm:py-8 sm:px-4"
          style={{
            borderRadius: '26px',
            border: '1px solid rgba(192, 155, 98, 0.60)',
            background: 'rgba(255, 255, 255, 0.06)',
            boxShadow: '0 0 30px 0 rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Banner Section */}
          <div className="w-full mb-8">
            <div 
              className="relative rounded-[20px] overflow-hidden p-8 sm:p-12 text-center bg-black/30"
              style={{
                backgroundImage: `url(${backgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backdropFilter: 'blur(6px)',
              }}
            >
              {/* Dark overlay to improve text readability */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
              <div className="relative">
                <h2
                  className="text-2xl sm:text-4xl mb-4"
                  style={{
                    color: 'var(--Grays-White, var(--Grays-White, #FFF))',
                    textAlign: 'center',
                    fontStyle: 'normal',
                    fontWeight: 600,
                    lineHeight: '42px',
                  }}
                >
                  Get an exclusive Package discount <br />only now!
                </h2>
                <p
                  className="text-sm sm:text-base max-w-2xl mx-auto"
                  style={{
                    color: 'rgba(255, 255, 255, 0.80)',
                    textAlign: 'center',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    lineHeight: '28px',
                  }}
                >
                  Purchase token packs at discounted rates and enjoy uninterrupted access to our premium features. Hurry, these offers are for a limited time only!
                </p>
              </div>
            </div>
          </div>

          {/* Token Options */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-8">
            {plans.length === 0 ? (
              <div className="text-sm text-white/50">Loading packs...</div>
            ) : (
              recurringPlans.map((p) => {
                const amount = String(p.coin_reward || p.coinReward || 0);
                const price = Number(p.price || 0);
                const badge = p.discount ? `${Number(p.discount)}% Bonus` : undefined;
                const isSelected = selectedTokens === Number(amount);
                return (
                  <OptionTile
                    key={p.pricing_id || p.id}
                    amount={amount}
                    price={`${price.toLocaleString()}`}
                    badge={badge}
                    onSelect={() => { setSelectedTokens(Number(amount)); }}
                    disabled={!((user as any)?.hasActiveSubscription)}
                    isSelected={isSelected}
                  />
                );
              })
            )}
          </div>

          {/* Pay Button */}
          <div className="w-full max-w-md mx-auto px-4">
            <Button
              onClick={async () => {
              if (!selectedTokens) {
                // no selection
                try { window?.alert('Please select a token pack first'); } catch {}
                return;
              }
              if (!user) {
                // redirect to login
                navigate('/login', { state: { background: location } });
                return;
              }

              const plan = plans.find((pp: any) => Number(pp.coin_reward || pp.coinReward || 0) === Number(selectedTokens));
              if (!plan) {
                try { window?.alert('Selected pack not found. Please reload and try again.'); } catch {}
                return;
              }

              setPayLoading(true);
              try {
                const url = buildApiUrl('/api/v1/tagada/checkout/create-session');
                if (!token) {
                  navigate('/login', { state: { background: location } });
                  return;
                }
                const tokenOnly = String(token).replace(/^bearer\s+/i, '').trim();

                  const payload = {
                    price_id: plan.pricing_id || plan.pricingId || plan.id,
                    currency: plan.currency || 'USD',
                  };

                  const res = await fetchWithAuth(url, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `bearer ${tokenOnly}`,
                    },
                    body: JSON.stringify(payload),
                  });

                  const txt = await res.text().catch(() => '');
                  let data: any = {};
                  try { data = txt ? JSON.parse(txt) : {}; } catch (err) { throw new Error('Invalid JSON from server'); }
                  if (!res.ok) {
                    const msg = data?.message || data?.detail || data?.error || `HTTP ${res.status}`;
                    throw new Error(msg);
                  }

                  if (data.checkout_url) {
                    window.location.href = data.checkout_url;
                  } else {
                    throw new Error('No checkout URL returned');
                  }
                } catch (err: any) {
                  console.error('Token checkout failed', err);
                  try { window?.alert(err?.message || 'Failed to create checkout session'); } catch {}
              } finally {
                setPayLoading(false);
              }
            }}
            disabled={!selectedTokens || !(user as any)?.hasActiveSubscription || payLoading}
            className="w-full py-3 text-[#000] font-bold text-lg shadow-lg transition-all hover:shadow-xl"
            style={{
              borderRadius: '60px',
              background: 'linear-gradient(90deg, #FFC54D 0%, #FFD784 100%)',
            }}
          >
              <span className="inline-flex items-center justify-center gap-2">
                {payLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  "Pay"
                )}
              </span>
          </Button>
          </div>
        </div>
      </div>
      {/* Top up modal disabled: billing/payment page removed temporarily */}
    </div>
  );
}
