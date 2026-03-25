import React, { Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from '../queryClient';

// Lazy-load the Tailwind admin bundle to reduce initial admin build and runtime cost.
const AdminApp = React.lazy(() => import('../../admin/src/App'));
// Only import admin-specific scoped styles (small), not the global index.css
import '../../admin/src/styles/admin.css';

// Import admin auth helpers to ensure admin bundle uses same token as main app
import { setAuthToken } from '../../admin/src/utils/auth';

// Hosts the admin application inside the main app's router.
// Admin styles are scoped under [data-admin-root] so they shouldn't affect the main site.
export default function AdminHost() {
  // On mount, copy the main app token (hl_token) into the admin token key
  // so admin fetch/axios helpers pick it up. Also mirror storage changes.
  React.useEffect(() => {
    try {
      const mainToken = localStorage.getItem('hl_token');
      if (mainToken) {
        // store clean token (auth util will strip bearer prefixes)
        setAuthToken(mainToken);
      }
    } catch (e) {
      // ignore storage access errors
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'hl_token') {
        try {
          const newToken = e.newValue ?? null;
          setAuthToken(newToken);
        } catch {}
      }
    };

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('storage', onStorage);
    }

    return () => {
      try {
        if (typeof window !== 'undefined' && window.removeEventListener) {
          window.removeEventListener('storage', onStorage);
        }
      } catch {}
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div data-admin-root>
        <Suspense fallback={<div className="p-6">Loading admin…</div>}>
          <AdminApp />
        </Suspense>
      </div>
    </QueryClientProvider>
  );
}
