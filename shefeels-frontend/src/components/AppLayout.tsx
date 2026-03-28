import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import SEOHead from "./SEOHead";
import genderService from '../utils/genderService';
import AuthModal from "./AuthModal";
import Sidebar from "./Sidebar";
import MobileTabBar from "./MobileTabBar";
import HeroSection from "./HeroSection";
import CharacterCard from "./CharacterCard";
import { useNavigate } from "react-router-dom";
import { normalizeCharacters } from '../utils/normalizeCharacter';
import LoadMoreButton from "./LoadMoreButton";
import InfoSplit from "./InfoSplit";
import MoreInfoSplit from "./MoreInfoSplit";
import FeatureCardsGrid from "./FeatureCardsGrid";
import HighlightsTriple from "./HighlightsTriple";
import FAQSection from "./FAQSection";
import SiteFooter from "./SiteFooter";
import { useTheme } from "../contexts/ThemeContext";
import { ChevronDown } from "./icons";
import apiClient from "../utils/api";
import CHARACTER_LIKE_ENDPOINT from "../utils/characterLikeEndpoint";
import sortMenuIcon from "../assets/sort-menu-icon.svg";

type SortOption = "new" | "popular";

const sortOptions: { id: SortOption; label: string }[] = [
  { id: "new", label: "New" },
  { id: "popular", label: "Popular" },
];

const getUpdatedTimestamp = (character: any) => {
  const candidate =
    character?.updated_at ??
    character?.updatedAt ??
    character?.updatedAtDate ??
    character?.updatedAtTimestamp ??
    character?.created_date ??
    character?.created_at ??
    character?.createdAt ??
    character?.createdAtDate ??
    character?.createdAtTimestamp ??
    "";
  const parsed = Date.parse(String(candidate));
  return Number.isNaN(parsed) ? 0 : parsed;
};

// Removed fallback/placeholder character assets - following industry standards to show loading state instead

