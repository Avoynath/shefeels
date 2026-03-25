import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * ThemeProvider component that wraps content and applies theme classes
 * This ensures consistent theme application across all pages
 */
export default function ThemeProvider({ children }: ThemeProviderProps) {
  const { theme } = useTheme();
  
  React.useEffect(() => {
    // Apply theme to document element
    document.documentElement.setAttribute('data-theme', theme);
    
    // Apply theme to body for consistent background
    document.body.className = `theme-transition ${
      theme === 'dark' 
        ? 'bg-black text-white' 
        : 'bg-light-bg text-light-text'
    }`;
  }, [theme]);

  return (
    <div className={`min-h-screen theme-transition ${
      theme === 'dark' 
        ? 'bg-black text-white' 
        : 'bg-light-bg text-light-text'
    }`}>
      {children}
    </div>
  );
}