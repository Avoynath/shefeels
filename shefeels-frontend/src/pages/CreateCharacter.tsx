import React, { useEffect, useMemo, useState, useRef } from "react";
import { useThemeStyles } from "../utils/theme";
import { useTheme } from "../contexts/ThemeContext";
import Card from "../components/Card";
import Button from "../components/Button";
import { useNavigate, useLocation } from 'react-router-dom';
import { generateSlug } from '../utils/slugs';
import { useAuth } from '../contexts/AuthContext';
import { useToastActions } from '../contexts/ToastContext';
import { buildApiUrl } from '../utils/apiBase';
import fetchWithAuth from '../utils/fetchWithAuth';
import SEOHead from "../components/SEOHead";
import LazyImage from "../components/LazyImage";

import { IconSpinner } from '../utils/chatUtils';
import defaultGirl from "../assets/girl.webp";
import NextIcon from "../assets/create-character/NextIcon.svg";
import PreviousIcon from "../assets/create-character/PreviousIcon.svg";
import { isValidSocialUrl, type Social, type Validation } from '../utils/socialUrlValidator';
import genderService from "../utils/genderService";
// explicit preview images
import femaleReal from "../assets/create-character/real_girl/realistic_gif.mp4";
import femaleAnime from "../assets/create-character/anime_girl/anime_gif.mp4";
import maleReal from "../assets/create-character/real_boy/character/real.png";
import maleAnime from "../assets/create-character/anime_boy/character/anime.jpg";
import transReal from "../assets/create-character/trans/real.avif";
import transAnime from "../assets/create-character/trans/anime.avif";

// Load special features images
const specialFeaturesImages = import.meta.glob('../assets/create-character/Special Features/*.{png,jpg,jpeg,svg,webp,avif}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

// Load all option images eagerly using Vite's glob import
const realGirlImages = import.meta.glob('../assets/create-character/real_girl/**/*.{png,jpg,jpeg,webp,avif}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const realBoyImages = import.meta.glob('../assets/create-character/real_boy/**/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const animeGirlImages = import.meta.glob('../assets/create-character/anime_girl/**/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const animeBoyImages = import.meta.glob('../assets/create-character/anime_boy/**/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

// Personality icons folder (filenames match card labels)
const personalityIcons = import.meta.glob('../assets/create-character/personality/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

// Relationship icons folder (filenames match card labels)
const relationshipIcons = import.meta.glob('../assets/create-character/relationship/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function getPreviewImage(style?: string, gender?: string): string {
  const s = (style || '').toLowerCase();
  const g = (gender || '').toLowerCase();

  // Return static preview images immediately for faster initial render
  if (s === 'realistic' || s === 'real') {
    if (g === 'male') return (maleReal as unknown as string) ?? defaultGirl;
    if (g === 'trans') return (transReal as unknown as string) ?? defaultGirl;
    if (g === 'female') return (femaleReal as unknown as string) ?? defaultGirl;
    return (femaleReal as unknown as string) ?? defaultGirl;
  }

  if (g === 'male') return (maleAnime as unknown as string) ?? defaultGirl;
  if (g === 'trans') return (transAnime as unknown as string) ?? defaultGirl;
  if (g === 'female') return (femaleAnime as unknown as string) ?? defaultGirl;
  return (femaleAnime as unknown as string) ?? defaultGirl;
}

// Fallback images for Step 8 categorized by gender/style
const fallbackImages = import.meta.glob<{ default: string }>('../assets/create-character/placeholders/**/*.webp', { eager: true });

// Eagerly compute an initial placeholder so the first render never shows a blank image
function pickPlaceholder(genderFolder: string, styleFolder: string): string {
  const sources = Object.entries(fallbackImages)
    .filter(([path]) => path.includes(`/${genderFolder}/${styleFolder}/`))
    .map(([_, mod]) => mod.default);
  if (sources.length > 0) return sources[Math.floor(Math.random() * sources.length)];
  // Broader fallback: any image from that gender
  const broader = Object.entries(fallbackImages)
    .filter(([path]) => path.includes(`/${genderFolder}/`))
    .map(([_, mod]) => mod.default);
  if (broader.length > 0) return broader[Math.floor(Math.random() * broader.length)];
  return defaultGirl as string;
}
const initialBlurSrc = pickPlaceholder('female', 'realistic');

// ------------------------------------------------------------
// Types


// Small check badge used by selection cards (keeps build green)
export function CheckBadge() {
  return (
    <span className="absolute top-3 right-3 inline-flex items-center justify-center h-7 w-7 rounded-full bg-black/60 text-(--sf-purple-light) ring-1 ring-(--sf-purple-light)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

type Style = "Realistic" | "Anime";

type Form = {
  // Final save (profile)
  name: string;
  username: string;
  bio: string;
  privacy: "Private" | "Public" | "Unlisted";
  // Social links (optional)
  onlyfans?: string | null;
  fanvue?: string | null;
  tiktok?: string | null;
  instagram?: string | null;
  // Looks
  style?: Style;
  ethnicity?: string;
  age: number; // 18+
  eyeColor?: string;
  hairStyle?: string;
  hairColor?: string;
  bodyType?: string;
  breastSize?: string;
  dickSize?: string;
  buttSize?: string;
  // Persona
  personality?: string;
  libido: number;
  kink: number;
  nudity: number;
  spicyPhotos: boolean;
  voiceMessages: boolean;
  voice?: string;
  relationship?: string;
  hobbies: string[];
  // Styling
  clothing: string[]; // UI limits to 1, but keeping array for compatibility
  features: string[]; // Special Features selected
  background?: string[];
  blurSrc?: string;
  looking_for?: string;
};

const defaultForm: Form = {
  name: "",
  username: "",
  bio: "",
  privacy: "Private",
  age: 24,
  clothing: [],
  dickSize: undefined,
  features: [],
  background: [],
  hobbies: [], // Kept in state for safety, but unused
  libido: 50,
  kink: 50,
  nudity: 50,
  spicyPhotos: true,
  voiceMessages: true,
  onlyfans: undefined,
  fanvue: undefined,
  tiktok: undefined,
  instagram: undefined,
  blurSrc: initialBlurSrc,
  looking_for: "",
};

type Draft = {
  form?: Partial<Form>;
  gender?: string;
  step?: number;
};

// ------------------------------------------------------------
// Options
// ------------------------------------------------------------
// Ethnicity display labels (left side label -> filename token mapping defined below)
const ETHNICITIES = ["Black", "Caucasian", "Latina", "Indian", "Asian", "Arabic"];
const EYES = ["Brown", "Blue", "Green", "Yellow", "Red"];
const HAIR_STYLES = ["Straight", "Braids", "Bangs", "Curly", "Bun", "Short"];
const MALE_HAIR_STYLES = ["Bun", "Buzz Cut", "Curly", "Long", "Short", "Slick Back"];
const HAIR_COLORS = ["Black", "Blonde", "Pink", "Redhead", "Green", "Blue"];
const REAL_GIRL_HAIR_COLORS = ["Black", "Blonde", "Brunette", "Redhead", "Unnatural Colors", "No Preferences"];
const MALE_HAIR_COLORS = ["Black", "Blonde", "Pink", "Redhead", "Green", "Blue"];
const BODY_TYPES = ["Athletic", "Chubby", "Medium", "Muscular", "Slim"];
const MALE_BODY_TYPES = ["Athletic", "Medium", "Muscular", "Slim"];
const BREAST = ["Flat", "Small", "Medium", "Large", "XL"];
const BUTT = ["Small", "Medium", "Large", "Athletic"];
const DICK_SIZES = ["Small", "Medium", "Large", "Huge"];
// Relationships are provided per-gender via relationshipsForGender
const FEATURES = [
  "Pubic Hair",
  "Pregnant",
  "Glasses",
  "Freckles",
  "Tattoos",
  "Belly Piercing",
];

const FEATURES_MALE = ["Pubic Hair", "Glasses", "Tattoos", "Freckles"];

const CLOTHING_OPTIONS = [
  "Bikini",
  "Lingerie",
  "Maid Outfit",
  "Princess Outfit",
  "Witch Costume",
  "Corset",
  "Wedding Dress",
  "Nurse Outfit",
  "Pencil Dress",
  "Pajamas",
  "Police Uniform",
  "Military"
];

const BACKGROUND_OPTIONS = [
  "Bedroom",
  "Bathroom",
  "Beach",
  "Living Room",
  "Kitchen",
  "Office"
];

// Business rules
// Allow only a single clothing selection in the UI; backend will receive comma-separated list for compatibility

// ------------------------------------------------------------
// Small UI
// ------------------------------------------------------------
// Removed CheckBadge - using golden ring for selection instead

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className={`text-lg sm:text-xl font-semibold text-(--primary) mb-4 text-center`} style={{ color: 'var(--primary)' }}>{title}</h2>
      {children}
    </section>
  );
}


function OptionCard({
  label,
  selected,
  onClick,
  className,
  compact,
  imageUrl,
  emoji,
  emojiSize,
  readOnly,
  fullHeight,
  style,
  loading = 'lazy',
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
  imageUrl?: string | null;
  emoji?: React.ReactNode;
  emojiSize?: string;
  readOnly?: boolean;
  fullHeight?: boolean;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // -- Text/Emoji Card Styles --
  const selectedRingText = selected
    ? "ring-[3px] ring-(--sf-purple-light) shadow-[0_0_0_1px_var(--sf-purple-light),0_8px_24px_rgba(127,90,240,0.35)]"
    : "ring-1";

  const baseRingText = isDark ? "ring-white/8" : "ring-gray-200/60";

  // For text cards, we use the original ring logic
  const ringClass = !imageUrl ? (selected ? selectedRingText : baseRingText) : "";

  const hoverClass = !readOnly && !selected
    ? isDark
      ? "hover:ring-(--sf-purple-light)/40 hover:shadow-[0_4px_16px_rgba(127,90,240,0.15)]"
      : "hover:ring-(--sf-purple-light)/50 hover:shadow-[0_4px_16px_rgba(127,90,240,0.2)]"
    : "";

  const focusClass =
    "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-(--sf-purple-light) focus-visible:ring-offset-2 " +
    (isDark ? "focus-visible:ring-offset-[#000000]" : "focus-visible:ring-offset-white");

  const interactive = !readOnly && typeof onClick === 'function';

  // For text/emoji cards: fill with primary color when selected
  const textCardBg = selected && !imageUrl
    ? "bg-gradient-to-br from-[var(--sf-purple)] to-[var(--sf-pink)]"
    : isDark
      ? "bg-black/30"
      : "bg-white/60";

  const textColor = selected && !imageUrl ? "text-white" : isDark ? "text-white/95" : "text-gray-900";

  // -- Image Card Config (User Request) --
  // We apply these styles via inline `style` to match the exact specs provided
  const imageCardStyle: React.CSSProperties = imageUrl ? (
    selected ? {
      borderRadius: '10px',
      border: '1.5px solid var(--sf-purple-light)',
      background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.00) -10%, rgba(0, 0, 0, 0.92) 100%)',
      opacity: 1,
      boxShadow: '0 22px 40px rgba(88, 52, 176, 0.28), inset 0 0 0 1px rgba(217,178,255,0.18)',
    } : {
      borderRadius: '12px',
      border: '1.5px solid rgba(255, 255, 255, 0.50)',
      opacity: 0.9,
      backdropFilter: 'blur(1.5px)',
      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.22)',
    }
  ) : {};

  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      aria-pressed={selected}
      aria-selected={selected}
      disabled={readOnly}
      className={`relative overflow-hidden ${compact ? 'rounded-[10px]' : 'rounded-2xl'} ${ringClass} ${!imageUrl ? hoverClass : ""} transition-all duration-200 ${className ?? ""} ${readOnly ? "cursor-default" : "cursor-pointer"} ${focusClass} ${interactive ? 'hover:scale-[1.02]' : ''} ${compact ? 'p-0' : 'p-0'} ${textCardBg} backdrop-blur-sm ${fullHeight ? 'h-full w-full' : ''}`}
      style={{
        WebkitBackdropFilter: 'blur(12px)',
        ...imageCardStyle,
        ...(style || {})
      }}
    >
      {imageUrl ? (
        <div className={`w-full ${compact ? 'rounded-[10px]' : 'rounded-2xl'} overflow-hidden ${fullHeight ? 'h-full' : 'aspect-3/4'}`}
          style={selected ? { borderRadius: '9px' } : { borderRadius: '11px' }}
        >
          <LazyImage
            src={imageUrl}
            alt={label}
            className="w-full h-full object-cover object-top"
            loading={loading}
            placeholder="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3Crect width='100%25' height='100%25' fill='%23121212'/%3E%3C/svg%3E"
          />
          {/* Label overlay on image */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center p-2 bg-linear-to-t from-black/70 via-black/40 to-transparent pointer-events-none">
            <span className="px-3 py-1.5 text-[10px] sm:text-xs font-semibold text-white max-w-[90%] truncate">
              {label}
            </span>
          </div>
          {/* Selected indicator removed per user request */}
        </div>
      ) : emoji ? (
        <div className={`w-full ${fullHeight ? 'h-full min-h-0' : 'aspect-3/4'} flex flex-col items-center justify-center gap-2 p-4`}>
          <span style={emojiSize ? { fontSize: emojiSize } : undefined} className={`text-4xl sm:text-5xl ${compact ? 'text-3xl sm:text-4xl' : ''}`}>{emoji}</span>
          <span className={`text-xs sm:text-sm font-semibold ${textColor} max-w-[90%] truncate text-center`}>
            {label}
          </span>
        </div>
      ) : (
        <div className={`w-full ${fullHeight ? 'h-full' : 'aspect-3/4'} flex items-center justify-center p-4`}>
          <span className={`text-sm sm:text-base font-semibold ${textColor} max-w-[90%] truncate text-center`}>
            {label}
          </span>
        </div>
      )}
    </button>
  );
}

function ToggleTag({
  label,
  active,
  onToggle,
  className,
  style,
}: {
  label: string;
  active?: boolean;
  onToggle?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const selectedStyle = {
    borderRadius: '16px',
    border: '1px solid var(--sf-purple-light)',
    background: 'linear-gradient(126deg, #000 28.96%, rgba(127, 90, 240, 0.1) 262.7%)',
  };

  const normalStyle = {
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(255,255,255,0.04)',
  };

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (onToggle) onToggle(); }}
      className={`px-5 py-2.5 text-sm font-medium transition-all duration-200 backdrop-blur-sm ${className ?? ''}`}
      aria-pressed={!!active}
      aria-selected={!!active}
      style={{
        ...(active ? selectedStyle : normalStyle),
        ...(style || {}),
      }}
    >
      <span className={active ? "text-(--sf-purple-light)" : "text-white/90"}>{label}</span>
    </button>
  );
}

