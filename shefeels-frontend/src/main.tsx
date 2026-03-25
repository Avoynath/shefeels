import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { PerformanceProvider } from './contexts/PerformanceContext'
import { ToastProvider } from './contexts/ToastContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <PerformanceProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </PerformanceProvider>
    </HelmetProvider>
  </StrictMode>,
)
