import React, { useState, useRef, useEffect, useMemo } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  fallback?: string;
  loading?: 'lazy' | 'eager';
  style?: React.CSSProperties;
  onClick?: () => void;
  // If the image is an animated asset (gif or animated webp), set this to true
  // and provide a loopInterval (ms) to force periodic reloads for formats
  // that may not loop by themselves. Set loopInterval to 0 to disable.
  isAnimated?: boolean;
  loopInterval?: number;
  onError?: () => void;
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  placeholder,
  fallback,
  loading = 'lazy',
  style,
  onClick,
  isAnimated = false,
  loopInterval = 0,
  onError,
}) => {
  const [imageSrc, setImageSrc] = useState<string>(placeholder || '');
  const [imageRef, setImageRef] = useState<HTMLElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reloadTimerRef = useRef<number | null>(null);

  // Check if src is video
  const isVideo = useMemo(() => {
    if (!src) return false;
    // Check extension or if explicit isAnimated flag + no image extension
    const cleanSrc = src.split('?')[0].toLowerCase();
    return cleanSrc.endsWith('.mp4') || cleanSrc.endsWith('.webm') || cleanSrc.endsWith('.ogg');
  }, [src]);

  useEffect(() => {
    setImageRef(isVideo ? videoRef.current : imgRef.current);
  }, [isVideo]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!imageRef || loading === 'eager') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.01,
        rootMargin: '200px',
      }
    );

    observer.observe(imageRef);

    return () => observer.disconnect();
  }, [imageRef, loading]);

  // Load image/video when in view
  useEffect(() => {
    if (!isInView || !src) return;

    if (isVideo) {
      // For video, we just set the src and let the video element handle loading
      setImageSrc(src);
      // We'll handle isLoaded in onLoadedData
      return;
    }

    const img = new Image();
    img.onload = () => {
      setImageSrc(src);
      setIsLoaded(true);
      setIsError(false);
    };
    img.onerror = () => {
      setIsError(true);
      if (fallback) setImageSrc(fallback);
    };
    img.src = src;

    return () => {
      // clear any pending reload timer when src changes/unmount
      if (reloadTimerRef.current) {
        window.clearInterval(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };
  }, [isInView, src, fallback, isVideo]);

  // Periodically reload animated images to enforce looping when requested
  // Note: For video, we use the loop attribute, so this is mainly for GIFs/WebP
  useEffect(() => {
    if (!isInView || isVideo || !isAnimated || !loopInterval || loopInterval <= 0) return;

    // Clear any existing timer
    if (reloadTimerRef.current) {
      window.clearInterval(reloadTimerRef.current);
      reloadTimerRef.current = null;
    }

    reloadTimerRef.current = window.setInterval(() => {
      try {
        if (!imgRef.current) return;
        const base = src.split('?')[0];
        imgRef.current.src = `${base}?reload=${Date.now()}`;
      } catch (e) {
        // ignore
      }
    }, loopInterval) as unknown as number;

    return () => {
      if (reloadTimerRef.current) {
        window.clearInterval(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };
  }, [isInView, isAnimated, loopInterval, src, isVideo]);

  const handleImageLoad = () => setIsLoaded(true);
  const handleImageError = () => {
    setIsError(true);
    if (fallback && imageSrc !== fallback) setImageSrc(fallback);
    try { onError?.(); } catch { }
  };

  const handleVideoLoad = () => {
    setIsLoaded(true);
    setIsError(false);
    // Ensure video plays when loaded
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay failed (e.g. low power mode), silent fail
      });
    }
  };

  const handleVideoError = () => {
    setIsError(true);
    try { onError?.(); } catch { }
    // If video fails, maybe try fallback image if provided?
    // But we can't easily switch tag types here without state. 
    // We already have logic to show error state.
  };

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ ...style, willChange: 'auto', contain: 'layout style paint' }}>
      {isVideo ? (
        <video
          ref={videoRef}
          src={imageSrc || undefined}
          poster={placeholder}
          className={`transition-opacity duration-400 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className} object-cover`}
          style={{ ...style, transform: 'translateZ(0)', background: '#121212' }}
          onLoadedData={handleVideoLoad}
          onError={handleVideoError}
          onClick={onClick}
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <img
          ref={imgRef}
          src={imageSrc || placeholder}
          alt={alt}
          className={`transition-opacity duration-400 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
          style={{ ...style, transform: 'translateZ(0)' }}
          onLoad={handleImageLoad}
          onError={handleImageError}
          onClick={onClick}
          loading={loading}
          decoding="async"
        />
      )}

      {/* Loading shimmer — always dark, never shows text */}
      {!isLoaded && !isError && <div className="absolute inset-0 bg-[#121212] animate-pulse" />}

      {/* Error state: only show text for non-video; videos just stay dark */}
      {isError && !fallback && !isVideo && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-gray-400 text-center text-xs">Media unavailable</div>
        </div>
      )}
      {isError && !fallback && isVideo && (
        <div className="absolute inset-0 bg-[#121212]" />
      )}
    </div>
  );
};

// Memoize to prevent unnecessary re-renders
export default React.memo(LazyImage, (prevProps, nextProps) => {
  return (
    prevProps.src === nextProps.src &&
    prevProps.className === nextProps.className &&
    prevProps.loading === nextProps.loading &&
    prevProps.isAnimated === nextProps.isAnimated &&
    prevProps.loopInterval === nextProps.loopInterval
  );
});