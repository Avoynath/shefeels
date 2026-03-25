import React from 'react';

interface HorizontalOptionCardProps {
  label: string;
  imageUrl?: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}

export default function HorizontalOptionCard({ 
  label, 
  imageUrl, 
  selected, 
  onClick,
  className = ''
}: HorizontalOptionCardProps) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center w-full max-w-xl mx-auto overflow-hidden rounded-xl border-2 transition-all duration-300 ${
        selected 
          ? 'border-[#FF9C00] bg-[#FF9C00]/10 shadow-[0_4_12px_rgba(255,156,0,0.2)]' 
          : 'border-white/10 bg-[#1A1A1A] hover:border-[#FF9C00]/60 hover:bg-white/5'
      } ${className}`}
    >
      <div className="w-[7.5rem] h-16 sm:w-40 sm:h-20 overflow-hidden bg-gray-800 shrink-0 border-r border-white/5">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={label} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
            loading="lazy" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
            No Image
          </div>
        )}
      </div>
      
      <div className={`grow px-5 sm:px-6 text-right font-bold transition-colors duration-300 ${
        selected ? 'text-[#FF9C00]' : 'text-white/80 group-hover:text-white'
      } text-base sm:text-lg capitalize tracking-wide`}>
        {label}
      </div>
    </button>
  );
}
