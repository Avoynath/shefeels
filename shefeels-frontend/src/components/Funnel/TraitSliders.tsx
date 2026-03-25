import React from 'react';

interface TraitSlidersProps {
  libido: number;
  kink: number;
  nudity: number;
  onChange: (key: 'libido' | 'kink' | 'nudity', value: number) => void;
}

export default function TraitSliders({ libido, kink, nudity, onChange }: TraitSlidersProps) {
  const renderSlider = (
    key: 'libido' | 'kink' | 'nudity', 
    label: string, 
    value: number, 
    icon: React.ReactNode
  ) => {
    return (
      <div className="bg-[#1A1A1A] rounded-2xl p-6 flex flex-col gap-4 border border-white/5">
        <div className="flex items-center justify-between text-white font-semibold">
          <div className="flex items-center gap-3">
            <span className="text-[#FF9C00] text-xl">{icon}</span>
            {label}
          </div>
          <span className="text-white/60">{value}%</span>
        </div>
        <div className="relative pt-1">
          {/* Track */}
          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded-full bg-slate-800">
            {/* Fill */}
            <div 
              style={{ width: `${value}%` }} 
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[#FF9C00] transition-all duration-300" 
            />
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={(e) => onChange(key, parseInt(e.target.value, 10))}
            className="absolute top-1 left-0 w-full h-2 opacity-0 cursor-pointer"
          />
          {/* Custom thumb to overlay the invisible input's thumb visually */}
          <div 
            className="absolute top-0 w-6 h-6 bg-white rounded-full shadow border-2 border-[#FF9C00] pointer-events-none transform -translate-x-1/2 -translate-y-1 transition-all duration-75"
            style={{ left: `${value}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      {renderSlider('libido', 'Libido intensity', libido, '🥵')}
      {renderSlider('kink', 'Kink Openness', kink, '👠')}
      {renderSlider('nudity', 'Comfort with Nudity', nudity, '👙')}
    </div>
  );
}
