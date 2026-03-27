import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Discover, Messages1, MagicStar, Gallery, Crown } from 'iconsax-react';
import { useTheme } from '../contexts/ThemeContext';

import { useAuth } from '../contexts/AuthContext';

export const MobileTabBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const hideOnThisRoute = location.pathname.startsWith('/chat');
  if (hideOnThisRoute) return null;

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || 
             location.pathname === '/ai-girlfriend' || 
             location.pathname === '/ai-boyfriend' || 
             location.pathname === '/ai-transgender';
    }
    return location.pathname === path;
  };

  const hasActiveSub = !!user?.hasActiveSubscription;

  const tabs = [
    {
      id: 'explore',
      label: 'Explore',
      icon: Discover,
      path: '/',
      color: 'text-[var(--sf-pink)]',
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: Messages1,
      path: '/chat',
      color: 'text-[var(--sf-pink)]',
    },
    {
      id: 'generate',
      label: 'Generate',
      icon: MagicStar,
      path: '/generate-image',
      color: 'text-[var(--sf-pink)]',
      isCenter: true,
    },
    {
      id: 'gallery',
      label: 'Gallery',
      icon: Gallery,
      path: '/gallery',
      color: 'text-[var(--sf-pink)]',
    },
    {
      id: 'premium',
      label: hasActiveSub ? 'Buy Token' : 'Premium',
      icon: Crown,
      path: hasActiveSub ? '/buy-tokens' : '/premium',
      color: 'text-[var(--sf-pink)]',
    },
  ];

  const muted = isDark ? 'text-white/60' : 'text-black/55';

  return (
    <nav
      role="tablist"
      aria-label="Primary"
      className={`fixed bottom-0 left-0 right-0 z-50 md:hidden backdrop-blur-md ${
        isDark ? 'bg-black/70' : 'bg-white/80'
      } border-t ${isDark ? 'border-white/10' : 'border-black/10'}`}
      style={{
        height: '68px',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: isDark
          ? '0 -2px 12px rgba(0,0,0,0.35)'
          : '0 -2px 12px rgba(0,0,0,0.08)'
      }}
    >
      <div className="flex items-center justify-around h-full px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          
          if (tab.isCenter) {
            // Center button with special styling (highlighted circle)
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                aria-label={tab.label}
                onClick={() => navigate(tab.path)}
                className="flex flex-col items-center justify-center relative -translate-y-1 active:scale-[0.98] transition-transform"
              >
                <div 
                  className={`flex items-center justify-center rounded-full`}
                  style={{
                    width: '56px',
                    height: '56px',
                    background: 'var(--primary-gradient)',
                    // keep warm glow but rely on brand pink
                    boxShadow: '0 10px 24px rgba(229, 49, 112, 0.28)',
                  }}
                >
                  <Icon 
                    size="24" 
                    color="currentColor"
                    variant={active ? "Bold" : "Linear"} 
                    className="text-black" 
                  />
                </div>
              </button>
            );
          }

          // Regular tabs
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              aria-label={tab.label}
              onClick={() => navigate(tab.path)}
              className="group relative flex flex-col items-center justify-center gap-1 pt-1 pb-2 px-3 min-w-[64px] transition-all active:scale-[0.98]"
            >
              {active && (
                <span className="absolute top-0 h-[2px] w-6 -translate-y-[1px] rounded-full bg-[var(--sf-pink)]" />
              )}
              <Icon 
                size="22"
                color="currentColor"
                variant={active ? "Bold" : "Linear"}
                className={`${
                  active 
                    ? tab.color 
                    : muted
                } transition-colors`}
              />
              <span 
                className={`text-[11px] font-medium tracking-[0.01em] ${
                  active 
                    ? tab.color 
                    : muted
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileTabBar;
