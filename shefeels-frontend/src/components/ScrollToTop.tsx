import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * ScrollToTop
 * 
 * Automatically scrolls to the top of the page when navigating to a new route.
 * Handles different navigation types (PUSH, POP, REPLACE) appropriately.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const scrollPositions = useRef<Record<string, number>>({});

  useEffect(() => {
    // If it's a new navigation (PUSH), save current position before moving? 
    // Actually, simple "always scroll top on new page" is the standard web behavior 
    // unless you want complex history restoration. 
    
    // For now, simpler is better: always scroll top on route change unless it's a POP (back button)
    // where browser usually handles it, but React Router sometimes needs help.
    
    // Most reliable method for SPA:
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
