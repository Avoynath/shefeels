import { useEffect, useState } from 'react';
import { getRandomPresets, type PresetMessage } from '../utils/chatPresets';

interface ChatPresetsProps {
  characterId?: string | number;
  characterName?: string;
  onSelectPreset: (text: string) => void;
  isDark: boolean;
  isMobile: boolean;
}

const CATEGORY_STYLES: Record<string, {
  badge: string;
  badgeDark: string;
  glowLight: string;
  glowDark: string;
}> = {
  flirty:   {
    badge:     'bg-pink-100 text-pink-700',
    badgeDark: 'bg-pink-500/20 text-pink-400',
    glowLight: '0 0 0 1.5px rgba(236,72,153,0.45), 0 6px 20px rgba(236,72,153,0.18)',
    glowDark:  '0 0 0 1.5px rgba(236,72,153,0.35), 0 6px 20px rgba(236,72,153,0.12)',
  },
  casual:   {
    badge:     'bg-blue-100 text-blue-700',
    badgeDark: 'bg-blue-500/20 text-blue-400',
    glowLight: '0 0 0 1.5px rgba(59,130,246,0.45), 0 6px 20px rgba(59,130,246,0.18)',
    glowDark:  '0 0 0 1.5px rgba(59,130,246,0.35), 0 6px 20px rgba(59,130,246,0.12)',
  },
  spicy:    {
    badge:     'bg-red-100 text-red-700',
    badgeDark: 'bg-red-500/20 text-red-400',
    glowLight: '0 0 0 1.5px rgba(239,68,68,0.45), 0 6px 20px rgba(239,68,68,0.18)',
    glowDark:  '0 0 0 1.5px rgba(239,68,68,0.35), 0 6px 20px rgba(239,68,68,0.12)',
  },
  playful:  {
    badge:     'bg-amber-100 text-amber-700',
    badgeDark: 'bg-amber-500/20 text-amber-400',
    glowLight: '0 0 0 1.5px rgba(245,158,11,0.45), 0 6px 20px rgba(245,158,11,0.18)',
    glowDark:  '0 0 0 1.5px rgba(245,158,11,0.35), 0 6px 20px rgba(245,158,11,0.12)',
  },
  romantic: {
    badge:     'bg-purple-100 text-purple-700',
    badgeDark: 'bg-purple-500/20 text-purple-400',
    glowLight: '0 0 0 1.5px rgba(168,85,247,0.45), 0 6px 20px rgba(168,85,247,0.18)',
    glowDark:  '0 0 0 1.5px rgba(168,85,247,0.35), 0 6px 20px rgba(168,85,247,0.12)',
  },
};

/**
 * Displays engaging preset messages to help users start conversations
 * Shown when a character is selected but no messages exist yet
 */
export default function ChatPresets({
  characterId,
  characterName,
  onSelectPreset,
  isDark,
  isMobile,
}: ChatPresetsProps) {
  const [presets, setPresets] = useState<PresetMessage[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Generate random presets when character changes
  useEffect(() => {
    if (characterId) {
      const randomPresets = getRandomPresets(4, characterId);
      setPresets(randomPresets);
    }
  }, [characterId]);

  if (presets.length === 0) return null;

  return (
    <div className={`flex flex-col items-center justify-center px-4 ${isMobile ? 'pt-2 pb-4 space-y-3' : 'py-8 space-y-6'}`}>
      {/* Header */}
      <div className={`text-center max-w-md ${isMobile ? 'space-y-1' : 'space-y-2'}`}>
        <h3
          className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}
        >
          Start a conversation with {characterName || 'them'}
        </h3>
        <p
          className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}
        >
          Try one of these conversation starters:
        </p>
      </div>

      {/* Preset Messages Grid */}
      <div className={`grid w-full max-w-2xl ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-3'}`}>
        {presets.map((preset) => {
          const styles = CATEGORY_STYLES[preset.category] ?? CATEGORY_STYLES.casual;
          const isHovered = hoveredId === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset.text)}
              onMouseEnter={() => setHoveredId(preset.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`
                relative text-left overflow-hidden
                ${isMobile ? 'px-3 py-2.5 rounded-lg' : 'px-4 py-3.5 rounded-xl'}
                focus:outline-none focus:ring-2 focus:ring-(--primary)s:ring-offset-2
                ${isDark
                  ? 'bg-white/6 border border-white/8 focus:ring-offset-[#1a1712]'
                  : 'bg-white border border-transparent shadow-sm focus:ring-offset-white'
                }
              `}
              style={{
                transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
                boxShadow: isHovered
                  ? (isDark ? styles.glowDark : styles.glowLight)
                  : isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                transition: 'transform 180ms ease-out, box-shadow 180ms ease-out',
              }}
            >
              {/* Category badge + arrow row */}
              <div className="flex items-center justify-between mb-2">
                <span className={`
                  inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide
                  ${isDark ? styles.badgeDark : styles.badge}
                `}>
                  {preset.category}
                </span>

                {/* Arrow — slides in from left, fades up */}
                <svg
                  style={{
                    opacity: isHovered ? 1 : 0,
                    transform: isHovered ? 'translateX(0)' : 'translateX(-6px)',
                    transition: 'opacity 160ms ease-out, transform 160ms ease-out',
                    color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(55,65,81,0.8)',
                  }}
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>

              {/* Message text */}
              <p
                className={`${isMobile ? 'text-xs' : 'text-sm'} leading-relaxed ${isDark ? 'text-white/90' : 'text-gray-800'}`}
              >
                {preset.text}
              </p>
            </button>
          );
        })}
      </div>

      {/* Refresh button */}
      <button
        onClick={() => setPresets(getRandomPresets(4, characterId))}
        className={`
          flex items-center gap-2 rounded-full font-medium transition-all duration-200
          ${isMobile ? 'mt-1 px-5 py-2 text-xs' : 'mt-4 px-6 py-2.5 text-sm'}
          ${isDark
            ? 'bg-white/8 hover:bg-white/12 text-white/80 hover:text-white border border-white/10'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border border-gray-200'
          }
          active:scale-95
          focus:outline-none focus:ring-2 focus:ring-(--primary) focus:ring-offset-2
          ${isDark ? 'focus:ring-offset-[#1a1712]' : 'focus:ring-offset-white'}
        `}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {isMobile ? 'Different starters' : 'Show me different starters'}
      </button>
    </div>
  );
}
