import React from "react";
import { createPortal } from "react-dom";
import { Hamburger, ChevronDown } from "./icons";
import { HambergerMenu } from 'iconsax-react';
import { Crown, LogOut, Settings } from "lucide-react";
// removed mobile search icon per design request
import headerLogo from "../assets/header-logo.svg";
// compact branding not used on mobile anymore
import premiumIcon from "../assets/home/PremiumHeaderIcon.svg";
import tokenIcon from "../assets/token.svg";
import { useTheme } from "../contexts/ThemeContext";
import genderService from '../utils/genderService';
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../utils/api";
import { useNavigate } from "react-router-dom";
import type { Dispatch, SetStateAction, RefObject } from "react";
import { usePromotionalConfig } from "../hooks/usePromotionalConfig";

type Props = {
  gender: string;
  setGender?: Dispatch<SetStateAction<string>>;
  genderOpen: boolean;
  setGenderOpen: Dispatch<SetStateAction<boolean>>;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  onOpenAuth?: () => void;
  popoverRef?: RefObject<any | null>;
  currentPath?: string;
};

export const Header: React.FC<Props> = ({
  gender,
  setGender,
  genderOpen,
  setGenderOpen,
  setSidebarOpen,
  onOpenAuth,
  popoverRef,
  currentPath = '/',
}) => {
  const { theme } = useTheme();
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = React.useState<boolean>(false);
  const profileToggleRef = React.useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = React.useRef<HTMLDivElement | null>(null);
  const { promoConfig } = usePromotionalConfig({ refetchIntervalMs: 60_000 });
  const [nsfwEnabled, setNsfwEnabled] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('hl_nsfw') === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileViewport, setIsMobileViewport] = React.useState<boolean>(() => {
    try {
      return (window?.innerWidth || document?.documentElement?.clientWidth || 0) < 640;
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    function onResize() {
      try {
        setIsMobileViewport((window.innerWidth || document.documentElement.clientWidth || 0) < 640);
      } catch { }
    }
    try {
      onResize();
      window.addEventListener("resize", onResize);
    } catch { }
    return () => {
      try { window.removeEventListener("resize", onResize); } catch { }
    };
  }, []);

  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties | null>(null);
  const [coinMenuStyle, setCoinMenuStyle] = React.useState<React.CSSProperties | null>(null);
  const tokenToggleRef = React.useRef<HTMLButtonElement | null>(null);
  const coinMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [coinCostOpen, setCoinCostOpen] = React.useState<boolean>(false);
  const [coinCosts, setCoinCosts] = React.useState<any | null>(null);

  // Refs for gender dropdown
  const genderToggleRef = React.useRef<HTMLButtonElement | null>(null);
  const genderMenuRef = React.useRef<HTMLDivElement | null>(null);

  const updateMenuPosition = React.useCallback(() => {
    try {
      const candidates: HTMLElement[] = [];
      if (genderToggleRef.current) candidates.push(genderToggleRef.current as HTMLElement);
      if (popoverRef?.current) candidates.push(popoverRef.current as HTMLElement);
      try {
        candidates.push(
          ...Array.from(document.querySelectorAll('[data-gender-anchor]')) as HTMLElement[]
        );
      } catch { }

      // Prefer the header toggle; otherwise fall back to the first visible anchor in the DOM (skip display:none).
      const anchor = candidates.find((node) => {
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        if (!rect) return false;
        if (rect.width === 0 && rect.height === 0) return false;
        const style = window.getComputedStyle ? window.getComputedStyle(node) : null;
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
        return true;
      }) || null;

      if (!anchor) return setMenuStyle(null);
      const rect = anchor.getBoundingClientRect();
      const menuWidth = 192; // Tailwind w-48
      const margin = 12;
      const viewportWidth = window?.innerWidth || document?.documentElement?.clientWidth || menuWidth;
      let left = rect.left;
      const maxLeft = viewportWidth - menuWidth - margin;
      if (left > maxLeft) left = Math.max(margin, maxLeft);
      if (left < margin) left = margin;
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 8,
        left,
        width: menuWidth,
      });
    } catch (e) {
      setMenuStyle(null);
    }
  }, [popoverRef]);

  const handleGenderToggle = React.useCallback(() => {
    if (!genderOpen) {
      updateMenuPosition();
      setGenderOpen(true);
    } else {
      setGenderOpen(false);
    }
  }, [genderOpen, setGenderOpen, updateMenuPosition]);

  React.useEffect(() => {
    if (!genderOpen) return;
    if (isMobileViewport) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [genderOpen, updateMenuPosition, isMobileViewport]);

  // Position coin menu anchored to token button
  const updateCoinMenuPosition = React.useCallback(() => {
    try {
      const anchor = tokenToggleRef?.current as HTMLElement | null;
      if (!anchor) return setCoinMenuStyle(null);
      const rect = anchor.getBoundingClientRect();
      const menuWidth = 227;
      const margin = 12;
      const viewportWidth = window?.innerWidth || document?.documentElement?.clientWidth || menuWidth;
      let left = rect.left + window.scrollX;
      const maxLeft = viewportWidth - menuWidth - margin;
      if (left > maxLeft) left = Math.max(margin, maxLeft);
      if (left < margin) left = margin;
      setCoinMenuStyle({
        position: 'absolute',
        top: rect.bottom + window.scrollY + 8,
        left,
        width: menuWidth,
      });
    } catch (e) {
      setCoinMenuStyle(null);
    }
  }, []);

  // Close profile menu on outside click
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      try {
        const target = e.target as Node | null;

        // Profile menu handling
        if (showProfile) {
          const toggleEl = profileToggleRef.current as HTMLElement | null;
          const menuEl = profileMenuRef.current as HTMLElement | null;
          if (toggleEl && toggleEl.contains && toggleEl.contains(target)) return;
          if (menuEl && menuEl.contains && menuEl.contains(target)) return;
          setShowProfile(false);
        }

        // Coin menu handling
        if (coinCostOpen) {
          const toggleEl = tokenToggleRef.current as HTMLElement | null;
          const menuEl = coinMenuRef.current as HTMLElement | null;
          if (toggleEl && toggleEl.contains && toggleEl.contains(target)) return;
          if (menuEl && menuEl.contains && menuEl.contains(target)) return;
          setCoinCostOpen(false);
        }

        // Gender menu handling (check both header toggle and mobile anchor in AppLayout)
        if (genderOpen && !isMobileViewport) {
          const toggleEl = genderToggleRef.current as HTMLElement | null;
          const menuEl = genderMenuRef.current as HTMLElement | null;

          // Check if click is on the toggle button
          if (toggleEl && toggleEl.contains && toggleEl.contains(target)) return;

          // Check if click is inside the portaled menu
          if (menuEl && menuEl.contains && menuEl.contains(target)) return;

          // Check if click is on mobile anchor button in AppLayout
          const mobileAnchors = document.querySelectorAll('[data-gender-anchor]');
          for (const anchor of Array.from(mobileAnchors)) {
            if (anchor.contains && anchor.contains(target)) return;
          }

          setGenderOpen(false);
        }
      } catch (err) {
        // ignore
        setShowProfile(false);
        setCoinCostOpen(false);
        setGenderOpen(false);
      }
    }

    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showProfile, coinCostOpen, genderOpen, isMobileViewport]);

  const isDark = theme === "dark";

  // Synchronize tokens for the admin dashboard to ensure it has the latest credentials
  const syncAdminTokens = () => {
    try {
      const raw = apiClient.getAccessToken() || String(localStorage.getItem('hl_token') || '');
      const token = String(raw).replace(/^Bearer\s+/i, '').trim();

      // Persist token under the main key the app uses so AdminHost and admin bundle can pick it up.
      try {
        if (token) {
          localStorage.setItem('hl_token', token);
          // also write a few legacy/admin-compatible keys just in case
          try { localStorage.setItem('access_token', token); } catch { }
          try { localStorage.setItem('pornily:auth:token', token); } catch { }
          try { localStorage.setItem('pornily:auth:access_token', token); } catch { }
        }
        if (user) {
          try { localStorage.setItem('pornily:auth:raw', JSON.stringify(user)); } catch { }
        }
      } catch (e) {
        // ignore storage errors
      }

      try { apiClient.setAccessToken(token || null); } catch { }
    } catch (e) {
      // ignore
    }
  };
  // Use consistent gold from design tokens
  const headerBg = isDark ? "bg-[#0f0e16]/95" : "bg-white/95";
  const hasActiveSubscription = !!(user as any)?.hasActiveSubscription;
  const tokenBalance = Number((user as any)?.tokenBalance || 0);
  const coinCostItems = [
    { label: 'Voice Cost', value: coinCosts?.voice_cost ?? '2' },
    { label: 'Image Cost', value: coinCosts?.image_cost ?? '2' },
    { label: 'Call Cost', value: coinCosts?.call_cost ? `${coinCosts.call_cost}/min` : '2/min' },
  ];

  // Debug log to help troubleshoot subscription status
  React.useEffect(() => {
    if (user) {
      console.log('[Header] User subscription status:', {
        hasActiveSubscription: (user as any)?.hasActiveSubscription,
        email: (user as any)?.email,
        subscription_coin_reward: (user as any)?.subscription_coin_reward,
        subscription_plan_name: (user as any)?.subscription_plan_name,
      });
    }
  }, [user]);

  // Golden divider between header and page
  const dividerColor = isDark
    ? `border-b border-[#815CF0]/35 shadow-[0_1px_0_rgba(129,92,240,0.12)]`
    : `border-b border-[#815CF0]/18 shadow-[0_1px_0_rgba(129,92,240,0.08)]`;

  // Gender metadata (label + icon). Using simple symbols to avoid extra dependencies.
  const GENDERS: { id: string; icon: string; label: string }[] = [
    { id: 'Female', icon: '♀', label: 'Girl' },
    { id: 'Male', icon: '♂', label: 'Guys' },
    { id: 'Trans', icon: '⚧', label: 'Trans' },
  ];

  const HOMEPAGE_GENDERS: { id: string; icon: string; label: string }[] = [
    { id: 'Female', icon: '\u2640', label: 'Female' },
    { id: 'Male', icon: '\u2642', label: 'Male' },
    { id: 'Trans', icon: '\u26A7', label: 'Trans' },
  ];

  // Determine if gender toggle should be shown
  const isExplorePage = currentPath === '/' || currentPath === '/ai-girlfriend' || currentPath === '/ai-boyfriend' || currentPath === '/ai-transgender';
  const isCreateCharacterPage = currentPath === '/create-character';
  const useHomepageNavbar = isExplorePage;
  // Style toggle visibility and the My AI flag are currently unused because the style
  // pills were requested to be commented out. Keep the page detection logic in place
  // in case we re-enable later.
  // const isMyAi = currentPath && currentPath.startsWith('/my-ai');
  // const isStyleToggleVisible = isExplorePage || isMyAi;
  // Track current style for toggle visual state (listen to global helper/events).
  // We only use the setter to respond to external events; the current value
  // isn't read anywhere in the active UI (style pills are currently removed),
  // so keep only the setter to avoid an unused-variable TypeScript error.
  const [currentStyle, setCurrentStyle] = React.useState<string | null>(() => {
    try {
      const w = (window as any);
      return (w && w.hl_current_style) ? String(w.hl_current_style).toLowerCase() : (localStorage.getItem('hl_style') || null)?.toLowerCase() || null;
    } catch {
      return null;
    }
  });

  React.useEffect(() => {
    function onStyleChange(e: any) {
      try { setCurrentStyle((e && e.detail) ? String(e.detail).toLowerCase() : null); } catch { setCurrentStyle(null); }
    }
    try {
      window.addEventListener('hl_style_changed', onStyleChange as EventListener);
    } catch { }
    return () => { try { window.removeEventListener('hl_style_changed', onStyleChange as EventListener); } catch { } };
  }, []);

  const clearHomepageStyleSelection = React.useCallback(() => {
    try {
      setCurrentStyle(null);
      try { (window as any).hl_current_style = null; } catch { }
      try { localStorage.removeItem('hl_style'); } catch { }
      try { window.dispatchEvent(new CustomEvent('hl_style_changed', { detail: null })); } catch { }
    } catch { }
  }, []);

  // StyleToggle component (Realistic/Anime) temporarily removed per request. Re-enable
  // by uncommenting the implementation below.
  // StyleToggle component (Realistic/Anime)
  const StyleToggle: React.FC<{ label: string; styleKey: string }> = ({ label, styleKey }) => {
    const isActive = currentStyle === styleKey;

    return (
      <button
        className={`relative inline-flex h-full items-center px-0 text-[17px] font-medium transition-colors theme-transition ${
          isActive
            ? 'text-[#815CF0]'
            : isDark
              ? 'text-[#E7E3F3] hover:text-white'
              : 'text-slate-800 hover:text-slate-900'
        }`}
        onClick={() => {
          try {
            const newStyle = isActive ? null : styleKey;
            setCurrentStyle(newStyle);
            try { (window as any).hl_current_style = newStyle; } catch { }
            try {
              if (newStyle) localStorage.setItem('hl_style', newStyle);
              else localStorage.removeItem('hl_style');
            } catch { }
            try { window.dispatchEvent(new CustomEvent('hl_style_changed', { detail: newStyle })); } catch { }
          } catch { }
        }}
      >
        <span>{label}</span>
        {isActive && (
          <span className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full bg-[#815CF0]" />
        )}
      </button>
    );
  };

  // Pill styles (legacy) removed where unused after design updates

  // Golden ring selection for create-character page will be inlined where used

  const compactButton = isDark
    ? "bg-[rgba(0,0,0,0.48)] border border-[#7f5af0]/35 text-white/80 hover:text-white hover:border-[#7f5af0]/55 hover:bg-[#14111f]"
    : "bg-[#F7EFE0] border border-[#E6D3A8]/60 text-black hover:border-[var(--hl-gold-strong)] hover:bg-[#FFF3D7]";

  // (explore dropdown styles removed — create-character buttons use explicit inline styles below)

  const headerStyle: React.CSSProperties = {
    height: "var(--header-h)",
    minHeight: "var(--header-h)",
    ...(useHomepageNavbar && isDark ? {
      backgroundImage: 'radial-gradient(55% 160% at 50% -18%, rgba(127, 90, 240, 0.34) 0%, rgba(229, 49, 112, 0.18) 46%, rgba(15, 14, 22, 0) 100%)',
    } : {}),
  };

  return (
    <header
      className={`w-full backdrop-blur-xl transition-colors duration-300 ${dividerColor} ${headerBg}`}
      style={headerStyle}
    >
      <div className="mx-auto h-full w-full max-w-[1920px] px-3 sm:px-5 md:px-[34px]">
        <div className={`flex h-full w-full items-center justify-between ${useHomepageNavbar ? '' : 'gap-2.5 md:gap-3'}`}>
          {/* Left side (branding column sized to the sidebar) */}
          {/* Reserve the expanded sidebar width so header doesn't move when the sidebar collapses */}
          <div className={useHomepageNavbar ? "flex shrink-0 items-center gap-2 sm:gap-4" : "flex items-center gap-2 sm:gap-4 md:w-60"}>
            {/* Mobile menu - only show hamburger icon on mobile */}
            <button
              className={`md:hidden grid place-items-center h-9 w-9 rounded-full transition theme-transition ${compactButton}`}
              onClick={() => setSidebarOpen((v) => !v)}
            >
              <HambergerMenu size="20" color="currentColor" className={`${isDark ? "text-white/80" : "text-gray-700"}`} />
            </button>

            {/* Branding */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Go to home"
                onClick={() => {
                  try {
                    navigate('/');
                  } catch {
                    // fallback to full reload only if navigate fails
                    try { window.location.assign('/'); } catch { }
                  }
                }}
                className="inline-flex items-center"
              >
                <img
                  src={headerLogo}
                  alt="Honey Love"
                  className="block shrink-0"
                  style={{ width: "93.866px", height: "44.262px", flexShrink: 0 }}
                />
              </button>
            </div>
          </div>

          {/* Nav - Hidden on very small screens */}
          <nav className={`hidden sm:flex h-full flex-1 items-center ${useHomepageNavbar ? 'gap-10 pl-10 lg:gap-12 lg:pl-16' : 'gap-2 lg:gap-3'}`}>
            {/* NSFW Toggle - show on mobile for explore page */}
            {isExplorePage && (
              <div className="flex items-center gap-2 sm:hidden">
                <span className={`text-sm font-medium ${isDark ? 'text-white/80' : 'text-gray-700'}`}>NSFW</span>
                <button
                  onClick={() => {
                    const newValue = !nsfwEnabled;
                    setNsfwEnabled(newValue);
                    try {
                      localStorage.setItem('hl_nsfw', String(newValue));
                    } catch { }
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${nsfwEnabled ? 'bg-(--hl-gold)' : isDark ? 'bg-white/20' : 'bg-gray-300'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${nsfwEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
            )}

            {/* Gender toggle - show only on explore and create-character pages */}
            {(isExplorePage || isCreateCharacterPage) && (
              <>
                {isCreateCharacterPage ? (
                  /* Create Character: Pill-style gender selector — selected pill uses dropdown style from Explore + gold ring */
                  <div className="flex items-center gap-2">
                    {GENDERS.map(({ id, label }) => {
                      const selected = id === gender;
                      // Keep existing behavior but enforce requested visual styles for create-character header
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            if (setGender) {
                              setGender(id);
                              try { genderService.setGender(id); } catch { }
                              clearHomepageStyleSelection();
                            }
                          }}
                          className={`px-6 py-2 text-sm font-medium transition-all duration-200 ${selected ? 'ring-[1px] ring-(--hl-gold) shadow-[0_0_0_1px_rgb(255,197,77),0_8px_24px_rgba(255,197,77,0.35)]' : ''} ${isDark ? 'text-white/90' : 'text-gray-800'}`}
                          style={selected ? { borderRadius: 50, border: '1px solid var(--secondary, #C09B62)', background: 'rgba(192, 155, 98, 0.18)' } : { borderRadius: 50, background: 'rgba(255, 255, 255, 0.10)' }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Explore page: Dropdown menu */
                  <div className="relative">
                    <button
                      ref={genderToggleRef}
                      aria-haspopup="menu"
                      aria-expanded={genderOpen}
                      onClick={handleGenderToggle}
                      className={`group relative inline-flex h-full items-center gap-2 px-0 text-[17px] font-medium focus:outline-none transition-colors duration-200 ${
                        isDark
                          ? "text-[#815CF0] hover:text-[#9A7AF4]"
                          : "text-[#5E4B8B] hover:text-[#4B3A78]"
                      }`}
                    >
                      <span>Gender</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${genderOpen ? "rotate-180" : "rotate-0"
                          }`}
                      />
                      <span className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full bg-[#815CF0]" />
                    </button>

                    {genderOpen && setGender && typeof document !== 'undefined' && !isMobileViewport && createPortal(
                      <div
                        ref={genderMenuRef}
                        style={menuStyle || undefined}
                        className={`w-[180px] overflow-hidden rounded-[18px] border p-2 shadow-xl theme-transition z-9999 ${isDark
                            ? "border-[#815CF0]/20 bg-[#000000] backdrop-blur-xl"
                            : "border-gray-200 bg-white/95 backdrop-blur-lg"
                          }`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {HOMEPAGE_GENDERS.map(({ id, icon, label }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setGender(id);
                              try { genderService.setGender(id); } catch { }
                              clearHomepageStyleSelection();
                              // Navigate to corresponding route
                              if (id === 'Male') navigate('/ai-boyfriend');
                              else if (id === 'Trans') navigate('/ai-transgender');
                              else if (id === 'Female') navigate('/ai-girlfriend');
                              else navigate('/');
                              setGenderOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left text-[17px] font-medium transition-colors ${id === gender
                                ? 'text-[#815CF0]'
                                : (isDark ? 'text-white/90 hover:bg-white/5 hover:text-white' : 'text-gray-800 hover:bg-gray-50')
                              }`}>
                            <span className={`inline-flex h-7 w-7 items-center justify-center text-[30px] leading-none ${id === gender ? 'text-[#815CF0]' : ''}`}>{icon}</span>
                            <span className="flex-1">{label}</span>
                          </button>
                        ))}
                      </div>,
                      document.body
                    )}
                  </div>
                )}
              </>
            )}

            {/* Style toggles (Realistic / Anime) - visible on explore/homepage */}
            {isExplorePage && (
              <div className="flex items-center gap-10 lg:gap-12">
                <StyleToggle label="Realistic" styleKey="realistic" />
                <StyleToggle label="Anime" styleKey="anime" />
              </div>
            )}
          </nav>

          {/* Right side */}
          <div
            className={`flex items-center gap-2 sm:gap-3 lg:gap-4`}>

            {/* Mobile search icon removed as per latest mobile design */}

            {/* Theme toggle disabled per request */}
            {/**
             * <button
             *   aria-label="Toggle theme"
             *   onClick={toggleTheme}
             *   className={`grid place-items-center h-8 w-8 sm:h-9 sm:w-9 rounded-full transition theme-transition ${compactButton}`}
             *   style={{ marginRight: 4 }}
             * >
             *   {isDark ? (
             *     <Sun className={`h-4 w-4 sm:h-5 sm:w-5 ${isDark ? "text-white/80" : "text-gray-700"}`} />
             *   ) : (
             *     <Moon className={`h-4 w-4 sm:h-5 sm:w-5 ${isDark ? "text-white/80" : "text-gray-700"}`} />
             *   )}
             * </button>
             */}

            {/* Premium button - shown only for guests or users WITHOUT an active subscription */}
            {(!user || !(user as any).hasActiveSubscription) && promoConfig && promoConfig.offer_enabled && (
              <button
                onClick={() => navigate('/premium')}
                className="hidden md:inline-flex items-center gap-3 px-4 sm:px-5 py-1 h-9 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02]"
                style={{
                  borderRadius: 50,
                  background: 'linear-gradient(90deg, #B88CFF 0%, #815CF0 52%, #7F5AF0 100%)',
                  boxShadow: '0 2px 26px 0 rgba(127, 90, 240, 0.60)'
                }}
              >
                <img src={premiumIcon} alt="" className="h-5 w-5 brightness-0 invert" />
                <span className="hidden xs:inline">{promoConfig?.premium_button_text || 'Get Premium'}</span>
                <span className="xs:hidden">Premium</span>
                <span className="inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[#815CF0]">
                  {promoConfig?.offer_badge_text || '70% off'}
                </span>
              </button>
            )}

            {/* Login / User */}
            {!isAuthenticated ? (
              <button
                onClick={() => { onOpenAuth ? onOpenAuth() : navigate('/login'); }}
                className={`rounded-xl px-4 py-1.5 h-8 text-sm font-medium transition theme-transition ${compactButton}`}
              >
                Login
              </button>
            ) : (
              <div className="relative flex items-center gap-3">
                {/* Show tokens left for users with active subscription */}
                {user ? (
                  <>
                    <button
                      ref={tokenToggleRef}
                      onClick={async () => {
                        try {
                          const opening = !coinCostOpen;
                          setCoinCostOpen(opening);
                          if (opening) {
                            try {
                              updateCoinMenuPosition();
                              const res: any = await apiClient.getCoinCost();
                              console.log('COIN COSTS RESPONSE:', res);
                              setCoinCosts(res);
                            } catch (err) {
                              setCoinCosts(null);
                            }
                            window.addEventListener('resize', updateCoinMenuPosition);
                            window.addEventListener('scroll', updateCoinMenuPosition, true);
                          } else {
                            window.removeEventListener('resize', updateCoinMenuPosition);
                            window.removeEventListener('scroll', updateCoinMenuPosition, true);
                          }
                        } catch { }
                      }}
                      className="inline-flex h-8 sm:h-9 shrink-0 items-center gap-1.5 rounded-full px-2 sm:px-4 text-[13px] sm:text-sm font-medium text-white transition"
                      title={`Tokens left: ${tokenBalance}`}
                      style={{
                        background: 'rgba(255, 255, 255, 0.12)',
                        backdropFilter: 'blur(6px)',
                        WebkitBackdropFilter: 'blur(6px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)'
                      }}
                    >
                      <img src={tokenIcon} alt="token" className="h-5 w-5 shrink-0" />
                      <span className="whitespace-nowrap text-white">
                        {tokenBalance}
                      </span>
                      <span className="inline-flex h-5 w-5 items-center justify-center text-white/90" aria-hidden>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10 5V15M5 10H15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </button>

                    {coinCostOpen && (typeof document !== 'undefined') && createPortal(
                      <div
                        ref={coinMenuRef}
                        style={coinMenuStyle || undefined}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        className="z-9999 mt-2 overflow-hidden"
                        aria-hidden
                      >
                        <div
                          className="w-[227px] rounded-[14px] border border-[rgba(251,254,252,0.3)] bg-black p-[19px_21px] shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-[20px]"
                        >
                          <div className="flex flex-col gap-3">
                            {coinCostItems.map((item) => (
                              <div key={item.label} className="flex items-center justify-between gap-4">
                                <span className="whitespace-nowrap text-sm font-normal text-white/88">
                                  {item.label}
                                </span>
                                <span className="inline-flex shrink-0 items-center gap-1 text-white">
                                  <img src={tokenIcon} alt="coin" className="h-4 w-4 shrink-0" />
                                  <span className="text-sm font-semibold">
                                    {item.value}
                                  </span>
                                </span>
                              </div>
                            ))}

                            <button
                              onClick={() => { setCoinCostOpen(false); window.requestAnimationFrame(() => navigate('/buy-tokens')); }}
                              className="mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#7F5AF0] px-4 text-sm font-semibold text-white transition hover:brightness-110"
                            >
                              <span className="text-xl font-normal leading-none">+</span>
                              <span>Buy more</span>
                            </button>
                          </div>
                        </div>
                      </div>,
                      document.body
                    )}
                  </>
                ) : null}
                <div className="relative">
                  <button
                    ref={profileToggleRef}
                    className={`flex items-center gap-2 rounded-full px-2.5 sm:px-4 h-10 text-sm transition theme-transition ${compactButton}`}
                    onClick={() => setShowProfile((v) => !v)}
                  >
                    <img src={(user && user.avatar) ? user.avatar : 'https://i.pravatar.cc/64'} alt="avatar" className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover" />
                    <span className="text-xs sm:text-sm hidden sm:inline">{user?.name || user?.email?.split('@')[0] || 'Profile'}</span>
                  </button>
                  {showProfile && (
                    <div
                      ref={profileMenuRef}
                      className={`absolute right-0 mt-[14px] w-[324px] rounded-[14px] border p-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-[20px] theme-transition ${
                        isDark
                          ? "border-[rgba(158,130,243,0.3)] bg-[#0F0E16]"
                          : "border-[#d7d0f4] bg-white"
                      }`}
                    >
                      <button
                        onClick={() => { setShowProfile(false); navigate('/premium'); }}
                        className={`flex h-12 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition-colors ${
                          isDark ? "text-white hover:bg-white/[0.03]" : "text-slate-900 hover:bg-slate-100"
                        }`}
                      >
                        <Crown className="h-5 w-5 shrink-0 text-[#815CF0]" strokeWidth={2} />
                        <span>Subscription</span>
                      </button>

                      <button
                        onClick={() => { setShowProfile(false); navigate('/profile'); }}
                        className={`mt-1 flex h-12 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition-colors ${
                          isDark ? "text-white hover:bg-white/[0.03]" : "text-slate-900 hover:bg-slate-100"
                        }`}
                      >
                        <Settings className="h-5 w-5 shrink-0" strokeWidth={2} />
                        <span>Settings</span>
                      </button>

                      <button
                        onClick={() => { setShowProfile(false); logout(); }}
                        className={`mt-1 flex h-12 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition-colors ${
                          isDark ? "text-[#FF453A] hover:bg-white/[0.03]" : "text-[#FF3B30] hover:bg-slate-100"
                        }`}
                      >
                        <LogOut className="h-5 w-5 shrink-0" strokeWidth={2} />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
