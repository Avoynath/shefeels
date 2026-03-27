import { useMemo, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from "../contexts/ThemeContext";
// useRef / useCallback not needed in this file
import { useLocation, useNavigate } from "react-router-dom";
// Import image generation prompts JSON (static file, cached by Vite)
import imageGenerationPrompts from '../assets/image_generation_prompts.json';
import videoPosePrompts from '../assets/prompt_video_pose.json';
// theme utilities (not required here currently)
import Button from "../components/Button";
import Card from "../components/Card";
import apiClient, { getErrorMessage } from "../utils/api";
import { buildApiUrl, getApiOrigin } from '../utils/apiBase';
import fetchWithAuth from '../utils/fetchWithAuth';
import genderService from '../utils/genderService';
import { useAuth } from "../contexts/AuthContext";
import { useToastActions } from "../contexts/ToastContext";
import { useCharacterMedia } from "../hooks/useCharacters";

// ——— Gallery helpers (copied/adapted) ———
function IconDownload({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 21H3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSpinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ——— Small UI icons to match Figma for the Number of images section ———
// IconDot removed (unused)

// Removed a few unused icon helpers to satisfy strict TS

const getMediaUrl = (item: any): string | null => {
  if (!item) return null;
  const keys = [
    's3_path_gallery',
    's3_path',
    'image_s3_url',
    'image_url_s3',
    'image_url',
    'url',
    'path',
    's3_url',
    'media_url',
    'file',
    'img',
    'image',
    'signed_url',
    'signedUrl',
  ];
  for (const k of keys) {
    const v = item[k];
    if (v && typeof v === 'string') return v;
  }
  if (item.attributes) {
    for (const k of ['s3_path_gallery', 'url', 'path', 'image']) {
      const v = (item.attributes as any)[k];
      if (v && typeof v === 'string') return v;
    }
  }
  if (item.data && typeof item.data === 'object') {
    return getMediaUrl(item.data) || null;
  }
  return null;
};

const getFilenameFromUrl = (url: string | null) => {
  try {
    if (!url || typeof url !== 'string') return 'download.bin';
    const clean = url.split('?')[0].split('#')[0];
    const parts = clean.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    if (last && last.includes('.')) return last;
    const extMatch = clean.match(/\.(jpg|jpeg|png|webp|mp4|webm|ogg)(?:$|\?)/i);
    const ext = extMatch ? extMatch[0].replace('.', '') : 'bin';
    return `download.${ext}`;
  } catch (e) {
    return 'download.bin';
  }
};

async function saveBlob(blob: Blob, suggestedName?: string) {
  if ((window as any).showSaveFilePicker) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [{ description: 'File', accept: { [blob.type || 'application/octet-stream']: ['.bin'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      const name = e && (e as any).name ? (e as any).name : '';
      const msg = e && (e as any).message ? (e as any).message : '';
      if (name === 'AbortError' || name === 'NotAllowedError' || name === 'SecurityError' || /cancel/i.test(msg)) {
        return;
      }
    }
  }
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = suggestedName || 'download.bin';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}


// Load generate-image assets (per-gender) using Vite glob
const genFemaleMap = (import.meta as any).glob('../assets/generate-image/female/**/*.{png,jpg,jpeg,webp,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const genMaleMap = (import.meta as any).glob('../assets/generate-image/male/**/*.{png,jpg,jpeg,webp,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const videoBackgroundMap = (import.meta as any).glob('../assets/generate-video/background/**/*.{png,jpg,jpeg,webp,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

// Video pose assets (per-gender)
const genVideoFemalePoseMap = (import.meta as any).glob('../assets/generate-video/female/Pose/**/*.{png,jpg,jpeg,webp,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const genVideoMalePoseMap = (import.meta as any).glob('../assets/generate-video/male/Pose/**/*.{png,jpg,jpeg,webp,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function getVideoPoseAssets(map: Record<string, string>): Array<{ url: string; label: string; key: string }> {
  const out: Array<{ url: string; label: string; key: string }> = [];
  for (const [path, url] of Object.entries(map)) {
    const label = filenameLabel(path);
    // Convert label to a key matching the pose prompt JSON keys
    const key = label.toLowerCase().replace(/\s+/g, '_');
    out.push({ url, label, key });
  }
  return out;
}

function filenameLabel(path: string) {
  // extract filename without extension and folder, use underscores/dashes -> spaces, capitalize
  const parts = path.split('/');
  const name = parts[parts.length - 1] || path;
  return name.replace(/\.(png|jpe?g|webp|svg)$/i, '').replace(/[_-]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function getGenAssets(tab: SuggestionTab, map: Record<string, string>): Array<{ url: string; label: string }> {
  const folder = tab.toLowerCase(); // outfit, pose, action, accessories
  const out: Array<{ url: string; label: string }> = [];
  for (const [path, url] of Object.entries(map)) {
    if (path.toLowerCase().includes(`/${folder}/`)) out.push({ url, label: filenameLabel(path) });
  }
  return out;
}

function normalizeAssetKey(value: string) {
  return value.toLowerCase().replace(/\.(png|jpe?g|webp|svg)$/i, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function getImageSuggestionAssets(tab: SuggestionTab, genderValue: string) {
  const isMale = genderValue === 'Male';
  const map = isMale ? genMaleMap : genFemaleMap;

  if (isMale) {
    return getGenAssets(tab, map);
  }

  const allAssets = Object.entries(map).map(([path, url]) => ({
    path,
    url,
    label: filenameLabel(path),
    normalized: normalizeAssetKey(path.split('/').pop() || path),
  }));

  const curatedByTab: Record<SuggestionTab, Array<{ match: string; label: string; fileName?: string }>> = {
    Outfit: [
      { match: 'summer dress', label: 'Summer dress', fileName: 'summer_dress.svg' },
      { match: 'bikini', label: 'Bikini', fileName: 'bikini.svg' },
      { match: 'skirt', label: 'Skirt', fileName: 'skirt.svg' },
      { match: 'mini skirt', label: 'Mini-skirt', fileName: 'mini_skirt.svg' },
      { match: 'jeans', label: 'Jeans', fileName: 'jeans.svg' },
      { match: 'tank top', label: 'Tank top', fileName: 'tank_top.svg' },
      { match: 'leather', label: 'Leather', fileName: 'leather.svg' },
    ],
    Pose: [
      { match: 'standing', label: 'Standing', fileName: 'standing.svg' },
      { match: 'sitting', label: 'Sitting', fileName: 'sitting.svg' },
      { match: 'squatting', label: 'Squatting', fileName: 'squatting.svg' },
      { match: 'stretching', label: 'Stretching', fileName: 'stretching.svg' },
      { match: 'kneeling', label: 'Kneeling', fileName: 'kneeling.svg' },
    ],
    Action: [
      { match: 'working out', label: 'Working out', fileName: 'working_out.svg' },
      { match: 'tanning', label: 'Tanning', fileName: 'tanning.svg' },
      { match: 'swimming', label: 'Swimming', fileName: 'swimming.png' },
      { match: 'playing soccer', label: 'Playing soccer', fileName: 'playing_soccer.png' },
      { match: 'dining', label: 'Dining', fileName: 'dining.png' },
    ],
    Accessories: [
      { match: 'necklace', label: 'Necklace' },
      { match: 'earing', label: 'Earing' },
      { match: 'tattoos', label: 'Tattoos' },
      { match: 'sunglass', label: 'Sunglass' },
      { match: 'hat', label: 'Hat' },
      { match: 'scarf', label: 'Scarf' },
      { match: 'choker', label: 'Choker' },
    ],
  };

  return curatedByTab[tab]
    .map((item) => {
      const asset = (item.fileName
        ? allAssets.find((entry) => entry.path.toLowerCase().endsWith(`/${item.fileName!.toLowerCase()}`))
        : undefined) || allAssets.find((entry) => entry.normalized === item.match);
      return asset ? { url: asset.url, label: item.label } : null;
    })
    .filter((item): item is { url: string; label: string } => Boolean(item));
}

function getVideoBackgroundAssets() {
  const allAssets = Object.entries(videoBackgroundMap).map(([path, url]) => ({
    path,
    url,
  }));

  const curated = [
    { label: 'Beach', fileName: 'beach.svg' },
    { label: 'Pool', fileName: 'pool.svg' },
    { label: 'Garden', fileName: 'garden.svg' },
    { label: 'Snow', fileName: 'snow.svg' },
    { label: 'Park', fileName: 'park.svg' },
    { label: 'Bedroom', fileName: 'bedroom.svg' },
    { label: 'Gym', fileName: 'gym.svg' },
  ];

  return curated
    .map((item) => {
      const asset = allAssets.find((entry) => entry.path.toLowerCase().endsWith(`/${item.fileName}`));
      return asset ? { url: asset.url, label: item.label } : null;
    })
    .filter((item): item is { url: string; label: string } => Boolean(item));
}

// Phrase templates for building a generated prompt
const outfitPhrases = [
  "dressed in {outfit}",
  "wearing {outfit}",
  "styled with {outfit}"
];

const posePhrases = [
  "in a {pose} pose",
  "while {pose}",
  "{pose} gracefully"
];

function randomPrompt(outfit?: string, pose?: string, action?: string, accessories: string[] = []) {
  const outfitPhrase = outfit ? outfitPhrases[Math.floor(Math.random() * outfitPhrases.length)].replace("{outfit}", outfit) : "";
  const posePhrase = pose ? posePhrases[Math.floor(Math.random() * posePhrases.length)].replace("{pose}", pose) : "";

  let segments: string[] = [];
  if (outfitPhrase) segments.push(outfitPhrase);
  if (posePhrase) segments.push(posePhrase);
  if (action) segments.push(action.toLowerCase());

  let prompt = "A model";
  if (segments.length > 0) prompt += ` ${segments.join(', ')}`;

  if (accessories.length > 0) {
    prompt += `, wearing ${accessories.join(', ')}`;
  }

  return prompt.trim().replace(/\s+,/g, ',') + '.';
}

// ------------------------------------------------------------
// Types & data
// ------------------------------------------------------------
type SuggestionTab = "Outfit" | "Pose" | "Action" | "Accessories";
type VideoSuggestionTab = "Scenes" | "Background" | "Action";

// Use backend CharacterRead-ish type (partial fields we care about)
// Backend now expects character_id as a string; keep runtime id as string here.
type Character = {
  id: string;
  username?: string;
  name?: string;
  bio?: string | null;
  age?: number | null;
  image_url_s3?: string | null;
  webp_image_url_s3?: string | null;
  gif_url_s3?: string | null;
  animated_webp_url_s3?: string | null;
  gender?: string | null;
  // optional style fields - backend may provide one of these
  style?: string | null;
  art_style?: string | null;
  image_style?: string | null;
  type?: string | null;
  attributes?: Record<string, any> | null;
};

// runtime fetched characters
// visible in the picker; we'll fetch defaults from the API

// Suggestions are replaced by the asset thumbnails below.

type ScenePreset = {
  imageUrl: string;
  label: string;
  promptText: string;
};

// Small helpers
// Chip helper removed — it was unused in this file. Kept other UI helpers (Thumb, CharacterBadge, etc.).

function Thumb({ label, selected, imageUrl }: { label: string; selected?: boolean; imageUrl?: string | null }) {
  return (
    <div className="w-[80px] overflow-visible text-center">
      <div className="relative flex justify-center">
        {imageUrl ? (
          <div
            className={`h-[72px] w-[72px] overflow-hidden rounded-xl border-2 transition-all ${selected ? 'border-[#9d66ff] shadow-[0_4px_12px_rgba(157,102,255,0.4)]' : 'border-white/10'} bg-black/5`}
          >
            <img src={imageUrl} alt={label} className="w-full h-full object-cover block" />
          </div>
        ) : (
          <div className={`h-[72px] w-[72px] rounded-xl border-2 transition-all ${selected ? 'border-[#9d66ff]' : 'border-white/10'} bg-gradient-to-br from-white/10 to-white/0`} />
        )}
        {selected && (
          <span className="absolute right-[-2px] top-[-2px] flex h-6 w-6 items-center justify-center rounded-full bg-[#7f5af0] text-white shadow-[0_2px_10px_#7f5af0] text-xs font-bold ring-2 ring-black">
            ✓
          </span>
        )}
      </div>

      <div className="mt-2 px-1">
        <span className="block truncate text-[11px] leading-4 text-white/90">{label}</span>
      </div>
    </div>
  );
}

function EmptyGenerated() {
  return (
    <div className="h-[220px] rounded-2xl border-2 border-dashed border-[#b8a3f6]/20 flex items-center justify-center text-center bg-black/40 backdrop-blur-sm">
      <div>
        <p className="text-white/70 text-base font-semibold">No Previous Generation</p>
        <p className="text-xs text-white/40 mt-2">Go on... generate some spicy images!</p>
      </div>
    </div>
  );
}

function PromptGlyph({ className = "h-4 w-4 text-white/70" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.167 15.833h2.083l7.292-7.292-2.083-2.083-7.292 7.292v2.083Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m10.417 4.583 2.083 2.083" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ImageCountIcon({ value, active }: { value: number; active: boolean }) {
  const dotClass = active ? "bg-white" : "bg-white";

  if (value === 1) {
    return <span className={`h-[6px] w-[6px] rounded-[4px] ${dotClass}`} />;
  }

  if (value === 4) {
    return (
      <span className="grid h-[14px] w-[14px] grid-cols-2 gap-[2px]">
        {Array.from({ length: 4 }).map((_, index) => (
          <span key={index} className={`h-[6px] w-[6px] rounded-[4px] ${dotClass}`} />
        ))}
      </span>
    );
  }

  if (value === 16) {
    return (
      <span className="grid h-[30px] w-[30px] grid-cols-4 gap-[2px]">
        {Array.from({ length: 16 }).map((_, index) => (
          <span key={index} className={`h-[6px] w-[6px] rounded-[4px] ${dotClass}`} />
        ))}
      </span>
    );
  }

  if (value === 32) {
    return <img src={Count32Icon} alt="" className="h-6 w-6" aria-hidden />;
  }

  return (
    <span className="flex items-center gap-[2px]" aria-hidden>
      <img src={Count32Icon} alt="" className="h-5 w-5" />
      <img src={Count32Icon} alt="" className="h-5 w-5" />
    </span>
  );
}


// Replaced FilterMenu with simple gender/style filters

// Icons for number-of-images (project assets)
import PickCharacterIcon from "../assets/generate-image/PickCharacterIcon.svg?url";
import GenerateImageIcon from "../assets/generate-image/GenerateImageIcon.svg?url";
import PromptActionIcon from "../assets/prompt-action.svg?url";
import SceneTittyDrop from "../assets/figma/generate-image/scene-titty-drop.png";
import SceneMissionary from "../assets/figma/generate-image/scene-missionary.png";
import SceneDoggystyle from "../assets/figma/generate-image/scene-doggystyle.png";
import SceneBounceWalk from "../assets/figma/generate-image/scene-bounce-walk.png";
import SceneBlowjob from "../assets/figma/generate-image/scene-blowjob.png";
import SceneCowgirl from "../assets/figma/generate-image/scene-cowgirl.png";
import Count32Icon from "../assets/figma/generate-image/count-32.svg?url";

const FIGMA_SCENE_PRESETS: ScenePreset[] = [
  { imageUrl: SceneTittyDrop, label: "Titty drop", promptText: "Titty drop" },
  { imageUrl: SceneMissionary, label: "Missionary", promptText: "Missionary pose" },
  { imageUrl: SceneDoggystyle, label: "Doggystyle", promptText: "Doggystyle pose" },
  { imageUrl: SceneBounceWalk, label: "Bounce walk", promptText: "Bounce walk" },
  { imageUrl: SceneBlowjob, label: "Blowjob", promptText: "Blowjob pose" },
  { imageUrl: SceneCowgirl, label: "Cowgirl", promptText: "Cowgirl pose" },
];

const VIDEO_SCENE_POSE_MAP: Record<string, string> = {
  "Titty drop": "titfuck",
  "Missionary": "missionary_pov",
  "Doggystyle": "doggie",
  "Bounce walk": "bouncewalk",
  "Blowjob": "blowjob1",
  "Cowgirl": "cowgirl1",
};

const IMAGE_COUNT_OPTIONS = [1, 4, 16, 32, 64];

function CharacterPicker({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (c: Character) => void }) {
  if (!open) return null;
  // Theme tokens are applied via Card/Button primitives; no direct use here.
  // local UI state for filtering
  const [onlyMyAI, setOnlyMyAI] = useState(false);
  const [ageFilterEnabled] = useState(false);

  const [chars, setChars] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // styleFilter was intentionally removed from this picker — style filtering
  // is handled elsewhere (Homepage/MyAI). No local state required here.


  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.getDefaultCharacters();
        if (cancelled) return;
        // Ensure character ids are strings to match the local Character type
        const normalized = Array.isArray(data)
          ? data.map((it: any) => ({ ...it, id: it?.id != null ? String(it.id) : String(Math.random()).slice(2) }))
          : [];
        setChars(normalized as Character[]);
      } catch (err: any) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const visible = chars.filter((c) => {
    if (onlyMyAI) return false; // for now we don't have 'my ai' indicator from defaults
    if (ageFilterEnabled && (typeof c.age !== 'number' || c.age < 22)) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Fullscreen panel to match Figma: back button top-left, actions top-right */}
      <div className="absolute inset-0 bg-[#000000] ring-1 ring-white/10 p-6 overflow-y-auto">
        {/* Back button top-left */}
        <button
          onClick={onClose}
          aria-label="Back"
          className="absolute left-6 top-6 z-60 rounded-full bg-[#2b2b2b] p-2 flex items-center justify-center border border-white/5 text-(--sf-purple-light)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-(--sf-purple-light)">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="relative z-50 flex items-center justify-end gap-3">
          {/* Top-right actions styled to match Figma: greyish pill buttons */}
          <button
            type="button"
            onClick={() => setOnlyMyAI((s) => !s)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${onlyMyAI ? 'bg-(--sf-purple) text-white' : 'bg-[#3a3a3a] text-white/95'}`}
          >
            My AI
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {loading && (
            <div className="text-white/70">Loading characters…</div>
          )}

          {error && (
            <div className="text-red-400">Error loading characters: {error}</div>
          )}

          {!loading && !error && visible.map((c) => (
            <div
              key={String(c.id)}
              role="button"
              tabIndex={0}
              onClick={() => { onSelect(c as unknown as any); onClose(); }}
              className="cursor-pointer focus:outline-none"
            >
              <Card className="p-0 text-left">
                <div className="aspect-[3/4] w-full rounded-2xl bg-gray-800 overflow-hidden relative">
                  {c.image_url_s3 ? (
                    <img src={c.image_url_s3} alt={c.name || c.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/40">No image</div>
                  )}
                  {/* Bottom gradient and name/age overlay to match Figma */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
                  <div className="absolute left-4 bottom-3 right-4">
                    <div
                      className="text-(--sf-purple-light) font-semibold leading-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                      style={{ fontSize: '18px' }}
                    >
                      {(c.name || c.username) ? (
                        <>
                          <span>{c.name || c.username}</span>
                          {c.age != null && <span>{`, ${c.age}`}</span>}
                        </>
                      ) : (
                        c.age != null ? <span>{String(c.age)}</span> : null
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Main component
// ------------------------------------------------------------
export default function GenerateImage() {
  // useThemeStyles is available if needed for theme-based component tokens.
  const [gender, setGender] = useState<string>(() => {
    try { return localStorage.getItem('hl_gender') || 'Female'; } catch { return 'Female'; }
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [character, setCharacter] = useState<Character | null>(null);
  const [activeTab, setActiveTab] = useState<SuggestionTab>("Outfit");
  const [videoActiveTab, setVideoActiveTab] = useState<VideoSuggestionTab>("Scenes");
  // Video generation state
  const [mediaMode, setMediaMode] = useState<'image' | 'video'>('image');
  const [selectedVideoPose, setSelectedVideoPose] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(5);
  const [videoPrompt, setVideoPrompt] = useState<string>('');
  const [prompt, setPrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState(
    gender === 'Male'
      ? 'Portrait of a young man, wearing casual clothes, portrait picture, looking at the viewer with a smile'
      : '--no blur,--no watermark,--no extra limbs,--no distortion.'
  );
  // selection state removed; clicking thumbnails adds their label to prompt directly
  const [count, setCount] = useState<number>(1);
  // Local generated placeholders (kept for the 'Generate Now' flow)
  // Local placeholder images removed; rely solely on backend gallery
  // Images from backend (user's generated gallery)
  const { images: galleryImages, loading: galleryLoading, error: galleryError, refresh: refreshGallery } = useCharacterMedia();
  const displayedItems = useMemo(() => (galleryImages || []).slice(0, 9), [galleryImages]);
  // showAll removed — we'll show a maximum of 3 rows (9 items) and link to /gallery
  const [selectedAssetMap, setSelectedAssetMap] = useState<Record<SuggestionTab, string[]>>({ Outfit: [], Pose: [], Action: [], Accessories: [] });
  const [selectedScenePreset, setSelectedScenePreset] = useState<string | null>("Titty drop");
  const [viewer, setViewer] = useState<any | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const [openPromptMenu, setOpenPromptMenu] = useState<"image" | "video" | null>(null);
  const [videoSuggestionSelections, setVideoSuggestionSelections] = useState<Record<VideoSuggestionTab, string | null>>({
    Scenes: null,
    Background: null,
    Action: null,
  });
  const [selectedPromptCategoryByMode, setSelectedPromptCategoryByMode] = useState<{ image: string | null; video: string | null }>({
    image: null,
    video: null,
  });
  const [negOpen, setNegOpen] = useState(false);

  // Helper function to format category keys into human-readable labels
  // Converts snake_case to Title Case (e.g., "adult_female" -> "Adult Female")
  const formatCategoryLabel = (key: string): string => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get a random prompt from a specific category
  // Returns a random prompt string from the array of prompts for the given category
  const getRandomPromptFromCategory = (categoryKey: string, genderKey: 'female' | 'male'): string | null => {
    try {
      const categoryPrompts = (imageGenerationPrompts as any)[genderKey]?.[categoryKey];
      if (Array.isArray(categoryPrompts) && categoryPrompts.length > 0) {
        const randomIndex = Math.floor(Math.random() * categoryPrompts.length);
        return categoryPrompts[randomIndex];
      }
    } catch (e) {
      console.error('Error getting random prompt:', e);
    }
    return null;
  };

  // Get available prompt categories based on selected character gender
  // If character is female/trans, returns female categories
  // If character is male, returns male categories
  // If no character selected, returns all categories (female + male)
  const getAvailableCategories = (): Array<{ key: string; label: string; gender: 'female' | 'male' }> => {
    const categories: Array<{ key: string; label: string; gender: 'female' | 'male' }> = [];

    // Determine which gender categories to include (case-insensitive comparison)
    const charGender = character?.gender?.toLowerCase();
    const includeFemale = !character || charGender === 'female' || charGender === 'transgender';
    const includeMale = !character || charGender === 'male';

    // Add female categories if applicable
    if (includeFemale && imageGenerationPrompts.female) {
      Object.keys(imageGenerationPrompts.female).forEach(key => {
        categories.push({ key, label: formatCategoryLabel(key), gender: 'female' });
      });
    }

    // Add male categories if applicable
    if (includeMale && imageGenerationPrompts.male) {
      Object.keys(imageGenerationPrompts.male).forEach(key => {
        categories.push({ key, label: formatCategoryLabel(key), gender: 'male' });
      });
    }

    return categories;
  };

  // Handle prompt category selection
  // Randomly selects a prompt from the chosen category and updates the prompt textarea
  const applyPromptSelection = (mode: 'image' | 'video', nextPrompt: string, categoryKey: string) => {
    if (mode === 'image') {
      setPrompt(nextPrompt);
      // Reset selected suggestions when a prompt is selected from dropdown
      setSelectedAssetMap({ Outfit: [], Pose: [], Action: [], Accessories: [] });
    } else {
      setVideoPrompt(nextPrompt);
    }
    setSelectedPromptCategoryByMode((prev) => ({ ...prev, [mode]: categoryKey }));
    setOpenPromptMenu(null);
  };

  const handleCategorySelect = (
    modeOrCategoryKey: 'image' | 'video' | string,
    categoryOrGenderKey: string | 'female' | 'male',
    maybeGenderKey?: 'female' | 'male'
  ) => {
    const mode: 'image' | 'video' = maybeGenderKey ? (modeOrCategoryKey as 'image' | 'video') : 'image';
    const categoryKey = maybeGenderKey ? (categoryOrGenderKey as string) : (modeOrCategoryKey as string);
    const genderKey = (maybeGenderKey ?? categoryOrGenderKey) as 'female' | 'male';
    const randomPrompt = getRandomPromptFromCategory(categoryKey, genderKey);
    if (randomPrompt) {
      applyPromptSelection(mode, randomPrompt, categoryKey);
      return;
    }
    setOpenPromptMenu(null);
    setShowPrompts(false);
  };

  // Handle regenerate prompt action
  // If a category is selected, picks a new random prompt from that category
  // Otherwise, uses the existing randomPrompt function for backward compatibility
  const handleRegeneratePrompt = (mode: 'image' | 'video' = 'image') => {
    const selectedPromptCategory = selectedPromptCategoryByMode[mode];
    if (selectedPromptCategory) {
      // Determine gender key based on character (case-insensitive)
      // Trans characters use female prompts
      const genderKey: 'female' | 'male' =
        character?.gender?.toLowerCase() === 'male' ? 'male' : 'female';
      const randomPrompt = getRandomPromptFromCategory(selectedPromptCategory, genderKey);
      if (randomPrompt) {
        applyPromptSelection(mode, randomPrompt, selectedPromptCategory);
        return;
      }
    } else {
      const availableCategories = getAvailableCategories();
      if (availableCategories.length > 0) {
        const randomCategory = availableCategories[Math.floor(Math.random() * availableCategories.length)];
        const randomPrompt = getRandomPromptFromCategory(randomCategory.key, randomCategory.gender);
        if (randomPrompt) {
          applyPromptSelection(mode, randomPrompt, randomCategory.key);
          return;
        }
      }

      if (mode === 'image') {
        // Fallback to existing randomPrompt function if no category is available
        const outfit = selectedAssetMap.Outfit?.[0];
        const pose = selectedAssetMap.Pose?.[0];
        const action = selectedAssetMap.Action?.[0];
        const accessories = selectedAssetMap.Accessories || [];
        setPrompt(randomPrompt(outfit, pose, action, accessories));
      }
    }
    setOpenPromptMenu(null);
    setShowPrompts(false);
  };

  const handlePromptAction = (mode: 'image' | 'video') => {
    if (mode === 'video') {
      if (selectedVideoPose) {
        const vpPrompts = videoPosePrompts as Record<string, string>;
        setVideoPrompt(vpPrompts[selectedVideoPose] || videoPrompt);
        return;
      }
      handleRegeneratePrompt('video');
      return;
    }

    const hasSelectedAssets = Object.values(selectedAssetMap).some((items) => items.length > 0);
    if (selectedPromptCategoryByMode.image || hasSelectedAssets) {
      handleRegeneratePrompt('image');
      return;
    }

    if (prompt.trim()) {
      setPrompt((current) => current.trim());
      return;
    }

    handleRegeneratePrompt('image');
  };

  const renderPromptDropdown = (mode: 'image' | 'video') => {
    const isOpen = openPromptMenu === mode;
    const selectedCategory = selectedPromptCategoryByMode[mode];

    return (
      <div className="relative inline-block text-left">
        <Button
          variant="ghost"
          className="flex h-[36px] items-center gap-2 rounded-[10px] border border-white/10 px-[15px] text-[14px] text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          onClick={() => setOpenPromptMenu((current) => current === mode ? null : mode)}
          style={{ background: 'linear-gradient(180deg, #7f5af0 3.02%, #e53170 98.45%)' }}
        >
          <span>Prompts</span>
          <span className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-white/80" aria-hidden />
        </Button>
        {isOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-1 w-[280px] overflow-hidden rounded-[16px] border border-white/12 bg-[#050505] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.5)] sm:w-[296px]"
            style={{ maxHeight: 'min(420px, calc(100vh - 180px))' }}
          >
            <div className="max-h-[300px] space-y-1 overflow-y-auto pr-1 sm:max-h-[320px]">
              {getAvailableCategories().map((category) => {
                const isSelected = selectedCategory === category.key;
                return (
                  <button
                    key={`${mode}-${category.gender}-${category.key}`}
                    onClick={() => handleCategorySelect(mode, category.key, category.gender)}
                    className={`flex w-full items-center gap-3 rounded-[12px] px-4 py-3 text-left transition-colors duration-150 ${isSelected ? 'bg-[#815CF0] text-white' : 'text-white hover:bg-white/[0.04]'}`}
                  >
                    <span className="text-[18px] leading-none text-inherit">+</span>
                    <span className="text-[15px] font-medium leading-6 text-inherit">{category.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => handleRegeneratePrompt(mode)}
              className="mt-2 flex w-full items-center gap-3 rounded-[12px] border-t border-white/8 px-4 py-3 text-left text-[#815CF0] transition-colors duration-150 hover:bg-white/[0.04]"
            >
              <span className="text-[18px] leading-none">⥮</span>
              <span className="text-[15px] font-medium leading-6">Random Prompt</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const API_ORIGIN = getApiOrigin();
  const getOrigin = (u: string) => { try { return new URL(u, window.location.href).origin; } catch { return null; } };
  const isSameOrApiOrigin = (u: string | null) => { const o = getOrigin(u || ''); return o === window.location.origin || (API_ORIGIN && o === API_ORIGIN); };

  const getFilenameFromHeadersOrUrl = (res: Response | { headers?: any }, url: string | null) => {
    try {
      const cd = (res as any)?.headers?.get?.('content-disposition');
      if (cd) {
        const m = cd.match(/filename\*?=(?:UTF-8''|")?([^\";]+)\"?/i);
        if (m && m[1]) return decodeURIComponent(m[1].replace(/\"/g, ''));
      }
    } catch (e) { }
    return getFilenameFromUrl(url);
  };

  const downloadAndSave = async (url: string | null) => {
    if (!url) return;
    setDownloading(url);
    try {
      try {
        const opts: any = { method: 'GET', mode: 'cors', credentials: 'omit' };
        if (isSameOrApiOrigin(url)) {
          const headers: Record<string, string> = {};
          const t = localStorage.getItem('hl_token');
          if (t) headers['Authorization'] = `Bearer ${String(t).replace(/^bearer\s+/i, '').trim()}`;
          else if ((import.meta as any).env?.VITE_API_AUTH_TOKEN) {
            const envToken = String((import.meta as any).env.VITE_API_AUTH_TOKEN || '');
            headers['Authorization'] = envToken.match(/^Bearer\s+/i) ? envToken : `Bearer ${envToken}`;
          }
          opts.headers = headers;
          opts.credentials = 'include';
        }
        const res = await fetchWithAuth(url, opts);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        await saveBlob(blob, getFilenameFromHeadersOrUrl(res, url));
        return;
      } catch (err) {
        console.warn('Direct fetch failed (likely CORS). Will try proxy.', err);
      }

      try {
        const proxyBase = buildApiUrl('/characters/media/download-proxy');
        const proxyUrl = `${proxyBase}?url=${encodeURIComponent(url)}&name=${encodeURIComponent(getFilenameFromUrl(url))}`;
        const proxyHeaders: Record<string, string> = {};
        try {
          const t = localStorage.getItem('hl_token');
          if (t) proxyHeaders['Authorization'] = `Bearer ${String(t).replace(/^bearer\s+/i, '').trim()}`;
          else if ((import.meta as any).env?.VITE_API_AUTH_TOKEN) {
            const envToken = String((import.meta as any).env.VITE_API_AUTH_TOKEN || '');
            proxyHeaders['Authorization'] = envToken.match(/^Bearer\s+/i) ? envToken : `Bearer ${envToken}`;
          }
        } catch (e) { }
        const pres = await fetchWithAuth(proxyUrl, { method: 'GET', credentials: 'omit', headers: proxyHeaders });
        if (!pres.ok) {
          const txt = await pres.text().catch(() => null);
          console.error('Proxy response status/text:', pres.status, txt);
          throw new Error(`Proxy HTTP ${pres.status}`);
        }
        const blob = await pres.blob();
        await saveBlob(blob, getFilenameFromHeadersOrUrl(pres as any, url));
        return;
      } catch (err2) {
        console.error('Proxy fetch failed:', err2);
        try { showError('Download failed', 'Ensure S3 CORS is set OR the /characters/media/download-proxy route is enabled. Check proxy auth and logs.'); } catch { /* fallback */ }
      }
    } finally {
      setDownloading(null);
    }
  };

  // const canGenerate = useMemo(() => !!character, [character]); // not needed for UI enable/disable anymore
  const { token } = useAuth();
  const [generating, setGenerating] = useState(false);
  const { showError } = useToastActions();
  const location = useLocation();
  const navigate = useNavigate();


  // If navigated from chat/selector, hydrate character and preserve the active media mode.
  useEffect(() => {
    try {
      const navMode = (location.state as any)?.mediaMode;
      if (navMode === 'image' || navMode === 'video') {
        setMediaMode(navMode);
      }
      const navChar = (location.state as any)?.character;
      if (navChar) {
        // normalize minimal shape to Character type
        setCharacter({
          id: String(navChar.id),
          name: navChar.name || navChar.username,
          username: navChar.username || navChar.name,
          bio: navChar.bio ?? null,
          age: navChar.age ?? (navChar as any).age_in_years ?? null,
          image_url_s3: navChar.image_url_s3 || navChar.imageUrl || null,
          webp_image_url_s3: navChar.webp_image_url_s3 || null,
          gif_url_s3: navChar.gif_url_s3 || null,
          animated_webp_url_s3: navChar.animated_webp_url_s3 || null,
          gender: (navChar as any).gender || null,
          style: (navChar as any).style || null,
          art_style: (navChar as any).art_style || null,
        } as Character);
      }
    } catch (e) { }
  }, [location.state]);

  const addToPrompt = (text: string) => {
    setPrompt((p) => {
      if (!p) return text;
      // Avoid duplicates
      const parts = p.split(",").map((s) => s.trim());
      if (parts.includes(text)) return p;
      return `${p}, ${text}`;
    });
  };

  // thumbnails now add labels directly via addToPrompt

  const generate = async () => {
    // Check if user is authenticated before proceeding
    if (!token) {
      // Redirect to login page with return location
      navigate('/login', { state: { from: location } });
      return;
    }

    // Build payload matching backend ImageCreate schema.
    // Allow generation even when no character is selected — backend will accept missing character fields.
    const payload: any = {
      outfit: (selectedAssetMap.Outfit && selectedAssetMap.Outfit[0]) || undefined,
      pose: (selectedAssetMap.Pose && selectedAssetMap.Pose[0]) || undefined,
      action: (selectedAssetMap.Action && selectedAssetMap.Action[0]) || selectedScenePreset || undefined,
      accessories: (selectedAssetMap.Accessories || []).join(', ') || undefined,
      prompt: prompt || undefined,
      num_images: Number(count || 1),
    } as any;

    // Always include these keys. If no character is selected, send explicit nulls
    payload.character_id = character?.id ? String(character.id) : null;
    payload.name = `${character?.name || (character as any)?.username || 'anonymous'}-${Date.now()}`;
    const maybeImage = (
      (character as any)?.webp_image_url_s3 ||
      (character as any)?.image_url_s3 ||
      getMediaUrl(character as any) ||
      (character as any)?.image_url ||
      (character as any)?.animated_webp_url_s3 ||
      (character as any)?.gif_url_s3
    ) as string | undefined;
    payload.image_s3_url = maybeImage || null;

    setGenerating(true);
    try {
      // Ensure apiClient has token (AuthContext normally sets this). As a fallback set it here from localStorage
      try { if (token) apiClient.setAccessToken(token); else apiClient.setAccessToken(localStorage.getItem('hl_token')) } catch { }

      await apiClient.createCharacterImage(payload as any);
      // refresh backend gallery to show created images when available
      try { await refreshGallery(); } catch { }
      // Stay on this page (no navigation) per requirements
    } catch (err: any) {
      try {
        const status = (err && typeof err.status === 'number') ? err.status : (err && (err as any).status) || 0;

        if (status >= 400 && status < 500) {
          // Prefer backend-provided `detail` or `message` when available
          const detail = err?.body?.detail ?? err?.body?.message ?? err?.detail ?? err?.message ?? getErrorMessage(err);
          showError('Failed to generate image', detail);
        } else if (status === 503) {
          // Service unavailable - likely guardrails down
          const detail = err?.body?.detail ?? err?.body?.message ?? 'Content safety check unavailable. Please try again later.';
          showError('Failed to generate image', detail);
        } else if (status >= 500) {
          // Generic server-side message for 5xx
          // Log so we can confirm the 5xx branch is reached in console during testing
          try { console.warn('GenerateImage: server error', status, err?.body ?? err); } catch { }
          showError('Failed to generate image', 'Unable to process your request currently.');
        } else {
          // Fallback for network/unknown errors
          showError('Failed to generate image', getErrorMessage(err));
        }
      } catch (e) {
        try { showError('Failed to generate image', getErrorMessage(err)); } catch { }
      }
    } finally {
      setGenerating(false);
    }
  };

  // ===== VIDEO GENERATION HANDLER =====
  const generateVideo = async () => {
    if (!token) {
      navigate('/login', { state: { from: location } });
      return;
    }
    if (!character) {
      showError('Character required', 'Please select a character before generating a video.');
      return;
    }
    if (!selectedVideoPose) {
      showError('Pose required', 'Please select a pose for the video.');
      return;
    }

    setGenerating(true);
    try {
      try { if (token) apiClient.setAccessToken(token); else apiClient.setAccessToken(localStorage.getItem('hl_token')); } catch { }

      const payload = {
        character_id: String(character.id),
        name: `${character.name || (character as any)?.username || 'video'}-${Date.now()}`,
        prompt: videoPrompt || undefined,
        duration: videoDuration,
        image_url: (
          character.webp_image_url_s3 ||
          character.image_url_s3 ||
          character.animated_webp_url_s3 ||
          character.gif_url_s3 ||
          undefined
        ),
        pose_name: selectedVideoPose,
        character_name: character.name || undefined,
        character_gender: character.gender || undefined,
        character_style: character.style || character.art_style || undefined,
      };

      await apiClient.createVideo(payload);
      showError('Video generation started! 🎬', 'Your video is being processed and will appear in your gallery shortly.');
      try { await refreshGallery(); } catch { }
    } catch (err: any) {
      const detail = err?.body?.detail ?? err?.message ?? getErrorMessage(err);
      showError('Failed to generate video', detail);
    } finally {
      setGenerating(false);
    }
  };

  // when a character is selected, set gender and persist
  useEffect(() => {
    if (character?.gender) {
      setGender(character.gender);
      try { genderService.setGender(character.gender); } catch { }
    }
  }, [character]);

  // Auto-populate prompt when selected assets change
  useEffect(() => {
    const outfit = selectedAssetMap.Outfit?.[0];
    const pose = selectedAssetMap.Pose?.[0];
    const action = selectedAssetMap.Action?.[0];
    const accessories = selectedAssetMap.Accessories || [];

    // Only auto-fill if we have at least one of outfit/pose/action selected
    if (outfit || pose || action || (accessories && accessories.length > 0)) {
      const built = randomPrompt(outfit, pose, action, accessories);
      setPrompt(built);
    }
  }, [selectedAssetMap]);

  // update negPrompt when gender changes
  useEffect(() => {
    setNegPrompt(
      gender === 'Male'
        ? 'Portrait of a young man, wearing casual clothes, portrait picture, looking at the viewer with a smile'
        : '--no blur,--no watermark,--no extra limbs,--no distortion.'
    );
  }, [gender]);

  useEffect(() => {
    function onGender(e: any) {
      const g = e?.detail || (typeof e === 'string' ? e : null);
      if (g) setGender(g);
    }
    window.addEventListener('hl_gender_changed', onGender as EventListener);
    return () => window.removeEventListener('hl_gender_changed', onGender as EventListener);
  }, []);

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Fullscreen viewer navigation (similar to Gallery)
  const findViewerIndex = (v = viewer) => {
    if (!v || !Array.isArray(displayedItems)) return -1;
    return displayedItems.findIndex((it: any) => {
      try {
        if (v.id != null && it.id != null) return String(it.id) === String(v.id);
        const a = getMediaUrl(it);
        const b = getMediaUrl(v);
        return a && b && String(a) === String(b);
      } catch (e) {
        return false;
      }
    });
  };

  const goPrev = () => {
    const idx = findViewerIndex();
    if (idx > 0) setViewer(displayedItems[idx - 1]);
  };

  const goNext = () => {
    const idx = findViewerIndex();
    if (idx >= 0 && idx < displayedItems.length - 1) setViewer(displayedItems[idx + 1]);
  };

  // Keyboard navigation for viewer
  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      if (e.key === 'Escape') { setViewer(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer, displayedItems]);

  const pageHeading = "text-xl sm:text-2xl font-semibold leading-7 text-white";
  // const pageSub = `text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`; // unused
  const pageShellClass = "mx-auto w-full max-w-6xl px-1 sm:px-4 md:px-0 pt-2 pb-8 sm:pt-4 sm:pb-12 md:pb-20";
  const desktopGridClass = "mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12 xl:gap-8";
  const tabBaseClass = "flex h-10 sm:h-12 items-center justify-center rounded-lg text-sm sm:text-base font-medium transition-all px-6";
  const cardSurfaceClass = "rounded-2xl bg-white/[0.05] ring-1 ring-white/10";
  const panelTitleClass = "text-lg sm:text-xl font-semibold leading-7 text-white";
  const imageTabAssets = getImageSuggestionAssets(activeTab, gender || 'Female');
  const videoTabAssets =
    videoActiveTab === "Background"
      ? getVideoBackgroundAssets()
      : videoActiveTab === "Action"
        ? getImageSuggestionAssets("Action", gender || 'Female')
        : [];

  return (
    // reduce outer left/right padding to minimize space between sidebar and content
    <div className={pageShellClass}>
      {/* primary container (no secondary wrapper) */}
      <div className={`flex flex-col min-h-[60vh]`}>
        {/* Title + mirrored right heading to match Figma desktop composition */}
        <div className="grid grid-cols-1 gap-6 px-1 lg:px-0 xl:grid-cols-[minmax(0,400px)_minmax(1fr)] xl:gap-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1f1f1f] ring-1 ring-white/5 sm:h-10 sm:w-10"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white sm:h-4 sm:w-4">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div>
              <h1 className={pageHeading}>{mediaMode === 'video' ? 'Generate AI NSFW Video' : 'Generate AI NSFW Image'}</h1>
            </div>
          </div>

          <div className="hidden xl:block">
            <h2 className={panelTitleClass}>{mediaMode === 'video' ? 'Generated Video' : 'Generated Images & Videos'}</h2>
            <p className="mt-3 text-[16px] leading-6 text-white/60">
              Your previously generated images. They are stored forever.
            </p>
          </div>

          {/* Image/Video toggle */}
          <div className="hidden items-center gap-0 mt-2 px-1 sm:px-6">
            <button
              onClick={() => setMediaMode('image')}
              className={`px-5 py-2 text-sm font-semibold rounded-l-full border transition-all ${
                mediaMode === 'image'
                  ? 'bg-[var(--primary,#FFC54D)] text-black border-[var(--primary,#FFC54D)]'
                  : 'bg-[#1a1a1a] text-white/70 border-white/10 hover:bg-[#2a2a2a]'
              }`}
            >
              🖼️ Image
            </button>
            <button
              onClick={() => setMediaMode('video')}
              className={`px-5 py-2 text-sm font-semibold rounded-r-full border border-l-0 transition-all ${
                mediaMode === 'video'
                  ? 'bg-[var(--primary,#FFC54D)] text-black border-[var(--primary,#FFC54D)]'
                  : 'bg-[#1a1a1a] text-white/70 border-white/10 hover:bg-[#2a2a2a]'
              }`}
            >
              🎬 Video
            </button>
          </div>
        </div>

        {/* ===== VIDEO MODE ===== */}
        {mediaMode === 'video' && (
          <div className={desktopGridClass}>
            {/* Left – Controls (50%) */}
            <div className="lg:col-span-6 space-y-3 sm:space-y-6">
              <div className="rounded-[12px] bg-[rgba(255,255,255,0.08)] p-[3px] ring-1 ring-white/6">
                <div className="grid grid-cols-2 gap-[3px]">
                  <button
                    onClick={() => setMediaMode('image')}
                    className={`${tabBaseClass} bg-[#232323] text-white/72`}
                  >
                    Image
                  </button>
                  <button
                    onClick={() => setMediaMode('video')}
                    className={tabBaseClass}
                    style={{ background: "linear-gradient(180deg, #7f5af0 0%, #9d66ff 100%)" }}
                  >
                    <span className="text-white">Video</span>
                  </button>
                </div>
              </div>

              {/* Character & Prompt matches Image mode sizing */}
              <div className="px-1 sm:px-6 py-0 min-h-0 relative">
                <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-4">
                  <div className="sm:min-w-[144px]">
                    {!character ? (
                      <button onClick={() => navigate('/generate-image/characters', { state: { mediaMode: 'video' } })} className="h-[144px] w-[144px]">
                        <Card
                          noBase
                          className={`h-[144px] w-[144px] min-h-0 flex items-center justify-center rounded-2xl border-[1.8px] border-dashed border-[#B8A3F6] p-3 ${isDark ? 'bg-black' : 'bg-white'}`}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/6 ring-1 ring-white/10 text-white">
                              <img src={PickCharacterIcon} alt="Pick character" className="h-8 w-8" />
                            </div>
                            <div
                              className="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium text-white shadow-md"
                              style={{ background: 'linear-gradient(180deg, #7F5AF0 0%, #9D66FF 100%)' }}
                            >
                              Pick a Character
                            </div>
                          </div>
                        </Card>
                      </button>
                    ) : (
                      <Card
                        noBase
                        className="relative h-[144px] w-[144px] overflow-hidden rounded-2xl border border-[#B8A3F6]/60 shadow-sm p-0 min-h-0"
                      >
                        {character.image_url_s3 ? (
                          <img src={character.image_url_s3} alt={character.name || ''} className="h-full w-full object-cover object-top" />
                        ) : (
                          <div className="h-full w-full bg-[linear-gradient(135deg,rgba(127,90,240,0.45),rgba(0,0,0,0))]" />
                        )}
                        <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
                          <div className="truncate text-left text-sm font-medium text-white/95 leading-tight">
                            {character.name || 'Selected'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/generate-image/characters', { state: { mediaMode: 'video' } })}
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow-sm hover:bg-black/80 transition-colors"
                        >
                          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16.667 9.167a6.667 6.667 0 1 0-1.95 4.717" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M16.667 4.167v5h-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </Card>
                    )}
                  </div>

                  <Card className="flex-1 min-h-[120px] p-4 rounded-2xl w-full bg-white/[0.05] ring-1 ring-white/10">
                    <textarea
                      readOnly
                      value={videoPrompt}
                      placeholder="Prompt is auto-generated for videos"
                      className="w-full h-full resize-none bg-transparent text-[13px] sm:text-sm text-white/80 placeholder-white/20 focus:outline-none"
                    />
                  </Card>
                </div>

                <div className="absolute right-3 bottom-2 sm:right-10 sm:bottom-3">
                  {renderPromptDropdown('video')}
                </div>
              </div>

              {/* Negative Prompt - matches Image mode style */}
              <div className="px-1 sm:px-6 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-normal text-white">Negative Prompt (what to avoid in the video)</label>
                  <button
                    type="button"
                    onClick={() => setNegOpen((s) => !s)}
                    className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white px-2 py-1 rounded-md"
                  >
                    <span>{negOpen ? 'Hide' : 'Show'}</span>
                    <svg className={`w-4 h-4 transform transition-transform ${negOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                
                {negOpen && (
                  <textarea
                    value={negPrompt}
                    onChange={(e) => setNegPrompt(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl bg-black/40 px-4 py-3 text-[13px] sm:text-sm text-white placeholder-white/30 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-[#7f5af0]"
                  />
                )}
              </div>

              {/* Suggestions - matches Image mode style */}
              <div className="px-1 sm:px-6 space-y-3">
                <label className="block text-sm font-semibold text-white">Suggestions</label>
                <div className="flex flex-wrap items-center gap-3">
                  {(["Scenes", "Background", "Action"] as VideoSuggestionTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setVideoActiveTab(tab)}
                      className={`flex h-8 sm:h-9 items-center justify-center rounded-lg border px-4 text-xs sm:text-sm transition-all ${videoActiveTab === tab
                        ? "border-transparent text-white"
                        : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                      }`}
                      style={videoActiveTab === tab ? { background: '#7f5af0' } : undefined}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-0 overflow-x-auto overflow-y-visible pb-2 gen-scrollbar">
                  {videoActiveTab === "Scenes" ? (
                    FIGMA_SCENE_PRESETS.map((scene) => {
                      const mappedPoseKey = VIDEO_SCENE_POSE_MAP[scene.label];
                      return (
                        <button
                          key={scene.label}
                          className="relative inline-flex shrink-0 flex-col items-center overflow-visible px-0.5"
                          onClick={() => {
                            const vpPrompts = videoPosePrompts as Record<string, string>;
                            setVideoSuggestionSelections((prev) => ({ ...prev, Scenes: scene.label }));
                            if (mappedPoseKey) {
                              setSelectedVideoPose(mappedPoseKey);
                              setVideoPrompt(vpPrompts[mappedPoseKey] || scene.promptText);
                            } else {
                              setVideoPrompt(scene.promptText);
                            }
                          }}
                        >
                          <Thumb label={scene.label} selected={videoSuggestionSelections.Scenes === scene.label || selectedVideoPose === mappedPoseKey} imageUrl={scene.imageUrl} />
                        </button>
                      );
                    })
                  ) : (
                    videoTabAssets.map((asset) => (
                      <button
                        key={asset.url}
                        className="relative inline-flex shrink-0 flex-col items-center overflow-visible px-0.5"
                        onClick={() => {
                          setVideoSuggestionSelections((prev) => {
                            const nextValue = prev[videoActiveTab] === asset.label ? null : asset.label;
                            return { ...prev, [videoActiveTab]: nextValue };
                          });
                          setVideoPrompt((prev) => {
                            const trimmed = prev.trim();
                            if (!trimmed) return asset.label;
                            return trimmed.toLowerCase().includes(asset.label.toLowerCase()) ? trimmed : `${trimmed}, ${asset.label}`;
                          });
                        }}
                      >
                        <Thumb
                          label={asset.label}
                          selected={videoSuggestionSelections[videoActiveTab] === asset.label}
                          imageUrl={asset.url}
                        />
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Length - matches Image mode button style */}
              <div className="px-1 sm:px-6 space-y-3">
                <label className="block text-sm font-normal text-white">Length</label>
                <div className="grid grid-cols-2 gap-4">
                  {[5, 10].map((d) => {
                    const active = videoDuration === d;
                    return (
                      <button
                        key={d}
                        onClick={() => setVideoDuration(d)}
                        className={`inline-flex h-8 sm:h-9 items-center justify-center gap-2 rounded-lg border text-xs sm:text-sm font-semibold transition-all ${
                          active
                            ? 'border-[#7f5af0] text-white'
                            : 'border-white/10 bg-[#141414] text-white hover:bg-[#181818]'
                        }`}
                        style={active ? { background: 'rgba(127,90,240,0.3)' } : undefined}
                      >
                        <span className="leading-none">{d}s</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Generate Video button matches Image mode sizing */}
              <div className="px-1 sm:px-6 pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={generateVideo}
                  disabled={generating || !character || !selectedVideoPose}
                  className="flex h-10 sm:h-12 w-full items-center justify-center gap-2 rounded-full text-sm sm:text-base font-semibold border border-white/20"
                  style={{
                    background: 'linear-gradient(90deg, #7F5AF0 0%, #9D66FF 100%)',
                    boxShadow: '0 4px 15px rgba(127,90,240,0.3)'
                  }}
                >
                  {generating ? (
                    <span className="inline-flex items-center gap-2"><IconSpinner className="w-4 h-4 animate-spin" />Generating...</span>
                  ) : (
                    <>
                      <img src={GenerateImageIcon} alt="" className="h-5 w-5 sm:h-6 sm:w-6" />
                      <span>Generate Now</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Right – Generated Media (reuses Image mode logic) */}
            <div className="lg:col-span-6 lg:-mt-10">
              <div className="px-0 mb-3 block xl:hidden">
                <h3 className={panelTitleClass}>Generated Video</h3>
                <p className="mt-1 text-xs text-white/50">Your previously generated media. They are stored forever.</p>
              </div>
              <div className="px-0 mt-0">
                {galleryLoading ? (
                  <div className="text-white/70">Loading...</div>
                ) : galleryError ? (
                  /no media found/i.test(String(galleryError)) ? (
                    <EmptyGenerated />
                  ) : (
                    <div className="text-red-400">Error loading media: {galleryError}</div>
                  )
                ) : (
                  <>
                    {(galleryImages && galleryImages.length > 0) ? (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {displayedItems.map((img: any, idx: number) => {
                            const url = getMediaUrl(img) || img?.s3_path_gallery || img?.s3_path || img?.image_url_s3 || img?.image_url || img?.url || img?.path || img?.thumbnail || null;
                            const key = img?.id ? String(img.id) : `img-${idx}`;
                            const isVideo = ((img.mime_type || img.content_type || '') || '').toString().startsWith('video') || (url && /\.(mp4|webm|ogg)$/i.test(url));

                            return (
                              <div key={key} className="rounded-xl overflow-hidden border border-white/10 relative group">
                                <button type="button" onClick={() => setViewer(img)} className="w-full block">
                                  {url ? (
                                    isVideo ? (
                                      <video src={url} className="w-full aspect-[4/5] object-cover block" muted preload="metadata" />
                                    ) : (
                                      <img src={url} alt={`Generated ${idx + 1}`} className="w-full aspect-[4/5] object-cover block" />
                                    )
                                  ) : (
                                    <div className="aspect-[4/5] bg-black/20" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); if (url) downloadAndSave(url); }}
                                  className="absolute right-2 bottom-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                  aria-label="Download"
                                  disabled={!url || !!(downloading && url && downloading === url)}
                                >
                                  {!!(downloading && url && downloading === url) ? (
                                    <IconSpinner className="w-4 h-4 text-white animate-spin" />
                                  ) : (
                                    <IconDownload className="w-4 h-4 text-white" />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {galleryImages.length > 9 && (
                          <div className="mt-4 flex justify-center">
                            <button
                              type="button"
                              className="text-xs font-semibold text-white px-5 py-2.5 rounded-full border border-white/10 hover:bg-white/5 transition-colors"
                              style={{
                                background: 'linear-gradient(90deg, #7F5AF0 0%, #9D66FF 100%)',
                              }}
                              onClick={() => navigate('/gallery')}
                            >
                              View more
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <EmptyGenerated />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== IMAGE MODE (original controls + gallery) ===== */}
        {mediaMode === 'image' && (
        <div className={desktopGridClass}>
          {/* Left – Controls (50%) */}
          <div className="lg:col-span-6 space-y-3 sm:space-y-6">
            <div className="rounded-[12px] bg-[rgba(255,255,255,0.08)] p-[3px] ring-1 ring-white/6">
              <div className="grid grid-cols-2 gap-[3px]">
                <button
                  onClick={() => setMediaMode('image')}
                  className={tabBaseClass}
                  style={{ background: "linear-gradient(180deg, #7f5af0 0%, #9d66ff 100%)" }}
                >
                  <span className="text-white">Image</span>
                </button>
                <button
                  onClick={() => setMediaMode('video')}
                  className={`${tabBaseClass} bg-[#232323] text-white/72`}
                >
                  Video
                </button>
              </div>
            </div>

            {/* Character & Prompt */}
            <div className="px-1 sm:px-6 py-0 min-h-0 relative">
              <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-4">
                <div className="sm:min-w-[144px]">
                  {!character ? (
                    <button onClick={() => navigate('/generate-image/characters')} className="h-[144px] w-[144px]">
                      <Card
                        noBase
                        className={`h-[144px] w-[144px] min-h-0 flex items-center justify-center rounded-2xl border-[1.8px] border-dashed border-[#B8A3F6] p-3 ${isDark ? 'bg-black' : 'bg-white'}`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="grid h-12 w-12 place-items-center rounded-full bg-white/6 ring-1 ring-white/10 text-white">
                            <img src={PickCharacterIcon} alt="Pick character" className="h-8 w-8" />
                          </div>
                          <div
                            className="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium text-white shadow-md"
                            style={{ background: 'linear-gradient(180deg, #7F5AF0 0%, #9D66FF 100%)' }}
                          >
                            Pick a Character
                          </div>
                        </div>
                      </Card>
                    </button>
                  ) : (
                    <Card
                      noBase
                      className="relative h-[144px] w-[144px] overflow-hidden rounded-2xl border border-[#B8A3F6]/60 shadow-sm p-0 min-h-0"
                    >
                      {character.image_url_s3 ? (
                        <img src={character.image_url_s3} alt={character.name || character.username} className="h-full w-full object-cover object-top" />
                      ) : (
                        <div className="h-full w-full bg-[linear-gradient(135deg,rgba(127,90,240,0.45),rgba(0,0,0,0))]" />
                      )}
                      {/* Name overlay matches HL simplified style */}
                      <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
                        <div className="truncate text-left text-sm font-medium text-white/95 leading-tight">
                          {character.name || character.username}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/generate-image/characters')}
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow-sm hover:bg-black/80 transition-colors"
                      >
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M16.667 9.167a6.667 6.667 0 1 0-1.95 4.717" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M16.667 4.167v5h-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </Card>
                  )}
                </div>

                {/* Prompt container matches HL sizing */}
                <Card className="flex-1 min-h-[120px] p-4 rounded-2xl w-full bg-white/[0.05] ring-1 ring-white/10">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    placeholder="Describe the image you want to generate..."
                    className="w-full h-full resize-none bg-transparent text-[13px] sm:text-sm text-white placeholder-white/35 focus:outline-none"
                  />
                </Card>
              </div>

              {/* Prompts button matches HL position relative to the cards */}
              <div className="absolute right-3 bottom-2 sm:right-10 sm:bottom-3">
                {renderPromptDropdown('image')}
              </div>
            </div>

            {/* Negative Prompt (matches HL spacing) */}
            <div className="px-1 sm:px-6 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-normal text-white">Negative Prompt (what to avoid in the image)</label>
                <button
                  type="button"
                  onClick={() => setNegOpen((s) => !s)}
                  className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white px-2 py-1 rounded-md"
                >
                  <span>{negOpen ? 'Hide' : 'Show'}</span>
                  <svg className={`w-4 h-4 transform transition-transform ${negOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              
              {negOpen && (
                <textarea
                  value={negPrompt}
                  onChange={(e) => setNegPrompt(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl bg-black/40 px-4 py-3 text-[13px] sm:text-sm text-white placeholder-white/30 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-[#7f5af0]"
                />
              )}
            </div>

            {/* Suggestions - matches HL spacing and sizing */}
            <div className="px-1 sm:px-6 space-y-3">
              <label className="block text-sm font-semibold text-white">Suggestions</label>
              <div className="flex flex-wrap items-center gap-3">
                {(["Outfit", "Pose", "Action", "Accessories"] as SuggestionTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex h-8 sm:h-9 items-center justify-center rounded-lg border px-4 text-xs sm:text-sm transition-all ${activeTab === tab
                      ? "border-transparent text-white"
                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                    style={activeTab === tab ? { background: '#7f5af0' } : undefined}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-0 overflow-x-auto overflow-y-visible pb-2 gen-scrollbar">
                {imageTabAssets.map((asset) => {
                  const currentKey = activeTab;
                  return (
                    <button
                      key={asset.url}
                      className="relative inline-flex shrink-0 flex-col items-center overflow-visible px-0.5"
                      onClick={() => {
                        setSelectedAssetMap((m) => {
                          const prev = m[currentKey] || [];
                          // Accessories can be multi-select; others are single-select
                          if (currentKey === 'Accessories') {
                            const exists = prev.includes(asset.label);
                            const next = exists ? prev.filter((x) => x !== asset.label) : [...prev, asset.label];
                            return { ...m, [currentKey]: next };
                          }
                          const isSame = prev[0] === asset.label;
                          return { ...m, [currentKey]: isSame ? [] : [asset.label] };
                        });
                      }}
                    >
                      <Thumb label={asset.label} selected={(selectedAssetMap[currentKey] || []).includes(asset.label)} imageUrl={asset.url} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Number of images - matches HL grid gap and button style */}
            <div className="px-1 sm:px-6 space-y-3">
              <label className="block text-sm font-normal text-white">Number of images</label>

              <div className="grid grid-cols-5 gap-3">
                {IMAGE_COUNT_OPTIONS.map((n) => {
                  const active = count === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setCount(n)}
                      className={`inline-flex h-8 sm:h-9 items-center justify-center gap-2 rounded-lg border text-xs sm:text-sm font-semibold transition-all ${active
                        ? 'border-[#7f5af0] text-white'
                        : 'border-white/10 bg-[#141414] text-white hover:bg-[#181818]'
                      }`}
                      style={active ? { background: 'rgba(127,90,240,0.3)' } : undefined}
                    >
                      <img src={GenerateImageIcon} alt="" className="h-4 w-4" aria-hidden />
                      <span>{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Generate button: matches HL thinner height and full width */}
            <div className="px-1 sm:px-6 pt-2">
              <Button
                variant="primary"
                size="md"
                className="flex h-10 sm:h-12 w-full items-center justify-center gap-2 rounded-full text-sm sm:text-base font-semibold border border-white/20"
                onClick={generate}
                disabled={generating}
                style={{
                  background: 'linear-gradient(90deg, #7F5AF0 0%, #9D66FF 100%)',
                  boxShadow: '0 4px 15px rgba(127,90,240,0.3)'
                }}
              >
                {generating ? (
                  <span className="inline-flex items-center gap-2"><IconSpinner className="w-4 h-4 animate-spin" />Generating...</span>
                ) : (
                  <>
                    <img src={GenerateImageIcon} alt="" className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span>Generate Now</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right – Generated Images (50%) */}
          <div className="lg:col-span-6 lg:-mt-10">
            <div className="px-0 mb-3 block xl:hidden">
              <h3 className={panelTitleClass}>Generated Images &amp; Videos</h3>
              <p className="mt-1 text-xs text-white/50">Your previously generated media. They are stored forever.</p>
            </div>
            <div className="px-0 mt-0">
              {galleryLoading ? (
                <div className="text-white/70">Loading images…</div>
              ) : galleryError ? (
                /no media found/i.test(String(galleryError)) ? (
                  <EmptyGenerated />
                ) : (
                  <div className="text-red-400">Error loading images: {galleryError}</div>
                )
              ) : (
                <>
                  {(galleryImages && galleryImages.length > 0) ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {displayedItems
                          .map((img: any, idx: number) => {
                            const url = getMediaUrl(img) || img?.s3_path_gallery || img?.s3_path || img?.image_url_s3 || img?.image_url || img?.url || img?.path || img?.thumbnail || null;
                            const key = img?.id ? String(img.id) : `img-${idx}`;
                            const isVideo = ((img.mime_type || img.content_type || '') || '').toString().startsWith('video') || (url && /\.(mp4|webm|ogg)$/i.test(url));

                            return (
                              <div key={key} className="rounded-xl overflow-hidden border border-white/10 relative group">
                                <button type="button" onClick={() => setViewer(img)} className="w-full block">
                                  {url ? (
                                    isVideo ? (
                                      <video src={url} className="w-full aspect-[4/5] object-cover block" muted preload="metadata" />
                                    ) : (
                                      <img src={url} alt={`Generated ${idx + 1}`} className="w-full aspect-[4/5] object-cover block" />
                                    )
                                  ) : (
                                    <div className="aspect-[4/5] bg-black/20" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); if (url) downloadAndSave(url); }}
                                  className="absolute right-2 bottom-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                  aria-label="Download"
                                  disabled={!url || !!(downloading && url && downloading === url)}
                                >
                                  {!!(downloading && url && downloading === url) ? (
                                    <IconSpinner className="w-4 h-4 text-white animate-spin" />
                                  ) : (
                                    <IconDownload className="w-4 h-4 text-white" />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                      </div>

                      {galleryImages.length > 9 && (
                        <div className="mt-4 flex justify-center">
                          <button
                            type="button"
                            className="text-xs font-semibold text-white px-5 py-2.5 rounded-full border border-white/10 hover:bg-white/5 transition-colors"
                            style={{
                              background: 'linear-gradient(90deg, #7F5AF0 0%, #9D66FF 100%)',
                            }}
                            onClick={() => navigate('/gallery')}
                          >
                            View more
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <EmptyGenerated />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Character picker */}
      <CharacterPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(c) => setCharacter(c)} />
      {viewer && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6">
          <div className="max-w-[90vw] max-h-[90vh] w-full">
            <div className="mb-3 flex justify-end gap-2">
              <button onClick={() => { setViewer(null); }} className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm transition-colors">Close</button>
              {(() => {
                const viewerUrl = getMediaUrl(viewer) || null;
                const isCurDownloading = !!(viewerUrl && downloading && downloading === viewerUrl);
                return (
                  <button
                    onClick={() => viewerUrl && downloadAndSave(viewerUrl)}
                    className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm transition-colors disabled:opacity-50"
                    disabled={!viewerUrl || isCurDownloading}
                  >
                    {isCurDownloading ? (
                      <span className="inline-flex items-center gap-2"><IconSpinner className="w-4 h-4 text-white animate-spin" />Downloading…</span>
                    ) : (
                      'Download'
                    )}
                  </button>
                );
              })()}
            </div>

            {/* Layout media with Prev/Next as siblings so buttons sit next to the image regardless of global absolute rules */}
            <div className="w-full flex items-center justify-center">
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => goPrev()}
                  disabled={findViewerIndex() <= 0}
                  className="rounded-full bg-black/30 p-2 text-white hover:bg-black/50 disabled:opacity-40"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <div className="relative">
                  {((viewer.mime_type || viewer.content_type || '').toString().startsWith('video')) ? (
                    <video src={getMediaUrl(viewer) || ''} controls autoPlay className="max-w-[90vw] max-h-[80vh] w-auto h-auto bg-black rounded-lg" />
                  ) : (
                    <img src={getMediaUrl(viewer) || ''} alt="full" className="max-w-[90vw] max-h-[80vh] w-auto h-auto object-contain rounded-lg" />
                  )}
                </div>

                <button
                  onClick={() => goNext()}
                  disabled={findViewerIndex() >= displayedItems.length - 1}
                  className="rounded-full bg-black/30 p-2 text-white hover:bg-black/50 disabled:opacity-40"
                  aria-label="Next"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
