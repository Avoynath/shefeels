
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import SEOHead from "../components/SEOHead";
import ChatSidebar from "../components/ChatSidebar";
import ChatGallery from "../components/ChatGallery";
import apiClient from "../utils/api";
import fetchWithAuth from '../utils/fetchWithAuth';
import { getErrorMessage } from '../utils/api';
import { useToastActions } from '../contexts/ToastContext';
import {
  loadLastMapFromLocalStorage,
  saveLastMapToLocalStorage,
  loadLastOpenedChatId,
  saveLastOpenedChatId,
  loadMessagesSnapshot,
  saveMessagesSnapshot,
} from "../utils/chatOfflineCache";
import { buildApiUrl } from '../utils/apiBase';
import OnlyfansIconImg from '../assets/chat/OnlyfansIcon.svg';
import FanvueIconImg from '../assets/chat/FanvueIcon.webp';
import TiktokIconImg from '../assets/chat/TiktokIcon.svg';
import InstagramIconImg from '../assets/chat/InstagramIcon.webp';
import { parseSlugId, generateSlug, matchesShortId } from '../utils/slugs';
import { toDate, splitIntoSentences, downloadUrl as downloadAndSave } from '../utils/chatUtils';
import type { ChatItem, Message, CharacterProfile, SocialKey, Character } from '../types/chat';
import useKeyboardOffset from '../hooks/useKeyboardOffset';
import useAutoScroll from '../hooks/useAutoScroll';
import useImageJobPoller from '../hooks/useImageJobPoller';
// navigation icons moved to component files where needed
import ChatListPanel from '../components/ChatListPanel';
import ChatCenterPanel from '../components/ChatCenterPanel';
import MediaViewerOverlay from '../components/MediaViewerOverlay';

// Stable message ID counter for optimistic updates (prevents key churn)
let messageIdCounter = 0;
const getNextMessageId = () => ++messageIdCounter;




// fallback demo contacts (kept for anonymous/demo view)
// NOTE: keep this empty by default to avoid accidental backend requests using demo ids
const CONTACTS: ChatItem[] = [];

const DEFAULT_PROFILE: CharacterProfile = {
  name: "Select a Character",
  age: 0,
  bio: "This is a placeholder character profile. No public bio is available.",
  gender: "unknown",
  gallery: [],
  details: [
    { label: "Body", value: "—", iconKey: "Body" },
    { label: "Eye", value: "—", iconKey: "Eye" },
    { label: "Ethnicity", value: "—", iconKey: "Ethnicity" },
    { label: "Hair", value: "—", iconKey: "Hair" },
  ],
  traits: [
    { label: "Personality", value: "—", iconKey: "Personality" },
    { label: "Special Features", value: "—", iconKey: "Occupation" },
    { label: "Relationship", value: "—", iconKey: "Relationship" },
    // { label: "Hobbies", value: "—", iconKey: "Hobbies" },
  ],
};

// Icons will be provided later as assets; keeping layout-only placeholders in UI below

// (types moved to `src/types/chat.ts`)

// Use static image assets for social icons to match Figma
// NOTE: order set to OnlyFans, Fanvue, TikTok, Instagram per design request
const SOCIAL_ICON_CONFIG: Array<{ key: SocialKey; label: string; src: string; accent?: string }> = [
  { key: "onlyfans", label: "OnlyFans", src: OnlyfansIconImg, accent: "#00AEEF" },
  { key: "fanvue", label: "Fanvue", src: FanvueIconImg, accent: "#7C4DFF" },
  { key: "tiktok", label: "TikTok", src: TiktokIconImg, accent: "#25F4EE" },
  { key: "instagram", label: "Instagram", src: InstagramIconImg, accent: "#E1306C" },
];

// Avatar component is provided from `src/components/AvatarImg.tsx`.

// removed legacy Bubble component; MessageBubble below handles all variants

// NOTE: date/time and text helpers moved to `src/utils/chatUtils.tsx`



// Page component
import { normalizeCharacters } from '../utils/normalizeCharacter';

// Determine if current AI text message is a continuation of the previous AI sentence (to reduce vertical gap)
function isCompactContinuation(prev?: Message, cur?: Message): boolean {
  try {
    if (!prev || !cur) return false;
    if (prev.from !== 'ai' || cur.from !== 'ai') return false;
    if (prev.type !== 'text' || cur.type !== 'text') return false;
    const t1 = toDate(prev.time).getTime();
    const t2 = toDate(cur.time).getTime();
    // consider messages within 2 seconds as part of the same split response
    return Math.abs(t2 - t1) <= 2000;
  } catch (e) {
    return false;
  }
}

const normalizeImageUrl = (url?: string | null) => {
  if (!url) return '';
  try {
    return String(url).split('#')[0].split('?')[0];
  } catch (e) {
    return String(url);
  }
};

