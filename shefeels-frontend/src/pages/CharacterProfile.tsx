import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import EditCharacter from './EditCharacter';
import { useAuth } from '../contexts/AuthContext';
import { useToastActions } from '../contexts/ToastContext';
import Card from '../components/Card';
import Button from '../components/Button';
import apiClient from '../utils/api';
import { normalizeCharacter } from '../utils/normalizeCharacter';
// import { buildApiUrl } from '../utils/apiBase';
// import fetchWithAuth from '../utils/fetchWithAuth';

export default function CharacterProfile() {
  const loc = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const stateChar = (loc.state as any)?.character || null;
  const slugParam = (params as any)?.slug ?? null;

  // Helper: consider a value an absolute image URL if it starts with http(s), data:, blob: or a leading slash
  const isAbsoluteImageUrl = (v: any) => {
    if (!v || typeof v !== 'string') return false;
    return /^https?:\/\//i.test(v) || /^data:/i.test(v) || /^blob:/i.test(v) || /^\//.test(v);
  };

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const { token } = useAuth();
  // We don't currently use toast functions directly in this component; keep the hook in case
  // child components rely on the same context or future changes need it.
  useToastActions();
  const [counts, setCounts] = useState<{ likes: number; messages: number } | null>(null);
  const [isLiked, setIsLiked] = useState<boolean | null>(null); // null = unknown

  // Return sensible initial counts when optimistic-updating before a server value exists
  const getInitialLikesCount = () => Number(form?.likes ?? 0);
  const getInitialMessagesCount = () => Number(form?.messages ?? 0);

  const getCharacterId = () => {
    // Prefer URL param when present, then navigation state, then form
    const paramSlug = (params as any)?.slug;
    // If slug present, we don't know the full id here; let fetchCharacterData resolve it
    const raw = paramSlug ?? stateChar?.id ?? form?.id;
    if (raw === null || typeof raw === 'undefined') return '';
    return String(raw).trim();
  };

  // `save` was previously implemented here but is not used in this component.
  // Editing is handled by the `EditCharacter` child and its `onSaved` callback.

  // helper to return normalized character data for an id (does not set state)
  async function fetchCharacterData(id: string | number) {
    try {
      // If `slugParam` is present, delegate to `getCharacterBySlug` which expects the full slug
      if (slugParam) {
        const resp: any = await apiClient.getCharacterBySlug(slugParam as string);
        const ch = resp && (resp.character || resp);
        if (!ch) return null;
        const n = normalizeCharacter(ch || {});
        // Cache the presigned image URL separately
        if (n && isAbsoluteImageUrl(n.image_url_s3)) {
          setImageUrl(n.image_url_s3);
        }
        return n;
      }

      const cid = String(id ?? '').trim();
      if (!cid) return null;
      const resp: any = await apiClient.getCharacterById(cid as any);
      const ch = resp && (resp.character || resp);
      if (!ch) return null;
      const n = normalizeCharacter(ch || {});
      // Cache the presigned image URL separately
      if (n && isAbsoluteImageUrl(n.image_url_s3)) {
        setImageUrl(n.image_url_s3);
      }
      return n;
    } catch (e) {
      return null;
    }
  }

  // Fetch likes/message counts for this character (if id available)
  useEffect(() => {
    let aborted = false;
    async function fetchCounts() {
      try {
        const cid = getCharacterId();
        if (!cid) return;
        if (token) apiClient.setAccessToken(token);
        const data = await apiClient.getLikesMessageCount([cid]);
        if (aborted) return;
        let item: any = null;
        if (Array.isArray(data)) {
          item = data.find((entry) => String(entry?.character_id ?? '') === cid) ?? data[0];
        }
        if (item) {
          setCounts({
            likes: Number(item?.likes_count ?? item?.likes ?? 0),
            messages: Number(item?.message_count ?? item?.messages ?? 0),
          });
        } else {
          setCounts({
            likes: 0,
            messages: 0,
          });
        }
      } catch (e) {
        // ignore
      }
    }

    fetchCounts();
    return () => { aborted = true; };
  }, [form?.id, token]);

  // Fetch like-status for current user (if authenticated)
  useEffect(() => {
    let aborted = false;
    async function fetchLikeStatus() {
      try {
        const cid = getCharacterId();
        if (!cid) return;
        if (!token) {
          setIsLiked(null);
          return;
        }
        if (apiClient && typeof apiClient.setAccessToken === 'function') {
          apiClient.setAccessToken(token);
        }
        const data = await apiClient.getCharacterLikeStatus([cid]);
        if (aborted) return;
        if (Array.isArray(data) && data.length > 0) {
          const item = data.find((d) => String(d.character_id) === cid) || data[0];
          if (item && typeof item.is_liked !== 'undefined') setIsLiked(Boolean(item.is_liked));
        }
      } catch (e) {
        // ignore
      }
    }

    fetchLikeStatus();
    return () => { aborted = true; };
  }, [form?.id, token]);

  // Always fetch authoritative character data when the page opens (and when location changes)
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const cid = getCharacterId();
        if (!cid) return;
        const n = await fetchCharacterData(cid);
        if (aborted) return;
        if (n) {
          setForm(n);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { aborted = true; };
    // running on location change ensures the page re-fetches whenever it is opened/navigated to
  }, [loc.key]);

  // If the navigation state requested the editor to open, enable editing once form is loaded
  useEffect(() => {
    try {
      const openEditor = (loc.state as any)?.openEditor;
      if (openEditor) setEditing(true);
    } catch { }
  }, [loc.state]);

  // If this page was opened without a character in state and without a URL param, redirect back
  useEffect(() => {
    const cid = (params as any)?.characterId;
    if (!cid && !stateChar) {
      // No canonical id or navigation state — redirect to homepage
      try { navigate('/', { replace: true }); } catch { };
    }
    // only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize from navigation state if present
  useEffect(() => {
    if (stateChar && isAbsoluteImageUrl(stateChar.image_url_s3)) {
      setImageUrl(stateChar.image_url_s3);
    }
  }, [stateChar?.image_url_s3]);

  // Toggle like action (POST to /characters/like)
  const toggleLike = async () => {
    // prevent liking again if already liked
    if (isLiked === true) return;
    const previousLiked = isLiked;
    try {
      const cid = getCharacterId();
      if (!cid) return;

      // optimistic update
      setIsLiked(true);
      setCounts((c) => {
        const currentLikes = c?.likes ?? getInitialLikesCount();
        const currentMessages = c?.messages ?? getInitialMessagesCount();
        return { likes: currentLikes + 1, messages: currentMessages };
      });

      if (token && typeof apiClient.setAccessToken === 'function') {
        apiClient.setAccessToken(token);
      }
      await apiClient.likeCharacter(cid);
    } catch (e) {
      // revert on error
      setIsLiked(previousLiked ?? false);
      setCounts((c) => {
        const currentLikes = c?.likes ?? 0;
        const currentMessages = c?.messages ?? 0;
        return { likes: Math.max(0, currentLikes - 1), messages: currentMessages };
      });
    }
  };

  if (!form) {
    return (
      <div className="max-w-275 mx-auto py-8">
        <Card noBase className="p-6">
          <div className="text-center text-white/60">Loading...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-300 mx-auto py-8 px-4">
      <Card noBase className="overflow-hidden relative bg-linear-to-br from-[#1a1a1a] to-[#0d0d0d] border border-white/5">
        <div className="md:flex md:items-start md:gap-8 p-8">
          <div className="md:w-2/5 w-full relative">
            <div className="rounded-2xl overflow-hidden ring-2 ring-(--hl-gold)/20 shadow-2xl relative group">
              {imageUrl ? (
                <img src={imageUrl} alt={form.name} className="w-full aspect-3/4 object-cover transition-transform group-hover:scale-105 duration-500" />
              ) : (
                <div className="w-full aspect-3/4 bg-linear-to-br from-(--hl-gold)/10 via-purple-500/5 to-transparent flex items-center justify-center">
                  <div className="text-white/30 text-lg">No Image</div>
                </div>
              )}

              {/* Gradient overlay with name/age */}
              <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent pt-20 pb-4 px-4">
                <div className="text-2xl font-bold text-white drop-shadow-lg">{form.name}{form.age ? `, ${form.age}` : ''}</div>
              </div>

              {/* Stats badges (top-left) */}
              <div className="absolute left-4 top-4 flex flex-col gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm text-xs text-white ring-1 ring-(--hl-gold)/30 shadow-lg">
                  <span className="text-(--hl-gold) text-sm">✉️</span>
                  <span className="font-semibold tabular-nums">{counts ? counts.messages : '—'}</span>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm text-xs text-white ring-1 ring-rose-400/30 shadow-lg">
                  <span className="text-rose-400 text-sm">❤</span>
                  <span className="font-semibold tabular-nums">{counts ? counts.likes : 0}</span>
                </div>
              </div>

              {/* Like button (top-right) */}
              <div className="absolute right-4 top-4">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); if (token && !isLiked) toggleLike(); }}
                  aria-label={isLiked ? 'Already liked' : 'Like character'}
                  title={!token ? 'Login to like' : (isLiked ? 'You liked this' : 'Like')}
                  disabled={isLiked === true || !token}
                  className={`inline-flex items-center justify-center w-10 h-10 rounded-full backdrop-blur-sm transition-all shadow-lg ${isLiked ? 'bg-rose-500 ring-2 ring-rose-400/50 scale-110' : 'bg-black/70 ring-1 ring-white/20 hover:bg-black/80 hover:scale-110'} ${isLiked === true || !token ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className={`text-lg ${isLiked ? 'text-white animate-pulse' : 'text-rose-400'}`}>{isLiked ? '❤️' : '🤍'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="md:flex-1 mt-8 md:mt-0">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                {!editing ? (
                  <Button variant="primary" onClick={() => setEditing(true)} className="px-6 py-2 rounded-full bg-linear-to-r from-(--hl-gold) to-yellow-600 hover:from-yellow-600 hover:to-(--hl-gold) text-black font-semibold shadow-lg shadow-(--hl-gold)/20">✏️ Edit Profile</Button>
                ) : (
                  <Button variant="ghost" onClick={() => setEditing(false)} className="px-6 py-2 rounded-full border border-white/20 hover:bg-white/5">✕ Cancel</Button>
                )}
              </div>
              <Button variant="ghost" onClick={() => navigate(-1)} className="px-4 py-2 rounded-full border border-white/20 hover:bg-white/5">← Back</Button>
            </div>

            {/* Use EditCharacter component for both edit and view modes */}
            <EditCharacter
              character={form}
              inline={true}
              readOnly={!editing}
              onSaved={(_saved) => {
                // When saved, refresh local form with authoritative data
                (async () => {
                  try {
                    const n = await fetchCharacterData(getCharacterId());
                    if (n) setForm(n);
                    setEditing(false);
                  } catch { }
                })();
              }}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
