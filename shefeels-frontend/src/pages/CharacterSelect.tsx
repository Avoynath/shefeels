import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import apiClient from '../utils/api';
import { normalizeCharacters } from '../utils/normalizeCharacter';
import CharacterCard from '../components/CharacterCard';
import VirtualScroll from '../components/VirtualScroll';
import chunk from '../utils/chunk';
// Replaced FilterMenu with simple gender/style selects

type Character = any;

export default function CharacterSelect() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const location = useLocation();
  const isSelectorMode = location.pathname === '/private-content/select-character';
  const [chars, setChars] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMyAi, setShowMyAi] = useState(false);
  const [myAiChars, setMyAiChars] = useState<Character[]>([]);
  const [myAiLoading, setMyAiLoading] = useState(false);
  const [genderFilter, setGenderFilter] = useState<'All' | 'Male' | 'Female' | 'Trans'>('All');
  const [styleFilter, setStyleFilter] = useState<'All' | 'Realistic' | 'Anime'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');


  // Track skeleton count for loading state
  const [skeletonCount, setSkeletonCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await apiClient.getDefaultCharacters();
        const list = Array.isArray(data) ? data : [];
        const normalizedList = normalizeCharacters(list);

        // If opened as the Private Content selector, filter out characters that
        // don't have private packs using a single batch API call.
        if (isSelectorMode && normalizedList.length > 0) {
          try {
            // Step 1: Get list of character IDs that have packs (single API call)
            const { character_ids: characterIdsWithPacks } = await apiClient.getCharactersWithPacks();

            if (cancelled) return;

            // Create a set for O(1) lookups
            const packCharacterSet = new Set(characterIdsWithPacks.map(id => String(id)));

            // Filter characters that have packs
            const filtered = normalizedList.filter((ch: any) =>
              packCharacterSet.has(String(ch.id))
            );

            // Set skeleton count for loading animation
            if (!cancelled) {
              setSkeletonCount(filtered.length);
              setChars(filtered);
            }
          } catch (e) {
            console.error('Failed to fetch characters with packs:', e);
            if (!cancelled) setChars([]);
          }
        } else {
          if (!cancelled) setChars(normalizedList);
          // Cache presigned URLs for quick reuse
          try {
            for (const ch of normalizedList) {
              const key = String(ch.id ?? (ch as any).character_id ?? ch.username ?? '');
              if (key && ch.image_url_s3) apiClient.setCachedPresigned(key, ch.image_url_s3, 60 * 15);
            }
          } catch { }
        }
      } catch (e) {
        if (!cancelled) setChars([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isSelectorMode]);

  // Listen for global style changes (header broadcasts hl_style_changed)
  // CharacterSelect no longer listens for the global style changes — style toggles are limited to Homepage + My AI

  const shellClass = 'mx-auto w-full max-w-[1602px] px-1 pb-8 pt-2 sm:px-2 sm:pb-10 sm:pt-4';
  const controlPillClass = (active = false) =>
    `inline-flex items-center justify-center rounded-[999px] border px-4 py-2 text-[13px] font-medium transition-all ${
      active
        ? 'border-[#9d66ff] bg-[#7f5af0] text-white shadow-[0_10px_30px_rgba(127,90,240,0.24)]'
        : 'border-white/10 bg-[rgba(255,255,255,0.08)] text-white/80 hover:bg-white/10'
    }`;

  return (
    <div className={`${shellClass} min-h-[70vh] bg-transparent`}>
      {/* top bar */}
      <div className="grid grid-cols-1 gap-6 px-1 sm:px-6 xl:grid-cols-[minmax(0,820px)_minmax(0,1fr)] xl:items-start">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1f1f1f] ring-1 ring-white/5 sm:h-10 sm:w-10"
            aria-label="Back"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white sm:h-4 sm:w-4">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="flex flex-col">
            <h1 className={`text-[24px] font-semibold leading-7 ${isDark ? 'text-white' : 'text-gray-900'} sm:text-[30px] sm:leading-9`}>
              Select a character
            </h1>
            {isSelectorMode && (
              <nav className="mt-1 flex items-center gap-1.5 text-[11px] text-white/55 sm:text-xs" aria-label="breadcrumb">
                <button type="button" onClick={() => navigate('/')} className="hover:underline">Home</button>
                <span className="opacity-40">/</span>
                <button type="button" onClick={() => navigate('/private-content/select-character')} className="hover:underline">Private Content</button>
                <span className="opacity-40">/</span>
                <span className="text-white">Select a character</span>
              </nav>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <div className="relative w-full max-w-[380px]">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              aria-label="Search characters"
              className={`h-[46px] w-full rounded-[999px] px-4 pr-10 text-sm font-medium ${isDark ? 'bg-[rgba(255,255,255,0.08)] text-white' : 'bg-white text-gray-800'} ring-1 ring-white/8 placeholder:text-white/35`}
            />
            <svg className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="11" cy="11" r="5" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (showMyAi) {
                  setShowMyAi(false);
                  return;
                }

                setShowMyAi(true);
                try {
                  setMyAiLoading(true);
                  const data = await apiClient.getUserCharacters();
                  setMyAiChars(Array.isArray(data) ? normalizeCharacters(data) : []);
                } catch (e) {
                  setMyAiChars([]);
                } finally {
                  setMyAiLoading(false);
                }
              }}
              className={controlPillClass(showMyAi)}
            >
              My AI
            </button>

            <div className="relative">
              <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value as any)} className="h-[42px] appearance-none rounded-[999px] border border-white/10 bg-[rgba(255,255,255,0.08)] px-4 pr-9 text-[13px] font-medium text-white/85" aria-label="Gender filter">
                <option value="All">Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Trans">Trans</option>
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/60" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <div className="relative">
              <select value={styleFilter} onChange={(e) => setStyleFilter(e.target.value as any)} className="h-[42px] appearance-none rounded-[999px] border border-white/10 bg-[rgba(255,255,255,0.08)] px-4 pr-9 text-[13px] font-medium text-white/85" aria-label="Style filter">
                <option value="All">Styles</option>
                <option value="Realistic">Realistic</option>
                <option value="Anime">Anime</option>
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/60" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* grid */}
      <div className="mt-6 px-1 sm:px-6">
        {(() => {
          const activeLoading = showMyAi ? myAiLoading : loading;
          const source = showMyAi ? myAiChars : chars;

          if (activeLoading) {
            const skeletonItems = skeletonCount > 0 ? skeletonCount : 8;
            return (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 xl:grid-cols-4 xl:gap-8">
                {Array.from({ length: Math.min(skeletonItems, 12) }).map((_, i) => (
                  <div
                    key={i}
                    className="relative overflow-hidden rounded-[18px] border border-white/6 bg-linear-to-b from-white/4 to-white/2"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="aspect-3/4 bg-linear-to-r from-white/3 via-white/8 to-white/3 animate-pulse" />
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-linear-to-t from-black/80 to-transparent">
                      <div className="h-3 w-1/2 rounded bg-white/8 animate-pulse mb-1" />
                      <div className="h-2 w-1/3 rounded bg-white/5 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            );
          }

          const filtered = (source || []).filter((c: any) => {
            if (genderFilter !== 'All') {
              const g = (c.gender || '').toString().toLowerCase();
              const f = String(genderFilter).toLowerCase();
              if (f === 'trans') {
                if (!g.startsWith('trans')) return false;
              } else {
                if (f !== g) return false;
              }
            }
            if (styleFilter !== 'All') {
              const s = ((c.style || c.art_style || c.image_style || c.type) || '').toString().toLowerCase();
              if (styleFilter === 'Anime' && !/anime/.test(s)) return false;
              if (styleFilter === 'Realistic' && !/(realistic|real|photorealistic|photo)/.test(s)) return false;
            }
            if (searchQuery && String(searchQuery).trim() !== '') {
              const q = String(searchQuery).toLowerCase();
              const name = ((c.name || c.username || '') + '').toLowerCase();
              if (!name.includes(q)) return false;
            }
            return true;
          });

          return (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 xl:grid-cols-4 xl:gap-8">
              {(filtered || []).map((ch: any) => (
                <div key={ch.id || ch.name || Math.random()}>
                  <CharacterCard
                    name={ch.name || ch.username}
                    age={ch.age}
                    img={ch.webp_image_url_s3 || ch.image_url_s3}
                    gif={ch.gif_url_s3}
                    webp={ch.animated_webp_url_s3}
                    bio={ch.bio}
                    onClick={() => {
                      if (isSelectorMode) {
                        try { navigate(`/private-content/character/${ch.id}/packs`); } catch { }
                      } else {
                        navigate('/generate-image', { state: { character: ch, mediaMode: (location.state as any)?.mediaMode } });
                      }
                    }}
                    showOptions={false}
                    alignActionsSpread={false}
                    variant="compact"
                  />
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
