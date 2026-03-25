// Image preloading utility for better performance
export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

export const preloadImages = async (srcs: string[]): Promise<void[]> => {
  return Promise.all(srcs.map(preloadImage));
};

// Preload critical images on app start - DISABLED for faster initial load
// Images will load on-demand when needed
export const preloadCriticalImages = () => {
  // Removed preloading to improve perceived performance
  // Images will lazy-load as user navigates
};

// Image optimization helpers with WebP support
export const getOptimizedImageUrl = (
  url: string, 
  quality: 'low' | 'medium' | 'high' = 'high',
  width?: number,
  format?: 'webp' | 'jpeg' | 'png'
): string => {
  if (!url) return url;
  
  const qualityMap = {
    low: 40,
    medium: 70,
    high: 90
  };
  
  const params = new URLSearchParams();
  params.set('quality', qualityMap[quality].toString());
  
  if (width) {
    params.set('w', width.toString());
  }
  
  if (format) {
    params.set('format', format);
  }
  
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${params.toString()}`;
};

// Generate placeholder data URLs
export const generatePlaceholder = (width: number, height: number, color = '#f3f4f6'): string => {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'%3E%3Crect width='100%25' height='100%25' fill='${encodeURIComponent(color)}'/%3E%3C/svg%3E`;
};

// Generate blur placeholder for better UX
export const generateBlurPlaceholder = (): string => {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Cfilter id='b'%3E%3CfeGaussianBlur stdDeviation='12'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' fill='%23f3f4f6' filter='url(%23b)'/%3E%3C/svg%3E`;
};

// Intersection Observer for lazy loading - ultra aggressive settings
export const createLazyObserver = (
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit
) => {
  const defaultOptions: IntersectionObserverInit = {
    threshold: 0.01, // Very low threshold
    rootMargin: '200px', // Very large margin for faster preloading
    ...options
  };

  return new IntersectionObserver(callback, defaultOptions);
};

// Check if browser supports WebP
export const supportsWebP = (() => {
  let support: boolean | undefined;
  return (): boolean => {
    if (support !== undefined) return support;
    
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      support = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } else {
      support = false;
    }
    return support;
  };
})();

// Debounce utility for performance
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};