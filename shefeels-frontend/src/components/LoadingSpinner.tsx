import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text = 'Loading...', 
  fullScreen = false 
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  const spinnerClass = `${sizeClasses[size]} animate-spin ${
    isDark ? 'text-[var(--hl-gold)]' : 'text-[var(--hl-gold)]'
  }`;

  const containerClass = fullScreen 
    ? `fixed inset-0 flex flex-col items-center justify-center z-50 ${
        isDark ? 'bg-black/80' : 'bg-white/80'
      } backdrop-blur-sm`
    : 'flex flex-col items-center justify-center p-8';

  const textClass = `mt-3 ${textSizeClasses[size]} ${
    isDark ? 'text-white/70' : 'text-gray-600'
  }`;

  return (
    <div className={containerClass}>
      <svg
        className={spinnerClass}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {text && <p className={textClass}>{text}</p>}
    </div>
  );
};

export default LoadingSpinner;