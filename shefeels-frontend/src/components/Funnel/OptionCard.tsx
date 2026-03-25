import React, { useEffect, useRef } from 'react';

interface OptionCardProps {
  label: string;
  imageUrl?: string;
  videoUrl?: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
  hideText?: boolean;
  showCheckmark?: boolean; // NEW: For multi-select steps
}

export default function OptionCard({ 
  label, 
  imageUrl, 
  videoUrl,
  selected, 
  onClick, 
  className = '',
  hideText = false,
  showCheckmark = false
}: OptionCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoUrl) return;

    const videoEl = videoRef.current;
    if (!videoEl) return;

    let disposed = false;

    const tryAutoplay = () => {
      if (disposed) return;

      // Some mobile browsers need these properties set before play() is called.
      videoEl.muted = true;
      videoEl.defaultMuted = true;
      videoEl.playsInline = true;

      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Ignore autoplay rejection; the video can still be started by user gesture.
        });
      }
    };

    // Force source evaluation on first mount/navigation.
    videoEl.load();

    if (videoEl.readyState >= 2) {
      tryAutoplay();
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tryAutoplay();
      }
    };

    videoEl.addEventListener('loadeddata', tryAutoplay);
    videoEl.addEventListener('canplay', tryAutoplay);
    window.addEventListener('pageshow', tryAutoplay);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      videoEl.removeEventListener('loadeddata', tryAutoplay);
      videoEl.removeEventListener('canplay', tryAutoplay);
      window.removeEventListener('pageshow', tryAutoplay);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [videoUrl]);

  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 transition-all duration-300 w-full h-full text-left bg-[#1A1A1A] ${
        selected 
          ? 'border-[#FF9C00] shadow-[0_0_20px_rgba(255,156,0,0.4)] scale-[1.02]' 
          : 'border-transparent hover:border-[#FF9C00]/60 hover:shadow-[0_0_15px_rgba(255,156,0,0.2)]'
      } ${className}`}
    >
      <div className="flex-grow w-full relative min-h-0 overflow-hidden">
        {videoUrl ? (
          <video 
            ref={videoRef}
            src={videoUrl} 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
            autoPlay 
            loop 
            muted 
            playsInline 
            preload="auto"
          />
        ) : imageUrl ? (
          <img 
            src={imageUrl} 
            alt={label} 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
            loading="lazy" 
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-slate-800 flex items-center justify-center text-white/50 text-xs">
            No Image
          </div>
        )}
        
        {/* Multi-select checkmark */}
        {showCheckmark && selected && (
          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#FF9C00] flex items-center justify-center text-black shadow-lg z-20 animate-in zoom-in duration-200">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        )}
      </div>

      {!hideText && (
        <div className={`w-full py-3 sm:py-4 text-center font-bold transition-all duration-300 z-10 shrink-0 border-t ${
          selected 
            ? 'bg-[#FF9C00] text-black border-[#FF9C00]' 
            : 'bg-[#1A1A1A] text-white border-white/5 group-hover:bg-[#FF9C00] group-hover:text-black group-hover:border-[#FF9C00]'
        }`}>
          <span className="text-sm sm:text-base tracking-wide capitalize">{label}</span>
          {selected && !showCheckmark && <span className="ml-2">→</span>}
        </div>
      )}
    </button>
  );
}