function ProgressDots({ step, total }: { step: number; total: number }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex items-center gap-2" aria-label="Progress">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full transition-all duration-200 ${i <= step
            ? "bg-(--sf-purple-light)"
            : isDark ? "bg-white/15" : "bg-gray-300"
            }`}
          aria-current={i === step ? "step" : undefined}
          aria-label={`Step ${i + 1}${i <= step ? " (completed)" : " (upcoming)"}`}
        />
      ))}
      <span className={`ml-2 text-xs font-medium ${isDark ? "text-white/60" : "text-gray-600"}`}>{step + 1}/{total}</span>
    </div>
  );
}




function getSpecialFeatureImage(label: string): string | null {
  const norm = label.toLowerCase();
  for (const k of Object.keys(specialFeaturesImages)) {
    const name = k.split('/').pop() || '';
    const n = name.toLowerCase();
    if (n.startsWith(norm) || n.includes(norm.replace(/ /g, '-')) || n.includes(norm.replace(/ /g, '_'))) {
      return specialFeaturesImages[k];
    }
  }
  return null;
}

function getRelationshipIcon(label: string): string | null {
  const possibleExt = ['.webp', '.png', '.jpg', '.jpeg', '.svg'];
  for (const k of Object.keys(relationshipIcons)) {
    for (const ext of possibleExt) {
      if (k.endsWith(`/${label}${ext}`)) return relationshipIcons[k];
    }
  }

  const norm = label.toLowerCase();
  for (const k of Object.keys(relationshipIcons)) {
    const name = k.split('/').pop() || '';
    const n = name.toLowerCase();
    if (n.startsWith(norm) || n.includes(norm.replace(/\s+/g, '-')) || n.includes(norm.replace(/\s+/g, '_'))) return relationshipIcons[k];
  }

  return null;
}

// Relationship emoji/meta for themed cards
const RELATION_META: Record<string, { icon: string; blurb?: string }> = {
  Stranger: { icon: '🕵️' },
  Schoolmate: { icon: '🎓' },
  Colleague: { icon: '💼' },
  Mentor: { icon: '🧑‍🏫' },
  Girlfriend: { icon: '💖' },
  'Sex Friend': { icon: '💋' },
  Wife: { icon: '💍' },
  Mistress: { icon: '👑' },
  Friend: { icon: '🧑‍🤝‍🧑' },
  Partner: { icon: '🤝' },
  Boyfriend: { icon: '💙' },
  Husband: { icon: '🤵' },
  Mister: { icon: '🧔' },
  Spouse: { icon: '💑' },
  Lover: { icon: '💘' },
};

// Occupation metadata matching screenshot design
const OCCUPATION_META: Record<string, { emoji: string }> = {
  Psychologist: { emoji: '🧠' },
  Nurse: { emoji: '🩺' },
  Professor: { emoji: '👩‍🏫' },
  Teacher: { emoji: '📚' },
  'Massage therapist': { emoji: '💆' },
  'Police officer': { emoji: '👮' },
  'Fitness coach': { emoji: '🏃' },
  Librarian: { emoji: '📖' },
  Secretary: { emoji: '💼' },
  Cook: { emoji: '👨‍🍳' },
  Artist: { emoji: '✨' },
  Student: { emoji: '🎓' },
  'Flight attendant': { emoji: '✈️' },
  Waitress: { emoji: '🔔' },
};

// Occupation options array for iteration
const OCCUPATIONS = Object.keys(OCCUPATION_META);

// OccupationCard component - sleek dark card with radio button style
function OccupationCard({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const meta = OCCUPATION_META[label] || { emoji: '🎭' };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!selected}
      aria-selected={!!selected}
      className={`relative flex items-center gap-3 w-full px-4 py-3.5 rounded-[18px] transition-all duration-200 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9d66ff] focus-visible:ring-offset-2 ${isDark ? "focus-visible:ring-offset-[#000000]" : "focus-visible:ring-offset-white"
        }`}
      style={{
        background: selected
          ? 'linear-gradient(180deg, rgba(127, 90, 240, 0.24) 0%, rgba(157, 102, 255, 0.12) 100%)'
          : isDark
            ? 'rgba(255, 255, 255, 0.045)'
            : 'rgba(255, 255, 255, 0.95)',
        border: selected
          ? '1.5px solid var(--sf-purple-light)'
          : isDark
            ? '1px solid rgba(255, 255, 255, 0.1)'
            : '1px solid rgba(0, 0, 0, 0.1)',
        boxShadow: selected
          ? '0 18px 34px rgba(88, 52, 176, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          : 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
      }}
    >
      {/* Radio button indicator */}
      <div
        className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${selected
          ? 'bg-(--sf-purple-light) ring-2 ring-(--sf-purple-light) ring-offset-2'
          : isDark
            ? 'bg-transparent ring-1 ring-white/30'
            : 'bg-transparent ring-1 ring-gray-400'
          }`}
        style={{
          '--ring-offset-color': isDark ? '#1a1a1a' : '#fff',
        } as React.CSSProperties}
      >
        {selected && (
          <div className="w-2 h-2 rounded-full bg-black" />
        )}
      </div>

      {/* Emoji */}
      <span className="text-xl shrink-0">{meta.emoji}</span>

      {/* Label */}
      <span
        className={`text-sm font-medium truncate ${selected
          ? 'text-white'
          : isDark
            ? 'text-white/90'
            : 'text-gray-800'
          }`}
      >
        {label}
      </span>
    </button>
  );
}

