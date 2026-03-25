import { useEffect, useState } from 'react';

/**
 * AdminGuard - Protects admin routes
 * - Fetches user profile from backend to verify admin role
 * - Clears stale tokens if user is not admin
 * - Shows loading state while checking, redirects guests/non-admins to main site
 */
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'denied'>('loading');

  useEffect(() => {
    let mounted = true;

    const checkAdminAccess = async () => {
      // Check for stored token
      const token = 
        localStorage.getItem('pornily:auth:token') || 
        localStorage.getItem('pornily:auth:access_token') || 
        localStorage.getItem('access_token');

      if (!token) {
        if (mounted) setStatus('denied');
        return;
      }

      // Check local cached role first (optimistic)
      const checkLocalRole = () => {
        try {
          const raw = localStorage.getItem('pornily:auth:raw');
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          const profile = parsed?.user ?? parsed;
          return profile?.role ?? null;
        } catch (e) {
          return null;
        }
      };

      const localRole = checkLocalRole();
      const roleStr = (localRole || '').toString().toLowerCase();
      if (!localRole || (roleStr !== 'admin' && roleStr !== 'super_admin')) {
        // Clear stale non-admin profile
        try { localStorage.removeItem('pornily:auth:raw'); } catch (e) {}
      }

      // Verify with backend
      try {
        const envBase = import.meta.env.VITE_API_BASE_URL || '';
        const baseFinal = envBase || (typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : '');
        const url = (baseFinal.endsWith('/') ? baseFinal.slice(0, -1) : baseFinal) + '/user/get-profile';
        
        const rawToken = token.toString();
        const tokenStr = rawToken.replace(/^bearer\s+/i, '').trim();
        
        const res = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${tokenStr}`
          },
          credentials: 'include'
        });

        if (!res.ok) {
          if (mounted) setStatus('denied');
          clearAuthData();
          return;
        }

        const data = await res.json();
        const roleValue = (data?.role || '').toString().toLowerCase();

        if (roleValue === 'admin' || roleValue === 'super_admin') {
          if (mounted) setStatus('ok');
          try { localStorage.setItem('pornily:auth:raw', JSON.stringify(data)); } catch (e) {}
        } else {
          if (mounted) setStatus('denied');
          clearAuthData();
        }
      } catch (e) {
        console.error('Admin guard check failed:', e);
        if (mounted) setStatus('denied');
        clearAuthData();
      }
    };

    checkAdminAccess();
    return () => { mounted = false; };
  }, []);

  // Redirect when denied
  useEffect(() => {
    if (status === 'denied') {
      const timer = setTimeout(() => {
        clearAuthData();
        try {
          window.location.replace('/?admin_denied=1');
        } catch (e) {
          window.location.href = '/';
        }
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center flex-col bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Checking admin access…</p>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full">
          <h3 className="text-red-800 font-semibold text-lg mb-2">Access Denied</h3>
          <p className="text-red-600">You do not have permission to view the admin area. Redirecting to main site...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function clearAuthData() {
  try {
    localStorage.removeItem('pornily:auth:raw');
    localStorage.removeItem('pornily:auth:token');
    localStorage.removeItem('pornily:auth:access_token');
    localStorage.removeItem('access_token');
  } catch (e) {}
}
