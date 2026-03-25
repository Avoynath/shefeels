import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    // Here you could send error to monitoring service
    // Example: Sentry, LogRocket, etc.
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

const DefaultErrorFallback: React.FC<{ error?: Error }> = ({ error }) => {
  // Safely use the theme context - fallback to dark if not available
  let theme = 'dark';
  let isDark = true;
  
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;
    isDark = theme === 'dark';
  } catch (e) {
    // If useTheme fails (context not available), use defaults
    console.warn('ThemeContext not available in ErrorBoundary, using default dark theme');
  }

  return (
    <div className={`min-h-screen flex items-center justify-center ${
      isDark ? 'bg-black text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      <div className="text-center p-8">
        <div className="text-6xl mb-4">😥</div>
        <h1 className="text-2xl font-bold mb-4">Oops! Something went wrong</h1>
        <p className={`mb-6 ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
          We're sorry for the inconvenience. Please try refreshing the page.
        </p>
        {error && (
          <details className={`mb-6 text-left p-4 rounded-lg ${
            isDark ? 'bg-white/5' : 'bg-gray-100'
          }`}>
            <summary className="cursor-pointer font-semibold mb-2">
              Error Details
            </summary>
            <pre className="text-sm overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-[var(--hl-gold)] text-black rounded-lg font-semibold hover:bg-[var(--hl-gold)] transition-colors"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
};

const ErrorBoundary: React.FC<Props> = ({ children, fallback }) => {
  return (
    <ErrorBoundaryClass fallback={fallback}>
      {children}
    </ErrorBoundaryClass>
  );
};

export default ErrorBoundary;