export default function Chat() {
  // Extract URL params for character and pack slugs
  const { characterSlug, packSlug } = useParams<{ characterSlug?: string; packSlug?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { showError } = useToastActions();

  const handleApiError = (err: any, title = 'Error') => {
    try {
      const status = err && (err.status || err.statusCode || (err.response && err.response.status));
      if (status && status >= 400 && status < 500) {
        const detail = err?.body?.detail || err?.body?.message || err?.detail || err?.message || getErrorMessage(err);
        showError(title, String(detail));
        return;
      }
      if (status && status >= 500) {
        // eslint-disable-next-line no-console
        console.warn('Chat: server error', status, err?.body ?? err);
        showError(title, 'Unable to process your request currently.');
        return;
      }
      showError(title, getErrorMessage(err));
    } catch (e) {
      try { showError(title, 'Unable to process your request.'); } catch { }
    }
  };

  // AbortController for cancelling stale requests
  const abortControllerRef = useRef<AbortController | null>(null);
  // Cache for character data to avoid refetching
  const characterCacheRef = useRef<Map<string, any>>(new Map());

  const isPrivatePackView = location.pathname.includes('/private-pack') || location.pathname.includes('/private-content');
  const isPackView = !!packSlug;

  // Redirect legacy chat private-pack routes to canonical private-content routes
  // - /chat/:characterSlug/private-pack  -> /private-content/character/:id/packs
  // - /chat/:characterSlug/pack/:packSlug -> /private-content/pack/:packId/media
  // We perform a runtime lookup (via API) to resolve slugs to IDs and then navigate.
  useEffect(() => {
    const path = location.pathname || '';

    // /chat/:characterSlug/private-pack
    const mChar = path.match(/^\/chat\/([^\/]+)\/private-pack(?:\/|$)/);
    if (mChar) {
      const characterSlugLocal = mChar[1];
      (async () => {
        try {
          const res = await apiClient.getCharacterBySlug(characterSlugLocal);
          const id = res?.character?.id;
          if (id) {
            navigate(`/private-content/character/${id}/packs`, { replace: true });
            return;
          }
        } catch (e) {
          // ignore and fall through to selector
        }
        navigate('/private-content/select-character', { replace: true });
      })();
      return;
    }

    // /chat/:characterSlug/pack/:packSlug
    const mPack = path.match(/^\/chat\/[^\/]+\/pack\/([^\/]+)(?:\/|$)/);
    if (mPack) {
      const packSlugLocal = mPack[1];
      (async () => {
        try {
          // backend exposes pack-by-slug under /api/v1/private-content/pack-by-slug/{slug}
          const pack: any = await apiClient.get(`/api/v1/private-content/pack-by-slug/${encodeURIComponent(packSlugLocal)}`);
          const packId = pack && (pack.id || (pack.MediaPack && pack.MediaPack.id) || (pack.media_pack && pack.media_pack.id));
          if (packId) {
            navigate(`/private-content/pack/${packId}/media`, { replace: true });
            return;
          }
        } catch (e) {
          // ignore and fallback
        }
        navigate('/private-content/select-character', { replace: true });
      })();
      return;
    }
  }, [location.pathname, navigate]);

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "ai">("all");
  // Start with a neutral placeholder (no id) so we don't default to demo contacts and accidentally send demo ids.
  const [selected, setSelected] = useState<ChatItem>({ id: '', name: 'Select a character', hue: 200, isOnline: false, last: '', time: '' });
  const [messages, setMessages] = useState<Message[]>([]);
  const lastMessageIdRef = useRef<string | null>(null);
  // Per-character message cache: speed up switching by restoring cached messages instantly
  const messagesCacheRef = useRef<Map<string, Message[]>>(new Map());
  // remember last selected id loaded from local cache (do not force-select immediately)
  const lastSelectedIdRef = useRef<string | null>(null);
  const [input, setInput] = useState("");
  // Mobile responsiveness and view state (single-pane flow on mobile)
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat' | 'details'>('list');

  useEffect(() => {
    const onResize = () => {
      try {
        const w = window.innerWidth || document.documentElement.clientWidth || 0;
        const m = w < 1024; // treat <1024px as mobile/tablet single-pane
        setIsMobile(m);
      } catch { }
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // On mount: hydrate lastOpenedChatId from localStorage. Only hydrate
  // the `lastMap` (chat previews/timestamps) when the user is authenticated
  // to avoid showing interaction timestamps to guests from stale local cache.
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const cachedMap = loadLastMapFromLocalStorage();
      // Only apply cached lastMap if we have a valid auth token
      if (cachedMap && token) {
        setLastMap(cachedMap);
      }

      const lastChatId = loadLastOpenedChatId();
      if (lastChatId) {
        lastSelectedIdRef.current = lastChatId;
      }
    } catch (e) {
      // ignore
      // eslint-disable-next-line no-console
      console.warn('[Chat] failed to hydrate from local cache', e);
    }
    // re-run when token becomes available so authenticated users can still
    // hydrate lastMap from localStorage when they sign in
  }, [token]);

  // Expose current mobile subview globally so MobileTabBar can hide itself appropriately
  useEffect(() => {
    try { (window as any).__hlMobileChatView = isMobile ? mobileView : undefined; } catch { }
    return () => { try { (window as any).__hlMobileChatView = undefined; } catch { } };
  }, [isMobile, mobileView]);

  // Sidebar state management (sync with AppLayout)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      // If we're on a small viewport, default to collapsed so mobile starts collapsed
      try {
        const w = typeof window !== 'undefined' ? (window.innerWidth || document.documentElement.clientWidth || 0) : 0;
        if (w && w < 768) return true;
      } catch { }
      return JSON.parse(localStorage.getItem("hl_sidebarCollapsed") || "true");
    } catch {
      return true;
    }
  });

  // Listen for sidebar state changes in localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "hl_sidebarCollapsed" && e.newValue) {
        try {
          setSidebarCollapsed(JSON.parse(e.newValue));
        } catch { }
      }
    };

    // Also listen for manual localStorage changes in same tab
    const handleSidebarChange = () => {
      try {
        const newValue = JSON.parse(localStorage.getItem("hl_sidebarCollapsed") || "true");
        setSidebarCollapsed(newValue);
      } catch { }
    };

    window.addEventListener("storage", handleStorageChange);

    // Poll for changes since localStorage events don't fire in same tab
    const interval = setInterval(handleSidebarChange, 100);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const [characters, setCharacters] = useState<Character[]>([]);
  // Characters created by the logged-in user (used for "My AI" tab)
  const [userCharacters, setUserCharacters] = useState<Character[]>([]);
  const [userCharactersLoading, setUserCharactersLoading] = useState(false);
  const [userCharactersError, setUserCharactersError] = useState<string | null>(null);
  const [fetchedCharacter, setFetchedCharacter] = useState<Character | null>(null);
  // Use string keys because character IDs may be non-numeric (VARCHAR).
  const [lastMap, setLastMap] = useState<Record<string, { text: string; time: string }>>({});
  const [galleryRefreshKey, setGalleryRefreshKey] = useState(0);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [mediaViewer, setMediaViewer] = useState<{ url: string; isVideo?: boolean } | null>(null);
  const [downloadingMediaViewer, setDownloadingMediaViewer] = useState(false);
  const [chatsLoading, setChatsLoading] = useState(false);
  // Build a list of media items in the current conversation for navigation
  const mediaItems = useMemo(() => {
    try {
      return (messages || [])
        .filter((m) => m && m.type === 'image' && typeof m.imageUrl === 'string' && m.imageUrl)
        .map((m) => {
          const url = String(m.imageUrl || '');
          const isVideo = /\.(mp4|webm|ogg)$/i.test(url) || ((m as any).mime_type || '').toString().startsWith('video');
          return { url, isVideo } as { url: string; isVideo?: boolean };
        });
    } catch (e) {
      return [] as Array<{ url: string; isVideo?: boolean }>;
    }
  }, [messages]);

  // Listen for image/video open events from MessageBubble
  useEffect(() => {
    const onOpen = (ev: Event) => {
      try {
        const e = ev as CustomEvent<{ url: string; isVideo?: boolean }>;
        if (!e?.detail?.url) return;
        setMediaViewer({ url: e.detail.url, isVideo: e.detail.isVideo });
      } catch (e) { }
    };
    window.addEventListener('open:media', onOpen as EventListener);
    return () => window.removeEventListener('open:media', onOpen as EventListener);
  }, []);

  // Keyboard navigation for media viewer
  useEffect(() => {
    if (!mediaViewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMediaViewer(null); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrevMedia(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNextMedia(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mediaViewer, mediaItems]);

  const getCurrentMediaIndex = () => {
    try {
      if (!mediaViewer) return -1;
      const idx = mediaItems.findIndex((it) => it.url === mediaViewer.url);
      return idx;
    } catch (e) { return -1; }
  };
  const goPrevMedia = () => {
    const idx = getCurrentMediaIndex();
    if (idx > 0) setMediaViewer(mediaItems[idx - 1]);
  };
  const goNextMedia = () => {
    const idx = getCurrentMediaIndex();
    if (idx >= 0 && idx < mediaItems.length - 1) setMediaViewer(mediaItems[idx + 1]);
  };

  // ensure we only auto-select a default character once on initial load
  const initialSelectedSet = useRef(false);

  // Selected character details if navigated from homepage
  const navigatedCharacter = (location.state as any)?.character;

  // detect when navigated back from generate-image with a request to refresh the gallery
  useEffect(() => {
    try {
      const shouldRefresh = Boolean((location.state as any)?.refreshGallery);
      if (shouldRefresh) {
        setGalleryRefreshKey((k) => k + 1);
        // clear state to avoid repeated refreshes if component re-mounts
        try {
          // replace history state without refresh flag
          navigate(location.pathname, { replace: true, state: { ...(location.state as any), refreshGallery: undefined } });
        } catch (e) { }
      }
    } catch (e) { }
    // only run when location changes
  }, [location]);

  // derive current character profile + image from selected, navigatedCharacter or loaded characters
  const currentCharacterData = useMemo(() => {
    const fromChars = characters.find((c) => String(c.id) === String(selected?.id));
    // Also check fetchedCharacter if not found in characters array
    const fromFetched = fetchedCharacter && String(fetchedCharacter.id) === String(selected?.id) ? fetchedCharacter : null;
    const base: any = fromChars || fromFetched || navigatedCharacter || null;
    const selProfile = (selected && (selected.profile as Partial<CharacterProfile>)) || {};

    // Safety check: if no valid character data and selected is empty/default, return null to prevent crash
    if (!base && (!selected || !selected.id || selected.id === '' || selected.name === 'Select a character')) {
      return null;
    }

    const pickString = (...values: any[]): string => {
      for (const value of values) {
        if (value === undefined || value === null) continue;
        const str = typeof value === "string" ? value.trim() : String(value).trim();
        if (str) return str;
      }
      return "";
    };

    const pickNumber = (...values: any[]): number | undefined => {
      for (const value of values) {
        if (value === undefined || value === null) continue;
        const num = typeof value === "number" ? value : Number(value);
        if (!Number.isNaN(num)) return num;
      }
      return undefined;
    };

    const name = pickString(selProfile.name, base?.name, base?.username, DEFAULT_PROFILE.name);
    const age = pickNumber(selProfile.age, base?.age, base?.age_in_years, DEFAULT_PROFILE.age) ?? DEFAULT_PROFILE.age;
    const bio = pickString(selProfile.bio, base?.bio, DEFAULT_PROFILE.bio);
    const gallery = (selProfile.gallery as number[]) || (base && (base.gallery as number[])) || DEFAULT_PROFILE.gallery;

    const genderRaw = pickString((selProfile as any).gender, base?.gender, DEFAULT_PROFILE.gender);
    const normalizedGender = genderRaw.toLowerCase();
    const isMale = normalizedGender === "male" || normalizedGender === "man";
    const isTrans = normalizedGender === "trans" || normalizedGender === "transgender";

    const detailDefaults = new Map(DEFAULT_PROFILE.details.map((d) => [d.label, d.value]));

    const detailValue = (label: string, ...sources: any[]) => {
      const value = pickString(...sources);
      const fallback = detailDefaults.get(label) ?? "";
      return value || fallback || "";
    };

    const sanitizeValue = (input: string) => {
      const trimmed = (input || "").trim();
      if (!trimmed) return "—";
      const lower = trimmed.toLowerCase();
      if (["n/a", "na", "none", "null", "undefined"].includes(lower)) return "—";
      return trimmed;
    };

    const pushDetail = (arr: CharacterProfile["details"], label: string, ...sources: any[]) => {
      const rawValue = detailValue(label, ...sources);
      const safe = sanitizeValue(rawValue);
      arr.push({ label, value: safe, iconKey: label });
    };

    const details: CharacterProfile["details"] = [];
    pushDetail(details, "Body", base?.body_type, base?.bodyType, (selProfile as any).body_type, (selProfile as any).bodyType);
    pushDetail(details, "Eye", base?.eye_colour, base?.eyeColor, (selProfile as any).eye_colour, (selProfile as any).eyeColor);
    if (isMale || isTrans) {
      pushDetail(details, "Dick", base?.dick_size, base?.dickSize, (selProfile as any).dick_size, (selProfile as any).dickSize);
    }
    if (!isMale) {
      pushDetail(details, "Breast", base?.breast_size, base?.breastSize, (selProfile as any).breast_size, (selProfile as any).breastSize);
    }
    pushDetail(details, "Ethnicity", base?.ethnicity, (selProfile as any).ethnicity);

    const hairColour = pickString(base?.hair_colour, base?.hairColor, (selProfile as any).hair_colour, (selProfile as any).hairColor);
    const hairStyle = pickString(base?.hair_style, base?.hairStyle, (selProfile as any).hair_style, (selProfile as any).hairStyle);
    const hairCombined = [hairColour, hairStyle].filter(Boolean).join(", ");
    pushDetail(details, "Hair", hairCombined);

    if (!isMale) {
      pushDetail(details, "Butt", base?.butt_size, base?.buttSize, (selProfile as any).butt_size, (selProfile as any).buttSize);
    }

    const traitDefaults = new Map(DEFAULT_PROFILE.traits.map((t) => [t.label, t.value]));
    const pushTrait = (arr: CharacterProfile["traits"], label: string, iconKey: string, ...sources: any[]) => {
      const value = pickString(...sources, traitDefaults.get(label));
      arr.push({ label, value: sanitizeValue(value), iconKey: iconKey || label });
    };

    const traits: CharacterProfile["traits"] = [];
    pushTrait(traits, "Personality", "Personality", base?.personality, (selProfile as any).personality);
    pushTrait(traits, "Special Features", "Occupation", base?.special_features, (selProfile as any).special_features, base?.specialFeatures, (selProfile as any).specialFeatures);
    pushTrait(traits, "Relationship", "Relationship", base?.relationship_type, base?.relationship, (selProfile as any).relationship_type, (selProfile as any).relationship);
    // pushTrait(traits, "Hobbies", "Hobbies", (selProfile as any).hobbies, base?.hobbies, bio);

    const profile: CharacterProfile = {
      name,
      age,
      bio,
      gender: normalizedGender || DEFAULT_PROFILE.gender,
      gallery,
      details,
      traits,
    };

    const imageUrl = pickString(
      (selected && (selected.imageUrl as string)),
      base?.webp_image_url_s3, // prefer static webp when present
      base?.image_url_s3,
      base?.imageUrl,
      base?.profile_image_url,
      (selProfile as any).image_url_s3
    ) || null;

    // Animated asset: prefer GIF over animated WebP (user request: WebP quality bad)
    const animatedUrl = pickString(
      base?.gif_url_s3,
      base?.gifUrl,
      base?.animated_webp_url_s3,
      base?.animatedWebpUrl,
      null
    ) || null;

    // Static webp key (explicit) for cases where callers want the separate static webp URL
    const webpImageUrl = pickString(
      base?.webp_image_url_s3,
      (selProfile as any).webp_image_url_s3,
      null
    ) || null;

    const instagram = pickString(base?.instagram, base?.instagram_url, base?.instagramUrl, (selProfile as any).instagram);
    const tiktok = pickString(base?.tiktok, base?.tiktok_url, base?.tiktokUrl, (selProfile as any).tiktok);
    const onlyfans = pickString(base?.onlyfans, base?.onlyfans_url, base?.onlyfansUrl, (selProfile as any).onlyfans);
    const fanvue = pickString(base?.fanvue, base?.fanvue_url, base?.fanvueUrl, (selProfile as any).fanvue);

    return {
      profile,
      imageUrl,
      webpImageUrl,
      animatedUrl,
      social: {
        instagram: instagram || null,
        tiktok: tiktok || null,
        onlyfans: onlyfans || null,
        fanvue: fanvue || null,
      },
    };
  }, [selected, characters, fetchedCharacter, navigatedCharacter]);

  const socialItems = currentCharacterData ? SOCIAL_ICON_CONFIG.map((item) => ({
    ...item,
    url: currentCharacterData?.social?.[item.key] || null,
  })) : [];

  useEffect(() => {
    if (navigatedCharacter) {
      // set selected chat item using navigated character
      const ch: ChatItem = {
        id: String(navigatedCharacter.id || navigatedCharacter.username || "sel"),
        name: navigatedCharacter.name || navigatedCharacter.username || "Character",
        hue: 200,
        isOnline: true,
        last: "",
        time: "",
        ai: true,
        profile: {
          name: navigatedCharacter.name,
        },
      };
      // include username only if an explicit username field is present
      try {
        (ch as any).username = typeof navigatedCharacter.username === 'string' && navigatedCharacter.username.trim() !== '' ? navigatedCharacter.username.trim().replace(/^@+/, '') : undefined;
      } catch (e) { }
      setSelected(ch);
      // preload image for display using Image() to avoid Cache API fetch/CORS errors
      (() => {
        try {
          const url = navigatedCharacter.image_url_s3;
          if (url) {
            const img = new Image();
            img.src = url;
            img.onload = () => { };
            img.onerror = () => { };
          }
        } catch (e) {
          // ignore preload errors
        }
      })();
    }
    // When navigating to chat with a character preselected, jump straight to chat on mobile
    try { if (isMobile) setMobileView('chat'); } catch { }
  }, []);

  // Handle character slug from URL - fetch character if slug present
  useEffect(() => {
    let aborted = false;

    async function loadCharacterBySlug() {
      if (!characterSlug) {
        // Clear fetched character when no slug
        setFetchedCharacter(null);
        return;
      }

      try {
        console.log('[Chat] Loading character by slug:', characterSlug);
        const parsedSlugId = parseSlugId(characterSlug);
        // Fallback for legacy/non-UUID ids where slug tail can be shorter than 8 chars.
        const slugTail = characterSlug
          .split('-')
          .filter(Boolean)
          .pop();
        const shortId = parsedSlugId || slugTail || characterSlug;

        // First try to find in already-loaded characters
        const existingChar = characters.find(c => {
          const cid = String(c.id || '');
          return cid === shortId || matchesShortId(cid, shortId);
        });

        if (existingChar && !aborted) {
          console.log('[Chat] Found character in loaded list:', existingChar);
          setFetchedCharacter(existingChar);
          const ch: ChatItem = {
            id: String(existingChar.id),
            name: existingChar.name || 'Character',
            hue: 200,
            isOnline: true,
            last: '',
            time: '',
            ai: true,
            imageUrl: existingChar.image_url_s3 || undefined,
          };
          setSelected(ch);
          // restore cached messages for this character if available
          try {
            const cached = messagesCacheRef.current.get(String(ch.id));
            if (Array.isArray(cached) && cached.length > 0) setMessages(cached);
            else setMessages([]);
          } catch (e) { setMessages([]); }
          setHistoryRefreshKey((k) => k + 1);
          setAutoScroll(true);
          if (isMobile) setMobileView('chat');
          return;
        }

        // If not found in loaded list, fetch from backend
        const response = await apiClient.getCharacterBySlug(characterSlug);

        if (aborted) return;

        const charData = response.character;
        if (charData) {
          console.log('[Chat] Fetched character by slug:', charData);

          // Store the fetched character so currentCharacterData can use it immediately
          setFetchedCharacter(charData as Character);

          // Also add to characters array for the chat list
          setCharacters((prev) => {
            // Check if already exists to avoid duplicates
            const exists = prev.some(c => String(c.id) === String(charData.id));
            if (exists) return prev;
            return [...prev, charData as Character];
          });

          const ch: ChatItem = {
            id: String(charData.id),
            name: charData.name || charData.username || 'Character',
            hue: 200,
            isOnline: true,
            last: '',
            time: '',
            ai: true,
            imageUrl: charData.image_url_s3 || undefined,
          };
          setSelected(ch);
          try {
            const cached = messagesCacheRef.current.get(String(ch.id));
            if (Array.isArray(cached) && cached.length > 0) setMessages(cached);
            else setMessages([]);
          } catch (e) { setMessages([]); }
          setHistoryRefreshKey((k) => k + 1);
          setAutoScroll(true);
          if (isMobile) setMobileView('chat');
        }
      } catch (err) {
        // show user-friendly toast and redirect
        try { handleApiError(err, 'Failed to load character'); } catch (e) { }
        // On error, redirect to /chat (no character selected)
        if (!aborted) {
          navigate('/chat', { replace: true });
        }
      }
    }

    loadCharacterBySlug();
    return () => { aborted = true; };
  }, [characterSlug, characters, isMobile, navigate]);

  // Fetch likes/message counts for the currently selected character
  useEffect(() => {
    let aborted = false;
    async function fetchCounts() {
      try {
        const cid = Number(selected?.id);
        if (!cid || Number.isNaN(cid)) return;
        // Use centralized API client; apiClient includes Authorization header when set
        if (token) apiClient.setAccessToken(token);
        const data = await apiClient.getLikesMessageCount([cid]);
        console.debug('Chat: likes-message-count response', data);
        if (aborted) return;
        // Note: counts are now handled in UI components that need them
      } catch (err) {
        console.debug('Chat: failed to fetch counts', err);
      }
    }

    fetchCounts();
    return () => { aborted = true; };
  }, [selected?.id, token]);

  // Poll for GIF/animated WebP generation completion
  // When a character is loaded without animated media, check periodically if it's been generated
  useEffect(() => {
    let aborted = false;
    let pollInterval: number | null = null;
    let pollCount = 0;
    const MAX_POLLS = 12; // Poll for up to 2 minutes (12 * 10s)

    async function checkForAnimatedMedia() {
      if (aborted || !selected?.id || !characterSlug) return;

      // Check if we already have animated media
      const hasAnimatedMedia = currentCharacterData?.animatedUrl;
      if (hasAnimatedMedia) {
        console.log('[Chat] Animated media already available, stopping poll');
        if (pollInterval) clearInterval(pollInterval);
        return;
      }

      // Stop polling after max attempts
      if (pollCount >= MAX_POLLS) {
        console.log('[Chat] Max poll attempts reached, stopping GIF poll');
        if (pollInterval) clearInterval(pollInterval);
        return;
      }

      pollCount++;
      console.log(`[Chat] Polling for animated media (attempt ${pollCount}/${MAX_POLLS})`);

      try {
        // Refresh character data from backend
        const response = await apiClient.getCharacterBySlug(characterSlug);
        if (aborted) return;

        const charData = response.character;
        if (charData) {
          // Check if GIF or animated WebP is now available
          const hasGif = charData.gif_url_s3 || charData.animated_webp_url_s3;

          if (hasGif) {
            console.log('[Chat] Animated media now available!', {
              gif: charData.gif_url_s3,
              webp: charData.animated_webp_url_s3
            });

            // Update fetched character with new data
            setFetchedCharacter(charData as Character);

            // Also update in characters array if present
            setCharacters((prev) => {
              const idx = prev.findIndex(c => String(c.id) === String(charData.id));
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = charData as Character;
                return updated;
              }
              return prev;
            });

            // Stop polling once we have the animated media
            if (pollInterval) clearInterval(pollInterval);
          }
        }
      } catch (err) {
        console.debug('[Chat] Failed to poll for animated media:', err);
      }
    }

    // Only start polling if:
    // 1. We have a selected character
    // 2. We have a character slug (means we're viewing a specific character)
    // 3. We don't already have animated media
    if (selected?.id && characterSlug && !currentCharacterData?.animatedUrl) {
      console.log('[Chat] Starting poll for animated media generation');

      // Poll every 10 seconds
      pollInterval = setInterval(checkForAnimatedMedia, 10000);

      // Also check immediately
      checkForAnimatedMedia();
    }

    return () => {
      aborted = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [selected?.id, characterSlug, currentCharacterData?.animatedUrl]);

  // Load characters (and if available, compute last message/time per character)
  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();

    async function load() {
      // Allow loading default/public characters even when not authenticated so
      // anonymous users can see and select public characters. When `token` is
      // available we will use it later for fetching chats summary and private data.

      try {
        // Check cache first
        const cached = characterCacheRef.current.get('all_characters');
        const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;

        // Use cache if less than 60 seconds old
        if (cached && cacheAge < 60000) {
          if (!aborted) {
            setCharacters(cached.data);
          }
          // Still continue to fetch fresh data in background
        }

        // Use centralized API client to fetch default characters
        console.log('[Chat] Fetching default characters...');
        const data = await apiClient.getDefaultCharacters();
        console.log('[Chat] Received characters:', data);

        if (aborted) return;

        const arr = Array.isArray(data) ? normalizeCharacters(data) : [];
        console.log('[Chat] Normalized characters:', arr.length, arr);

        // Update cache
        characterCacheRef.current.set('all_characters', {
          data: arr,
          timestamp: Date.now(),
        });

        setCharacters(arr);

        // preload images
        for (const ch of arr) {
          try {
            if (ch?.image_url_s3) {
              const img = new Image();
              img.src = ch.image_url_s3;
            }
          } catch { }
        }

        // if token available, fetch a lightweight chats summary (cached) to compute last message/time per character
        if (token) {
          try {
            apiClient.setAccessToken(token);
            const CACHE_KEY = 'ct_chats_summary_v1';
            // Try to hydrate from localStorage cache for instant render
            try {
              const raw = localStorage.getItem(CACHE_KEY);
              if (raw) {
                const cached = JSON.parse(raw);
                if (Array.isArray(cached)) {
                  const map: Record<string, { text: string; time: string }> = {};
                  for (const it of cached) {
                    try {
                      const cid = it && it.character_id != null ? String(it.character_id) : '';
                      if (!cid) continue;
                      map[cid] = { text: String(it.last_message_preview || ''), time: String(it.last_activity || '') };
                    } catch (e) { }
                  }
                  setLastMap(map);
                }
              }
            } catch (e) {
              // ignore local cache errors
            }

            setChatsLoading(true);
            const summary = await apiClient.getChatsSummary(50);
            if (!aborted && Array.isArray(summary)) {
              const map: Record<string, { text: string; time: string }> = {};
              for (const it of summary) {
                try {
                  const cid = it && it.character_id != null ? String(it.character_id) : '';
                  if (!cid) continue;
                  map[cid] = { text: String(it.last_message_preview || ''), time: String(it.last_activity || '') };
                } catch (e) { /* ignore malformed rows */ }
              }
              setLastMap(map);
              try { localStorage.setItem(CACHE_KEY, JSON.stringify(summary)); } catch (e) { }
            }
          } catch (e: any) {
            if (e.name !== 'AbortError') {
              console.error('[Chat] Failed to fetch chats summary for lastMap', e);
            }
          }
          finally { if (!aborted) setChatsLoading(false); }
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          try { handleApiError(e, 'Failed to load characters'); } catch (ee) { }
        }
      }
    }

    load();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [token]);

  // SSE subscription to backend chat_updates channel to keep lastMap fresh in realtime
  // Enhanced with message-level streaming for instant updates
  useEffect(() => {
    if (!token) return;
    let es: EventSource | null = null;
    try {
      const characterIdParam = selected?.id ? `&character_id=${encodeURIComponent(String(selected.id))}` : '';
      const url = buildApiUrl(`/api/v1/chats/subscribe?token=${encodeURIComponent(token)}${characterIdParam}`);
      es = new EventSource(url);

      es.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data);
          const cid = d && d.character_id != null ? String(d.character_id) : '';
          if (!cid) return;

          // Update chat list preview
          setLastMap((prev) => ({
            ...(prev || {}),
            [cid]: {
              text: String(d.last_message_preview || ''),
              time: String(d.last_activity || new Date().toISOString())
            }
          }));

          // Handle message_update (background image generation result)
          if (d.type === 'message_update' && selected?.id && String(selected.id) === cid) {
            const imageJobId = d.image_job_id || null;
            const imageUrl = d.s3_url_media || d.image_url || null;
            const messageId = d.message_id;

            if (imageUrl) {
              let shouldAutoScroll = false;
              const normalizedIncoming = normalizeImageUrl(String(imageUrl || ''));
              setMessages((prev) => {
                // First, try to find and update an image-pending message with matching imageJobId
                if (imageJobId) {
                  const pendingIdx = prev.findIndex(m => m.imageJobId === imageJobId);
                  if (pendingIdx !== -1) {
                    const pending = prev[pendingIdx];
                    const currentUrl = normalizeImageUrl(pending.imageUrl);
                    const alreadyComplete = pending.type === 'image' && pending.imageJobStatus === 'completed' && !pending.imageJobId;
                    if (alreadyComplete && currentUrl && normalizedIncoming && currentUrl === normalizedIncoming) {
                      return prev;
                    }
                    // Update the pending message to a completed image
                    const updated = [...prev];
                    updated[pendingIdx] = {
                      ...pending,
                      type: 'image' as const,
                      imageUrl: imageUrl,
                      imageJobId: null,
                      imageJobStatus: 'completed' as const,
                    };
                    shouldAutoScroll = pendingIdx >= prev.length - 1;
                    return updated;
                  }
                }

                // Fallback: remove legacy pending placeholders and add new image
                /*
                 * Prevent duplicates: if the polling hook already updated the message 
                 * with this imageUrl, we should not add a second one here.
                 */
                if (normalizedIncoming && prev.some(m => normalizeImageUrl(m.imageUrl) === normalizedIncoming)) {
                  console.log('[SSE] Image update ignored - duplicate URL found:', normalizedIncoming);
                  return prev;
                }

                console.log('[SSE] Adding new image message from SSE:', messageId);
                const targetPendingId = `sys-img-pending-${messageId}`;

                // Also remove any generic "Taking a picture..." placeholders
                const filtered = prev.filter(m => {
                  const isSpecificPending = m.id === targetPendingId;
                  const isGenericPending = m.text === "Taking a picture..." || m.text === "Sending image...";
                  const isPollerPending = m.type === 'image-pending' && m.imageJobId === imageJobId;

                  // Clean up any temporary placeholder that matches this job
                  return !isSpecificPending && !isGenericPending && !isPollerPending;
                });

                const newMsg = {
                  // align ID with send() and chatMapping logic: append -m for media-only messages
                  id: String(messageId ? `${messageId}-m` : `sse-${Date.now()}`),
                  from: 'ai',
                  type: 'image',
                  text: '',
                  time: new Date().toISOString(),
                  imageUrl: imageUrl,
                } as Message;

                if (filtered.some(m => String(m.id) === String(newMsg.id))) return filtered;

                shouldAutoScroll = true;
                return [...filtered, newMsg];
              });
              setGalleryRefreshKey(k => k + 1);
              if (shouldAutoScroll) setAutoScroll(true);
            }
            return;
          }

          // If this update is for the currently selected character, append the message in real-time
          if (selected?.id && String(selected.id) === cid && d.message) {
            const newMsg = {
              id: d.message.id || `sse-${Date.now()}`,
              from: d.message.sender === 'user' ? 'me' : 'ai',
              type: d.message.type || 'text',
              text: d.message.content || '',
              time: d.message.created_at || new Date().toISOString(),
              audioUrl: d.message.audio_url,
              imageUrl: d.message.image_url,
              videoUrl: d.message.video_url,
            } as Message;

            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            // Auto-scroll to new message
            setAutoScroll(true);
            // If SSE message contains media, refresh gallery to pick it up
            try {
              if (d.message && (d.message.image_url || d.message.video_url)) {
                setGalleryRefreshKey((k) => k + 1);
              }
            } catch (e) { }
          }
        } catch (e) {
          // ignore malformed messages
        }
      };

      es.onerror = () => {
        // keep alive errors quiet; EventSource will reconnect automatically in most browsers
      };
    } catch (e) {
      // ignore
    }
    return () => { try { if (es) es.close(); } catch (e) { } };
  }, [token, selected?.id]);

  // When characters and lastMap become available, pick a sensible default selection
  useEffect(() => {
    try {
      // don't override an explicit navigated character
      if (navigatedCharacter) return;
      // don't auto-select if there's a characterSlug (it will be handled by the slug loader)
      if (characterSlug) return;
      if (initialSelectedSet.current) return;
      // If we have a last opened chat remembered from localStorage, try to select it first
      try {
        // Only auto-select the last opened chat if the user is authenticated.
        // This prevents guests from automatically loading a previously-opened
        // character (e.g. 'latina') when visiting the chat page.
        if (lastSelectedIdRef.current && token) {
          const found = characters.find((c) => String(c.id) === String(lastSelectedIdRef.current));
          if (found) {
            const ch: ChatItem = {
              id: String(found.id),
              name: found.name || found.username || 'Character',
              hue: 200,
              isOnline: true,
              last: '',
              time: '',
              ai: true,
              imageUrl: (found as any).image_url_s3,
            };
            setSelected(ch);
            // restore cached messages if present, otherwise clear and trigger load
            try {
              const cached = messagesCacheRef.current.get(String(ch.id));
              if (Array.isArray(cached) && cached.length > 0) setMessages(cached);
              else setMessages([]);
            } catch (e) { setMessages([]); }
            setHistoryRefreshKey((k) => k + 1);
            setAutoScroll(true);
            initialSelectedSet.current = true;
            return;
          }
        }
      } catch (e) { }
      const hasChars = Array.isArray(characters) && characters.length > 0;
      if (!hasChars) return;

      // If we're on /chat (no slug), don't auto-select - show empty state
      if (!characterSlug && location.pathname === '/chat') {
        // Don't set a default character, let user select one
        initialSelectedSet.current = true;
        return;
      }

      // Build a normalized list similar to `filtered` and pick the top (most recent activity)
      const normalized = characters
        .map((c) => {
          const idKey = String(c.id ?? '');
          const timeRaw = lastMap[idKey]?.time || (c as any)?.updated_at || (c as any)?.created_at || null;
          const sortTime = timeRaw ? new Date(timeRaw).getTime() : 0;
          return { char: c, _sortTime: sortTime };
        })
        .sort((a, b) => (b._sortTime || 0) - (a._sortTime || 0));

      let pick: any = null;
      if (normalized.length > 0 && normalized[0]._sortTime > 0) {
        pick = normalized[0].char;
      }

      // fallback to first character if no activity timestamps available
      if (!pick) pick = characters[0];
      if (pick) {
        const ch: ChatItem = {
          id: String(pick.id),
          name: pick.name || pick.username || 'Character',
          hue: 200,
          isOnline: true,
          last: '',
          time: '',
          ai: true,
          imageUrl: (pick as any).image_url_s3,
        };
        setSelected(ch);
        // restore cached messages if present, otherwise clear and trigger load
        try {
          const cached = messagesCacheRef.current.get(String(ch.id));
          if (Array.isArray(cached) && cached.length > 0) setMessages(cached);
          else setMessages([]);
        } catch (e) { setMessages([]); }
        setHistoryRefreshKey((k) => k + 1);
        setAutoScroll(true);
      }
      initialSelectedSet.current = true;
    } catch (e) { }
  }, [characters, lastMap, navigatedCharacter]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  // ref + state to measure the mobile input bar so we can pad the chat
  // container and avoid the last message being hidden behind the fixed input
  const inputBarRef = useRef<HTMLDivElement | null>(null);
  const [inputBarHeight, setInputBarHeight] = useState<number>(0);
  // Pending cached messages staged while ChatHistory mounts to avoid
  // racing cached content into the virtualized list (which can reuse
  // index-based measurements and cause overlap). We store cached messages
  // here and only insert them after ChatHistory reports `onLoaded`.
  const pendingCachedMessagesRef = useRef<Message[] | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(false);

  // Hooks: keyboard offset (visualViewport) and auto-scroll behaviors
  const kbOffset = useKeyboardOffset(isMobile);
  const { autoScroll, setAutoScroll, jumpToLatest } = useAutoScroll(scrollRef, endRef);

  // Hook for non-blocking async image generation polling
  // This polls image job status in the background and updates messages when images are ready
  useImageJobPoller(messages, setMessages, {
    pollInterval: 2000,
    onJobComplete: (job) => {
      // Refresh gallery when an image completes
      setGalleryRefreshKey((k) => k + 1);
      if (job?.messageId && String(job.messageId) === String(lastMessageIdRef.current || '')) {
        setAutoScroll(true);
      }
    },
    onJobFailed: (job) => {
      console.warn('[Chat] Image generation failed:', job.jobId, job.error);
    },
  });

  useEffect(() => {
    try {
      lastMessageIdRef.current = messages[messages.length - 1]?.id ?? null;
    } catch (e) { }
  }, [messages]);

  // Keep a cache of messages per-character in the parent so switching back
  // restores instantly; update cache whenever messages change for the
  // currently selected character.
  useEffect(() => {
    try {
      const cid = String(selected?.id ?? '');
      if (!cid) return;
      messagesCacheRef.current.set(cid, messages);
    } catch (e) { }
  }, [messages, selected?.id]);

  // When selected chat changes, hydrate messages from offline cache (then from memory)
  useEffect(() => {
    if (!selected) return;

    const characterId = String(selected.id);

    // Remember last opened chat
    try { saveLastOpenedChatId(characterId); } catch (e) { }

    let cancelled = false;

    (async () => {
      try {
        // Show skeleton while ChatHistory mounts and fetches
        setShowSkeleton(true);

        // Cancel any previously staged cached messages
        pendingCachedMessagesRef.current = null;

        // 1) Try in-memory cache first (fast)
        const fromMem = messagesCacheRef.current.get(characterId);
        if (fromMem && fromMem.length > 0) {
          // Stage cached messages but do NOT apply them immediately —
          // wait for ChatHistory to mount and call `onLoaded` to avoid
          // racing cached DOM into the virtual list which may reuse stale
          // measurement indices.
          pendingCachedMessagesRef.current = fromMem;
          // clear visible messages to allow ChatHistory to initialize cleanly
          setMessages([]);
          return;
        }

        // 2) Fallback to IndexedDB snapshot
        const fromIdb = await loadMessagesSnapshot(characterId);
        if (!cancelled && fromIdb && fromIdb.length > 0) {
          pendingCachedMessagesRef.current = fromIdb as any;
          setMessages([]);
        } else if (!cancelled) {
          setMessages([]);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[Chat] failed to hydrate messages from cache', e);
        setMessages([]);
      }
    })();

    return () => { cancelled = true; };
  }, [selected]);

  // Memoize normalized character list to reduce re-computation
  // Persist the latest messages for the selected chat into IndexedDB (debounced)
  useEffect(() => {
    if (!selected) return;
    if (!messages || messages.length === 0) return;

    const characterId = String(selected.id);

    // Debounce writes so we’re not hammering IndexedDB for every single token
    const handle = window.setTimeout(() => {
      try {
        // Save last ~200 messages
        saveMessagesSnapshot(characterId, messages as any, 200);
        // Also keep the in-memory cache in sync
        try { messagesCacheRef.current.set(characterId, [...messages]); } catch (e) { }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[Chat] failed to save messages snapshot', e);
      }
    }, 500);

    return () => clearTimeout(handle);
  }, [selected, messages]);

  // Persist lastMap to localStorage whenever it changes
  useEffect(() => {
    if (!lastMap) return;
    try {
      saveLastMapToLocalStorage(lastMap);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[Chat] failed to persist lastMap', e);
    }
  }, [lastMap]);

  const lastMessage = messages[messages.length - 1];
  const lastMessageKey = `${lastMessage?.id ?? ''}|${lastMessage?.type ?? ''}|${lastMessage?.imageUrl ?? ''}|${lastMessage?.audioUrl ?? ''}|${lastMessage?.imageJobId ?? ''}|${lastMessage?.imageJobStatus ?? ''}`;

  // Whenever new messages arrive or the last message upgrades (ex: image loads),
  // keep the view pinned to the bottom if auto-scroll is enabled.
  useEffect(() => {
    try {
      if (!autoScroll) return;
      jumpToLatest('auto');
    } catch (e) { }
  }, [lastMessageKey, autoScroll, jumpToLatest]);

  const normalizedCharacters = useMemo(() => {
    return (characters || []).map((c: any) => ({
      id: String(c.id ?? c.username ?? ""),
      name: c.name || c.username || "Character",
      bio: c.bio,
      imageUrl: c.image_url_s3,
      ai: c.ai ?? true,
      updated_at: (c as any)?.updated_at,
      created_at: (c as any)?.created_at,
    }));
  }, [characters]);

  const normalizedUserCharacters = useMemo(() => {
    return (userCharacters || []).map((c: any) => ({
      id: String(c.id ?? c.username ?? ""),
      name: c.name || c.username || "Character",
      bio: c.bio,
      imageUrl: c.image_url_s3,
      ai: true,
      updated_at: (c as any)?.updated_at,
      created_at: (c as any)?.created_at,
    }));
  }, [userCharacters]);

  const filtered = useMemo(() => {
    // When in "My AI" tab, prefer the logged-in user's characters fetched from backend.
    const source = tab === 'ai'
      ? (normalizedUserCharacters.length > 0 ? normalizedUserCharacters : [])
      : (normalizedCharacters.length > 0 ? normalizedCharacters : CONTACTS);
    // Helper: format a message timestamp similar to WhatsApp-style list view
    // - Same day: show local time (e.g. 12:52 AM)
    // - Yesterday: "Yesterday"
    // - Within last week: weekday (e.g. Tue) 
    // - Older than a week but within a month: "Last week"
    // - Older than a month but within a year: "Last month"
    // - Older than a year but within two years: "Last year"
    // - Older: show year (e.g. 2021)
    const formatMessageTime = (d: Date) => {
      const now = new Date();
      const msDiff = now.getTime() - d.getTime();
      const daysDiff = Math.floor(msDiff / (1000 * 60 * 60 * 24));

      // same calendar day -> show time only
      if (now.toDateString() === d.toDateString()) {
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }

      if (daysDiff === 1) return 'Yesterday';

      if (daysDiff < 7) {
        // show weekday short like "Tue"
        return d.toLocaleDateString([], { weekday: 'short' });
      }

      if (daysDiff < 30) return 'Last week';

      if (daysDiff < 365) return 'Last month';

      if (daysDiff < 365 * 2) return 'Last year';

      return String(d.getFullYear());
    };
    // Normalize entries and capture a sortable timestamp (last activity)
    const normalized = (source as any[])
      // If we're on the My AI tab, we already limited source to userCharacters, so don't re-filter by c.ai.
      .filter((c) => ((tab === 'ai') ? true : (c.ai ?? true)) && (String((c.name || c.username || "") as string).toLowerCase().includes(q.toLowerCase())))
      .map((c) => {
        const idKey = String(c.id ?? c.username ?? "");
        const id = idKey;
        const last = lastMap[idKey]?.text || (c.bio ? String(c.bio).slice(0, 40) : "");
        const timeRaw = lastMap[idKey]?.time || (c as any)?.updated_at || (c as any)?.created_at || null;
        const sortTime = timeRaw ? new Date(timeRaw).getTime() : 0;
        const time = timeRaw ? formatMessageTime(new Date(timeRaw)) : "";
        return {
          id,
          name: c.name || c.username || "Character",
          hue: 200,
          isOnline: true,
          last,
          time,
          ai: true,
          // support both normalized entries (imageUrl) and raw backend keys (image_url_s3, image_url)
          imageUrl: (c as any).imageUrl || (c as any).image_url_s3 || (c as any).image_url || null,
          _sortTime: sortTime,
        } as any;
      });

    // Sort by most recent activity first (descending)
    normalized.sort((a: any, b: any) => (b._sortTime || 0) - (a._sortTime || 0));

    return normalized.map((n: any) => {
      const { _sortTime, ...rest } = n;
      return rest as ChatItem;
    });
  }, [q, tab, normalizedCharacters, normalizedUserCharacters, lastMap]);

  // Fetch characters created by the logged-in user when the "My AI" tab is active.
  useEffect(() => {
    let aborted = false;

    async function load() {
      if (tab !== 'ai') return;
      if (!token) {
        setUserCharacters([]);
        setUserCharactersError('Please sign in to view your characters.');
        return;
      }

      setUserCharactersLoading(true);
      setUserCharactersError(null);

      try {
        // Check cache first
        const cached = characterCacheRef.current.get('user_characters');
        const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;

        if (cached && cacheAge < 30000) {
          if (!aborted) {
            setUserCharacters(cached.data);
            setUserCharactersLoading(false);
          }
          return;
        }

        if (token) apiClient.setAccessToken(token);
        const res = await apiClient.getUserCharacters();
        if (aborted) return;
        const arr = Array.isArray(res) ? res : [];

        // Update cache
        characterCacheRef.current.set('user_characters', {
          data: arr,
          timestamp: Date.now(),
        });

        setUserCharacters(arr);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        if (!aborted) {
          try { handleApiError(e, 'Failed to load your characters'); } catch (ee) { }
          setUserCharactersError('Failed to load your characters.');
          setUserCharacters([]);
        }
      } finally {
        if (!aborted) setUserCharactersLoading(false);
      }
    }

    load();
    return () => {
      aborted = true;
    };
  }, [tab, historyRefreshKey, token]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    const characterId = (selected && selected.id !== undefined && selected.id !== null) ? String((selected as any).id) : null;
    const nowIso = new Date().toISOString();
    // If user is not authenticated, persist pending message and redirect to login
    if (!token) {
      try {
        sessionStorage.setItem(
          'hl_pending_chat_message',
          JSON.stringify({ text, characterId: selected?.id || null })
        );
      } catch (e) {
        // ignore storage failures
      }
      // preserve full location so Login can navigate back
      navigate('/login', { state: { from: location } });
      return;
    }

    // ensure we auto-scroll when sending
    setAutoScroll(true);
    // Optimistically refresh chat preview + timestamp so the thread jumps to the top
    if (characterId) {
      setLastMap((prev) => ({
        ...(prev || {}),
        [characterId]: {
          text,
          time: nowIso,
        },
      }));
    }
    // heuristic to detect image request REMOVED
    // const isImageRequest = /\b(picture|photo|image|selfie|send me a pic|nudes|pic)\b/i.test(text);
    const typingText = "Typing…";

    // optimistic local append (user) - use stable counter-based ID
    const userMsgId = `user-${getNextMessageId()}`;
    setMessages((m) => [...m, { id: userMsgId, from: "me", type: "text", text, time: nowIso }]);
    setInput("");

    // add a loading AI message which we'll replace when backend responds
    const aiLoadingId = `ai-loading-${getNextMessageId()}`;
    setMessages((m) => [...m, { id: aiLoadingId, from: "ai", type: "text", text: typingText, time: new Date().toISOString() }]);

    // attempt to persist message to backend and replace loading message with response
    (async () => {
      try {
        const url = buildApiUrl('/chats/');
        const payload: Record<string, any> = {
          session_id: sessionRef.current || `session-${Date.now()}`,
          user_query: text,
          client_timestamp: nowIso,
        };
        // character ids were migrated to string; only include when available as string
        if (characterId) payload.character_id = characterId;
        // include model hint if configured
        const model = (import.meta.env.VITE_DEFAULT_MODEL as string) || undefined;
        if (model) payload.model = model;

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetchWithAuth(url, { method: 'POST', headers, body: JSON.stringify(payload) });
        if (res.ok) {
          const body = await res.json();
          const aiText = body?.chat_response ?? body?.ai_response ?? "";
          const serverMessageId = body?.message_id;
          const isImageRequest = body?.is_image_request === true;
          const imageJobId = body?.image_job_id || null;
          const isMedia = Boolean(body?.is_media_available || body?.is_image_created); // support legacy flag
          const mediaUrl = body?.s3_url_media || null;

          // Build replacement messages
          const baseId = serverMessageId ? String(serverMessageId) : `ai-${getNextMessageId()}`;
          const newMessages: Message[] = [];

          // Add text response messages
          if (aiText) {
            const parts = splitIntoSentences(aiText);
            if (parts.length > 0) {
              parts.forEach((s, i) => {
                newMessages.push({
                  id: `${baseId}-a-${i}`,
                  from: 'ai',
                  type: 'text',
                  text: s,
                  time: new Date().toISOString()
                });
              });
            } else {
              newMessages.push({
                id: `${baseId}-a`,
                from: 'ai',
                type: 'text',
                text: aiText,
                time: new Date().toISOString()
              });
            }
          }

          // Handle async image generation - show simple text while waiting
          // Using regular text message to feel natural (like character is sending a photo)
          if (imageJobId && !isMedia) {
            newMessages.push({
              id: `${baseId}-img-pending`,
              from: 'ai',
              type: 'text',
              text: 'Sending image...',
              imageJobId: imageJobId,
              imageJobStatus: 'queued',
              time: new Date().toISOString()
            });
          } else if (isImageRequest && !isMedia && !imageJobId) {
            // Legacy fallback: show text placeholder for older API responses
            newMessages.push({
              id: `sys-img-pending-${serverMessageId || Date.now()}`,
              from: 'ai',
              type: 'text',
              text: "Sending image...",
              time: new Date().toISOString()
            });
          }

          // Handle immediate media (already generated)
          if (isMedia && mediaUrl) {
            newMessages.push({
              id: `${baseId}-m`,
              from: 'ai',
              type: 'image',
              imageUrl: mediaUrl,
              time: new Date().toISOString()
            });
          }

          if (newMessages.length === 0) {
            newMessages.push({
              id: baseId,
              from: 'ai',
              type: 'text',
              text: 'No response',
              time: new Date().toISOString()
            });
          }

          // OPTIMIZED: Update messages by replacing loading message efficiently
          // Use server-provided message ID if available for better sync with SSE
          setMessages((prev) => {
            const loadingIndex = prev.findIndex(msg => msg.id === aiLoadingId);
            if (loadingIndex === -1) return prev;

            // Replace loading message with actual response(s)
            return [
              ...prev.slice(0, loadingIndex),
              ...newMessages,
              ...prev.slice(loadingIndex + 1)
            ];
          });

          // Force save to cache immediately in case the user navigates away before the debounce fires
          // or if the component is already unmounted (which drops the state update).
          if (characterId) {
            try {
              const memCache = messagesCacheRef.current.get(String(characterId)) || [];
              const lIndex = memCache.findIndex(m => m.id === aiLoadingId);
              if (lIndex !== -1) {
                const updatedMem = [...memCache.slice(0, lIndex), ...newMessages, ...memCache.slice(lIndex + 1)];
                messagesCacheRef.current.set(String(characterId), updatedMem);
                saveMessagesSnapshot(String(characterId), updatedMem as any, 200);
              }
            } catch (e) { }
          }
          if (characterId) {
            const lastPreview = aiText || text;
            const previewTime = new Date().toISOString();
            setLastMap((prev) => ({
              ...(prev || {}),
              [characterId]: {
                text: lastPreview,
                time: previewTime,
              },
            }));
          }
          // If server returned media, refresh gallery section so new image appears
          try { if (isMedia && mediaUrl) setGalleryRefreshKey((k) => k + 1); } catch (e) { }
        } else {
          // try to parse backend body to surface details in a toast
          let errBody: any = null;
          try { errBody = await res.json(); } catch (e) { errBody = null; }
          const errObj = { status: res.status, body: errBody, message: errBody?.detail || errBody?.message || `Failed to send (${res.status})` };
          try { handleApiError(errObj, 'Failed to send'); } catch (e) { }
          // remove the loading message; error shown via toast only
          setMessages((m) => m.filter(msg => msg.id !== aiLoadingId));
        }
      } catch (e) {
        try { handleApiError(e, 'Failed to send'); } catch (ee) { }
        // remove the loading message on network error
        setMessages((m) => m.filter(msg => msg.id !== aiLoadingId));
      }
    })();
  }, [input, selected, token, navigate, location, setAutoScroll]);

  // If returning from login and a pending message exists, auto-send it when token becomes available
  useEffect(() => {
    if (!token) return;
    try {
      const raw = sessionStorage.getItem('hl_pending_chat_message');
      if (!raw) return;
      const pending = JSON.parse(raw || '{}');
      const pendingText = pending?.text;
      const pendingCharacterId = pending?.characterId;
      if (!pendingText) {
        sessionStorage.removeItem('hl_pending_chat_message');
        return;
      }

      // If pending message targets a different character, try to select it
      if (pendingCharacterId && String(pendingCharacterId) !== String(selected?.id)) {
        // create a minimal ChatItem and select it so message sends to intended character
        try {
          const ch: ChatItem = {
            id: String(pendingCharacterId),
            name: selected?.name || 'Character',
            hue: 200,
            isOnline: true,
            last: '',
            time: '',
            ai: true,
          };
          setSelected(ch);
        } catch { }
      }

      const targetCharacterId = (pendingCharacterId ?? selected?.id) !== undefined && (pendingCharacterId ?? selected?.id) !== null
        ? String(pendingCharacterId ?? selected?.id)
        : null;
      const pendingNowIso = new Date().toISOString();
      if (targetCharacterId) {
        setLastMap((prev) => ({
          ...(prev || {}),
          [targetCharacterId]: {
            text: pendingText,
            time: pendingNowIso,
          },
        }));
      }

      // send the pending message via the same flow (optimistic + backend)
      const pendingUserId = `u-p-${Date.now()}`;
      setMessages((m) => [...m, { id: pendingUserId, from: 'me', type: 'text', text: pendingText, time: pendingNowIso }]);

      const isPendingImageRequest = /\b(picture|photo|image|selfie|send me a pic|nudes|pic)\b/i.test(pendingText);
      const pendingTypingText = isPendingImageRequest ? "Taking a picture..." : "Typing…";

      const pendingAiLoadingId = `ai-p-loading-${Date.now()}`;
      setMessages((m) => [...m, { id: pendingAiLoadingId, from: 'ai', type: 'text', text: pendingTypingText, time: new Date().toISOString() }]);

      (async () => {
        try {
          const url = buildApiUrl('/chats/');
          const payload: Record<string, any> = {
            session_id: sessionRef.current || `session-${Date.now()}`,
            user_query: pendingText,
            client_timestamp: pendingNowIso,
          };
          if (targetCharacterId) payload.character_id = targetCharacterId;
          const model = (import.meta.env.VITE_DEFAULT_MODEL as string) || undefined;
          if (model) payload.model = model;
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          const res = await fetchWithAuth(url, { method: 'POST', headers, body: JSON.stringify(payload) });
          if (res.ok) {
            const body = await res.json();
            const aiText = body?.chat_response ?? body?.ai_response ?? '';
            const isMedia = Boolean(body?.is_media_available || body?.is_image_created);
            const mediaUrl = body?.s3_url_media || null;
            const isImageRequest = body?.is_image_request === true;
            const imageJobId = body?.image_job_id || null;
            const serverMessageId = body?.message_id;

            const baseId = serverMessageId ? String(serverMessageId) : `ai-${Date.now()}`;
            const newMessages: Message[] = [];

            if (aiText) {
              const parts = splitIntoSentences(aiText);
              if (parts.length > 0) {
                for (const [i, s] of parts.entries()) {
                  newMessages.push({ id: `${baseId}-t${i}`, from: 'ai', type: 'text', text: s, time: new Date().toISOString() });
                }
              } else {
                newMessages.push({ id: `${baseId}-t`, from: 'ai', type: 'text', text: aiText, time: new Date().toISOString() });
              }
            }

            if (imageJobId && !isMedia) {
              newMessages.push({
                id: `${baseId}-img-pending`,
                from: 'ai',
                type: 'text',
                text: 'Sending image...',
                imageJobId: imageJobId,
                imageJobStatus: 'queued',
                time: new Date().toISOString()
              });
            } else if (isImageRequest && !isMedia && !imageJobId) {
              newMessages.push({
                id: `sys-img-pending-${serverMessageId || Date.now()}`,
                from: 'ai',
                type: 'text',
                text: "Sending image...",
                time: new Date().toISOString()
              });
            }

            if (isMedia && mediaUrl) {
              newMessages.push({ id: `${baseId}-i`, from: 'ai', type: 'image', imageUrl: mediaUrl, time: new Date().toISOString() });
            }

            if (newMessages.length === 0) {
              newMessages.push({ id: baseId, from: 'ai', type: 'text', text: 'No response', time: new Date().toISOString() });
            }

            setMessages((prev) => prev.flatMap(msg => {
              if (msg.id !== pendingAiLoadingId) return [msg];
              return newMessages;
            }));

            // Force save to cache immediately
            if (targetCharacterId) {
              try {
                const memCache = messagesCacheRef.current.get(String(targetCharacterId)) || [];
                const pIndex = memCache.findIndex(m => m.id === pendingAiLoadingId);
                if (pIndex !== -1) {
                  const updatedMem = [...memCache.slice(0, pIndex), ...newMessages, ...memCache.slice(pIndex + 1)];
                  messagesCacheRef.current.set(String(targetCharacterId), updatedMem);
                  saveMessagesSnapshot(String(targetCharacterId), updatedMem as any, 200);
                }
              } catch (e) { }
            }
            if (targetCharacterId) {
              const previewTime = new Date().toISOString();
              const lastPreview = aiText || pendingText;
              setLastMap((prev) => ({
                ...(prev || {}),
                [targetCharacterId]: {
                  text: lastPreview,
                  time: previewTime,
                },
              }));
            }
            // If server returned media, refresh gallery section so new image appears
            try { if (isMedia && mediaUrl) setGalleryRefreshKey((k) => k + 1); } catch (e) { }
          } else {
            // parse backend body and show toast
            let errBody: any = null;
            try { errBody = await res.json(); } catch (e) { errBody = null; }
            const errObj = { status: res.status, body: errBody, message: errBody?.detail || errBody?.message || `Failed to send (${res.status})` };
            try { handleApiError(errObj, 'Failed to send'); } catch (e) { }
            // remove the pending loading message; error shown via toast only
            setMessages((m) => m.filter(msg => msg.id !== pendingAiLoadingId));
          }
        } catch (e) {
          try { handleApiError(e, 'Failed to send'); } catch (ee) { }
          // remove the pending loading message on network error
          setMessages((m) => m.filter(msg => msg.id !== pendingAiLoadingId));
        }
      })();

      // clear pending
      sessionStorage.removeItem('hl_pending_chat_message');
    } catch (e) { }
    // intentionally only run when token changes (i.e. after login)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard overlap handled by `useKeyboardOffset` hook

  // Measure input bar (mobile fixed input) height so we can pad chat container
  // and avoid the last message being covered by the pinned input. Includes
  // keyboard offset in the final padding calculation via `kbOffset` above.
  useEffect(() => {
    if (!isMobile) {
      setInputBarHeight(0);
      return;
    }
    const el = inputBarRef.current;
    if (!el) return;
    const update = () => {
      try {
        const h = Math.ceil((el as HTMLElement).getBoundingClientRect().height || 0);
        setInputBarHeight(h);
      } catch (e) { }
    };
    update();
    const ro = new ResizeObserver(update);
    try { ro.observe(el); } catch (e) { }
    window.addEventListener('resize', update);
    const vv: any = (window as any).visualViewport;
    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    }
    return () => {
      try { ro.disconnect(); } catch (e) { }
      window.removeEventListener('resize', update);
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
    };
  }, [isMobile, kbOffset]);

  // Create one session id per (user, character) and persist it so text & voice share history across reloads
  const sessionKey = useMemo(() => {
    try {
      const uid = (user && (user as any).id) ? String((user as any).id) : 'anon';
      const cid = selected?.id ?? 'none';
      return `hl_session_${uid}_${cid}`;
    } catch (e) {
      return `hl_session_anon_none`;
    }
  }, [user?.id, selected?.id]);

  const sessionRef = useRef<string>((() => {
    try {
      const existing = localStorage.getItem(sessionKey);
      if (existing) return existing;
      const fresh = `session-${Date.now()}`;
      try { localStorage.setItem(sessionKey, fresh); } catch (e) { }
      return fresh;
    } catch (e) {
      return `session-${Date.now()}`;
    }
  })());

  // set session id once on mount (expose to global for VoiceRecorder)
  useEffect(() => {
    try {
      (window as any).__hl_session_id = sessionRef.current;
    } catch { }
    return () => { try { (window as any).__hl_session_id = undefined; } catch { } };
  }, [sessionRef.current]);

  // keep selected character id in a global so VoiceRecorder upload includes it
  useEffect(() => {
    try { (window as any).__hl_selected_character_id = selected?.id; } catch { }
    return () => { try { (window as any).__hl_selected_character_id = undefined; } catch { } };
  }, [selected?.id]);

  // Handle result from voice endpoint: voice-to-voice communication
  const handleVoiceResult = useCallback((inputUrl: string | null, outputUrl: string | null, _transcript?: string, imageUrl?: string | null, imageJobId?: string | null) => {
    console.group('handleVoiceResult');
    try {
      console.log('rendering voice turn:', { inputUrl, outputUrl, transcriptLen: (_transcript || '').length, imageJobId });
      // For voice-to-voice: don't show text, only add voice messages

      // Set auto-scroll BEFORE adding messages to ensure chat stays at bottom
      setAutoScroll(true);

      // Add user's voice message (input)
      if (inputUrl) {
        console.log('rendering input voice bubble', inputUrl);
        const userMsgId = `user-voice-${Date.now()}`;
        setMessages((m) => [...m, {
          id: userMsgId,
          from: 'me',
          type: 'voice',
          audioUrl: inputUrl,
          inputAudioUrl: inputUrl,
          time: new Date().toISOString()
        }]);
      }

      let appendedImage = false;
      if (outputUrl) {
        console.log('rendering AI voice bubble', outputUrl);
        // Use 'temp' prefix so ChatHistory doesn't see it as a 'loading' optimistic message to preserve
        const aiMsgId = `ai-temp-${Date.now()}`;
        setMessages((m) => [...m, {
          id: aiMsgId,
          from: 'ai',
          type: 'voice',
          audioUrl: outputUrl,
          time: new Date().toISOString()
        }]);


        // Auto-play the AI's voice response
        try {
          console.log('autoplay: starting');
          const audio = new Audio(outputUrl);
          // set playsinline attribute in a type-safe way for browsers / iOS inline playback
          try { audio.setAttribute && audio.setAttribute('playsinline', ''); } catch { }
          audio.play().then(() => console.log('autoplay: success')).catch((err) => console.warn('autoplay: failed', err));
        } catch (err) {
          console.warn('autoplay error', err);
        }

        // If the server returned an image URL for this voice turn, add it as an image message
        if (imageUrl) {
          try {
            // Use 'temp' prefix to prevent duplication when backend history loads
            const imgMsgId = `ai-temp-img-${Date.now()}`;
            setMessages((m) => [...m, {
              id: imgMsgId,
              from: 'ai',
              type: 'image',
              imageUrl: imageUrl,
              time: new Date().toISOString()
            }]);
            appendedImage = true;
            // Refresh gallery so newly-generated voice image appears in profile gallery
            try { setGalleryRefreshKey((k) => k + 1); } catch (e) { }
          } catch (e) {
            console.warn('failed to append image message', e);
          }
        }
      }

      // If backend provided an image but no outputUrl (or image wasn't appended above), append image separately
      if (imageUrl && !appendedImage) {
        try {
          // Use 'temp' prefix to prevent duplication when backend history loads
          const imgMsgId = `ai-temp-img-${Date.now()}`;
          setMessages((m) => [...m, {
            id: imgMsgId,
            from: 'ai',
            type: 'image',
            imageUrl: imageUrl,
            time: new Date().toISOString()
          }]);
          try { setGalleryRefreshKey((k) => k + 1); } catch (e) { }
          appendedImage = true;
        } catch (e) {
          console.warn('failed to append image message (fallback)', e);
        }
      }

      // Handle async image generation via imageJobId (non-blocking)
      // The useImageJobPoller hook will poll for status and update when ready
      if (imageJobId && !imageUrl && !appendedImage) {
        try {
          const pendingMsgId = `ai-voice-img-pending-${Date.now()}`;
          setMessages((m) => [...m, {
            id: pendingMsgId,
            from: 'ai',
            type: 'text',
            text: 'Sending image...',
            imageJobId: imageJobId,
            imageJobStatus: 'queued',
            time: new Date().toISOString()
          }]);
          console.log('added pending message for voice imageJobId:', imageJobId);
        } catch (e) {
          console.warn('failed to append pending message', e);
        }
      }

      // Note: History will be refreshed naturally when user navigates or reloads.
      // Immediate refresh is removed to prevent messages from disappearing
      // and to maintain stable scroll behavior.
    } catch (e) {
      console.error('handleVoiceResult error:', e);
    } finally {
      console.groupEnd();
    }
  }, [setMessages, setAutoScroll]);

  const onHistoryLoaded = useCallback(() => {
    try {
      setMessages((cur) => {
        if (cur && cur.length > 0) {
          pendingCachedMessagesRef.current = null;
          setShowSkeleton(false);
          window.setTimeout(() => jumpToLatest('auto'), 60);
          return cur;
        }
        const staged = pendingCachedMessagesRef.current || null;
        pendingCachedMessagesRef.current = null;
        setShowSkeleton(false);
        window.setTimeout(() => jumpToLatest('auto'), 60);
        return staged || cur;
      });
    } catch (e) {
      setShowSkeleton(false);
    }
  }, [jumpToLatest]);

  const onHistoryScroll = useCallback((_offset: number, near: boolean) => {
    try { void _offset; setAutoScroll(near); } catch (e) { }
  }, [setAutoScroll]);

  const handleSelectCharacter = useCallback((c: ChatItem) => {
    try {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const ch: ChatItem = {
        id: c.id,
        name: c.name,
        hue: c.hue ?? 200,
        isOnline: c.isOnline,
        last: c.last,
        time: c.time,
        ai: c.ai,
        imageUrl: (c as any).imageUrl,
      };

      setSelected(ch);
      try {
        const cached = messagesCacheRef.current.get(String(ch.id));
        if (Array.isArray(cached) && cached.length > 0) setMessages(cached);
        else setMessages([]);
      } catch (e) { setMessages([]); }

      setHistoryRefreshKey((k) => k + 1);
      setAutoScroll(true);

      const slug = generateSlug(c.name, c.id);
      navigate(`/chat/${slug}`, { replace: false });

      if (isMobile) setMobileView('chat');
    } catch (e) {
      console.warn('handleSelectCharacter error', e);
    }
  }, [setMessages, setHistoryRefreshKey, setAutoScroll, navigate, isMobile, setMobileView]);

  return (
    <div
      className={`fixed inset-0 flex overflow-hidden transition-all duration-200 bg-(--bg-primary) text-(--text-primary) ${
        // align left offset with sidebar width: collapsed = 64px (left-16), expanded = 240px (left-60)
        sidebarCollapsed ? 'md:left-16' : 'md:left-60'
        }`}
      style={{
        top: 'var(--header-h, 80px)'
      }}
    >
      <SEOHead
        title={`Chat with ${selected?.name || 'AI Character'} - ChatTime`}
        description={`Chat with ${selected?.name || 'your AI companion'} on ChatTime. Experience personalized conversations with advanced AI characters designed for meaningful connections.`}
        keywords="AI chat, AI girlfriend chat, virtual companion chat, AI character conversation, AI dating chat"
        canonical="/chat"
      />
      <ChatListPanel
        isMobile={isMobile}
        mobileView={mobileView}
        setMobileView={setMobileView}
        isDark={isDark}
        tab={tab}
        setTab={setTab}
        q={q}
        setQ={setQ}
        chatsLoading={chatsLoading}
        filtered={filtered}
        userCharactersLoading={userCharactersLoading}
        userCharactersError={userCharactersError}
        chatsLoadingFallback={false}
        selected={selected}
        onSelect={handleSelectCharacter}
        navigateToSelect={() => navigate('/private-content/select-character')}
        navigateToCreate={() => navigate('/create-character')}
      />

      {/* CENTER PANEL - Chat Messages */}
      <ChatCenterPanel
        isMobile={isMobile}
        mobileView={mobileView}
        setMobileView={setMobileView}
        isDark={isDark}
        selected={selected}
        characterSlug={characterSlug}
        currentCharacterData={currentCharacterData}
        isPrivatePackView={isPrivatePackView}
        isPackView={isPackView}
        packSlug={packSlug}
        scrollRef={scrollRef}
        endRef={endRef}
        inputBarRef={inputBarRef}
        inputBarHeight={inputBarHeight}
        kbOffset={kbOffset}
        messages={messages}
        setMessages={setMessages}
        token={token}
        historyRefreshKey={historyRefreshKey}
        showSkeleton={showSkeleton}
        onHistoryLoaded={onHistoryLoaded}
        onHistoryScroll={onHistoryScroll}
        input={input}
        setInput={setInput}
        send={send}
        handleVoiceResult={handleVoiceResult}
        isCompactContinuation={isCompactContinuation}
      />


      {/* RIGHT PANEL - Character Profile (only render when a character is selected) */}
      {selected?.id ? (
        <ChatSidebar
          isMobile={isMobile}
          mobileView={mobileView}
          setMobileView={setMobileView}
          isDark={isDark}
          currentCharacterData={currentCharacterData}
          selected={selected}
          galleryRefreshKey={galleryRefreshKey}
          navigate={navigate}
          theme={theme}
          socialItems={socialItems}
          ChatGallery={ChatGallery}
        />
      ) : null}
      {/* Media Viewer Modal */}
      <MediaViewerOverlay
        mediaViewer={mediaViewer}
        downloading={downloadingMediaViewer}
        onClose={() => setMediaViewer(null)}
        onNext={goNextMedia}
        onPrev={goPrevMedia}
        onDownload={(url?: string) => {
          if (!url) return;
          setDownloadingMediaViewer(true);
          downloadAndSave(url).finally(() => setDownloadingMediaViewer(false));
        }}
        mediaItems={mediaItems}
        getCurrentMediaIndex={getCurrentMediaIndex}
      />
    </div>
  );
}

// Chat history has been moved to `src/components/ChatHistory.tsx`
