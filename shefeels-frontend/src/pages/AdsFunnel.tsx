import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import OptionCard from '../components/Funnel/OptionCard';
import HorizontalOptionCard from '../components/Funnel/HorizontalOptionCard';
import TraitSliders from '../components/Funnel/TraitSliders';
import Login from './Login';
import fetchWithAuth from '../utils/fetchWithAuth';
import { buildApiUrl } from '../utils/apiBase';
import { generateSlug } from '../utils/slugs';
import { useToastActions } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import LogoIcon from '../assets/Branding with text.svg';

// Fallback character preview images (same assets used by CreateCharacter)
const funnelFallbackImages = import.meta.glob<{ default: string }>('../assets/create-character/placeholders/**/*.webp', { eager: true });

function pickFunnelPlaceholder(styleLabel: string | null): string {
  const sFolder = styleLabel?.toLowerCase().includes('anime') ? 'anime' : 'realistic';
  const gFolder = 'female';
  const sources = Object.entries(funnelFallbackImages)
    .filter(([path]) => path.includes(`/${gFolder}/${sFolder}/`))
    .map(([_, mod]) => mod.default);
  if (sources.length > 0) return sources[Math.floor(Math.random() * sources.length)];
  // Broader fallback: any female image
  const broader = Object.entries(funnelFallbackImages)
    .filter(([path]) => path.includes(`/${gFolder}/`))
    .map(([_, mod]) => mod.default);
  return broader.length > 0 ? broader[Math.floor(Math.random() * broader.length)] : '';
}

// --- Asset Imports ---
const realisticImages = import.meta.glob('../assets/Funnel/Realistic/**/*.{png,jpg,jpeg,webp,avif}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const animeImages = import.meta.glob('../assets/Funnel/Anime/**/*.{png,jpg,jpeg,webp,avif}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const realisticVideos = import.meta.glob('../assets/Funnel/Realistic/**/*.mp4', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const animeVideos = import.meta.glob('../assets/Funnel/Anime/**/*.mp4', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const findImage = (style: 'Realistic' | 'Anime', folder: string, filename: string): string | undefined => {
  const images = style === 'Realistic' ? realisticImages : animeImages;
  
  // Normalize folder name: Realistic uses "Scenarios", Anime uses "Scenario"
  let targetFolder = folder;
  if (style === 'Realistic' && folder.toLowerCase() === 'scenario') targetFolder = 'Scenarios';
  else if (style === 'Anime' && folder.toLowerCase() === 'scenarios') targetFolder = 'Scenario';

  const exactMatch = Object.keys(images).find(p =>
    p.toLowerCase().includes(`/${targetFolder.toLowerCase()}/`) &&
    p.toLowerCase().includes(filename.toLowerCase())
  );
  if (exactMatch) return images[exactMatch];
  const fallback = Object.keys(images).find(p => p.toLowerCase().includes(filename.toLowerCase()));
  return fallback ? images[fallback] : undefined;
};

const findVideo = (style: 'Realistic' | 'Anime', folder: string, filename: string): string | undefined => {
  const videos = style === 'Realistic' ? realisticVideos : animeVideos;
  const exactMatch = Object.keys(videos).find(p =>
    p.toLowerCase().includes(`/${folder.toLowerCase()}/`) &&
    p.toLowerCase().includes(filename.toLowerCase())
  );
  return exactMatch ? videos[exactMatch] : undefined;
};

// -- Types --
type FunnelState = {
  style: 'Realistic' | 'Anime' | null;
  age: string | null;
  ethnicity: string | null;
  morphology: string | null;
  breastSize: string | null;
  buttSize: string | null;
  hairColor: string | null;
  specificities: string[];
  lookingFor: string[];
  traits: { libido: number; kink: number; nudity: number };
  kinks: string[];
  scenarios: string[];
  spicyPhotos: boolean | null;
  voiceMessages: boolean | null;
  customImages: boolean | null;
  name: string;
};

const LOOKING_FOR_LABELS: Record<string, string> = {
  romantic: 'Romantic roleplay',
  friendship: 'Friendship',
  flirting: 'Flirting and love',
  'safe-space': 'A safe, non-judgemental space',
  exploring: 'Exploring AI capabilities',
};

const KINK_LABELS: Record<string, string> = {
  threesome: 'Threesome',
  backdoor: 'Backdoor action',
  bdsm: 'BDSM',
  roleplay: 'Roleplay',
  'age-gap': 'Age Gap',
};

const SCENARIO_LABELS: Record<string, string> = {
  'doctor-patient': 'Doctor & Patient',
  'teacher-student': 'Teacher & Student',
  'boss-employee': 'Boss & Employee',
  'officer-criminal': 'Officer & Criminal',
  'royalty-commoner': 'Royalty & Commoner',
  'superhero-villain': 'Superhero & Villain',
  'repairman-house-owner': 'Repairman & House Owner',
  'massage-therapist-client': 'Massage Therapist & Client',
};

const SPECIFICITY_LABELS: Record<string, string> = {
  'belly-piercing': 'Belly Piercing',
  freckles: 'Freckles',
  glasses: 'Glasses',
  pregnant: 'Pregnant',
  'pubic-hair': 'Pubic Hair',
  tattoo: 'Tattoo',
  tattoos: 'Tattoos',
};

function mapSelectionLabels(values: unknown, labelMap: Record<string, string>): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => labelMap[value] || value.replace(/-/g, ' '));
}

function formatApiErrorDetail(detail: unknown): string {
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const message = detail
      .map((item) => formatApiErrorDetail(item))
      .filter(Boolean)
      .join(', ');
    return message || 'Request failed.';
  }
  if (detail && typeof detail === 'object') {
    const record = detail as Record<string, unknown>;
    if (typeof record.detail === 'string') return record.detail;
    if (typeof record.message === 'string') return record.message;
    if (typeof record.msg === 'string') return record.msg;
    try {
      return JSON.stringify(detail);
    } catch {
      return 'Request failed.';
    }
  }
  return 'Request failed.';
}

