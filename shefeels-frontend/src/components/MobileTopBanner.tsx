import React from "react";
import { useNavigate } from "react-router-dom";
import premiumIcon from "../assets/home/PremiumHeaderIcon.svg";
import timeReducingIcon from "../assets/home/TimeReducingIcon.svg";
import { useCountdown } from "../hooks/useCountdown";

import { useAuth } from "../contexts/AuthContext";

/** MobileTopBanner
 * Accepts optional `className` so parent can position it (absolute)
 * when needed. Kept compact so it can overlap hero gracefully.
 */
type Props = {
  className?: string;
};

const MobileTopBanner: React.FC<Props> = ({ className = "" }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const timeLeft = useCountdown(6 * 60);

  if (user?.hasActiveSubscription) return null;

  return (
    <div className={className + " w-full"}>
      <div className="flex items-center gap-1.5 w-full pr-1.5">
        {/* Left: premium pill - ultra compact */}
        <div className="flex-1 min-w-0">
          <button
            onClick={() => navigate('/premium')}
            className="flex items-center justify-center gap-1 px-1.5 py-1 text-xs font-medium text-black shadow-[0_10px_22px_rgba(245,120,146,0.25)] w-full overflow-hidden whitespace-nowrap"
            style={{
              borderRadius: 14,
              background: 'var(--promo-gradient)'
            }}
          >
            <img src={premiumIcon} alt="" className="h-3.5 w-3.5 shrink-0" />
            <span className="inline-flex items-center rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold text-pink-600 shrink-0">
              70% off
            </span>
          </button>
        </div>

        {/* Right: timer */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-0.5 text-[11px] leading-none">
            <img src={timeReducingIcon} alt="timer" className="h-3 w-3" />
            <span className="font-semibold tabular-nums" style={{ color: 'var(--primary)' }}>
              {timeLeft}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileTopBanner;
