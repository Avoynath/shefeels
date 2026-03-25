import React, { createContext, useContext, useEffect, useState } from 'react';

interface PerformanceContextType {
  isSlowConnection: boolean;
  enableLazyLoading: boolean;
  imageQuality: 'low' | 'medium' | 'high';
  prefetchImages: boolean;
}

const PerformanceContext = createContext<PerformanceContextType>({
  isSlowConnection: false,
  enableLazyLoading: true,
  imageQuality: 'high',
  prefetchImages: true,
});

export const usePerformance = () => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
};

interface PerformanceProviderProps {
  children: React.ReactNode;
}

export const PerformanceProvider: React.FC<PerformanceProviderProps> = ({ children }) => {
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [enableLazyLoading, setEnableLazyLoading] = useState(true);
  const [imageQuality, setImageQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [prefetchImages, setPrefetchImages] = useState(true);

  useEffect(() => {
    // Detect slow connection
    const detectSlowConnection = () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          const isSlow = connection.effectiveType === 'slow-2g' || 
                        connection.effectiveType === '2g' ||
                        connection.saveData === true;
          
          setIsSlowConnection(isSlow);
          
          if (isSlow) {
            setImageQuality('low');
            setPrefetchImages(false);
            setEnableLazyLoading(true);
          }
        }
      }

      // Fallback: detect based on page load time
      const startTime = performance.now();
      setTimeout(() => {
        const loadTime = performance.now() - startTime;
        if (loadTime > 3000) { // If basic timeout takes > 3s, consider slow
          setIsSlowConnection(true);
          setImageQuality('medium');
        }
      }, 100);
    };

    detectSlowConnection();

    // Listen for connection changes
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', detectSlowConnection);
        return () => connection.removeEventListener('change', detectSlowConnection);
      }
    }
  }, []);

  // Preload critical resources
  useEffect(() => {
    if (!prefetchImages) return;

    const preloadCriticalImages = () => {
      const criticalImages = [
        '/src/assets/Branding.svg',
        '/src/assets/Branding with text.svg',
        '/src/assets/header-logo.svg',
      ];

      criticalImages.forEach(src => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        document.head.appendChild(link);
      });
    };

    // Preload after initial render
    setTimeout(preloadCriticalImages, 100);
  }, [prefetchImages]);

  const value = {
    isSlowConnection,
    enableLazyLoading,
    imageQuality,
    prefetchImages,
  };

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
};
