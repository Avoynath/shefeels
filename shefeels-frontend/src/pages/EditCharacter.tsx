import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Button from "../components/Button";
import { useThemeStyles } from "../utils/theme";
import { useTheme } from "../contexts/ThemeContext";
import apiClient from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

export default function EditCharacter({ character: propCharacter, onSaved, inline, readOnly }: { character?: any; onSaved?: (data: any) => void; inline?: boolean; readOnly?: boolean }) {
  const { components } = useThemeStyles();
  const cardBase = components.cardBase;
  // Adjusted title and card styles to match Figma
  const titleClass = "text-2xl font-semibold text-[#7F5AF0]";
  const cardBorder = "ring-0 border border-[#7F5AF0]/25"; // very thin light purple edge

  const location = useLocation();
  // Accept character from prop for embedding; fallback to navigation state for backwards-compat
  const character = propCharacter ?? (location.state as any)?.character ?? null;

  const [name, setName] = useState<string>(() => character?.name ?? "Character Name");
  const [username, setUsername] = useState<string>(() => character?.username ?? "_username_123");
  const [bio, setBio] = useState<string>(() => character?.bio ?? "No profile description available.");
  const [privacy, setPrivacy] = useState(() => character?.privacy ?? "private");
  const [onlyFansUrl, setOnlyFansUrl] = useState<string>(() => character?.social?.onlyfans ?? character?.onlyfans_url ?? "");
  const [fanvueUrl, setFanvueUrl] = useState<string>(() => character?.social?.fanvue ?? character?.fanvue_url ?? "");
  const [tiktokUrl, setTiktokUrl] = useState<string>(() => character?.social?.tiktok ?? character?.tiktok_url ?? "");
  const [instagramUrl, setInstagramUrl] = useState<string>(() => character?.social?.instagram ?? character?.instagram_url ?? "");

  const navigate = useNavigate();
  const { token } = useAuth();

  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState<string | null>(null);

  const handleSave = async () => {
    // Build payload matching backend schema
    const charIdRaw = (character as any)?.id;
    const characterId = charIdRaw != null ? String(charIdRaw) : '';
    if (!characterId) {
      setModalMessage('Invalid character id');
      setModalOpen(true);
      return;
    }

    const payload: any = {
      character_id: characterId,
    };
    if (name) payload.name = name;
    if (username) payload.username = username;
    if (bio) payload.bio = bio;
    if (privacy) payload.privacy = privacy;
    if (onlyFansUrl) payload.onlyfans_url = onlyFansUrl;
    if (fanvueUrl) payload.fanvue_url = fanvueUrl;
    if (tiktokUrl) payload.tiktok_url = tiktokUrl;
    if (instagramUrl) payload.instagram_url = instagramUrl;

    try {
      setLoading(true);
      if (token) apiClient.setAccessToken(token);
  // Call endpoint at the configured base URL: VITE_API_BASE_URL/characters/edit-by-id
  await apiClient.post('/characters/edit-by-id', payload);
      setModalMessage('Character updated successfully');
      setModalOpen(true);
      // If parent provided an onSaved handler (embedding), call it and don't navigate away
      const savedData = { ...payload, character_id: characterId } as any;
      try {
        if (onSaved && typeof onSaved === 'function') {
          onSaved(savedData);
        }
      } catch {}
      // close modal after short delay and navigate back only when not embedded
      setTimeout(() => {
        setModalOpen(false);
        if (!inline) navigate('/my-ai');
      }, 1200);
    } catch (err) {
      console.error('Failed to save character', err);
      setModalMessage((err as any)?.message || 'Failed to save character');
      setModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
    if (!open) return null;
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    return (
      <div className="fixed inset-0 z-50">
        <div className={`absolute inset-0 ${isDark ? 'bg-black/70' : 'bg-white/70'} backdrop-blur-sm`} onClick={onClose} />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,92vw)]">
          <div className={`${cardBase} p-6 text-center`}>{children}</div>
        </div>
      </div>
    );
  }

  const inner = (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-medium text-[#7F5AF0] mb-2 uppercase tracking-wide">Name</div>
        {readOnly ? (
          <div className="text-xl font-semibold text-white/95 py-2">{name || '—'}</div>
        ) : (
          <input value={name} onChange={(e)=>setName(e.target.value)} className={`${components.input} rounded-xl border-white/10 focus:border-[#7F5AF0]/50 focus:ring-2 focus:ring-[#7F5AF0]/20`} />
        )}
      </div>

      <div>
        <div className="text-sm font-medium text-[#7F5AF0] mb-2 uppercase tracking-wide">Username</div>
        {readOnly ? (
          <div className="text-white/90 py-1 font-mono">{username ? `@${username}` : '—'}</div>
        ) : (
          <input value={username} onChange={(e)=>setUsername(e.target.value)} className={components.input} />
        )}
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-medium text-[#7F5AF0] uppercase tracking-wide">Bio</div>
          {!readOnly && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const charId = (character as any)?.id;
                  if (!charId) return;
                  setLoading(true);
                  const res: any = await apiClient.post(`/characters/${charId}/generate-bio`);
                  if (res && res.bio) {
                    setBio(res.bio);
                    // Also update looking_for if needed, though not currently in this form
                  }
                } catch (err: any) {
                  setModalMessage(err?.message || "Failed to generate bio");
                  setModalOpen(true);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="text-[10px] sm:text-xs font-bold text-white bg-[#7F5AF0] hover:bg-[#9D66FF] px-3 py-1 rounded-full transition-all flex items-center gap-1 shadow-sm active:scale-95 disabled:opacity-50"
            >
              {loading ? '...' : '✨ Generate with AI'}
            </button>
          )}
        </div>
        {readOnly ? (
          <div className="bg-white/5 rounded-xl p-4 text-white/90 min-h-[80px] whitespace-pre-wrap leading-relaxed border border-white/5">{bio || '—'}</div>
        ) : (
          <textarea value={bio} onChange={(e)=>setBio(e.target.value)} rows={4} className={`${components.input} resize-none rounded-xl border-white/10 focus:border-[#7F5AF0]/50 focus:ring-2 focus:ring-[#7F5AF0]/20`} />
        )}
      </div>

      <div>
        <div className="text-sm font-medium text-[#7F5AF0] mb-2 uppercase tracking-wide">OnlyFans URL</div>
        {readOnly ? (
          onlyFansUrl ? (
            <a href={onlyFansUrl} target="_blank" rel="noreferrer" className="text-[#7F5AF0] hover:text-[#9D66FF] underline decoration-[#7F5AF0]/30 hover:decoration-[#7F5AF0] break-all transition-colors inline-flex items-center gap-2">🔗 {onlyFansUrl}</a>
          ) : (
            <div className="text-white/50">—</div>
          )
        ) : (
          <input value={onlyFansUrl} onChange={(e)=>setOnlyFansUrl(e.target.value)} placeholder="https://onlyfans.com/username" className={`${components.input} rounded-xl border-white/10 focus:border-[#7F5AF0]/50 focus:ring-2 focus:ring-[#7F5AF0]/20`} />
        )}
      </div>

      <div>
        <div className="text-sm font-medium text-[#7F5AF0] mb-2 uppercase tracking-wide">Fanvue URL</div>
        {readOnly ? (
          fanvueUrl ? (
            <a href={fanvueUrl} target="_blank" rel="noreferrer" className="text-[#7F5AF0] hover:text-[#9D66FF] underline decoration-[#7F5AF0]/30 hover:decoration-[#7F5AF0] break-all transition-colors inline-flex items-center gap-2">🔗 {fanvueUrl}</a>
          ) : (
            <div className="text-white/50">—</div>
          )
        ) : (
          <input value={fanvueUrl} onChange={(e)=>setFanvueUrl(e.target.value)} placeholder="https://fanvue.com/username" className={`${components.input} rounded-xl border-white/10 focus:border-[#7F5AF0]/50 focus:ring-2 focus:ring-[#7F5AF0]/20`} />
        )}
      </div>

      <div>
        <div className="text-sm font-medium text-[#7F5AF0] mb-2 uppercase tracking-wide">TikTok URL</div>
        {readOnly ? (
          tiktokUrl ? (
            <a href={tiktokUrl} target="_blank" rel="noreferrer" className="text-[#7F5AF0] hover:text-[#9D66FF] underline decoration-[#7F5AF0]/30 hover:decoration-[#7F5AF0] break-all transition-colors inline-flex items-center gap-2">🔗 {tiktokUrl}</a>
          ) : (
            <div className="text-white/50">—</div>
          )
        ) : (
          <input value={tiktokUrl} onChange={(e)=>setTiktokUrl(e.target.value)} placeholder="https://www.tiktok.com/@username" className={`${components.input} rounded-xl border-white/10 focus:border-[#7F5AF0]/50 focus:ring-2 focus:ring-[#7F5AF0]/20`} />
        )}
      </div>

      <div>
        <div className="text-sm font-medium text-[#7F5AF0] mb-2 uppercase tracking-wide">Instagram URL</div>
        {readOnly ? (
          instagramUrl ? (
            <a href={instagramUrl} target="_blank" rel="noreferrer" className="text-[#7F5AF0] hover:text-[#9D66FF] underline decoration-[#7F5AF0]/30 hover:decoration-[#7F5AF0] break-all transition-colors inline-flex items-center gap-2">🔗 {instagramUrl}</a>
          ) : (
            <div className="text-white/50">—</div>
          )
        ) : (
          <input value={instagramUrl} onChange={(e)=>setInstagramUrl(e.target.value)} placeholder="https://www.instagram.com/username" className={`${components.input} rounded-xl border-white/10 focus:border-[#7F5AF0]/50 focus:ring-2 focus:ring-[#7F5AF0]/20`} />
        )}
      </div>

      <div>
        <div className="text-sm font-medium text-[#7F5AF0] mb-2 uppercase tracking-wide">Privacy</div>
        {readOnly ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 text-white/90 border border-white/10">
            <span>{privacy === 'public' ? '🌍' : privacy === 'unlisted' ? '🔓' : '🔒'}</span>
            <span className="capitalize font-medium">{privacy || 'Private'}</span>
          </div>
        ) : (
          <select value={privacy} onChange={(e)=>setPrivacy(e.target.value)} className={`${components.input} appearance-none rounded-xl border-white/10 focus:border-[#7F5AF0]/50 focus:ring-2 focus:ring-[#7F5AF0]/20`}>
            <option value="private">Private</option>
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
          </select>
        )}
      </div>

      {!readOnly && (
        <div className="mt-8 pt-6 border-t border-white/10">
          <Button variant="primary" onClick={handleSave} className="w-full rounded-full py-3 bg-gradient-to-r from-[#7F5AF0] to-[#E53170] hover:from-[#E53170] hover:to-[#7F5AF0] text-white font-bold shadow-lg shadow-[#7F5AF0]/30 hover:shadow-[#7F5AF0]/50 transition-all">
            {loading ? '⏳ Saving...' : '💾 Save Changes'}
          </Button>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div>
          <div className="text-lg font-semibold mb-2">{modalMessage ?? 'Status'}</div>
          <div>
            <Button variant="primary" onClick={() => setModalOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );

  if (inline) return inner;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className={`${cardBase} ${cardBorder} p-8 rounded-[18px]`}>
        <h2 className={`${titleClass} text-center`}>Your AI Girl Setting</h2>
        <div className="mt-6">{inner}</div>
      </div>
    </div>
  );
}