export default function AppLayout({ children }: { children?: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const location = useLocation();
  // Footer is shown on all pages except Chat and multi-step creation/admin areas
  const isChatRoute = location.pathname.startsWith('/chat');
  const isCreateCharacterRoute = location.pathname.startsWith('/create-character');
  const isGalleryRoute = location.pathname.startsWith('/gallery'); // Gallery often used without footer in some designs, but we'll include it unless requested otherwise
  const isAdminRoute = location.pathname.startsWith('/admin');
  
  const shouldShowFooter = !isChatRoute && !isCreateCharacterRoute && !isAdminRoute;

  // Fixed header height for consistency across all pages (match Figma header)
  const HEADER_H = 74; // px

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    try {
      // For mobile view (narrow widths) we should not open the sidebar by default.
      // If a stored user preference exists, respect it; otherwise default to false on mobile.
      const stored = localStorage.getItem("hl_sidebarOpen");
      try {
        const w = typeof window !== 'undefined' ? (window.innerWidth || document.documentElement.clientWidth || 0) : 0;
        if (w && w < 768) {
          return stored ? JSON.parse(stored) : false;
        }
      } catch { }
      return stored ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      // On small screens, always default to collapsed for mobile view
      try {
        const w = typeof window !== 'undefined' ? (window.innerWidth || document.documentElement.clientWidth || 0) : 0;
        if (w && w < 768) return true;
      } catch { }
      // default to expanded (true) when no stored value exists
      return JSON.parse(localStorage.getItem("hl_sidebarCollapsed") || "false");
    } catch {
      return true;
    }
  });
  const [selectedItem, setSelectedItem] = useState<string>("Explore");
  const [genderOpen, setGenderOpen] = useState(false);

  // Determine initial gender based on route
  const getInitialGender = (): string => {
    const path = location.pathname;
    // On the homepage (`/`) leave gender unselected by default (empty string)
    // so the hero can show the generic/promotional copy when nothing is chosen.
    if (path === '/') return '';
    if (path === '/ai-boyfriend') return 'Male';
    if (path === '/ai-transgender') return 'Trans';
    if (path === '/ai-girlfriend' || path === '/create-character') return 'Female';
    // Default to stored gender or Female
    try {
      return genderService.getGender();
    } catch { return 'Female'; }
  };

  const [gender, setGender] = useState<string>(getInitialGender);
  const [authOpen, setAuthOpen] = useState(false);

  // Filter states for homepage
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("new");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const popoverRef = useRef<any | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = useState<number>(HEADER_H);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileStyleRef = useRef<HTMLDivElement | null>(null);

  // Preview images and popover refs

  useEffect(() => {
    try {
      localStorage.setItem("hl_sidebarCollapsed", JSON.stringify(sidebarCollapsed));
    } catch { }
  }, [sidebarCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem("hl_sidebarOpen", JSON.stringify(sidebarOpen));
    } catch { }
  }, [sidebarOpen]);

  // Update gender when route changes
  useEffect(() => {
    const path = location.pathname;
    if (path === '/ai-boyfriend') {
      setGender('Male');
      genderService.setGender('Male');
    } else if (path === '/ai-transgender') {
      setGender('Trans');
      genderService.setGender('Trans');
    } else if (path === '/ai-girlfriend') {
      setGender('Female');
      genderService.setGender('Female');
    } else if (path === '/create-character') {
      // Check for draft and restore that gender so we don't overwrite it
      let restored = 'Female';
      try {
        const raw = sessionStorage.getItem('hl_create_character_draft');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.gender) restored = parsed.gender;
        }
      } catch { }
      setGender(restored);
      genderService.setGender(restored);
    } else {
      // Do not override explicit 'All' selection when on '/', keep current stored gender
    }
  }, [location.pathname]);

  // Force a consistent header height no matter the page content
  useEffect(() => {
    setHeaderH(HEADER_H);
  }, []);

  useEffect(() => {
    const isVisible = (el: HTMLElement | null) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) return false;
      const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
      if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
      return true;
    };

    function onDocClick(e: MouseEvent) {
      if (!genderOpen) return;
      // Only use the mobile anchor to close the popover on small screens; desktop header handles its own clicks.
      const isMobile = (() => {
        try {
          return (window?.innerWidth || document?.documentElement?.clientWidth || 0) < 640;
        } catch {
          return false;
        }
      })();
      if (!isMobile) return;
      const anchor = popoverRef.current as HTMLElement | null;
      if (!isVisible(anchor)) return;
      if (anchor && anchor.contains(e.target as Node)) return;
      setGenderOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setGenderOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [genderOpen]);

  useEffect(() => {
    if (!sortMenuOpen) return undefined;
    function onOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      if (sortMenuRef.current && sortMenuRef.current.contains(target)) return;
      if (mobileStyleRef.current && mobileStyleRef.current.contains(target)) return;
      setSortMenuOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [sortMenuOpen]);

  // subscribe to global gender changes so the layout updates immediately
  useEffect(() => {
    const unsub = genderService.subscribe((g: string) => {
      try { setGender(String(g)); } catch { }
    });
    return () => { try { unsub(); } catch { } };
  }, []);

  const navigate = useNavigate();
  // Listen for global auth-required events dispatched by the API client
  useEffect(() => {
    function onAuthRequired() {
      try {
        // Only prompt for login if the current page is a protected route
        // Background API calls (e.g. profile fetches on the homepage) should
        // not force a modal/redirect for anonymous visitors.
        const path = location?.pathname || '/';
        const protectedPrefixes = [
          '/create-character',
          '/my-ai',
          '/profile',
          '/buy-tokens',
          '/premium',
          '/edit-character',
        ];

        const isProtected = protectedPrefixes.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p));
        if (!isProtected) {
          // Ignore auth-required events triggered by background requests on public pages
          return;
        }

        // Open the auth modal and navigate to login as a modal over the current page
        setAuthOpen(true);
        if (location.pathname !== '/login') {
          try { navigate('/login', { state: { background: location } }); } catch { }
        }
      } catch { }
    }

    try { window.addEventListener('hl_auth_required', onAuthRequired as EventListener); } catch { }
    return () => { try { window.removeEventListener('hl_auth_required', onAuthRequired as EventListener); } catch { } };
  }, [location, navigate]);

  // Listen for manual auth modal triggers (e.g. from guest interactions on public pages)
  useEffect(() => {
    function onTriggerAuthModal() {
      setAuthOpen(true);
    }
    try { window.addEventListener('hl_trigger_auth_modal', onTriggerAuthModal as EventListener); } catch { }
    return () => { try { window.removeEventListener('hl_trigger_auth_modal', onTriggerAuthModal as EventListener); } catch { } };
  }, []);

  const [characters, setCharacters] = useState<any[] | null>(null);
  const [charError, setCharError] = useState<string | null>(null);
  const [countsMap, setCountsMap] = useState<Record<string, { likes: number; messages: number }>>({});
  const [likeStatusMap, setLikeStatusMap] = useState<Record<string, boolean>>({});
  const [likingMap, setLikingMap] = useState<Record<string, boolean>>({});
  const [showAllCharacters, setShowAllCharacters] = useState<boolean>(false);

  // Responsive items per row (fallback to 4). Adjust breakpoints as needed.
  const getItemsPerRowFromWidth = (w: number) => {
    try {
      if (w < 640) return 2; // small/mobile
      if (w < 1024) return 3; // tablet
      return 4; // desktop and up
    } catch { return 4; }
  };
  const getInitialItemsPerRow = () => {
    try {
      const w = typeof window !== 'undefined' ? (window.innerWidth || document.documentElement.clientWidth || 0) : 0;
      return getItemsPerRowFromWidth(w);
    } catch { return 4; }
  };
  const [itemsPerRow, setItemsPerRow] = useState<number>(getInitialItemsPerRow);

  useEffect(() => {
    try {
      function onResize() {
        try {
          const w = window.innerWidth || document.documentElement.clientWidth || 0;
          setItemsPerRow(getItemsPerRowFromWidth(w));
        } catch { }
      }
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    } catch { return; }
  }, []);
  const handleSortSelect = (option: SortOption) => {
    setSortOption(option);
    setSortMenuOpen(false);
  };

  const handleLikeCharacter = async (characterId: string) => {
    if (!characterId) return;
    if (likeStatusMap[characterId] || likingMap[characterId]) return;
    setLikingMap((prev) => ({ ...prev, [characterId]: true }));
    try {
      await apiClient.post(CHARACTER_LIKE_ENDPOINT, { character_id: String(characterId) });
      setCountsMap((prev) => {
        const current = prev[characterId] || { likes: 0, messages: 0 };
        return {
          ...prev,
          [characterId]: {
            likes: (current.likes ?? 0) + 1,
            messages: current.messages ?? 0,
          },
        };
      });
      setLikeStatusMap((prev) => ({ ...prev, [characterId]: true }));
    } catch (err) {
      console.debug('AppLayout: failed to like character', err);
    } finally {
      setLikingMap((prev) => {
        const next = { ...prev };
        delete next[characterId];
        return next;
      });
    }
  };

  const renderCharacterCard = (character: any, keyOverride?: React.Key) => {
    const charId = String(character?.id ?? character?.character_id ?? '').trim();
    const counts = countsMap[charId] || { likes: 0, messages: 0 };
    const isLiked = !!likeStatusMap[charId];
    const isLiking = !!likingMap[charId];
    const handleLike = charId ? () => handleLikeCharacter(charId) : undefined;
    const resolvedKey = keyOverride ?? (charId || String(character?.id ?? character?.name ?? Math.random()));

    // Check if we're on the homepage-style paths (including gender-specific routes)
    const isHomepagePath = location.pathname === '/' ||
      location.pathname === '/ai-girlfriend' ||
      location.pathname === '/ai-boyfriend' ||
      location.pathname === '/ai-transgender';

    return (
      <CharacterCard
        key={resolvedKey}
        name={character.name || character.username}
        age={character.age}
        img={character.webp_image_url_s3 || character.image_url_s3}
        gif={character.gif_url_s3}
        webp={character.animated_webp_url_s3}
        bio={character.bio}
        metaBadgeLabel={isHomepagePath ? (character.ethnicity || character?.attributes?.ethnicity || null) : null}
        displayFullName={isHomepagePath}
        onClick={() => navigate('/chat', { state: { character } })}
        likesCount={counts.likes}
        messageCount={counts.messages}
        onLike={handleLike}
        isLiked={isLiked}
        likeDisabled={!charId || isLiked || isLiking}
        hideLike={!handleLike}
        hideChat={isHomepagePath}
        showOptions={false}
        alignActionsSpread={isHomepagePath}
      />
    );
  };

  const filteredCharacters = useMemo(() => {
    if (!characters) return [];
    const readField = (obj: any, key: string) => {
      try {
        if (!obj) return undefined;
        if (key.indexOf('.') === -1) return obj[key];
        return key.split('.').reduce((acc: any, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), obj);
      } catch {
        return undefined;
      }
    };

    const getNormalized = (obj: any, keys: string[]) => {
      for (const k of keys) {
        const v = readField(obj, k);
        if (v != null && String(v).trim() !== '') return String(v).toLowerCase().trim();
      }
      return '';
    };

    return characters.filter((ch) => {
      const rawGender = String(gender || '').toLowerCase().trim();

      if (activeFilters.includes('private_content')) {
        const hasPrivate = ch.has_private_content || ch.private_content || ch.premium;
        if (!hasPrivate) return false;
      }

      try {
        // Default to showing female characters when no gender is selected in the header
        const g = rawGender || 'female';
        if (g && g !== 'all') {
          const genderVal = getNormalized(ch, ['gender', 'sex', 'gender_identity', 'profile.gender', 'meta.gender']);
          if (!genderVal) return false;

          const matchWord = (text: string, words: string[]) => {
            try {
              const t = String(text || '').toLowerCase();
              for (const w of words) {
                const re = new RegExp('\\b' + w.replace(/[^a-z0-9]/g, '') + '\\b');
                if (re.test(t)) return true;
              }
            } catch { }
            return false;
          };

          if (g === 'male') {
            if (!matchWord(genderVal, ['male', 'man', 'guy', 'boy'])) return false;
          } else if (g === 'female') {
            if (!matchWord(genderVal, ['female', 'woman', 'girl'])) return false;
          } else if (g === 'trans') {
            // Accept common transgender labels, not just the exact word "trans"
            const normalized = genderVal.toLowerCase();
            const collapsed = normalized.replace(/[^a-z0-9]/g, '');
            const isTransLike =
              normalized.startsWith('trans') ||
              collapsed.startsWith('trans') ||
              /\bmtf\b/.test(normalized) ||
              /\bftm\b/.test(normalized) ||
              matchWord(genderVal, ['transgender']);
            if (!isTransLike) return false;
          } else {
            if (!matchWord(genderVal, [g])) return false;
          }
        }
      } catch { }

      try {
        const wantsAnime = activeFilters.includes('anime');
        const wantsRealisticExplicit = activeFilters.includes('realistic');
        // When no gender or style is chosen, default to female realistic characters
        const shouldDefaultRealistic = !rawGender && !wantsAnime && !wantsRealisticExplicit;
        const wantsRealistic = wantsRealisticExplicit || shouldDefaultRealistic;
        if (wantsRealistic || wantsAnime) {
          const style = String(ch.style || ch.style_type || '').toLowerCase();
          const ok = (wantsRealistic && style.includes('realistic')) || (wantsAnime && style.includes('anime'));
          if (!ok) return false;
        }
      } catch { }

      return true;
    });
  }, [characters, activeFilters, gender]);
  const sortedCharacters = useMemo(() => {
    const list = [...filteredCharacters];
    if (sortOption === 'popular') {
      list.sort((a, b) => {
        const keyA = String(a?.id ?? '');
        const keyB = String(b?.id ?? '');
        const likesA = countsMap[keyA]?.likes ?? 0;
        const likesB = countsMap[keyB]?.likes ?? 0;
        const likeDiff = likesB - likesA;
        if (likeDiff !== 0) return likeDiff;
        const messagesA = countsMap[keyA]?.messages ?? 0;
        const messagesB = countsMap[keyB]?.messages ?? 0;
        const messageDiff = messagesB - messagesA;
        if (messageDiff !== 0) return messageDiff;
        return getUpdatedTimestamp(b) - getUpdatedTimestamp(a);
      });
    } else {
      list.sort((a, b) => getUpdatedTimestamp(b) - getUpdatedTimestamp(a));
    }
    return list;
  }, [filteredCharacters, sortOption, countsMap]);

  useEffect(() => {
    let aborted = false;

    // Skip character loading on chat routes - chat page loads its own characters
    if (isChatRoute) {
      return;
    }

    const sanitizeIds = (list: any[]): string[] => {
      const seen = new Set<string>();
      for (const entry of list) {
        const raw = entry?.id ?? entry?.character_id;
        const id = raw == null ? '' : String(raw).trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
      }
      return Array.from(seen);
    };

    const fetchLikeStatuses = async (ids: string[]) => {
      if (!ids || ids.length === 0) {
        setLikeStatusMap({});
        return;
      }
      try {
        const data = await apiClient.getCharacterLikeStatus(ids);
        if (aborted) return;

        const map: Record<string, boolean> = {};
        if (Array.isArray(data)) {
          for (const item of data) {
            const id = String(item?.character_id ?? '');
            if (id) {
              map[id] = !!item.is_liked;
            }
          }
        }

        setLikeStatusMap((prev) => ({
          ...prev,
          ...map
        }));
      } catch (err) {
        if (!aborted) console.debug('AppLayout: failed to fetch like statuses', err);
      }
    };

    async function loadChars() {
      try {
        // OPTIMIZATION: Fetch characters first, then parallelize counts + like status
        const data = await apiClient.getDefaultCharacters();
        if (aborted) return;
        const arr = Array.isArray(data) ? normalizeCharacters(data) : [];
        setCharacters(arr);
        setLikingMap({});

        const ids = sanitizeIds(arr);
        if (ids.length === 0) {
          setCountsMap({});
          setLikeStatusMap({});
        } else {
          // OPTIMIZATION: Fetch counts and like status in parallel using Promise.allSettled
          // This reduces waterfall delays significantly
          const [countsResult, likeStatusResult] = await Promise.allSettled([
            apiClient.getLikesMessageCount(ids),
            apiClient.getCharacterLikeStatus(ids)
          ]);

          if (aborted) return;

          // Process counts result
          if (countsResult.status === 'fulfilled') {
            const d2 = countsResult.value;
            const m: Record<string, { likes: number; messages: number }> = {};
            for (const id of ids) {
              m[id] = { likes: 0, messages: 0 };
            }
            if (Array.isArray(d2)) {
              for (const item of d2) {
                const id = String(item?.character_id ?? '').trim();
                if (!id) continue;
                m[id] = {
                  likes: Number(item?.likes_count ?? 0),
                  messages: Number(item?.message_count ?? 0),
                };
              }
            }
            setCountsMap(m);
          } else {
            console.debug('AppLayout: counts fetch error', countsResult.reason);
            setCountsMap({});
          }

          // Process like status result
          if (likeStatusResult.status === 'fulfilled') {
            const likeData = likeStatusResult.value;
            const likeMap: Record<string, boolean> = {};
            if (Array.isArray(likeData)) {
              for (const item of likeData) {
                const id = String(item?.character_id ?? '');
                if (id) {
                  likeMap[id] = !!item.is_liked;
                }
              }
            }
            setLikeStatusMap((prev) => ({ ...prev, ...likeMap }));
          }
        }

        // OPTIMIZATION: Preload only first 3 images eagerly for faster FCP
        // Schedule remaining images during browser idle time
        try {
          const MAX_EAGER_PRELOAD = 3; // Reduced from 6 for faster initial render
          const eager = arr.slice(0, MAX_EAGER_PRELOAD);
          for (const ch of eager) {
            try {
              if (ch?.image_url_s3) {
                const img = new Image();
                img.src = ch.image_url_s3;
              }
            } catch { }
          }

          const remaining = arr.slice(MAX_EAGER_PRELOAD).map((c) => c?.image_url_s3).filter(Boolean);
          if (remaining.length > 0 && typeof window !== 'undefined') {
            const schedule = () => {
              try {
                for (const url of remaining) {
                  try {
                    const i = new Image();
                    i.src = url as string;
                  } catch { }
                }
              } catch { }
            };
            if ('requestIdleCallback' in window) {
              (window as any).requestIdleCallback(schedule, { timeout: 3000 });
            } else {
              setTimeout(schedule, 2000);
            }
          }
        } catch { }
      } catch (err: any) {
        if (!aborted) setCharError(err?.message || String(err));
      }
    }

    loadChars();
    return () => { aborted = true; };
  }, []);

  useEffect(() => {
    if (charError) console.warn("Character fetch error:", charError);
  }, [charError]);

  // Expose a small global helper so header and pages can reliably set/get the current style.
  useEffect(() => {
    try {
      if (!(window as any).hl_set_style) {
        (window as any).hl_set_style = function (style: string) {
          try { localStorage.setItem('hl_style', String(style)); } catch { }
          try { (window as any).hl_current_style = String(style).toLowerCase(); } catch { }
          try { window.dispatchEvent(new CustomEvent('hl_style_changed', { detail: style })); } catch { }
        };
      }
      // populate hl_current_style from localStorage if present
      try {
        const s = localStorage.getItem('hl_style');
        if (s && !(window as any).hl_current_style) (window as any).hl_current_style = String(s).toLowerCase();
      } catch { }
    } catch { }
  }, []);

  // Keep activeFilters in sync with global style changes (Realistic/Anime select-deselect)
  useEffect(() => {
    function onStyleChange(e: any) {
      try {
        const detail = (e && e.detail) ? String(e.detail).toLowerCase() : '';
        setActiveFilters(prev => {
          const next = (prev || []).filter(Boolean).filter((p) => p !== 'realistic' && p !== 'anime');
          if (detail === 'realistic') next.push('realistic');
          if (detail === 'anime') next.push('anime');
          return next;
        });
      } catch { }
    }
    try { window.addEventListener('hl_style_changed', onStyleChange as EventListener); } catch { }
    // initialize from existing value
    try {
      const s = (window as any).hl_current_style || localStorage.getItem('hl_style');
      if (s) {
        const low = String(s).toLowerCase();
        setActiveFilters(prev => {
          const next = (prev || []).filter(Boolean).filter((p) => p !== 'realistic' && p !== 'anime');
          if (low.includes('realistic')) next.push('realistic');
          if (low.includes('anime')) next.push('anime');
          return next;
        });
      }
    } catch { }

    return () => { try { window.removeEventListener('hl_style_changed', onStyleChange as EventListener); } catch { } };
  }, []);

  const showMobileTabBar = !isChatRoute;
  const mobilePaddingClass = showMobileTabBar ? 'pb-[84px]' : 'pb-6';

  return (
    <div
      className={`min-h-screen w-full relative overflow-x-hidden theme-transition ${isDark
        ? "bg-black text-white"
        : "bg-white text-slate-900"
        }`}
      style={{ ["--header-h" as any]: `${headerH}px` }}
    >
      {/* SEO Head for homepage */}
      {!children && (
        <SEOHead
          title={(() => {
            const g = (gender || '').toLowerCase();
            if (g === 'male') return "Free AI Boyfriend Chat – Unlimited & Uncensored Messages";
            if (g === 'trans') return "AI Transgender Chat, Girls & Women (Free Trans AI Generator)";
            if (g === 'female') return "Chat with AI Girlfriend Free, Unlimited Messages, No Limits";
            return "Realistic AI Companion with Interactive AI Chat Online";
          })()}
          description={(() => {
            const g = (gender || '').toLowerCase();
            if (g === 'male') return "Chat with your AI boyfriend free on SheFeels AI. Enjoy free AI BF chatting with unlimited messages, no filters, 100% fully customizable. Your AI boy is waiting.";
            if (g === 'trans') return "SheFeels AI offers the best AI transgender generator. Create custom trans AI girlfriend, women with any personality, look, and voice — no restrictions, unlimited trans chat.";
            if (g === 'female') return "Talk to AI girlfriend free on SheFeels AI. Start free AI girl chatting, unlimited messages, unfiltered & no restriction. Sign your AI girlfriend website or app now.";
            return "Craving for a realistic AI companion? Try interactive chat online, meet AI companions chatbot, and get personalized with the best AI companion website on SheFeels AI.";
          })()}
          keywords="AI girlfriend, AI boyfriend, AI chat, NSFW AI, AI companion, character AI, virtual girlfriend, virtual boyfriend, AI roleplay, custom AI characters"
          canonical="https://shefeels.ai"
          structuredData={{
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "SheFeels AI",
            "description": "AI companion platform for creating and chatting with custom AI characters",
            "url": "https://shefeels.ai",
            "applicationCategory": "Entertainment",
            "operatingSystem": "Web Browser",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD",
              "availability": "https://schema.org/InStock"
            },
            "author": {
              "@type": "Organization",
              "name": "SheFeels AI"
            }
          }}
        />
      )}
      <div ref={headerRef} className="fixed left-0 right-0 top-0 z-50 transition-all duration-300">
        <Header
          gender={gender}
          setGender={setGender}
          genderOpen={genderOpen}
          setGenderOpen={setGenderOpen}
          setSidebarOpen={setSidebarOpen}
          onOpenAuth={() => setAuthOpen(true)}
          popoverRef={popoverRef}
          currentPath={location.pathname}
        />
        {/* Premium banner removed - now shown in HeroSection on mobile instead */}
      </div>

      {/* Extend the sidebar divider behind the fixed header without doubling the line below it */}
      <div
        aria-hidden
        className={`pointer-events-none fixed top-0 z-40 hidden md:block border-l ${isDark ? 'border-[#815CF0]/35' : 'border-[#815CF0]/18'}`}
        style={{ left: sidebarCollapsed ? '64px' : '240px', height: 'var(--header-h)' }}
      />

      <div className={`flex min-h-[calc(100vh-1px)] transition-all duration-300 md:pb-0 ${
        (sidebarCollapsed ? 'md:pl-16' : 'md:pl-60')
        }`} style={{ paddingTop: "var(--header-h)" } as React.CSSProperties}>
        <Sidebar
          sidebarOpen={sidebarOpen}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          setSidebarOpen={setSidebarOpen}
          selectedItem={selectedItem}
          setSelectedItem={setSelectedItem}
        />

        {/* Main content column (remove inner left border to avoid double line) */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          {children ? (
            <main className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6">{children}</main>
          ) : (
            <>
              <HeroSection gender={gender} />

              {/* Featured NSFW Chatbot Card - removed from mobile per user request */}

              <main className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6">
                <section className="py-8 md:py-10">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3 md:mb-8">
                    <h2 className="w-full text-lg font-bold leading-tight tracking-[-0.01em] text-[#F2F2F7] md:w-auto md:text-xl">
                      AI Character
                    </h2>

                    {/* Mobile-only filter pills below heading - smaller size, proper dropdowns */}
                    <div className="md:hidden w-full flex flex-wrap items-center gap-2 mt-2.5 pb-1.5">
                      {/* Gender Dropdown */}
                      <div className="relative flex-auto min-w-0" ref={popoverRef} data-gender-anchor>
                        <button
                          onClick={() => setGenderOpen(!genderOpen)}
                          className={`flex w-full h-7 justify-center items-center gap-1 px-2 text-[10px] tracking-tight leading-none font-medium transition-all duration-200 rounded-full whitespace-nowrap overflow-hidden text-ellipsis ${gender
                            ? 'bg-[rgba(192,155,98,0.18)] border border-[#C09B62] text-white'
                            : 'border'
                            }`}
                          style={!gender ? {
                            background: 'rgba(255, 255, 255, 0.10)',
                            color: '#F2F2F7',
                            borderColor: 'rgba(255, 255, 255, 0.15)'
                          } : {}}
                        >
                          {gender ? gender : 'Gender'}
                          <svg width="8" height="8" viewBox="0 0 12 12" fill="none" className="opacity-60 shrink-0">
                            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {genderOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setGenderOpen(false)}
                            />
                            <div className="absolute top-full left-0 mt-1 bg-[#1C1C1E] border border-white/10 rounded-lg shadow-xl z-50 min-w-25">
                              {['All', 'Male', 'Female', 'Trans'].map((option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    const val = option === 'All' ? '' : option;
                                    setGender(val);
                                    genderService.setGender(val);
                                    setGenderOpen(false);
                                  }}
                                  className="block w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 first:rounded-t-lg last:rounded-b-lg"
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Style Dropdown */}
                      <div className="relative flex-auto min-w-0" ref={mobileStyleRef}>
                        <button
                          onClick={() => setSortMenuOpen(!sortMenuOpen)}
                          className={`flex w-full h-7 justify-center items-center gap-1 px-2 text-[10px] tracking-tight leading-none font-medium transition-all duration-200 rounded-full whitespace-nowrap overflow-hidden text-ellipsis ${activeFilters.includes('realistic') || activeFilters.includes('anime')
                            ? 'bg-[rgba(192,155,98,0.18)] border border-[#C09B62] text-white'
                            : 'border'
                            }`}
                          style={!activeFilters.includes('realistic') && !activeFilters.includes('anime') ? {
                            background: 'rgba(255, 255, 255, 0.10)',
                            color: '#F2F2F7',
                            borderColor: 'rgba(255, 255, 255, 0.15)'
                          } : {}}
                        >
                          {activeFilters.includes('realistic') ? 'Realistic' : activeFilters.includes('anime') ? 'Anime' : 'Style'}
                          <svg width="8" height="8" viewBox="0 0 12 12" fill="none" className="opacity-60 shrink-0">
                            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {sortMenuOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setSortMenuOpen(false)}
                            />
                            <div className="absolute top-full left-0 mt-1 bg-[#1C1C1E] border border-white/10 rounded-lg shadow-xl z-50 min-w-25">
                              {['All', 'Realistic', 'Anime'].map((option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    setActiveFilters(prev => {
                                      const filtered = prev.filter(f => f !== 'realistic' && f !== 'anime');
                                      if (option === 'Realistic') filtered.push('realistic');
                                      if (option === 'Anime') filtered.push('anime');
                                      return filtered;
                                    });
                                    try {
                                      localStorage.setItem('hl_style', option.toLowerCase());
                                      window.dispatchEvent(new CustomEvent('hl_style_changed', { detail: option.toLowerCase() }));
                                    } catch { }
                                    setSortMenuOpen(false);
                                  }}
                                  className="block w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 first:rounded-t-lg last:rounded-b-lg"
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          try { navigate('/private-content/select-character'); } catch { }
                        }}
                        className="flex-auto min-w-0 h-7 flex justify-center items-center gap-1 px-2 text-[10px] tracking-tight leading-none font-medium transition-all duration-200 rounded-full border whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{
                          background: 'rgba(0, 0, 0, 0.60)',
                          color: '#F2F2F7',
                          borderColor: 'rgba(127, 90, 240, 0.44)'
                        }}
                      >
                        Private
                      </button>
                    </div>

                    {/* Filter Pills - Right aligned to match Figma */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Gender, Style, Private Content pills moved to Homepage below heading */}

                      {/* Style Dropdown - mobile only (removed per request)
                      <button
                        type="button"
                        className="md:hidden inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                        style={{ 
                          background: 'rgba(255, 255, 255, 0.10)', 
                          color: '#F2F2F7',
                          border: '1px solid rgba(255, 255, 255, 0.15)'
                        }}
                      >
                        <span>Style</span>
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      */}

                      {/* Filter Button removed per request
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs md:text-sm font-medium transition-all"
                        style={{ 
                          background: 'rgba(255, 255, 255, 0.10)', 
                          color: '#F2F2F7',
                          border: '1px solid rgba(255, 255, 255, 0.15)'
                        }}
                      >
                        <FilterIcon className="h-3 w-3" />
                        <span className="hidden md:inline">Filter</span>
                      </button>
                      */}

                      {/* 'All Models' pill removed per request */}

                      <div className="hidden md:flex items-center gap-4">
                        <div className="relative" ref={sortMenuRef}>
                          <button
                            type="button"
                            onClick={() => setSortMenuOpen((prev) => !prev)}
                            className="inline-flex h-8 items-center justify-center gap-2 rounded-full border border-[#7F5AF0]/40 px-4 text-sm font-semibold text-[#F2F2F7] transition-all duration-200 hover:bg-[#7F5AF0]/10 hover:scale-[1.01]"
                            style={{
                              background: 'rgba(0, 0, 0, 0.50)',
                              backdropFilter: 'blur(5px)'
                            }}
                            aria-expanded={sortMenuOpen}
                          >
                            <span>Sort</span>
                            <img src={sortMenuIcon} alt="" className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
                          </button>
                          {sortMenuOpen && (
                            <div className="absolute right-0 top-full z-20 mt-2 min-w-37.5 rounded-xl border border-white/20 bg-[#070707]/90 p-2 shadow-[0_8px_20px_rgba(0,0,0,0.6)]">
                              {sortOptions.map((option) => {
                                const isActive = sortOption === option.id;
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleSortSelect(option.id)}
                                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${isActive ? 'bg-white text-black' : 'text-white/70 hover:text-white'
                                      }`}
                                  >
                                    {option.label}
                                    {isActive && (
                                      <span className="text-xs font-bold text-(--hl-gold)">✓</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => navigate('/private-content/select-character')}
                          className="inline-flex h-8 items-center justify-center rounded-full border border-[#7F5AF0]/40 px-4 text-sm font-semibold text-[#F2F2F7] transition-all duration-200 hover:bg-[#7F5AF0]/10 hover:scale-[1.01]"
                          style={{
                            background: 'rgba(0, 0, 0, 0.50)',
                            backdropFilter: 'blur(5px)'
                          }}
                        >
                          Private Content
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Render characters in 3-row preview: 2 rows, banner, 1 row, then load more */}
                  {(() => {
                    // If we have characters from the API, render them.
                    if (sortedCharacters.length > 0) {
                      const ITEMS_PER_ROW = itemsPerRow;
                      const firstThree = sortedCharacters.slice(0, ITEMS_PER_ROW * 3);
                      const fourthRow = sortedCharacters.slice(ITEMS_PER_ROW * 3, ITEMS_PER_ROW * 4);
                      const rest = sortedCharacters.slice(ITEMS_PER_ROW * 4);

                      return (
                        <>
                          <div className="mt-2 md:mt-4 responsive-grid">
                            {firstThree.map((ch) => renderCharacterCard(ch))}
                          </div>

                          {/* Fourth row */}
                          <div className="mt-6 md:mt-8 responsive-grid">
                            {fourthRow.map((ch) => renderCharacterCard(ch))}
                          </div>

                          {/* Load more / remaining characters */}
                          {rest.length > 0 && !showAllCharacters && (
                            <div className="py-6 flex justify-center">
                              <LoadMoreButton onClick={() => setShowAllCharacters(true)} />
                            </div>
                          )}

                          {showAllCharacters && rest.length > 0 && (
                            <div className="mt-6 md:mt-8 responsive-grid">
                              {rest.map((ch) => renderCharacterCard(ch))}
                            </div>
                          )}
                        </>
                      );
                    }

                    // Industry standard: Show loading state instead of fake placeholder characters
                    if (characters === null && !charError) {
                      return (
                        <div className="py-12 flex flex-col items-center justify-center">
                          <div className="w-12 h-12 border-4 border-(--hl-gold) border-t-transparent rounded-full animate-spin mb-4"></div>
                          <p className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                            Loading characters...
                          </p>
                        </div>
                      );
                    }

                    // At this point either characters === [] (loaded but empty) or there
                    // was an error — render an empty state instead of placeholder cards.
                    return (
                      <div className="mt-6 w-full text-center">
                        <p className={`${isDark ? 'text-white/60' : 'text-slate-500'} text-sm`}>No characters available.</p>
                      </div>
                    );
                  })()}
                </section>
              </main>

              {/* Additional sections follow after the dynamic character blocks */}

              {/* Additional site sections */}
              <InfoSplit gender={gender} style={activeFilters.includes('anime') ? 'anime' : 'realistic'} />
              <MoreInfoSplit gender={gender} style={activeFilters.includes('anime') ? 'anime' : 'realistic'} />
              <FeatureCardsGrid gender={gender} />
              <HighlightsTriple gender={gender} />
              <FAQSection gender={gender} />
            </>
          )}

          {shouldShowFooter && <SiteFooter gender={gender} />}
        </div>
      </div>

      {/* Mobile Tab Bar */}
      {showMobileTabBar && <MobileTabBar />}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
