import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Clock } from 'lucide-react';

export const PremiumBanner: React.FC = () => {
  const navigate = useNavigate();

  return (
    <button 
      onClick={() => navigate('/premium')}
      className="w-full px-4 sm:px-6 py-2.5 md:hidden cursor-pointer"
      style={{
        background: 'linear-gradient(90deg, #FF69B4 17.02%, #FFA07A 100%)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-white" fill="white" />
          <span className="text-white font-semibold text-sm">Get Premium</span>
          <span 
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              color: '#FF1493'
            }}
          >
            90% off
          </span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-white" />
          <span className="text-white text-xs font-medium tabular-nums">
            00:00
          </span>
        </div>
      </div>
    </button>
  );
};

export default PremiumBanner;