// Step map:
// 0  Style
// 1  Age            (tall cards, auto-advance)
// 2  Ethnicity      (tall cards, auto-advance)
// 3  Morphology     (tall cards, auto-advance)
// 4  Breast Size    (tall cards, auto-advance)
// 5  Butt Size      (tall cards, auto-advance)
// 6  Hair Color     (tall cards, auto-advance)
// 7  Specificities  (multi-select grid + Continue)
// 8  Interstitial   "Hey handsome" + Continue
// 9  Looking For    (multi-select list + Continue)
// 10 Traits         (sliders + Continue)
// 11 Kinks          (multi-select list + Continue)
// 12 Scenarios      (multi-select grid + Continue)
// 13 Loading screen -> navigate('/login')
// 13 Loading screen (Analyzing your desires)
// 14 Spicy Photos Question
// 15 Loading...
// 16 Voice Messages Question
// 17 Loading...
// 18 Special Videos Question
// 19 Loading...
// 20 Summary Page
const TOTAL_STEPS = 21;
const LOADING_STEP = 13;
const SPICY_PHOTOS_STEP = 14;
const LOADING_PHASE_2 = 15;
const VOICE_MESSAGES_STEP = 16;
const LOADING_PHASE_3 = 17;
const SPECIAL_VIDEOS_STEP = 18;
const LOADING_FINAL = 19;
const SUMMARY_STEP = 20;
const LOGIN_STEP = 21;
const PROCESSING_STEP = 22;

const LOADING_PHASES = [
  { label: 'Understanding your preferences', duration: 1200 },
  { label: 'Creating an uncensored version of AI girl', duration: 1400 },
  { label: 'Crafting AI girl to your preferences', duration: 1000 },
];

