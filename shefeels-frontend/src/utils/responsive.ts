import { useTheme } from "../contexts/ThemeContext";

// Mobile-first responsive design utilities
export const breakpoints = {
  xs: '475px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
} as const;

// Common responsive patterns
export const responsiveClasses = {
  // Container padding
  containerPadding: 'px-4 sm:px-6 lg:px-8',
  
  // Section spacing
  sectionSpacing: 'py-6 sm:py-8 lg:py-12',
  
  // Grid layouts
  grid: {
    cards: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6',
    twoCol: 'grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8',
    threeCol: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6',
    form: 'grid grid-cols-1 sm:grid-cols-2 gap-4'
  },
  
  // Text sizes
  text: {
    xs: 'text-xs sm:text-sm',
    sm: 'text-sm sm:text-base',
    base: 'text-base sm:text-lg',
    lg: 'text-lg sm:text-xl',
    xl: 'text-xl sm:text-2xl',
    '2xl': 'text-2xl sm:text-3xl lg:text-4xl',
  '3xl': 'text-2xl sm:text-3xl lg:text-4xl',
  '4xl': 'text-3xl sm:text-4xl lg:text-5xl'
  },
  
  // Button sizes
  button: {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base',
    lg: 'px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg'
  },
  
  // Spacing
  spacing: {
    xs: 'space-y-2 sm:space-y-3',
    sm: 'space-y-3 sm:space-y-4',
    md: 'space-y-4 sm:space-y-6',
    lg: 'space-y-6 sm:space-y-8'
  }
};

// Theme-aware responsive utilities
export function useResponsiveTheme() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return {
    theme,
    isDark,
    
    // Colors that adapt to theme
    colors: {
      bg: {
        primary: isDark ? 'bg-black' : 'bg-light-bg',
        secondary: isDark ? 'bg-gray-900' : 'bg-white',
        tertiary: isDark ? 'bg-gray-800' : 'bg-gray-50',
        card: isDark ? 'bg-gray-900/50' : 'bg-white',
        overlay: isDark ? 'bg-black/80' : 'bg-white/90'
      },
      
      text: {
        primary: isDark ? 'text-white' : 'text-light-text',
        secondary: isDark ? 'text-gray-300' : 'text-light-text-secondary',
        muted: isDark ? 'text-gray-400' : 'text-gray-500',
        accent: isDark ? 'text-dark-accent' : 'text-light-accent'
      },
      
      border: {
        primary: isDark ? 'border-gray-700' : 'border-light-border',
        secondary: isDark ? 'border-gray-600' : 'border-gray-300',
        accent: isDark ? 'border-dark-accent' : 'border-light-accent'
      },
      
      ring: {
        primary: isDark ? 'ring-gray-700' : 'ring-light-border',
        focus: isDark ? 'ring-dark-accent' : 'ring-light-accent'
      }
    },
    
    // Interactive states
    interactive: {
      hover: isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100',
      active: isDark ? 'active:bg-white/20' : 'active:bg-gray-200',
      focus: isDark ? 'focus:ring-dark-accent' : 'focus:ring-light-accent'
    },
    
    // Glass effect
    glass: isDark 
      ? 'backdrop-blur-xl bg-black/80 border-white/10' 
      : 'backdrop-blur-xl bg-white/80 border-gray-200/50',
    
    // Shadow
    shadow: isDark ? 'shadow-2xl shadow-black/50' : 'shadow-xl shadow-gray-200/50'
  };
}

// Mobile-specific utilities
export const mobile = {
  // Touch-friendly sizing
  touchTarget: 'min-h-[44px] min-w-[44px]',
  
  // Safe area handling
  safeArea: {
    top: 'pt-safe-top',
    bottom: 'pb-safe-bottom',
    left: 'pl-safe-left',
    right: 'pr-safe-right',
    all: 'p-safe'
  },
  
  // Mobile-optimized scrolling
  scroll: 'overflow-auto overscroll-contain',
  
  // Prevent zoom on inputs
  inputZoom: 'text-base', // 16px+ prevents zoom on iOS
  
  // Mobile-friendly modals
  modal: 'fixed inset-0 z-50 overflow-auto p-4 sm:p-6 lg:p-8',
  
  // Full-width on mobile
  fullWidthMobile: 'w-full sm:w-auto'
};

// Common component patterns
export const patterns = {
  // Page layout
  page: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12',
  
  // Card
  card: 'rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border theme-transition',
  
  // Button
  button: 'inline-flex items-center justify-center font-medium rounded-lg sm:rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
  
  // Input
  input: 'w-full rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0',
  
  // Modal
  modal: 'fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6',
  modalContent: 'w-full max-w-md sm:max-w-lg bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl shadow-2xl',
  
  // Navigation
  nav: 'flex items-center space-x-2 sm:space-x-4',
  navItem: 'px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-sm sm:text-base font-medium transition-colors'
};

// Responsive visibility utilities
export const visibility = {
  // Show only on mobile
  mobileOnly: 'block sm:hidden',
  
  // Hide on mobile
  hiddenMobile: 'hidden sm:block',
  
  // Show only on tablet and up
  tabletUp: 'hidden md:block',
  
  // Show only on desktop
  desktopOnly: 'hidden lg:block'
};

// Animation utilities that respect reduced motion
export const animations = {
  // Safe transitions that work with prefers-reduced-motion
  transition: 'transition-all duration-200 ease-out motion-reduce:transition-none',
  
  // Hover effects
  hover: 'transform hover:scale-105 motion-reduce:hover:scale-100',
  
  // Focus effects
  focus: 'focus:ring-2 focus:ring-offset-2 motion-reduce:focus:ring-1',
  
  // Loading states
  pulse: 'animate-pulse motion-reduce:animate-none',
  spin: 'animate-spin motion-reduce:animate-none'
};

export default {
  breakpoints,
  responsiveClasses,
  useResponsiveTheme,
  mobile,
  patterns,
  visibility,
  animations
};