function RelationshipCard({ label, selected, onClick, compact, readOnly }: { label: string; selected?: boolean; onClick?: () => void; compact?: boolean; readOnly?: boolean }) {
  const { components } = useThemeStyles();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const cardBase = components.cardBase;

  const selectedClass = isDark
    ? "ring-2 ring-(--sf-purple-light) bg-(--sf-purple)/20 text-white border-[var(--sf-purple-light)] shadow-lg"
    : "ring-2 ring-(--sf-purple-light) bg-(--sf-purple)/10 text-gray-900 border-[var(--sf-purple-light)] shadow-[0_0_0_3px_rgba(127,90,240,0.25)]";

  // Selected inline style to enforce exact requested look (overrides global CSS where needed)
  const selectedStyle: React.CSSProperties = {
    borderRadius: '16px',
    border: '1px solid var(--sf-purple-light)',
    background: 'linear-gradient(126deg, #000 28.96%, rgba(127, 90, 240, 0.0) 262.7%)',
  };

  const baseHover = isDark ? "hover:ring-(--sf-purple-light)/60" : "hover:ring-(--sf-purple-light)/60";

  const focusClass =
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-(--sf-purple-light) " +
    (isDark ? "focus-visible:ring-offset-[#000000]" : "focus-visible:ring-offset-white");

  const meta = RELATION_META[label] || { icon: '🤝' };

  if (compact) {
    return (
      <button
        type="button"
        onClick={readOnly ? undefined : onClick}
        aria-pressed={!!selected}
        aria-selected={!!selected}
        disabled={readOnly}
        className={`relative overflow-hidden ${cardBase} ${selected ? selectedClass : baseHover} ${readOnly ? "cursor-default" : "cursor-pointer"} ${focusClass}`}
        style={selected ? selectedStyle : undefined}
      >
        <div className="flex flex-col items-center gap-2 p-2">
          <div className={`h-20 w-full rounded-xl grid place-items-center overflow-hidden ${isDark ? "bg-black/50" : "bg-gray-100"}`}>
            {(() => {
              const url = getRelationshipIcon(label);
              return url ? (
                <img src={url} alt={`${label} icon`} className="h-16 w-auto object-contain" />
              ) : (
                <span className="text-2xl">{meta.icon}</span>
              );
            })()}
          </div>
          <div className="text-center">
            <span
              className={`rounded-xl px-2 py-0.5 text-xs font-medium ${selected ? 'bg-(--sf-purple-light) text-white' : isDark ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              {label}
            </span>
          </div>
        </div>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={readOnly ? undefined : onClick}
      aria-pressed={!!selected}
      aria-selected={!!selected}
      disabled={readOnly}
      className={`relative overflow-hidden ${cardBase} p-6 flex flex-col items-center justify-center ${selected ? selectedClass : baseHover} transition-all duration-150 ${readOnly ? "cursor-default" : "cursor-pointer"} ${focusClass}`}
      style={selected ? selectedStyle : undefined}
    >
      <div className={`h-14 w-14 grid place-items-center rounded-xl ring-1 mb-4 ${isDark ? "bg-black/50 ring-white/10" : "bg-gray-100 ring-gray-200"
        }`}>
        {(() => {
          const url = getRelationshipIcon(label);
          return url ? (
            <img src={url} alt={`${label} icon`} className="h-10 w-auto object-contain" />
          ) : (
            <span className="text-2xl">{meta.icon}</span>
          );
        })()}
      </div>
      <div
        className={`text-lg font-medium truncate max-w-[12ch] text-center ${selected ? 'text-white' : (isDark ? 'text-white' : 'text-gray-900')}`}
      >
        {label}
      </div>
    </button>
  );
}


export default function CreateCharacter() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useAuth();
  const { showError, showSuccess } = useToastActions();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [initialDraft] = useState<Draft | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('hl_create_character_draft');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as Draft;
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [step, setStep] = useState<number>(() => (
    typeof initialDraft?.step === 'number' ? initialDraft.step : 0
  ));
  const totalSteps = 13;
  const [form, setForm] = useState<Form>(() => {
    if (initialDraft?.form && typeof initialDraft.form === 'object') {
      return { ...defaultForm, ...(initialDraft.form as Partial<Form>) };
    }
    return defaultForm;
  });
  const [gender, setGender] = useState<string>(() => (
    typeof initialDraft?.gender === 'string' && initialDraft.gender
      ? initialDraft.gender
      : 'Female'
  ));
  const [showStepHint, setShowStepHint] = useState<boolean>(false);
  // Social section collapsed by default on final profile step
  const [socialOpen, setSocialOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Dynamic creation progress messages
  const CREATION_PHASES = [
    'Analyzing preferences…',
    'Crafting your AI…',
    'Generating image…',
    'Applying personality…',
    'Almost ready…',
  ];
  const [creationPhase, setCreationPhase] = useState(0);
  const [creationProgress, setCreationProgress] = useState(0);
  useEffect(() => {
    if (!saving) { setCreationPhase(0); setCreationProgress(0); return; }
    // Tick progress up
    const progressTimer = setInterval(() => {
      setCreationProgress(p => {
        if (p >= 95) return 95; // cap at 95 until actually done
        return p + Math.floor(Math.random() * 4) + 1;
      });
    }, 300);
    // Rotate phase messages
    const phaseTimer = setInterval(() => {
      setCreationPhase(p => (p + 1) % CREATION_PHASES.length);
    }, 2200);
    return () => { clearInterval(progressTimer); clearInterval(phaseTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving]);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState<boolean>(false);
  const [generatedNames, setGeneratedNames] = useState<string[]>([]);

  // Track last gender to avoid re-processing the same gender event
  const lastGender = useRef<string>(gender);

  // Pick a random fallback character preview image based on gender + style
  const lastGenderStyle = useRef<string>('');
  useEffect(() => {
    const g = (gender || '').toLowerCase();
    const s = (form.style || '').toLowerCase();
    const key = `${g}|${s}`;

    // Only update if we don't have one yet, or gender/style changed
    if (!form.blurSrc || key !== lastGenderStyle.current) {
      // Map gender tab labels to folder names
      let gFolder = 'female';
      if (g === 'male' || g === 'guy' || g === 'guys') gFolder = 'male';
      else if (g === 'trans') gFolder = 'trans';

      // Map style to folder names
      const sFolder = s.includes('anime') ? 'anime' : 'realistic';

      // Filter matching images from the glob
      const sources = Object.entries(fallbackImages)
        .filter(([path]) => path.includes(`/${gFolder}/${sFolder}/`))
        .map(([_, mod]) => mod.default);

      if (sources.length > 0) {
        const selected = sources[Math.floor(Math.random() * sources.length)];
        setForm(f => ({ ...f, blurSrc: selected }));
      }
      lastGenderStyle.current = key;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender, form.style]);

  // Persist draft to sessionStorage whenever form, gender, or step changes
  useEffect(() => {
    try {
      sessionStorage.setItem('hl_create_character_draft', JSON.stringify({ form, gender, step }));
    } catch (err) {
      // ignore
    }
  }, [form, gender, step]);

  // Detect mobile viewport (matches Tailwind's md breakpoint)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      const mq = window.matchMedia('(max-width: 767px)');
      const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
      // Some browsers use addEventListener
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else mq.addListener(onChange as any);
      return () => {
        try {
          if (mq.removeEventListener) mq.removeEventListener('change', onChange);
          else mq.removeListener(onChange as any);
        } catch { }
      };
    } catch {
      // ignore
    }
  }, []);

  // Sidebar state management (sync with AppLayout)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      // Default to collapsed on small viewports so mobile always starts collapsed
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

  // Main heading larger, but subheadings consistently smaller
  const pageShellClass = "mx-auto w-full max-w-[1152px] px-1 pb-10 pt-2 sm:px-2 sm:pb-12 sm:pt-4";
  const heading = `text-2xl sm:text-3xl lg:text-4xl font-semibold leading-[1.06] ${isDark ? "text-white" : "text-gray-900"}`;
  const subheading = `text-lg sm:text-xl font-semibold text-(--primary) text-center`; // For "Choose..." titles
  // const sub = `text-sm ${isDark ? "text-white/60" : "text-gray-600"}`;
  const hint = `text-xs ${isDark ? "text-(--hl-gold)" : "text-(--hl-gold-strong)"}`;

  // Desktop-only fixed action bar ref
  const bottomBarRef = useRef<HTMLDivElement | null>(null);

  // Small, mobile-only gender selector pills reused from Header component
  const MobileGenderPills = ({ value, onChange }: { value: string; onChange: (g: string) => void }) => (
    <div className="sm:hidden mb-3 flex items-center gap-2">
      {[{ id: 'Female', label: 'Girl' }, { id: 'Male', label: 'Guys' }, { id: 'Trans', label: 'Trans' }].map(({ id, label }) => {
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            onClick={() => { onChange(id); try { genderService.setGender(id); } catch { } }}
            className={`px-5 py-1 min-w-18 text-sm font-medium transition-all ${selected ? 'ring-[1px] ring-(--hl-gold) shadow-[0_0_0_1px_rgb(255,197,77),0_8px_24px_rgba(255,197,77,0.35)]' : ''} ${isDark ? 'text-white/90' : 'text-gray-800'}`}
            style={selected ? { borderRadius: 50, border: '1px solid var(--secondary, #C09B62)', background: 'rgba(192, 155, 98, 0.18)' } : { borderRadius: 50, background: 'rgba(255, 255, 255, 0.10)' }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  // Placeholder fallback for Step 8 if form.blurSrc is missing (unlikely)
  const blurSrc = (defaultGirl as unknown as string);

  function validName(name?: string) {
    return typeof name === 'string' && name.trim().length >= 2;
  }
  function validUsername(u?: string) {
    return typeof u === 'string' && /^[a-zA-Z0-9_-]{3,20}$/.test(u);
  }

  // social URL validation helpers — use strict validator per social
  function socialValidation(s?: string | null, social?: Social): Validation {
    if (!s) return { valid: true };
    try {
      return isValidSocialUrl(s.trim(), social as Social);
    } catch (err) {
      return { valid: false, reason: 'Invalid' };
    }
  }

  const canNext = useMemo(() => {
    if (step === 0) return !!form.style;
    if (step === 1) return !!form.ethnicity && form.age >= 18;
    if (step === 2) return !!form.eyeColor;
    if (step === 3) return !!form.hairStyle;
    if (step === 4) return !!form.hairColor;
    if (step === 5) return !!form.bodyType;
    if (step === 6) {
      if (gender === 'Male') return !!form.dickSize;
      return !!form.breastSize;
    }
    if (step === 7) {
      if (gender === 'Male') return true;
      if (gender === 'Trans') return !!form.buttSize && !!form.dickSize;
      return !!form.buttSize;
    }
    if (step === 8) return !!form.relationship;
    if (step === 9) return Array.isArray(form.clothing) && form.clothing.length > 0;
    if (step === 10) return Array.isArray(form.background) && form.background.length > 0;
    if (step === 11) return true; // Special features are optional
    if (step === 12) {
      const onlyfansValid = socialValidation(form.onlyfans, 'onlyfans').valid;
      const fanvueValid = socialValidation(form.fanvue, 'fanvue').valid;
      const tiktokValid = socialValidation(form.tiktok, 'tiktok').valid;
      const instagramValid = socialValidation(form.instagram, 'instagram').valid;
      const hasBio = typeof form.bio === 'string' && form.bio.trim().length > 0;
      return validName(form.name) && validUsername(form.username) && hasBio && onlyfansValid && fanvueValid && tiktokValid && instagramValid;
    }
    return true;
  }, [step, form, gender]);

  const relationshipsForGender = useMemo(() => {
    if (gender === 'Male') {
      return [
        "Stranger",
        "Schoolmate",
        "Colleague",
        "Mentor",
        "Boyfriend",
        "Sex Friend",
        "Husband",
        "Mister",
        "Friend",
      ];
    }
    if (gender === 'Trans') {
      return [
        "Stranger",
        "Schoolmate",
        "Colleague",
        "Mentor",
        "Partner",
        "Sex Friend",
        "Spouse",
        "Lover",
        "Friend",
      ];
    }
    // default Female
    return [
      "Stranger",
      "Schoolmate",
      "Colleague",
      "Mentor",
      "Girlfriend",
      "Sex Friend",
      "Wife",
      "Mistress",
      "Friend",
    ];
  }, [gender]);

  // feature list adapts per gender:
  // - Male: use male-focused list
  // - Trans: include both sets but drop features that are logically female-only (e.g. 'Pregnant') by default
  // - Female/default: use general FEATURES
  const featureOptions = useMemo(() => {
    if (gender === 'Male') return FEATURES_MALE;
    if (gender === 'Trans') {
      // exclude clearly female-only features for a neutral default
      const neutral = FEATURES.filter((f) => f !== "Pregnant");
      return Array.from(new Set([...neutral, ...FEATURES_MALE]));
    }
    return FEATURES;
  }, [gender]);

  // Hair color options presented to the user.
  const hairColorOptions = useMemo(() => {
    if (gender === 'Male') return MALE_HAIR_COLORS;
    if (form.style !== 'Anime') return REAL_GIRL_HAIR_COLORS;
    return HAIR_COLORS;
  }, [gender, form.style]);

  // Kept for future dynamic asset loading (currently using static previews for performance)
  /*
  const categoryFolderMap: Record<string, string> = {
    ethnicity: 'ethnicity',
    eye_color: 'eye_color',
    hair_style: 'hair_style',
    hair_color: 'hair_color',
    body_type: 'body_type',
    breast_size: 'breast_size',
    butt_size: 'butt_size',
    dick_size: 'dick_size',
  };

  // small synonyms for options that don't match filenames exactly
  const synonyms: Record<string, string[]> = {
    black: ['afro', 'black'],
    latina: ['latino', 'latina'],
    mixed: ['mixed', 'mix'],
    caucasian: ['caucasian', 'white'],
  };

  // manual token mapping for specific categories (option -> filename token)
  const manualTokens: Record<string, Record<string, string>> = {
    ethnicity: {
      'black': 'afro',
      'caucasian': 'caucasian',
      'latina': 'latina',
      'latino': 'latina',
      'indian': 'indian',
      'asian': 'asian',
      'arabic': 'arabic',
    },
    // eye colors often match file names directly, but we can normalize common names
    eye_color: {
      brown: 'brown',
      blue: 'blue',
      green: 'green',
      yellow: 'yellow',
      red: 'red',
    },
    // hair styles and colors — map UI labels to common filename tokens
    hair_style: {
      straight: 'straight',
      braids: 'braids',
      bangs: 'bangs',
      curly: 'curly',
      bun: 'bun',
      short: 'short',
      long: 'long',
  ponytail: 'ponytail',
  bob: 'bob',
  'buzz cut': 'buzz_cut',
  'buzz_cut': 'buzz_cut',
  'slick back': 'slick_back',
  'slick_back': 'slick_back',
    },
    hair_color: {
      black: 'black',
      blonde: 'blonde',
      pink: 'pink',
      redhead: 'red',
      red: 'red',
      green: 'green',
      blue: 'blue',
      brown: 'brown',
      white: 'white',
      brunette: 'brunette',
      'unnatural colors': 'unnatural-colors',
      'no preferences': 'no-preferences',
    },
    // body and size mappings
    body_type: {
  athletic: 'athletic',
  chubby: 'chubby',
  medium: 'medium',
  muscular: 'muscular',
  slim: 'skinny',
    },
    breast_size: {
      flat: 'flat',
      small: 'small',
      medium: 'medium',
      large: 'large',
      xxl: 'xxl',
      xl: 'xxl',
    },
    butt_size: {
      small: 'small',
      medium: 'medium',
      large: 'large',
      athletic: 'athletic',
    },
    dick_size: {
      small: 'small',
      medium: 'medium',
      large: 'large',
      huge: 'huge',
    },
  };
  */

  // Simplified: use static image references which Vite will bundle efficiently
  function getOptionPreview(category: string, option: string): string | null {
    if (!option) return null;

    // Determine which image set to use based on current form state
    const isAnime = form.style === 'Anime';
    const isMale = gender === 'Male';
    const isTrans = gender === 'Trans';

    let imageMap: Record<string, string>;
    // For trans: use girl assets for all categories except dick_size (use boy assets for dick)
    if (isTrans && category === 'dick_size') {
      imageMap = isAnime ? animeBoyImages : realBoyImages;
    } else if (isTrans || !isMale) {
      // Trans uses girl assets, females use girl assets
      imageMap = isAnime ? animeGirlImages : realGirlImages;
    } else {
      // Males use boy assets
      imageMap = isAnime ? animeBoyImages : realBoyImages;
    }

    // Normalize option name to lowercase for file matching
    const optionLower = option.toLowerCase();

    // Map display names to actual filenames (gender and style-specific)
    let fileName = optionLower;

    // Ethnicity mappings
    if (category === 'ethnicity') {
      const ethnicityMap: Record<string, string> = {
        'black': 'afro',
        'caucasian': 'caucasian',
        'latina': isMale ? (isAnime ? 'latina' : 'latino') : 'latina',
        'indian': 'indian',
        'asian': 'asian',
        'arabic': 'arabic',
      };
      fileName = ethnicityMap[optionLower] || optionLower;
    }

    // Hair color mappings
    else if (category === 'hair_color') {
      const hairColorMap: Record<string, string> = {
        'blonde': 'blonde',
        'redhead': 'red',
        'black': 'black',
        'pink': 'pink',
        'green': 'green',
        'blue': 'blue',
        'brunette': 'brunette',
        'unnatural colors': 'unnatural-colors',
        'no preferences': 'no-preferences',
      };
      fileName = hairColorMap[optionLower] || optionLower;
    }

    // Hair style mappings
    else if (category === 'hair_style') {
      const hairStyleMap: Record<string, string> = {
        'buzz cut': 'buzz_cut',
        'slick back': 'slick_back',
        'straight': 'straight',
        'braids': 'braids',
        'bangs': 'bangs',
        'curly': 'curly',
        'bun': 'bun',
        'short': 'short',
        'long': 'long',
      };
      fileName = hairStyleMap[optionLower] || optionLower;
    }

    // Body type mappings - complex due to variations
    else if (category === 'body_type') {
      if (isAnime) {
        // Anime mappings
        const animeBodyMap: Record<string, string> = {
          'athletic': isMale ? 'athletic' : 'athlete',
          'chubby': 'chubby',
          'medium': isMale ? 'medium' : 'fit',
          'muscular': 'muscular',
          'slim': isMale ? 'slim' : 'skinny',
        };
        fileName = animeBodyMap[optionLower] || optionLower;
      } else {
        // Realistic mappings
        const realBodyMap: Record<string, string> = {
          'athletic': 'athletic',
          'chubby': 'chubby',
          'medium': isMale ? 'medium' : 'fit',
          'muscular': 'muscular',
          'slim': isMale ? 'slim' : 'skinny',
        };
        fileName = realBodyMap[optionLower] || optionLower;
      }
    }

    // Eye color - same for all
    else if (category === 'eye_color') {
      const eyeColorMap: Record<string, string> = {
        'brown': 'brown',
        'blue': 'blue',
        'green': 'green',
        'yellow': 'yellow',
        'red': 'red',
      };
      fileName = eyeColorMap[optionLower] || optionLower;
    }

    // Breast/butt/dick sizes - use as-is
    else {
      fileName = optionLower;
    }

    // Build the path pattern to search for
    const pathPattern = `${category}/${fileName}.`;

    // Find matching image in the map
    const find = (pattern: string) => {
      for (const [path, url] of Object.entries(imageMap)) {
        if (path.includes(pattern)) return url;
      }
      return null;
    };

    let url = find(pathPattern);

    // Fallbacks for known filename inconsistencies between anime/real assets
    if (!url) {
      // breast_size: anime assets use 'xxl' while real uses 'xl' — try both
      if (category === 'breast_size' && fileName === 'xl') {
        url = find(`${category}/xxl.`) || find(`${category}/xl.`);
      }
    }

    return url;
  }

  // helper: map dick size to repeated eggplant emoji (small=1, medium=2, large=3, huge=4)
  function getDickEmoji(size?: string) {
    if (!size) return '🍆';
    const s = size.toLowerCase();
    const map: Record<string, number> = {
      small: 1,
      medium: 2,
      large: 3,
      huge: 4,
    };
    const count = map[s] ?? 1;
    return '🍆'.repeat(count);
  }

  // A small hint per step if user tries to advance without completing
  const stepRequirementHint = useMemo(() => {
    switch (step) {
      case 0:
        return "Select a style (Realistic or Anime) to continue.";
      case 1:
        return "Pick an ethnicity and make sure age is 18+.";
      case 2:
        return "Choose an eye color.";
      case 3:
        return "Choose a hair style.";
      case 4:
        return "Choose a hair color.";
      case 5:
        return "Choose a body type.";
      case 6:
        return gender === 'Male' ? "Choose a dick size." : "Choose a breast size.";
      case 7:
        if (gender === 'Trans') return "Choose a butt size and a dick size.";
        return "Choose a butt size.";
      case 8:
        return "Choose a relationship.";
      case 9:
        return "Choose at least one outfit.";
      case 10: {
        return "Choose at least one background.";
      }
      case 11:
        return "Choose optional special features to continue.";
      case 12: {
        if (!validName(form.name)) return "Enter a valid name (at least 2 characters).";
        return "";
      }
      default:
        return "";
    }
  }, [step, form, gender]);

  // listen for global gender changes
  useEffect(() => {
    function onGender(e: any) {
      const g = e?.detail || (typeof e === 'string' ? e : null);
      if (g) {
        if (g === lastGender.current) return;
        lastGender.current = g;
        // set gender, clear any in-progress form and start over
        setGender(g);
        setForm(defaultForm);
        setStep(0);
        setShowStepHint(false);
        try { sessionStorage.removeItem('hl_create_character_draft'); } catch { }
      }
    }
    window.addEventListener('hl_gender_changed', onGender as EventListener);
    return () => window.removeEventListener('hl_gender_changed', onGender as EventListener);
  }, []);

  // ensure any change to `gender` after initial mount restarts the flow
  const _mounted = useRef(false);
  useEffect(() => {
    if (!_mounted.current) {
      _mounted.current = true;
      return;
    }
    // gender changed after mount -> restart
    setForm(defaultForm);
    setStep(0);
    setShowStepHint(false);
    try { sessionStorage.removeItem('hl_create_character_draft'); } catch { }
  }, [gender]);

  // clear male-only fields when gender is not male
  useEffect(() => {
    if (gender !== 'Male') {
      setForm((f) => ({ ...f, dickSize: undefined }));
    }
  }, [gender]);

  const next = () => setStep((s) => {
    let nextStep = Math.min(totalSteps - 1, s + 1);
    // Male flow skips step 7 (butt-size page).
    if (gender === 'Male' && nextStep === 7) nextStep = Math.min(totalSteps - 1, nextStep + 1);
    return nextStep;
  });
  const prev = () => setStep((s) => {
    let prevStep = Math.max(0, s - 1);
    // Male flow skips step 7 (butt-size page).
    if (gender === 'Male' && prevStep === 7) prevStep = Math.max(0, prevStep - 1);
    return prevStep;
  });

  // Auto-scroll to top whenever the step changes (fixes mobile staying at bottom)
  useEffect(() => {
    try {
      // Smooth scroll on mobile for nicer UX, instant on desktop
      const behavior = isMobile ? 'smooth' : 'auto';
      window.scrollTo({ top: 0, behavior: behavior as ScrollBehavior });
    } catch (err) {
      // ignore
    }
  }, [step, isMobile]);

  // Auto-generate a name when user enters the final step (step 12)
  useEffect(() => {
    if (step === 12 && !form.name && !isGeneratingMetadata) {
      const femaleNames = ["Maha", "Simran", "Priya", "Emily", "Sarah", "Anna", "Chloe", "Mia", "Zoe", "Lily", "Aisha", "Maria", "Luna", "Sophia", "Ava", "Isla", "Layla", "Nora", "Aria", "Leah"];
      const maleNames = ["James", "Alex", "Leo", "Noah", "Liam", "Kai", "Lucas", "Ryan", "Jake", "Ethan", "Max", "Ravi", "Adrian", "Marcus", "Theo"];
      const names = gender === 'Male' ? maleNames : femaleNames;
      setForm((f) => ({ ...f, name: names[Math.floor(Math.random() * names.length)] }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Trigger early metadata generation when reaching Occupation and Summary if missing
  useEffect(() => {
    const isStep12MissingBio = step === 12 && !form.bio && !isGeneratingMetadata && user;
    const isStep8FirstTrigger = step === 8 && !form.name && !isGeneratingMetadata && user;
    
    if (isStep12MissingBio || isStep8FirstTrigger) {
      preGenerateMetadata();
    }
  }, [step, user, form.bio]);

  async function preGenerateMetadata() {
    try {
      setIsGeneratingMetadata(true);
      const url = buildApiUrl('/characters/generate-metadata-preview'); // Match backend route
      const payload = {
        gender,
        style: form.style,
        ethnicity: form.ethnicity,
        age: form.age,
        personality: `Libido: ${form.libido}%, Kink: ${form.kink}%, Nudity: ${form.nudity}%`,
        relationship_type: form.relationship,
        clothing: form.clothing.join(', '),
        background: (form.background || []).join(', '),
        special_features: form.features.join(', ')
      };

      const res = await fetchWithAuth(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_data: payload }),
      });

      if (res.ok) {
        const data = await res.json();
        const namesList = Array.isArray(data.character_names) ? data.character_names : [];
        const firstName = namesList.length > 0 ? namesList[0] : (data.character_name || '');
        
        if (namesList.length > 1) {
          setGeneratedNames(namesList.slice(1));
        }

        setForm(f => ({
          ...f,
          name: f.name || firstName,
          bio: f.bio || data.bio,
          looking_for: f.looking_for || data.looking_for
        }));
      }
    } catch (err) {
      console.warn('Metadata pre-generation failed', err);
    } finally {
      setIsGeneratingMetadata(false);
    }
  }

  // On mobile we show a shorter, action-oriented label
  // On mobile we show a shorter, action-oriented label
  const primaryLabel = (() => {
    if (step === 12) return "Create Character";
    return "Next";
  })();

  const handlePrimary = () => {
    if (!canNext) {
      if (step === 12) {
        // Show validation popup for the final step
        showError("Validation Error", stepRequirementHint || "Please check your inputs.");
      }
      setShowStepHint(true);
      return;
    }

    // Steps 0-11 just go to the next step
    if (step < 12) {
      next();
      return;
    }

    // Step 12 is the final save step
    // If not logged in, redirect to login and return to this page
    if (!token) {
      // preserve current location so login can return here
      try {
        sessionStorage.setItem('hl_create_character_draft', JSON.stringify({ form, gender, step }));
      } catch (err) {
        console.warn('Failed to persist draft before login redirect', err);
      }
      navigate('/login', { state: { from: location } });
      return;
    }
    // logged in -> call backend API
    saveCharacter();
  };

  // Build payload matching backend schema and POST to API
  async function saveCharacter() {
    try {
      setSaving(true);

      const url = buildApiUrl('/characters/create');

      // Prepare hobbies string
      const hobbiesStr = (Array.isArray(form.hobbies) && form.hobbies.length > 0) ? form.hobbies.join(', ') : '';
      const finalBio = form.bio || '';

      // Helper to determine picture_shot_type based on clothing
      const getShotType = (clothes: string[]): string => {
        // By default use Upper Body for the simplified flat options list.
        return "Upper Body";
      };

      const payload = {
        username: form.username ?? null,
        name: form.name ?? null,
        bio: finalBio,
        gender: gender ?? null,
        style: (form.style as string) ?? null,
        ethnicity: form.ethnicity ?? null,
        age: typeof form.age === 'number' ? form.age : null,
        eye_colour: form.eyeColor ?? null,
        hair_style: form.hairStyle ?? null,
        hair_colour: form.hairColor ?? null,
        body_type: form.bodyType ?? null,
        breast_size: form.breastSize ?? null,
        butt_size: form.buttSize ?? null,
        dick_size: form.dickSize ?? null,
        personality: `Libido: ${form.libido}%, Kink Openness: ${form.kink}%, Comfort with Nudity: ${form.nudity}%, Spicy Photos: ${form.spicyPhotos ? 'Yes' : 'No'}, Voice Messages: ${form.voiceMessages ? 'Yes' : 'No'}`,
        voice_type: form.voice ?? null,
        relationship_type: form.relationship ?? null,
        // NOTE: privacy removed from UI; keep in payload but pass null per current requirement
        privacy: null,
        // send clothing as comma-separated list
        clothing: (Array.isArray(form.clothing) && form.clothing.length > 0) ? form.clothing.join(', ') : null,
        picture_shot_type: getShotType(form.clothing),
        special_features: (Array.isArray(form.features) && form.features.length > 0) ? form.features.join(', ') : null,
        hobbies: null, // Hobbies removed from UI
        background: (Array.isArray(form.background) && form.background.length > 0) ? form.background.join(', ') : null,
        enhanced_prompt: null,
        onlyfans_url: form.onlyfans ?? null,
        fanvue_url: form.fanvue ?? null,
        tiktok_url: form.tiktok ?? null,
        instagram_url: form.instagram ?? null,
        looking_for: form.looking_for ?? null,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetchWithAuth(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        let msg = raw;
        let parsed: any = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
          if (parsed && typeof parsed === 'object') msg = parsed.message || JSON.stringify(parsed);
        } catch { }

        // Prefer backend 'detail' if present, fall back to 'message' or raw text
        const detail = parsed?.detail ?? parsed?.message ?? parsed?.error ?? msg;
        const detailText = String(typeof detail === 'string' ? detail : JSON.stringify(detail ?? '')).toLowerCase();

        const isSubscriptionIssue =
          detailText.includes('subscription inactive') ||
          detailText.includes('please subscribe') ||
          detailText.includes('subscription required') ||
          detailText.includes('no active subscription');

        const isTokenIssue =
          detailText.includes('insufficient token') ||
          detailText.includes('not enough token') ||
          detailText.includes('insufficient balance') ||
          detailText.includes('token balance') ||
          detailText.includes('buy token');

        if (isSubscriptionIssue || isTokenIssue || res.status === 402) {
          navigate(isSubscriptionIssue ? '/premium' : '/buy-tokens', {
            state: { from: location, reason: 'create-character' },
          });
          return;
        }

        if (res.status === 401) {
          try {
            sessionStorage.setItem('hl_create_character_draft', JSON.stringify({ form, gender, step }));
          } catch {}
          navigate('/login', { state: { from: location } });
          return;
        }

        if (res.status >= 400 && res.status < 500) {
          showError('Failed to save character', detail || `Server returned ${res.status}`);
        } else if (res.status >= 500) {
          console.warn('CreateCharacter: server error', res.status, parsed ?? msg);
          showError('Failed to save character', 'Unable to process your request currently.');
        } else {
          showError('Failed to save character', `Server returned ${res.status}: ${msg}`);
        }

        return;
      }

      const data = await res.json().catch(() => null);
      console.log('Character created', data);
      // clear any saved draft now that the character is saved
      try {
        sessionStorage.removeItem('hl_create_character_draft');
      } catch (err) { }
      // show success toast
      showSuccess('Character saved', 'Your character was saved successfully.');
      // navigate to Chat page with the new character
      try {
        const slug = generateSlug(data.name || data.username, data.id);
        navigate(`/chat/${slug}`);
      } catch (err) {
        console.warn('Navigation to chat failed, falling back to /my-ai', err);
        navigate('/my-ai');
      }
    } catch (err: any) {
      console.error('Error saving character', err);
      const msg = err?.message || String(err);

      const low = String(msg).toLowerCase();
      const isSubscriptionIssue =
        low.includes('subscription inactive') ||
        low.includes('please subscribe') ||
        low.includes('subscription required') ||
        low.includes('no active subscription');
      const isTokenIssue =
        low.includes('insufficient token') ||
        low.includes('not enough token') ||
        low.includes('insufficient balance') ||
        low.includes('token balance') ||
        low.includes('buy token');

      if (isSubscriptionIssue || isTokenIssue) {
        navigate(isSubscriptionIssue ? '/premium' : '/buy-tokens', {
          state: { from: location, reason: 'create-character' },
        });
        return;
      }

      showError('Error saving character', msg);
    } finally {
      setSaving(false);
    }
  }

  // keep button styled even when locked by controlling clicks in JS
  const isLocked = !canNext;

  // clothing single-select helper
  const toggleClothing = (c: string) => {
    setForm((f) => {
      const active = f.clothing.includes(c);
      if (active) return { ...f, clothing: f.clothing.filter((x) => x !== c) };
      // Single-select: replace with the selected item (keeps array type for compatibility)
      return { ...f, clothing: [c] };
    });
  };

  return (
    <div
      className={pageShellClass}
      // Ensure there is ample bottom padding so the footer/action buttons
      // (desktop action bar and mobile inline buttons) do not overlap the content.
      // Use a larger value on desktop to comfortably clear the bottom bar.
      style={{ paddingBottom: isMobile ? '160px' : '120px' }}
    >
      <SEOHead
        title="Create AI Character - Custom AI Girlfriend & Companion | SheFeels"
        description="Create your perfect AI girlfriend or companion with SheFeels's character creator. Customize appearance, personality, and traits to build your ideal AI character."
        keywords="create AI character, custom AI girlfriend, AI character creator, personalized AI companion, build AI character, AI girlfriend maker"
        canonical="/create-character"
      />
      {/* Page header (rendered outside of the main rounded container to match Figma) */}
      <div className="mb-5 px-1 sm:px-4">
        {/* Mobile gender pills placed above the heading */}
        <MobileGenderPills value={gender} onChange={(g) => setGender(g)} />
        <h1 className={heading}>
          <span style={{ color: 'var(--Grays-White, #FFF)' }}>Create Your </span>
          <span style={{ color: 'var(--sf-purple-light)' }}>
            {`own AI ${gender === 'Male' ? 'Boy' : gender === 'Female' ? 'Girl' : 'Companion'}`}
          </span>
        </h1>
        <p className={`mt-2.5 font-medium ${isDark ? 'text-white/70' : 'text-gray-700'} text-xs sm:text-sm md:text-base`}>
          She will do whatever you want. It's yours
        </p>
      </div>

      {/* Add a subtle golden border around the main content to match Figma */}
      <div className={`${step === 0 ? 'max-w-3xl' : 'max-w-6xl'} mx-auto w-full rounded-[24px] ${step === 0 ? 'p-2 sm:p-4 md:p-5 pb-3' : 'p-3 sm:p-6 md:p-8'} border-2 ${step === 0 ? '' : 'flex flex-col min-h-[70vh]'} ${isDark
        ? "bg-[#050505] border-[#7F5AF0]/20 shadow-[0_0_0_1px_rgba(127,90,240,0.06),0_15px_50px_rgba(0,0,0,0.3)]"
        : "bg-white border-[#7F5AF0]/12 shadow-[0_15px_50px_rgba(0,0,0,0.06)]"
        }`}>
        {/* Progress dots: centered on mobile, right-aligned on md+ (keep desktop unchanged) */}
        <div className="flex items-center justify-center md:justify-end">
          <ProgressDots step={step} total={totalSteps} />
        </div>

        {/* Step content */}
        <div className={`${step === 0 ? 'mt-2' : 'mt-7 flex-1'}`}>
          {/* Step 0: Style */}
          {step === 0 && (
            <div>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-2 gap-2.5 sm:gap-4 items-start justify-center">
                <div className="flex justify-center w-full">
                  <div className="aspect-9/16 sm:aspect-2/3 w-full max-w-[188px] sm:max-w-[260px]">
                    <OptionCard
                      label={"Realistic"}
                      selected={form.style === "Realistic"}
                      onClick={() => { setForm({ ...form, style: "Realistic" }); next(); }}
                      imageUrl={getPreviewImage("Realistic", gender) as string}
                      compact
                      fullHeight
                      loading="eager"
                    />
                  </div>
                </div>

                <div className="flex justify-center w-full">
                  <div className="aspect-9/16 sm:aspect-2/3 w-full max-w-[188px] sm:max-w-[260px]">
                    <OptionCard
                      label={"Anime"}
                      selected={form.style === "Anime"}
                      onClick={() => { setForm({ ...form, style: "Anime" }); next(); }}
                      imageUrl={getPreviewImage("Anime", gender) as string}
                      compact
                      fullHeight
                      loading="eager"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Ethnicity + Age */}
          {step === 1 && (
            <div>
              <h2 className={subheading} style={{ color: 'var(--primary)' }}>Ethnicity</h2>
              {/* Ethnicity grid: larger on mobile for better visibility */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-4">
                {ETHNICITIES.map((e) => (
                  <OptionCard
                    key={e}
                    label={e}
                    selected={form.ethnicity === e}
                    onClick={() => {
                      setForm({ ...form, ethnicity: e });
                      setTimeout(next, 0);
                    }}
                    imageUrl={getOptionPreview('ethnicity', e) as string}
                    compact
                  />
                ))}
              </div>

              <Section title="Age">
                <div className="flex items-center gap-4">
                  <span className={isDark ? "text-white/70" : "text-gray-600"}>18+</span>
                  <input
                    type="range"
                    min={18}
                    max={60}
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
                    className="w-full accent-(--sf-purple-light)"
                  />
                  <span className={isDark ? "text-white/70" : "text-gray-600"}>60</span>
                  <div className={`shrink-0 h-10 min-w-10 flex items-center justify-center rounded-xl font-bold ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-black'}`}>
                    {form.age}
                  </div>
                </div>
              </Section>

            </div>
          )}

          {/* Step 2: Eye Color */}
          {step === 2 && (
            <div>
              <h2 className={subheading} style={{ color: 'var(--primary)' }}>Eye Color</h2>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8">
                {EYES.map((c) => (
                  <OptionCard
                    key={c}
                    label={c}
                    selected={form.eyeColor === c}
                    onClick={() => {
                      setForm({ ...form, eyeColor: c });
                      setTimeout(next, 0);
                    }}
                    imageUrl={getOptionPreview('eye_color', c) as string}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Hair Style */}
          {step === 3 && (
            <div>
              <h2 className={subheading} style={{ color: 'var(--primary)' }}>Hair Style</h2>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 sm:gap-6">
                {(gender === 'Male' ? MALE_HAIR_STYLES : HAIR_STYLES).map((s) => (
                  <OptionCard key={s} label={s} selected={form.hairStyle === s} onClick={() => {
                    setForm({ ...form, hairStyle: s });
                    setTimeout(next, 0);
                  }} imageUrl={getOptionPreview('hair_style', s) as string} />
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Hair Color */}
          {step === 4 && (
            <div>
              <h2 className={subheading} style={{ color: 'var(--primary)' }}>Hair Color</h2>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 sm:gap-6">
                {hairColorOptions.map((c) => (
                  <OptionCard key={c} label={c} selected={form.hairColor === c} onClick={() => {
                    setForm({ ...form, hairColor: c });
                    setTimeout(next, 0);
                  }} imageUrl={getOptionPreview('hair_color', c) as string} />
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Body Type */}
          {step === 5 && (
            <div>
              <h2 className={subheading} style={{ color: 'var(--primary)' }}>Body Type</h2>
              <div className={`mt-6 grid grid-cols-2 sm:grid-cols-3 ${gender === 'Male' ? 'lg:grid-cols-4' : 'lg:grid-cols-5'} gap-6 sm:gap-6`}>
                {(gender === 'Male' ? MALE_BODY_TYPES : BODY_TYPES).map((b) => (
                  <OptionCard key={b} label={b} selected={form.bodyType === b} onClick={() => {
                    setForm({ ...form, bodyType: b });
                    setTimeout(next, 0);
                  }} imageUrl={getOptionPreview('body_type', b) as string} />
                ))}
              </div>
            </div>
          )}

          {/* Step 6: Breast Size / Dick Size */}
          {step === 6 && (
            <div>
              {gender === 'Male' ? (
                <>
                  <h2 className={subheading} style={{ color: 'var(--primary)' }}>Dick Size</h2>
                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                    {DICK_SIZES.map((d) => {
                      const token = d;
                      const url = getOptionPreview('dick_size', token) as string | null;
                      return (
                        <OptionCard
                          key={d}
                          label={d}
                          selected={form.dickSize === d}
                          onClick={() => {
                            setForm({ ...form, dickSize: d });
                            setTimeout(next, 0);
                          }}
                          imageUrl={url}
                          emoji={!url ? getDickEmoji(d) : null}
                        />
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <h2 className={subheading} style={{ color: 'var(--primary)' }}>Breast Size</h2>
                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-6">
                    {BREAST.map((b) => (
                      <OptionCard
                        key={b}
                        label={b}
                        selected={form.breastSize === b}
                        onClick={() => {
                          setForm({ ...form, breastSize: b });
                          setTimeout(next, 0);
                        }}
                        imageUrl={getOptionPreview('breast_size', b) as string}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 7: Butt Size (and Dick Size for Trans) */}
          {step === 7 && (
            <div>
              {gender !== 'Male' && (
                <>
                  <h2 className={subheading} style={{ color: 'var(--primary)' }}>Butt Size</h2>
                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-6">
                    {BUTT.map((b) => (
                      <OptionCard key={b} label={b} selected={form.buttSize === b} onClick={() => {
                        setForm({ ...form, buttSize: b });
                        if (gender !== 'Trans' || form.dickSize) setTimeout(next, 0);
                      }} imageUrl={getOptionPreview('butt_size', b) as string} />
                    ))}
                  </div>
                </>
              )}

              {gender === 'Trans' && (
                <Section title="Dick Size">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">{DICK_SIZES.map((d) => {
                    const token = d;
                    const url = getOptionPreview('dick_size', token) as string | null;
                    return (
                      <OptionCard
                        key={d}
                        label={d}
                        selected={form.dickSize === d}
                        onClick={() => {
                          setForm({ ...form, dickSize: d });
                          if (form.buttSize) setTimeout(next, 0);
                        }}
                        imageUrl={url}
                        emoji={!url ? getDickEmoji(d) : null}
                      />
                    );
                  })}
                  </div>
                </Section>
              )}
            </div>
          )}

          {/* Step 8: Occupation (Relationship) */}
          {step === 8 && (
            <div>
              <h2 className="text-center text-xl font-semibold text-(--primary)" style={{ color: 'var(--primary)' }}>Occupation</h2>
              <p className="text-center text-sm text-white/60 mt-2 mb-6">Select your character's profession</p>
              <div className="grid grid-cols-1 gap-3 max-w-3xl mx-auto sm:grid-cols-2">
                {OCCUPATIONS.map((occupation) => (
                  <OccupationCard
                    key={occupation}
                    label={occupation}
                    selected={form.relationship === occupation}
                    onClick={() => { setForm({ ...form, relationship: occupation }); next(); }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Step 9: Clothing */}
          {step === 9 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h2 className={subheading} style={{ color: 'var(--primary)' }}>Outfit</h2>
                <p className="text-center text-sm text-white/60 mt-2">Select your character's attire</p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-3xl mx-auto sm:grid-cols-3">
                {CLOTHING_OPTIONS.map((item) => {
                  const active = form.clothing.includes(item);
                  return (
                    <ToggleTag
                      key={item}
                      label={item}
                      active={active}
                      onToggle={() =>
                        setForm((f) => {
                          const newForm = { ...f, clothing: [item] };
                          setTimeout(next, 0); // Small delay for visual feedback of selection
                          return newForm;
                        })
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 10: Background */}
          {step === 10 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h2 className={subheading} style={{ color: 'var(--primary)' }}>Background</h2>
                <p className="text-center text-sm text-white/60 mt-2">Select your character's environment</p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-3xl mx-auto sm:grid-cols-3">
                {BACKGROUND_OPTIONS.map((item) => {
                  const active = form.background?.includes(item);
                  return (
                    <ToggleTag
                      key={item}
                      label={item}
                      active={active}
                      onToggle={() =>
                        setForm((f) => {
                          const newForm = { ...f, background: [item] };
                          setTimeout(next, 0);
                          return newForm;
                        })
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 11: Special Features */}
          {step === 11 && (
            <div>
              <h2 className={subheading} style={{ color: 'var(--primary)' }}>Features</h2>
              <p className="text-center text-sm text-white/60 mt-2 mb-6">Select optional special features for your character</p>
              <div className="grid grid-cols-3 gap-3 max-w-4xl mx-auto sm:grid-cols-4 lg:grid-cols-6">
                {featureOptions.map((feature) => {
                  const active = form.features.includes(feature);
                  const imageUrl = getSpecialFeatureImage(feature);
                  return (
                    <div key={feature} className="aspect-square w-full">
                      <OptionCard
                        label={feature}
                        selected={active}
                        imageUrl={imageUrl as string}
                        compact
                        fullHeight
                        onClick={() => {
                          setForm((f) => ({
                            ...f,
                            features: active ? f.features.filter((x) => x !== feature) : [...f.features, feature],
                          }));
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 12 && (() => {
            return (
            <div>
              {/* Keyframes for pulsating blur animation */}
              <style>{`
                @keyframes blurPulse {
                  0%, 100% { filter: blur(8px); transform: scale(1.08); }
                  50% { filter: blur(14px); transform: scale(1.14); }
                }
              `}</style>
              {/* Desktop: side-by-side | Mobile: stacked */}
              <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">

                {/* LEFT: Blurred Character Preview */}
                <div className={`w-full md:w-85 md:shrink-0 rounded-[20px] p-4 flex flex-col items-center ${isDark ? 'bg-[#111]' : 'bg-gray-100'}`}>
                  <div className="relative w-full aspect-3/4 rounded-2xl overflow-hidden mb-3 shadow-lg">
                    <img 
                      src={(form.blurSrc || defaultGirl) as string}
                      alt="Character preview" 
                      className="w-full h-full object-cover select-none pointer-events-none"
                      style={{ 
                        animation: 'blurPulse 5s ease-in-out infinite',
                        filter: 'blur(8px)',
                        transform: 'scale(1.08)',
                        willChange: 'filter, transform'
                      }}
                    />
                    {/* Dark secret overlay */}
                    <div className="absolute inset-0 bg-black/10 backdrop-blur-[0.5px]" />
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-linear-to-t from-black/50 via-black/10 to-transparent" />

                    {/* Lock icon centered */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl opacity-60">🔒</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl" style={{ background: 'rgba(127, 90, 240, 0.10)' }}>
                    <span className="text-(--sf-purple-light) text-sm">🔒</span>
                    <p className={`text-xs font-medium ${isDark ? 'text-white/70' : 'text-gray-600'}`}>Your AI will remain private. Only you will see it</p>
                  </div>
                </div>

                {/* RIGHT: Name + Personality controls */}
                <div className="flex-1 w-full min-w-0">

                  {/* Name Generator */}
                  <div className="mb-5">
                    <h3 className={`text-base font-semibold mb-2 ${isDark ? "text-white" : "text-black"}`}>Name your AI {gender === 'Male' ? 'Boyfriend' : gender === 'Female' ? 'Girlfriend' : 'Companion'}</h3>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={form.name} 
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className={`flex-1 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-(--sf-purple-light)/50 transition-colors text-base font-medium ${isDark ? "bg-black/40 ring-1 ring-white/10 text-white placeholder-white/30" : "bg-gray-100 ring-1 ring-gray-300 text-black placeholder-gray-400"}`} 
                        placeholder={isGeneratingMetadata ? "Generating name..." : "Enter name"}
                      />
                      <button 
                        onClick={() => {
                          if (generatedNames.length > 0) {
                            // Pop next name from LLM generated list
                            const nextName = generatedNames[0];
                            setGeneratedNames(prev => prev.slice(1));
                            setForm(f => ({ ...f, name: nextName }));
                          } else {
                            // Fallback if list is empty
                            const femaleNames = ["Maha", "Simran", "Priya", "Emily", "Sarah", "Anna", "Chloe", "Mia", "Zoe", "Lily", "Aisha", "Maria", "Luna", "Sophia", "Ava", "Isla", "Layla", "Nora", "Aria", "Leah"];
                            const maleNames = ["James", "Alex", "Leo", "Noah", "Liam", "Kai", "Lucas", "Ryan", "Jake", "Ethan", "Max", "Ravi", "Adrian", "Marcus", "Theo"];
                            const arr = gender === 'Male' ? maleNames : femaleNames;
                            setForm((f) => ({ ...f, name: arr[Math.floor(Math.random() * arr.length)] }));
                          }
                        }}
                        className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-sm shrink-0"
                        style={{
                          background: 'linear-gradient(180deg, #7F5AF0 0%, #9d66ff 100%)',
                          border: '1px solid var(--sf-purple-light)',
                        }}
                      >
                        <span className="text-black text-lg font-bold">↻</span>
                      </button>
                    </div>
                  </div>

                  {/* Personality Attributes */}
                  <div className={`p-4 sm:p-5 rounded-[20px] ${isDark ? "bg-[#111] border border-(--sf-purple-light)/10" : "bg-white border border-gray-200 shadow-sm"}`}>
                    
                    {/* Looking for */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-(--sf-purple-light) text-base">💜</span>
                        <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-black"}`}>You're looking for</span>
                      </div>
                      <div className={`inline-block px-4 py-2 rounded-xl text-sm font-medium ${isDark ? "bg-white/5 text-white/80 ring-1 ring-white/10" : "bg-gray-100 text-gray-700"}`}>
                        {isGeneratingMetadata ? "AI is thinking..." : (form.looking_for || "A safe, non-judgemental space")}
                      </div>
                    </div>

                    {/* Bio Preview */}
                    <div className="mb-4 pt-3 border-t border-(--sf-purple-light)/10">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-(--sf-purple-light) text-base">📖</span>
                          <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-black"}`}>Bio Preview</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => preGenerateMetadata()}
                          disabled={isGeneratingMetadata}
                          className="text-[10px] font-bold text-white bg-(--sf-purple) hover:bg-(--sf-purple-light) px-2.5 py-1 rounded-full transition-all flex items-center gap-1 shadow-sm active:scale-95 disabled:opacity-50"
                        >
                           {isGeneratingMetadata ? '...' : '✨ Regenerate'}
                        </button>
                      </div>
                      <div className={`text-xs leading-relaxed ${isDark ? "text-white/70" : "text-gray-600"} p-3 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"} border border-(--hl-gold)/5 whitespace-pre-wrap`}>
                        {isGeneratingMetadata ? "Crafting a unique story..." : (form.bio || "Generating your character's bio...")}
                      </div>
                    </div>

                    {/* Libido */}
                    <div className="mb-4 border-t border-(--hl-gold)/10 pt-3">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-(--hl-gold) text-base">🔥</span>
                          <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-black"}`}>Libido intensity</span>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${isDark ? 'bg-white/10 text-white' : 'bg-gray-200 text-black'}`}>{form.libido}%</span>
                      </div>
                      <input type="range" min="0" max="100" step="5" value={form.libido} onChange={(e) => setForm({...form, libido: parseInt(e.target.value)})} className="w-full accent-(--hl-gold)" />
                    </div>

                    {/* Kink Openness */}
                    <div className="mb-4 border-t border-(--hl-gold)/10 pt-3">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-(--hl-gold) text-base">👠</span>
                          <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-black"}`}>Kink Openness</span>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${isDark ? 'bg-white/10 text-white' : 'bg-gray-200 text-black'}`}>{form.kink}%</span>
                      </div>
                      <input type="range" min="0" max="100" step="5" value={form.kink} onChange={(e) => setForm({...form, kink: parseInt(e.target.value)})} className="w-full accent-(--hl-gold)" />
                    </div>

                    {/* Comfort with Nudity */}
                    <div className="mb-4 border-t border-(--hl-gold)/10 pt-3">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-(--hl-gold) text-base">👙</span>
                          <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-black"}`}>Comfort with Nudity</span>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${isDark ? 'bg-white/10 text-white' : 'bg-gray-200 text-black'}`}>{form.nudity}%</span>
                      </div>
                      <input type="range" min="0" max="100" step="5" value={form.nudity} onChange={(e) => setForm({...form, nudity: parseInt(e.target.value)})} className="w-full accent-(--hl-gold)" />
                    </div>

                    {/* Toggles */}
                    <div className="space-y-2.5 border-t border-(--hl-gold)/10 pt-3">
                      <label className="flex items-center justify-between cursor-pointer py-1">
                        <div className="flex items-center gap-2.5">
                          <span className="text-(--hl-gold) text-base">📷</span>
                          <span className={`text-sm font-medium ${isDark ? "text-white" : "text-black"}`}>Spicy photos</span>
                        </div>
                        <input type="checkbox" checked={form.spicyPhotos} onChange={(e) => setForm({...form, spicyPhotos: e.target.checked})} className="w-5 h-5 rounded accent-(--hl-gold) cursor-pointer" />
                      </label>
                      
                      <label className="flex items-center justify-between cursor-pointer py-1">
                        <div className="flex items-center gap-2.5">
                          <span className="text-(--hl-gold) text-base">🎙️</span>
                          <span className={`text-sm font-medium ${isDark ? "text-white" : "text-black"}`}>Voice messages</span>
                        </div>
                        <input type="checkbox" checked={form.voiceMessages} onChange={(e) => setForm({...form, voiceMessages: e.target.checked})} className="w-5 h-5 rounded accent-(--hl-gold) cursor-pointer" />
                      </label>
                    </div>

                  </div>
                </div>
              </div>
            </div>
            );
          })()}
        </div>

        {/* Bottom action controls */}
        {/* Desktop/tablet: action bar (fixed to bottom on desktop) */}
        <div
          ref={bottomBarRef}
          className={`hidden md:block fixed inset-x-0 bottom-0 z-40 backdrop-blur-xs transition-all duration-200 ${isDark ? 'bg-[#040404]/72 border-t border-white/8' : 'bg-white/80 border-t border-gray-200/80'
            } shadow-[0_-3px_8px_rgba(0,0,0,0.04)] ${
            // match main layout: collapsed = 64px (pl-16), expanded = 240px (pl-60)
            sidebarCollapsed ? 'md:pl-16' : 'md:pl-60'
            }`}
          style={{ WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)' }}
        >
          <div className="mx-auto w-full max-w-5xl px-6 sm:px-8 py-5 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-4">
                {step > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                  onClick={prev}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-base min-w-40 rounded-full text-white"
                    style={{
                      borderRadius: '60px',
                      border: '1px solid rgba(255, 255, 255, 0.16)',
                      background: 'rgba(255,255,255,0.06)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)'
                    }}
                  >
                    <img src={PreviousIcon} alt="" className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                )}

                <Button
                  type="button"
                  variant="primary"
                  disabled={saving}
                  onClick={() => {
                    handlePrimary();
                  }}
                  style={{
                    borderRadius: '60px',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    background: 'linear-gradient(90deg, #d9b2ff 0%, #7f5af0 38%, #9d66ff 64%, #f48db5 100%)',
                    color: '#fff',
                  }}
                  className="text-white shadow-[inset_0_0_8px_rgba(255,255,255,0.16),inset_0_20px_24px_rgba(202,172,255,0.22)]"
                >
                  {saving ? (
                    <span className="inline-flex items-center gap-2 min-w-45">
                      <IconSpinner className="w-4 h-4 animate-spin text-white" />
                      <span className="flex flex-col items-start leading-tight">
                        <span className="text-sm font-semibold">{CREATION_PHASES[creationPhase]}</span>
                        <span className="text-[10px] opacity-70">{Math.min(creationProgress, 95)}%</span>
                      </span>
                    </span>
                  ) : (
                    <>
                      <img src={NextIcon} alt="" className="w-4 h-4 mr-2" />
                      {primaryLabel}
                    </>
                  )}
                </Button>
              </div>

              {isLocked && showStepHint && step !== 12 && (
                <p className={`mt-2 text-sm ${isDark ? "text-[#d9b2ff]/90" : "text-[#7f5af0]/90"}`}>{stepRequirementHint}</p>
              )}
            </div>
          </div>
        </div>

        {/* Mobile: inline centered buttons below content with extra bottom space for tab bar access */}
        <div className="md:hidden mt-6 flex items-center justify-center pb-4">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              {step > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={prev}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 text-base rounded-full text-white"
                  style={{
                    borderRadius: '60px',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    background: 'rgba(255,255,255,0.06)'
                  }}
                >
                  <img src={PreviousIcon} alt="" className="w-4 h-4 mr-1.5" />
                  Previous
                </Button>
              )}

              {step !== 0 && (
                <Button
                  type="button"
                  variant="primary"
                  disabled={saving}
                  onClick={() => {
                    handlePrimary();
                  }}
                  style={{
                    borderRadius: '60px',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    background: 'linear-gradient(90deg, #d9b2ff 0%, #7f5af0 38%, #9d66ff 64%, #f48db5 100%)',
                    color: '#fff',
                  }}
                  className="text-white shadow-[inset_0_0_8px_rgba(255,255,255,0.16),inset_0_20px_24px_rgba(202,172,255,0.22)]"
                >
                  {saving ? (
                    <span className="inline-flex items-center gap-2 min-w-40">
                      <IconSpinner className="w-4 h-4 animate-spin text-white" />
                      <span className="flex flex-col items-start leading-tight">
                        <span className="text-xs font-semibold">{CREATION_PHASES[creationPhase]}</span>
                        <span className="text-[10px] opacity-70">{Math.min(creationProgress, 95)}%</span>
                      </span>
                    </span>
                  ) : (
                    <>
                      <img src={NextIcon} alt="" className="w-4 h-4 mr-1.5" />
                      {primaryLabel}
                    </>
                  )}
                </Button>
              )}
            </div>
            {isLocked && showStepHint && step !== 12 && (
              <p className={`mt-1 text-xs ${isDark ? "text-(--hl-gold)/90" : "text-(--hl-gold)/90"}`}>{stepRequirementHint}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