export default function AdsFunnel() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToastActions();
  const { user } = useAuth();
  const [agree, setAgree] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<FunnelState>({
    style: null,
    age: null,
    ethnicity: null,
    morphology: null,
    breastSize: null,
    buttSize: null,
    hairColor: null,
    specificities: [],
    lookingFor: [],
    traits: { libido: 50, kink: 50, nudity: 50 },
    kinks: [],
    scenarios: [],
    spicyPhotos: null,
    voiceMessages: null,
    customImages: null,
    name: '',
  });

  const [generatedNames, setGeneratedNames] = useState<string[]>([]);

  // Fallback preview image for the summary step — re-pick when style changes
  const [previewImage, setPreviewImage] = useState<string>(() => pickFunnelPlaceholder(null));
  const lastPreviewStyle = useRef<string>('');
  useEffect(() => {
    const styleKey = state.style || '';
    if (styleKey !== lastPreviewStyle.current) {
      lastPreviewStyle.current = styleKey;
      setPreviewImage(pickFunnelPlaceholder(styleKey));
    }
  }, [state.style]);
  
  useEffect(() => {
    // Pick a default name if style selection happens
    if (state.style && !state.name) {
      const femaleNames = ["Maha", "Simran", "Priya", "Emily", "Sarah", "Anna", "Chloe", "Mia", "Zoe", "Lily", "Aisha", "Maria", "Luna", "Sophia", "Ava", "Isla", "Layla", "Nora", "Aria", "Leah"];
      setState(prev => ({ ...prev, name: femaleNames[Math.floor(Math.random() * femaleNames.length)] }));
    }
  }, [state.style, state.name]);

  // Loading screen animation state
  const [phaseProgress, setPhaseProgress] = useState<number[]>([0, 0, 0]);

  // Interleaved Loading Phases Ticker
  useEffect(() => {
    const phaseMap: Record<number, number> = {
      [LOADING_STEP]: 0,
      [LOADING_PHASE_2]: 1,
      [LOADING_PHASE_3]: 2
    };

    const phaseIdx = phaseMap[stepIndex];
    if (phaseIdx === undefined) return;

    let progress = 0;
    const interval = LOADING_PHASES[phaseIdx].duration / 100;
    
    // Set initial 0 for current phase if not already 100
    setPhaseProgress(prev => {
      const next = [...prev];
      if (next[phaseIdx] < 100) next[phaseIdx] = 0;
      return next;
    });

    const timer = setInterval(() => {
      progress += 1;
      setPhaseProgress(prev => {
        const next = [...prev];
        // Only update if not already 100 from a previous run (e.g. going back)
        if (next[phaseIdx] < 100) {
          next[phaseIdx] = Math.min(progress, 100);
        }
        return next;
      });

      if (progress >= 100) {
        clearInterval(timer);
        setTimeout(goNext, 800);
      }
    }, interval);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Handle final short interstitial (19)
  useEffect(() => {
    if (stepIndex === LOADING_FINAL) {
      const timer = setTimeout(() => {
        goNext();
      }, 1000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Handle character creation when login succeeds
  useEffect(() => {
    if (stepIndex === PROCESSING_STEP) {
      const processFunnel = async () => {
        try {
          const rawPrefs = localStorage.getItem('funnel_preferences');
          if (!rawPrefs) {
             navigate('/');
             return;
          }
          const savedState = JSON.parse(rawPrefs);

          const lookingForLabels = mapSelectionLabels(savedState.lookingFor, LOOKING_FOR_LABELS);
          const kinkLabels = mapSelectionLabels(savedState.kinks, KINK_LABELS);
          const scenarioLabels = mapSelectionLabels(savedState.scenarios, SCENARIO_LABELS);
          const specificityLabels = mapSelectionLabels(savedState.specificities, SPECIFICITY_LABELS);
          
          let ageNum = 21;
          if (savedState.age) {
            const parsed = parseInt(savedState.age, 10);
            if (!isNaN(parsed)) ageNum = parsed;
          }

          // Build payload
          const payload = {
            username: null,
            name: savedState.name || "My AI Girl",
            bio: "",
            gender: "Female",
            style: savedState.style || "Realistic",
            ethnicity: savedState.ethnicity || null,
            age: ageNum,
            eye_colour: null,
            hair_style: null,
            hair_colour: savedState.hairColor || null,
            body_type: savedState.morphology || null,
            breast_size: savedState.breastSize || null,
            butt_size: savedState.buttSize || null,
            dick_size: null,
            personality: `Libido: ${savedState.traits?.libido || 50}%, Kink Openness: ${savedState.traits?.kink || 50}%, Comfort with Nudity: ${savedState.traits?.nudity || 50}%, Looking For: ${lookingForLabels.join(', ') || 'Not specified'}, Kinks: ${kinkLabels.join(', ') || 'None'}, Scenarios: ${scenarioLabels.join(', ') || 'None'}, Spicy Photos: ${savedState.spicyPhotos ? 'Yes' : 'No'}, Voice Messages: ${savedState.voiceMessages ? 'Yes' : 'No'}, Custom Images: ${savedState.customImages ? 'Yes' : 'No'}`,
            voice_type: null,
            relationship_type: "Girlfriend",
            privacy: null,
            clothing: null,
            picture_shot_type: "Upper Body",
            special_features: specificityLabels.length > 0 ? specificityLabels.join(', ') : null,
            hobbies: null,
            background: null,
            enhanced_prompt: null,
            onlyfans_url: null,
            fanvue_url: null,
            tiktok_url: null,
            instagram_url: null,
            looking_for: lookingForLabels[0] || null,
          };

          const res = await fetchWithAuth(buildApiUrl('/characters/create'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!res.ok) {
            const raw = await res.text().catch(() => '');
            let parsed: unknown = raw;
            try {
              parsed = raw ? JSON.parse(raw) : raw;
            } catch {
              parsed = raw;
            }

            console.error('Funnel character creation failed:', {
              status: res.status,
              body: parsed,
            });

            const message = formatApiErrorDetail(
              (parsed && typeof parsed === 'object')
                ? ((parsed as Record<string, unknown>).detail
                  ?? (parsed as Record<string, unknown>).message
                  ?? (parsed as Record<string, unknown>).error
                  ?? parsed)
                : parsed
            );

            const error = new Error(message || `Server returned ${res.status}`) as Error & { status?: number };
            error.status = res.status;
            throw error;
          }
          const data = await res.json();
          localStorage.removeItem('funnel_preferences');
          
          showSuccess("Companion Created", "Your new companion is ready!");
          const slug = generateSlug(data.name || data.username, data.id);
          navigate(`/chat/${slug}`, { replace: true });

        } catch (err: unknown) {
          console.error("Funnel processing error:", err);
          const detail = err instanceof Error && err.message.trim()
            ? err.message
            : "We couldn't create your AI companion from the funnel.";
          const status = typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status?: unknown }).status === 'number'
            ? (err as { status: number }).status
            : null;
          showError("Creation Failed", detail);
          if (status === 401) {
            setStepIndex(LOGIN_STEP);
          } else {
            setStepIndex(SUMMARY_STEP);
          }
        }
      };

      processFunnel();
    }
  }, [stepIndex, navigate, showSuccess, showError]);

  // Navigation
  const goNext = () => {
    setStepIndex(prev => Math.min(prev + 1, TOTAL_STEPS - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goPrev = () => {
    if (stepIndex === LOADING_STEP) return;
    setStepIndex(prev => Math.max(0, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Single-select auto-advance
  const handleSingleSelect = (key: keyof FunnelState, value: string | boolean) => {
    setState(prev => ({ ...prev, [key]: value }));
    setTimeout(goNext, 280);
  };

  // Toggle multi-select
  const toggleMulti = (key: 'specificities' | 'lookingFor' | 'kinks' | 'scenarios', id: string) => {
    setState(prev => {
      const arr = prev[key] as string[];
      return { ...prev, [key]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
    });
  };

  const s = state.style || 'Realistic';

  // Step data builder
  type StepData =
    | { type: 'tall-cards'; title: string; subtitle?: string; stateKey: keyof FunnelState; options: { id: string; label: string; img?: string; video?: string }[] }
    | { type: 'horizontal-cards'; title: string; subtitle?: string; stateKey: keyof FunnelState; options: { id: string; label: string; img?: string }[] }
    | { type: 'multi-grid'; title: string; subtitle?: string; stateKey: 'specificities' | 'scenarios'; options: { id: string; label: string; img?: string }[] }
    | { type: 'multi-list'; title: string; subtitle?: string; stateKey: 'lookingFor' | 'kinks'; options: { id: string; label: string; icon?: string }[] }
    | { type: 'boolean-select'; title: string; stateKey: 'spicyPhotos' | 'voiceMessages' | 'customImages'; image?: string }
    | { type: 'interstitial'; title: string; interstitialImage?: string }
    | { type: 'traits'; title: string; subtitle?: string }
    | { type: 'loading'; title: string; isSmall?: boolean }
    | { type: 'summary'; title: string }
    | { type: 'login' }
    | { type: 'processing' };

  const stepData: StepData = (() => {
    switch (stepIndex) {
      case 0: return {
        type: 'tall-cards', title: 'Create your Dream AI Girl',
        subtitle: 'Bring your fantasies to life. No limits.\n3-min quiz',
        stateKey: 'style',
        options: [
          { id: 'Realistic', label: 'Realistic', video: findVideo('Realistic', 'Initial video', 'gifr') },
          { id: 'Anime', label: 'Anime', video: findVideo('Anime', 'Initial  video', 'GIFANIME_') },
        ],
      };
      case 1: return {
        type: 'tall-cards', title: 'How old would you like your AI Girlfriend to be?',
        stateKey: 'age',
        options: [
          { id: '18', label: '18', img: findImage(s, 'Age', '18') },
          { id: '19-21', label: '19-21', img: findImage(s, 'Age', '19-21') },
          { id: '22-25', label: '22-25', img: findImage(s, 'Age', '22-25') },
          { id: '26+', label: '26+', img: findImage(s, 'Age', '26+') },
        ],
      };
      case 2: return {
        type: 'horizontal-cards', title: 'Choose Ethnicity',
        stateKey: 'ethnicity',
        options: s === 'Anime' ? [
          { id: 'afro', label: 'Afro', img: findImage('Anime', 'Ethnicity', 'afro') },
          { id: 'arabic', label: 'Arabic', img: findImage('Anime', 'Ethnicity', 'arabic') },
          { id: 'asian', label: 'Asian', img: findImage('Anime', 'Ethnicity', 'asian') },
          { id: 'caucasian', label: 'Caucasian', img: findImage('Anime', 'Ethnicity', 'caucasian') },
          { id: 'indian', label: 'Indian', img: findImage('Anime', 'Ethnicity', 'indian') },
          { id: 'latina', label: 'Latina', img: findImage('Anime', 'Ethnicity', 'latina') },
        ] : [
          { id: 'caucasian', label: 'Caucasian', img: findImage('Realistic', 'Ethinicty', 'caucasian') },
          { id: 'asian', label: 'Asian', img: findImage('Realistic', 'Ethinicty', 'asian') },
          { id: 'latin', label: 'Latina', img: findImage('Realistic', 'Ethinicty', 'latin') },
          { id: 'black', label: 'Black', img: findImage('Realistic', 'Ethinicty', 'black') },
          { id: 'middle-eastern', label: 'Middle Eastern', img: findImage('Realistic', 'Ethinicty', 'middle-eastern') },
        ],
      };
      case 3: return {
        type: 'tall-cards', title: 'What kind of figure do you prefer in women?',
        stateKey: 'morphology',
        options: s === 'Anime' ? [
          { id: 'athlete', label: 'Athlete', img: findImage('Anime', 'Morpho', 'athlete') },
          { id: 'chubby', label: 'Chubby', img: findImage('Anime', 'Morpho', 'chubby') },
          { id: 'fit', label: 'Fit', img: findImage('Anime', 'Morpho', 'fit') },
          { id: 'muscular', label: 'Muscular', img: findImage('Anime', 'Morpho', 'muscular') },
          { id: 'skinny', label: 'Skinny', img: findImage('Anime', 'Morpho', 'skinny') },
        ] : [
          { id: 'extra-skinny', label: 'Extra skinny', img: findImage('Realistic', 'Morphology', 'extra-skinny') },
          { id: 'skinny', label: 'Skinny', img: findImage('Realistic', 'Morphology', 'skinny') },
          { id: 'curvy', label: 'Curvy', img: findImage('Realistic', 'Morphology', 'curvy') },
          { id: 'thick', label: 'Thick', img: findImage('Realistic', 'Morphology', 'thick') },
        ],
      };
      case 4: return {
        type: 'tall-cards', title: 'Is there a certain breast size you find especially attractive?',
        stateKey: 'breastSize',
        options: s === 'Anime' ? [
          { id: 'flat', label: 'Flat', img: findImage('Anime', 'Breast Size', 'flat') },
          { id: 'small', label: 'Small', img: findImage('Anime', 'Breast Size', 'small') },
          { id: 'medium', label: 'Medium', img: findImage('Anime', 'Breast Size', 'medium') },
          { id: 'large', label: 'Large', img: findImage('Anime', 'Breast Size', 'large') },
          { id: 'xxl', label: 'XXL', img: findImage('Anime', 'Breast Size', 'xxl') },
        ] : [
          { id: 'small', label: 'Small', img: findImage('Realistic', 'Breast Size', 'small') },
          { id: 'medium', label: 'Medium', img: findImage('Realistic', 'Breast Size', 'medium') },
          { id: 'large', label: 'Large', img: findImage('Realistic', 'Breast Size', 'large') },
          { id: 'huge', label: 'Huge', img: findImage('Realistic', 'Breast Size', 'huge') },
        ],
      };
      case 5: return {
        type: 'tall-cards', title: 'What kind of butt catches your eye the most?',
        stateKey: 'buttSize',
        options: s === 'Anime' ? [
          { id: 'small', label: 'Small', img: findImage('Anime', 'Butt Size', 'small') },
          { id: 'medium', label: 'Medium', img: findImage('Anime', 'Butt Size', 'medium') },
          { id: 'large', label: 'Large', img: findImage('Anime', 'Butt Size', 'large') },
          { id: 'athletic', label: 'Athletic', img: findImage('Anime', 'Butt Size', 'athletic') },
        ] : [
          { id: 'small', label: 'Small', img: findImage('Realistic', 'Butt Size', 'small') },
          { id: 'medium', label: 'Medium', img: findImage('Realistic', 'Butt Size', 'medium') },
          { id: 'large', label: 'Large', img: findImage('Realistic', 'Butt Size', 'large') },
          { id: 'huge', label: 'Huge', img: findImage('Realistic', 'Butt Size', 'huge') },
        ],
      };
      case 6: return {
        type: 'tall-cards', title: 'Which hair color do you find most attractive on a woman?',
        stateKey: 'hairColor',
        options: s === 'Anime' ? [
          { id: 'black', label: 'Black', img: findImage('Anime', 'Hair color', 'black') },
          { id: 'blonde', label: 'Blonde', img: findImage('Anime', 'Hair color', 'blonde') },
          { id: 'brunette', label: 'Brunette', img: findImage('Anime', 'Hair color', 'brunette') },
          { id: 'pink', label: 'Pink', img: findImage('Anime', 'Hair color', 'pink') },
          { id: 'redhead', label: 'Redhead', img: findImage('Anime', 'Hair color', 'redhead') },
        ] : [
          { id: 'black', label: 'Black', img: findImage('Realistic', 'Hair color', 'black') },
          { id: 'blonde', label: 'Blonde', img: findImage('Realistic', 'Hair color', 'blonde') },
          { id: 'brunette', label: 'Brunette', img: findImage('Realistic', 'Hair color', 'brunette') },
          { id: 'red', label: 'Red', img: findImage('Realistic', 'Hair color', 'red') },
          { id: 'unnatural-colors', label: 'Unnatural Colors', img: findImage('Realistic', 'Hair color', 'unnatural-colors') },
          { id: 'no-preferences', label: 'No Preferences', img: findImage('Realistic', 'Hair color', 'no-preferences') },
        ],
      };
      case 7: return {
        type: 'multi-grid', title: 'Any specific preferences?',
        subtitle: 'You can choose all that excites you',
        stateKey: 'specificities',
        options: s === 'Anime' ? [
          { id: 'belly-piercing', label: 'Belly Piercing', img: findImage('Anime', 'Specificities', 'Belly Piercing') },
          { id: 'freckles', label: 'Freckles', img: findImage('Anime', 'Specificities', 'Freckles') },
          { id: 'glasses', label: 'Glasses', img: findImage('Anime', 'Specificities', 'Glasses') },
          { id: 'pregnant', label: 'Pregnant', img: findImage('Anime', 'Specificities', 'Pregnant') },
          { id: 'pubic-hair', label: 'Pubic Hair', img: findImage('Anime', 'Specificities', 'Pubic Hair') },
          { id: 'tattoo', label: 'Tattoo', img: findImage('Anime', 'Specificities', 'Tatoo') },
        ] : [
          { id: 'belly-piercing', label: 'Belly Piercing', img: findImage('Realistic', 'Specificities', 'Belly Piercing') },
          { id: 'freckles', label: 'Freckles', img: findImage('Realistic', 'Specificities', 'Freckles') },
          { id: 'glasses', label: 'Glasses', img: findImage('Realistic', 'Specificities', 'Glasses') },
          { id: 'pregnant', label: 'Pregnant', img: findImage('Realistic', 'Specificities', 'Pregnant') },
          { id: 'pubic-hair', label: 'Pubic Hair', img: findImage('Realistic', 'Specificities', 'Pubic Hair') },
          { id: 'tattoos', label: 'Tattoos', img: findImage('Realistic', 'Specificities', 'Tattoos') },
        ],
      };
      case 8: return {
        type: 'interstitial', title: 'Hey handsome, now let me match your freak',
        interstitialImage: findImage('Realistic', 'Hey handsome let me match your freak', 'match-freak'),
      };
      case 9: return {
        type: 'multi-list', title: 'What are you looking for in your AI companion?',
        subtitle: 'Create my AI Girl',
        stateKey: 'lookingFor',
        options: [
          { id: 'romantic', label: 'Romantic roleplay', icon: '💝' },
          { id: 'friendship', label: 'Friendship', icon: '🫂' },
          { id: 'flirting', label: 'Flirting and love', icon: '🥂' },
          { id: 'safe-space', label: 'A safe, non-judgemental space', icon: '🤲' },
          { id: 'exploring', label: 'Exploring AI capabilities', icon: '✨' },
        ],
      };
      case 10: return {
        type: 'traits', title: 'What character traits should your ideal woman have?',
        subtitle: 'Create my AI Girl',
      };
      case 11: return {
        type: 'multi-list', title: 'What are you willing to try?',
        subtitle: 'You can choose all that excites you',
        stateKey: 'kinks',
        options: [
          { id: 'threesome', label: 'Threesome', icon: '🔥' },
          { id: 'backdoor', label: 'Backdoor action', icon: '🍑' },
          { id: 'bdsm', label: 'BDSM', icon: '⛓️' },
          { id: 'roleplay', label: 'Roleplay', icon: '🎭' },
          { id: 'age-gap', label: 'Age Gap', icon: '💫' },
        ],
      };
      case 12: return {
        type: 'multi-grid', title: 'Do you have any favorite scenarios?',
        subtitle: 'You can choose all that excites you',
        stateKey: 'scenarios',
        options: [
          { id: 'doctor-patient', label: 'Doctor & Patient', img: findImage(s, 'Scenario', 'doctor-patient') },
          { id: 'teacher-student', label: 'Teacher & Student', img: findImage(s, 'Scenario', 'teacher-student') },
          { id: 'boss-employee', label: 'Boss & Employee', img: findImage(s, 'Scenario', 'boss-employee') },
          { id: 'officer-criminal', label: 'Officer & Criminal', img: findImage(s, 'Scenario', 'officer-criminal') },
          { id: 'royalty-commoner', label: 'Royalty & Commoner', img: findImage(s, 'Scenario', 'royalty-commoner') },
          { id: 'superhero-villain', label: 'Superhero & Villain', img: findImage(s, 'Scenario', 'superhero-villain') },
          { id: 'repairman-house-owner', label: 'Repairman & House Owner', img: findImage(s, 'Scenario', 'repairman-house-owner') },
          { id: 'massage-therapist-client', label: 'Massage Therapist & Client', img: findImage(s, 'Scenario', 'massage-therapist-client') },
        ],
      };
      case 13: return { type: 'loading', title: 'Analyzing your desires' };
      case 14: return { 
        type: 'boolean-select', 
        title: 'Would you like to receive spicy photos?', 
        stateKey: 'spicyPhotos',
        image: findImage(s, 'Age', '22-25') 
      };
      case 15: return { type: 'loading', title: 'Creating your companion...' };
      case 16: return { 
        type: 'boolean-select', 
        title: 'Would you like to receive voice messages?', 
        stateKey: 'voiceMessages',
        image: findImage(s, 'Age', '19-21') 
      };
      case 17: return { type: 'loading', title: 'Refining the details...' };
      case 18: return { 
        type: 'boolean-select', 
        title: 'Would you like to receive custom AI images?', 
        stateKey: 'customImages',
        image: findImage(s, 'Age', '26+') 
      };
      case 19: return { type: 'loading', title: 'Finalizing your experience...' };
      case 20: return { type: 'summary', title: 'Create my AI Girl' };
      case 21: return { type: 'login' };
      case 22: return { type: 'processing' };
      default: return { type: 'loading', title: 'Analyzing your desires' };
    }
  })();

  const isAnyLoadingStep = [LOADING_STEP, LOADING_PHASE_2, LOADING_PHASE_3, LOADING_FINAL].includes(stepIndex);
  const isInterstitial = stepData.type === 'interstitial';
  const isAuthOrProcess = stepIndex >= LOGIN_STEP;

  // Segmented progress: 12 segments covering steps 1-12
  const showHeader = stepIndex > 0 && !isAnyLoadingStep;
  const progressSegments = 12;
  const progressFilled = Math.min(stepIndex - 1, progressSegments);

  return (
    <div className="min-h-screen bg-[#101010] text-white flex flex-col font-sans">

      {/* Loading Screen */}
      {(isAnyLoadingStep || stepData.type === 'loading') && (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 animate-in fade-in duration-500">
          <div className="relative w-24 h-24 mb-10">
            <div className="absolute inset-0 rounded-full border-4 border-[#FF9C00]/20" />
            <div className="absolute inset-0 rounded-full border-4 border-t-[#FF9C00] animate-spin" />
          </div>

          {'title' in stepData && (
            <p className="text-[#FF9C00] text-xs font-bold uppercase tracking-[0.2em] mb-3 animate-pulse">
              {stepData.title}
            </p>
          )}
          
          <div className="w-full max-w-md flex flex-col gap-9 mt-14">
            {LOADING_PHASES.map((phase, i) => {
              const prog = phaseProgress[i];
              // A phase is "active" if it's the one mapped to the current step
              const phaseMap: Record<number, number> = {
                [LOADING_STEP]: 0,
                [LOADING_PHASE_2]: 1,
                [LOADING_PHASE_3]: 2
              };
              const currentPhaseIdx = phaseMap[stepIndex];
              const isActive = currentPhaseIdx === i;
              const isDone = prog >= 100;

              return (
                <div key={phase.label} className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium transition-colors duration-500 ${
                      isDone || isActive ? 'text-white' : 'text-white/25'
                    }`}>
                      {phase.label}
                    </span>
                    <span className={`text-sm font-bold tabular-nums transition-colors duration-500 ${
                      isDone || isActive ? 'text-[#FF9C00]' : 'text-white/20'
                    }`}>
                      {prog}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#FF9C00] rounded-full transition-all duration-150"
                      style={{ width: `${prog}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 mt-16">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-[#FF9C00]/50 animate-pulse"
                style={{ animationDelay: `${i * 0.25}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Normal Steps */}
      {!isAnyLoadingStep && stepData.type !== 'loading' && stepData.type !== 'processing' && stepData.type !== 'login' && (
        <div className="max-w-4xl mx-auto w-full px-2 sm:px-4 pt-6 pb-24 flex flex-col items-center">

          {showHeader && (
            <>
              <div className="w-full flex items-center justify-between mb-5 max-w-2xl">
                <button
                  onClick={goPrev}
                  className="text-white/60 hover:text-white transition-colors p-1"
                  aria-label="Back"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <span className="text-xs font-bold tracking-[0.15em] uppercase text-white/50">
                  Create my AI Girl
                </span>
                <div className="w-7" />
              </div>

              <div className="w-full max-w-lg mb-8 flex gap-0.75">
                {Array.from({ length: progressSegments }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-0.75 flex-1 rounded-full transition-all duration-300 ${
                      i < progressFilled ? 'bg-[#FF9C00]' : 'bg-white/12'
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          <h1 className={`font-bold text-center px-2 ${stepIndex === 0 ? 'text-3xl md:text-4xl mb-1' : 'text-2xl md:text-3xl mb-2'} ${stepIndex >= 20 ? 'hidden' : ''}`}>
            {'title' in stepData && stepData.title}
          </h1>
          {'subtitle' in stepData && stepData.subtitle && stepIndex !== 9 && stepIndex !== 10 && stepData.type !== 'multi-grid' && stepData.type !== 'multi-list' && (
            <p className="text-white/40 text-sm md:text-base text-center mb-5 whitespace-pre-line max-w-md">
              {stepData.subtitle}
            </p>
          )}

          <div className="w-full mt-4 flex justify-center">

            {/* Tall cards (auto-advance single-select) */}
            {stepData.type === 'tall-cards' && (
              (() => {
                const isIntroStep = stepIndex === 0;
                return (
              <div className={`grid gap-3 w-full ${
                stepData.options.length <= 2
                  ? isIntroStep
                    ? 'grid-cols-2 max-w-2xl'
                    : 'grid-cols-2 max-w-xl'
                  : stepData.options.length === 4
                  ? 'grid-cols-2 md:grid-cols-4 max-w-4xl'
                  : stepData.options.length === 5
                  ? 'grid-cols-2 md:grid-cols-5 max-w-4xl'
                  : 'grid-cols-2 md:grid-cols-3 max-w-3xl'
              }`}>
                {stepData.options.map(opt => {
                  const currentVal = state[stepData.stateKey];
                  const isSelected = Array.isArray(currentVal)
                    ? (currentVal as string[]).includes(opt.id)
                    : currentVal === opt.id;
                  
                  // Selective taller cards for steps 1, 3, 4, 5
                  const isTall = [1, 3, 4, 5].includes(stepIndex);
                  
                  return (
                    <div key={opt.id} className={`w-full transition-all duration-300 ${isTall ? 'aspect-[2/4.2]' : isIntroStep ? 'aspect-[2/3.2] sm:aspect-[3/4.3]' : 'aspect-3/4 md:aspect-2/3'}`}>
                      <OptionCard
                        label={opt.label}
                        imageUrl={opt.img}
                        videoUrl={opt.video}
                        selected={isSelected}
                        onClick={() => handleSingleSelect(stepData.stateKey, opt.id)}
                      />
                    </div>
                  );
                })}
              </div>
                );
              })()
            )}

            {/* Horizontal cards (Ethnicity) */}
            {stepData.type === 'horizontal-cards' && (
              <div className="flex flex-col gap-3 w-full max-w-2xl">
                {stepData.options.map(opt => {
                  const isSelected = state[stepData.stateKey] === opt.id;
                  return (
                    <HorizontalOptionCard
                      key={opt.id}
                      label={opt.label}
                      imageUrl={opt.img}
                      selected={isSelected}
                      onClick={() => handleSingleSelect(stepData.stateKey, opt.id)}
                    />
                  );
                })}
              </div>
            )}

            {/* Multi-select grid (specificities / scenarios) */}
            {stepData.type === 'multi-grid' && (
              <div className="flex flex-col w-full max-w-4xl items-center gap-6">
                {'subtitle' in stepData && stepData.subtitle && (
                  <p className="text-white/40 text-sm md:text-base text-center w-full mb-2">{stepData.subtitle}</p>
                )}
                <div className={`grid gap-4 w-full justify-center ${
                  stepData.options.length <= 4
                    ? 'grid-cols-2 lg:grid-cols-4 max-w-4xl'
                    : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-w-5xl'
                }`}>
                  {stepData.options.map(opt => {
                    const selected = state[stepData.stateKey] as string[];
                    const isSel = selected.includes(opt.id);
                    return (
                      <div key={opt.id} className="aspect-[3/4.2] md:aspect-[3/4.5] w-full">
                        <OptionCard
                          label={opt.label}
                          imageUrl={opt.img}
                          selected={isSel}
                          showCheckmark={true}
                          onClick={() => toggleMulti(stepData.stateKey, opt.id)}
                        />
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={goNext}
                  disabled={(state[stepData.stateKey] as string[]).length === 0}
                  className="w-full max-w-lg bg-[#FF9C00] hover:bg-[#FF8800] text-black font-bold py-4 rounded-xl transition-all duration-300 shadow-lg shadow-orange-500/20 mt-6 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#FF9C00]"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Multi-select list (lookingFor / kinks) */}
            {stepData.type === 'multi-list' && (
              <div className="flex flex-col w-full max-w-lg gap-3">
                {'subtitle' in stepData && stepData.subtitle && (
                  <p className="text-white/40 text-sm text-center w-full mb-1">{stepData.subtitle}</p>
                )}
                {stepData.options.map(item => {
                  const selected = state[stepData.stateKey] as string[];
                  const isSel = selected.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleMulti(stepData.stateKey, item.id)}
                      className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-200 ${
                        isSel
                          ? 'border-[#FF9C00] bg-[#FF9C00]/10 text-white'
                          : 'border-white/10 bg-[#1A1A1A] text-white/65 hover:border-white/25 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-4 text-base md:text-lg font-medium text-left">
                        {item.icon && <span className="text-2xl leading-none">{item.icon}</span>}
                        {item.label}
                      </div>
                      <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                        isSel ? 'bg-[#FF9C00] border-[#FF9C00] text-black text-xs font-bold' : 'border-white/20'
                      }`}>
                        {isSel && '✓'}
                      </span>
                    </button>
                  );
                })}
                <button
                  onClick={goNext}
                  disabled={(state[stepData.stateKey] as string[]).length === 0}
                  className="w-full mt-4 bg-[#FF9C00] hover:bg-[#FF8800] text-black font-bold py-4 rounded-xl transition-colors shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#FF9C00]"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Interstitial */}
            {isInterstitial && (
              <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {stepData.type === 'interstitial' && stepData.interstitialImage && (
                  <img
                    src={stepData.interstitialImage}
                    alt="Match Freak"
                    className="w-[72vw] max-w-[288px] rounded-2xl shadow-2xl object-contain object-top bg-black aspect-[3/4.4]"
                  />
                )}
                <button
                  onClick={goNext}
                  className="w-full max-w-[288px] bg-[#FF9C00] hover:bg-[#FF8800] text-black font-bold py-4 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Boolean select (Yes/No) */}
            {stepData.type === 'boolean-select' && (
              <div className="flex flex-col items-center w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                {stepData.image && (
                  <div className="w-64 sm:w-80 aspect-3/4 rounded-3xl overflow-hidden mb-8 border-2 border-white/10 shadow-2xl">
                    <img src={stepData.image} alt="AI Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mt-4">
                  <button
                    onClick={() => handleSingleSelect(stepData.stateKey, true)}
                    className="flex-1 bg-[#FF9C00] hover:bg-[#FF8800] text-black font-extrabold py-5 rounded-2xl transition-all duration-300 shadow-lg shadow-orange-500/20 active:scale-95 text-xl uppercase tracking-wider"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => handleSingleSelect(stepData.stateKey, false)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-extrabold py-5 rounded-2xl transition-all duration-300 border border-white/10 active:scale-95 text-xl uppercase tracking-wider"
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            {/* Character Creation Summary Step */}
            {stepData.type === 'summary' && (
              <div className="w-full max-w-4xl animate-in fade-in zoom-in duration-700">
                <div className="mb-6">
                  <h1 className="text-2xl md:text-3xl font-black text-center">
                    <span className="text-white">Create Your </span>
                    <span className="text-[#FF9C00]">own AI Girl</span>
                  </h1>
                  <p className="text-center text-white/50 mt-1 font-medium text-sm">She will do whatever you want. It's yours</p>
                </div>

                <div className="flex flex-col md:flex-row gap-6 items-start bg-black/40 p-5 sm:p-6 rounded-3xl border border-white/5 backdrop-blur-xl">
                  {/* Character Preview */}
                  <div className="w-full md:w-64 md:shrink-0 flex flex-col items-center">
                    <style>{`
                      @keyframes blurPulse {
                        0%, 100% { filter: blur(8px); transform: scale(1.08); }
                        50% { filter: blur(14px); transform: scale(1.14); }
                      }
                    `}</style>
                    <div className="relative w-full aspect-3/4 rounded-2xl overflow-hidden mb-3 shadow-2xl group">
                      <img 
                        src={previewImage || findImage(s, 'Age', '22-25')} 
                        alt="Preview" 
                        className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                        style={{ 
                          animation: 'blurPulse 5s ease-in-out infinite',
                          filter: 'blur(8px)',
                          transform: 'scale(1.08)',
                          willChange: 'filter, transform'
                        }}
                      />
                      <div className="absolute inset-0 bg-black/20" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl drop-shadow-lg">🔒</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FF9C00]/5 border border-[#FF9C00]/10 w-full">
                      <span className="text-[#FF9C00] text-xs">🔒</span>
                      <p className="text-[9px] font-semibold text-white/60">Your AI will remain private. Only you will see it</p>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex-1 w-full space-y-4">
                    {/* Name Input */}
                    <div>
                      <h3 className="text-base font-bold text-white mb-2">Name your AI Girlfriend</h3>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={state.name} 
                          onChange={(e) => setState(prev => ({ ...prev, name: e.target.value }))}
                          className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold focus:outline-none focus:border-[#FF9C00]/50 transition-all text-sm"
                          placeholder="Enter name"
                        />
                        <button 
                          onClick={() => {
                            const femaleNames = ["Maha", "Simran", "Priya", "Emily", "Sarah", "Anna", "Chloe", "Mia", "Zoe", "Lily", "Aisha", "Maria", "Luna", "Sophia", "Ava", "Isla", "Layla", "Nora", "Aria", "Leah"];
                            setState(prev => ({ ...prev, name: femaleNames[Math.floor(Math.random() * femaleNames.length)] }));
                          }}
                          className="w-11 h-11 bg-linear-to-b from-[#FFC54D] to-[#FFE2A5] rounded-xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all text-black font-black text-xl"
                        >
                          ↻
                        </button>
                      </div>
                    </div>

                    {/* Personality Attributes */}
                    <div className="bg-[#111] p-5 rounded-2xl border border-white/5 space-y-4">
                      <h3 className="text-base font-bold text-white border-b border-white/5 pb-2">Personality Attributes</h3>
                      
                      {/* Looking For Tag */}
                      <div className="flex items-center gap-4 justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[#FF9B00]">💛</span>
                          <span className="text-xs font-bold text-white/80">You're looking for</span>
                        </div>
                        <div className="px-3 py-1.5 rounded-lg bg-white/5 text-[10px] font-bold text-white/60 border border-white/10">
                          {state.lookingFor?.[0] || "A safe, non-judgemental space"}
                        </div>
                      </div>

                      {/* Sliders */}
                      <div className="space-y-3">
                        {[
                          { label: 'Libido intensity', icon: '🔥', val: state.traits.libido, key: 'libido' },
                          { label: 'Kink Openness', icon: '👠', val: state.traits.kink, key: 'kink' },
                          { label: 'Comfort with Nudity', icon: '👙', val: state.traits.nudity, key: 'nudity' },
                        ].map((item) => (
                          <div key={item.key} className="space-y-1.5">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <div className="flex items-center gap-1.5 uppercase tracking-wide text-white/70">
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                              </div>
                              <span className="text-[#FF9B00]">{item.val}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="0" max="100" 
                              value={item.val} 
                              onChange={(e) => setState(prev => ({ 
                                ...prev, 
                                traits: { ...prev.traits, [item.key]: parseInt(e.target.value) } 
                              }))}
                              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#FF9B00]" 
                            />
                          </div>
                        ))}
                      </div>

                      {/* Toggles */}
                      <div className="flex gap-4 pt-2 border-t border-white/5">
                        <label className="flex-1 flex items-center justify-between cursor-pointer group">
                          <div className="flex items-center gap-2">
                            <span className="text-base">📷</span>
                            <span className="text-[11px] font-bold text-white/60 group-hover:text-white transition-colors">Photos</span>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={!!state.spicyPhotos} 
                            onChange={(e) => setState(prev => ({ ...prev, spicyPhotos: e.target.checked }))}
                            className="w-5 h-5 rounded-md accent-[#FF9B00] cursor-pointer"
                          />
                        </label>
                        <label className="flex-1 flex items-center justify-between cursor-pointer group">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🎙️</span>
                            <span className="text-[11px] font-bold text-white/60 group-hover:text-white transition-colors">Voices</span>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={!!state.voiceMessages} 
                            onChange={(e) => setState(prev => ({ ...prev, voiceMessages: e.target.checked }))}
                            className="w-5 h-5 rounded-md accent-[#FF9B00] cursor-pointer"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => {
                          localStorage.setItem('funnel_preferences', JSON.stringify(state));
                          // Skip login step if already authenticated
                          if (user) {
                            setStepIndex(PROCESSING_STEP);
                          } else {
                            setStepIndex(LOGIN_STEP);
                          }
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="w-full bg-[#FF9C00] hover:bg-[#FF8800] text-black font-black py-3.5 rounded-xl transition-all duration-300 shadow-xl shadow-orange-500/40 active:scale-[0.98] text-sm uppercase tracking-widest"
                      >
                        Create my AI Girl
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Trait sliders */}
            {stepData.type === 'traits' && (
              <div className="flex flex-col w-full max-w-lg items-center">
                <TraitSliders
                  libido={state.traits.libido}
                  kink={state.traits.kink}
                  nudity={state.traits.nudity}
                  onChange={(key, val) =>
                    setState(prev => ({ ...prev, traits: { ...prev.traits, [key]: val } }))
                  }
                />
                <button
                  onClick={goNext}
                  className="w-full mt-10 bg-[#FF9C00] hover:bg-[#FF8800] text-black font-bold py-4 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
                >
                  Continue
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Inline Login Step */}
      {stepData.type === 'login' && (
        <div className="w-full max-w-5xl mx-auto px-4 pt-12 pb-24 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-center md:items-start bg-black/40 p-6 sm:p-8 rounded-3xl border border-white/5 backdrop-blur-xl">
            {/* Image side */}
            <div className="w-full md:w-80 shrink-0 flex flex-col items-center space-y-4">
              <div className="relative w-48 sm:w-64 md:w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl group">
                <img
                  src={previewImage || findImage(s, 'Age', '22-25')}
                  alt="Preview"
                  className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                  style={{ filter: 'blur(12px)', transform: 'scale(1.1)' }}
                />
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl sm:text-5xl drop-shadow-lg">🔒</span>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FF9C00]/5 border border-[#FF9C00]/10 w-full justify-center">
                <span className="text-[#FF9C00] text-sm">🔒</span>
                <p className="text-[11px] sm:text-xs font-semibold text-white/60">Your AI will remain private. Only you will see it</p>
              </div>
            </div>

            {/* Login side */}
            <div className="flex-1 w-full max-w-lg flex flex-col items-center pt-2">
              <div className="w-full flex justify-center mb-8">
                <img src={LogoIcon} alt="HoneyLove" className="h-[28px] md:h-[34px] w-auto drop-shadow-md" />
              </div>
              <div className="w-full bg-[#111] rounded-3xl p-6 border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#FF9C00]/50 to-transparent" />
                <Login onClose={() => setStepIndex(PROCESSING_STEP)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Processing Funnel */}
      {stepData.type === 'processing' && (
        <div className="min-h-screen bg-[#101010] flex flex-col items-center justify-center p-6 text-white animate-in fade-in duration-500">
          <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-[#FF9C00]/20" />
            <div className="absolute inset-0 rounded-full border-4 border-t-[#FF9C00] animate-spin" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Creating your AI Companion</h2>
          <p className="text-white/60">Applying your preferences...</p>
        </div>
      )}
    </div>
  );
}
