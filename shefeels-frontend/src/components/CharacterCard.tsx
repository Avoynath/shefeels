import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import LazyImage from "./LazyImage";
import ChatIcon from "../assets/home/ChatCharacterIcon.svg";
import LikeIconSrc from "../assets/private-content/LikeIcon.svg";
import { usePerformance } from "../contexts/PerformanceContext";

type Props = {
  name: string;
  age?: number | null;
  img?: string | null;
  gif?: string | null;
  webp?: string | null;
  bio?: string | null;
  metaBadgeLabel?: string | null;
  displayFullName?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  likesCount?: number;
  messageCount?: number;
  hideCounts?: boolean;
  hideLike?: boolean;
  hideChat?: boolean;
  showOptions?: boolean;
  alignActionsRight?: boolean;
  alignActionsSpread?: boolean;
  optionsPlacement?: "right" | "left";
  optionsButtonVariant?: 'default' | 'compact';
  onLike?: () => void;
  isLiked?: boolean;
  likeDisabled?: boolean;
  variant?: 'default' | 'compact';
  onMediaError?: () => void;
};

export default function CharacterCard({
  name,
  age,
  img,
  gif,
  webp,
  bio,
  metaBadgeLabel,
  displayFullName = false,
  onClick,
  onEdit,
  onDelete,
  likesCount = 0,
  messageCount = 0,
  hideCounts = false,
  hideLike = false,
  hideChat = false,
  showOptions = true,
  alignActionsSpread = false,
  optionsPlacement = "right",
  optionsButtonVariant = 'default',
  onLike,
  isLiked = false,
  likeDisabled = false,
  variant = 'default',
  onMediaError,
}: Props) {
  const isCompact = variant === 'compact';
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { imageQuality, enableLazyLoading } = usePerformance();
  const isDark = theme === "dark";

  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const ignoreNextDocClick = useRef(false);
  // unique id for coordinating single-open behavior across cards
  const instanceId = useRef(Symbol("character-card"));

  // when menu is open, disable hover transforms to avoid geometry changes that cause flicker
  const hoverTransform = menuOpen ? '' : 'group-hover:scale-[1.02] group-hover:-translate-y-0.5';
  const hoverTheme = menuOpen
    ? ''
    : (isDark
      ? 'group-hover:border-[#8f67ff]/70 group-hover:bg-[radial-gradient(circle_at_50%_0%,_rgba(32,20,60,0.95),_rgba(15,12,24,0.92)_70%)]'
      : 'group-hover:border-[#e53170]/70');
  const cardDepthClass = menuOpen ? 'z-[200]' : 'z-10';
  const likeActionDisabled = likeDisabled || isLiked;
  const interactiveLike = typeof onLike === 'function';
  const showCountPills = !hideCounts;
  const showLikePill = showCountPills && !hideLike;
  const showMessagePill = showCountPills;
  const optionsOnLeft = showOptions && optionsPlacement === 'left';
  const pillSizingClass = 'h-[24px] min-h-[24px] leading-none sm:h-[28px] sm:min-h-[28px]';
  const countTextClass = alignActionsSpread ? 'text-[13px] sm:text-[14px]' : 'text-[11px] sm:text-xs';
  const countIconClass = alignActionsSpread ? 'h-4 w-4 sm:h-[18px] sm:w-[18px]' : 'h-3.75 w-3.75';
  const likedBackground = 'rgba(244, 114, 182, 0.28)';
  const neutralPillBackground = 'transparent';
  const likePillStyle = {
    borderRadius: '12px',
    background: isLiked ? likedBackground : neutralPillBackground,
    border: isLiked ? '1px solid rgba(244,114,182,0.6)' : undefined,
  };
  const likeCompactStyle = {
    borderRadius: '9999px',
    background: isLiked ? likedBackground : (isDark ? 'rgba(31, 41, 55, 0.55)' : 'rgba(243, 244, 246, 1)'),
    border: isLiked ? '1px solid rgba(244,114,182,0.6)' : undefined,
  };
  const likeTextTone = isLiked ? 'text-[#FFD6E3]' : '';
  const likeButtonStateClass = likeActionDisabled
    ? 'cursor-not-allowed opacity-75'
    : 'hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300';
  const likePillBaseClass = `inline-flex items-center gap-[2.37px] px-0 py-0.5 ${countTextClass} font-medium tracking-[0.01em] ${pillSizingClass} text-white ${likeTextTone}`;
  const likeCompactBaseClass = `inline-flex items-center gap-[2.37px] px-0 py-0.5 ${countTextClass} font-medium tracking-[0.01em] ${pillSizingClass} text-white ${likeTextTone}`;
  const likeIconColor = isLiked ? 'text-[#FF9DB5]' : 'text-rose-400';
  const chatButtonBackground = 'rgba(255, 255, 255, 0.08)';
  const chatButtonClass = `allow-custom-text inline-flex items-center justify-center h-[36px] px-3 text-[14px] font-normal text-white backdrop-blur-[7.5px] rounded-[6px] transition-all duration-200 border border-transparent hover:bg-white/18`;
  const chatButtonStyle = { background: chatButtonBackground };
  const typographyStyle = { fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' };
  const actionLabel = (() => {
    const seed = String(bio || '').trim();
    if (!seed) return 'Chat';
    const raw = seed.split(/\s+/)[0] || 'Chat';
    return raw.slice(0, 12);
  })();

  const optimizeImageUrl = (url: string) => {
    if (!url) return url;
    // Skip optimization for videos or presigned URLs to avoid breaking signatures/playback
    if (url.includes('.mp4') || url.includes('.webm') || url.includes('X-Amz-Signature')) return url;

    if (imageQuality === 'low') return url.includes('?') ? `${url}&quality=40&w=300` : `${url}?quality=40&w=300`;
    if (imageQuality === 'medium') return url.includes('?') ? `${url}&quality=70&w=400` : `${url}?quality=70&w=400`;
    return url;
  };

  // Simple hover state for GIF/WebP playback
  const [isHovering, setIsHovering] = useState(false);
  const [staticMediaFailed, setStaticMediaFailed] = useState(false);

  // Prefer animated media when available; static S3 URLs can be blocked in some environments.
  const animatedSrc = webp || gif || '';
  const staticFallbackSrc = img || '';
  const displayedSrc = staticMediaFailed
    ? (animatedSrc || staticFallbackSrc || '')
    : (animatedSrc || staticFallbackSrc || '');

  useEffect(() => {
    setStaticMediaFailed(false);
  }, [img, webp, gif]);

  // Close on outside click / esc
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (ignoreNextDocClick.current) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && menuButtonRef.current && !menuButtonRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  // Ensure only one menu is open at a time across all CharacterCards
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail !== instanceId.current) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('character-card-menu-open', handler as EventListener);
    return () => window.removeEventListener('character-card-menu-open', handler as EventListener);
  }, []);

  // No viewport-based positioning needed; menu is absolutely positioned within the button wrapper
  const renderOptionsControl = (placement: 'left' | 'right' = 'right') => {
    const isCompactVariant = optionsButtonVariant === 'compact';
    const defaultButtonClass = isDark
      ? 'inline-flex items-center justify-center rounded-full px-1 py-1 text-xs bg-black/70 text-white/90 hover:bg-black/85 border border-white/20 backdrop-blur-sm'
      : 'inline-flex items-center justify-center rounded-full px-1 py-1 text-xs bg-gray-100 text-black/80 hover:bg-gray-200 border border-gray-200';
    const compactToneClass = isDark
      ? 'text-white/90 border border-white/10'
      : 'text-black/80 border border-gray-200';
    const compactButtonClass = `allow-custom-text pill inline-flex items-center justify-center rounded-full ${pillSizingClass} px-2 text-[11px] sm:text-xs font-medium theme-transition ${compactToneClass} hover:!bg-[var(--sf-purple)] hover:!text-white hover:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-purple)]`;
    const buttonClass = isCompactVariant ? compactButtonClass : defaultButtonClass;
    const optionsIconClass = isCompactVariant ? 'h-3 w-3' : 'h-3.5 w-3.5';
    const optionsButtonStyle = isCompactVariant ? { borderRadius: '12px', background: 'rgba(255, 255, 255, 0.12)' } : undefined;
    const dropdownAlignmentClass = placement === 'left' ? 'left-0 origin-top-left' : 'right-0 origin-top-right';
    return (
      <>
        <button
          ref={menuButtonRef}
          onClick={(e) => {
            e.stopPropagation();
            if (menuOpen) { setMenuOpen(false); return; }
            window.dispatchEvent(new CustomEvent('character-card-menu-open', { detail: instanceId.current }));
            ignoreNextDocClick.current = true;
            setTimeout(() => { ignoreNextDocClick.current = false; }, 0);
            setMenuOpen(true);
          }}
          aria-label="More options"
          className={buttonClass}
          style={optionsButtonStyle}
        >
          <MoreVertical className={optionsIconClass} />
        </button>

        {menuOpen ? (
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            className={`absolute top-full mt-2 z-1000 w-44 rounded-lg p-2 bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.15)] border border-gray-200 ${dropdownAlignmentClass}`}
          >
            <button
              onClick={() => { setMenuOpen(false); if (typeof onEdit === 'function') onEdit(); }}
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 flex items-center gap-3 text-black"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Pencil className="h-5 w-5 text-black" />
              <span className="text-sm font-medium">Edit</span>
            </button>
            <button
              onClick={() => { setMenuOpen(false); if (typeof onDelete === 'function') onDelete(); }}
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 flex items-center gap-3 text-red-600"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Trash2 className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium">Delete</span>
            </button>
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div onClick={onClick} className={`group relative transition-all duration-200 ${onClick ? 'cursor-pointer' : ''}`}>
      <div className={`relative rounded-[18px] p-[1.35px] overflow-visible transition-all duration-300 theme-transition ${hoverTransform} ${cardDepthClass} ${isDark ? 'bg-white/10' : 'bg-white/60'} shadow-md`}>
        <div className={`relative rounded-2xl overflow-hidden border transition-all duration-300 theme-transition ${isDark ? 'border-white/8 bg-black/20' : 'border-black/10 bg-black/10'} ${hoverTheme}`}>
        <div className="relative">

            {/* Image is required for Explore page — fallback removed intentionally */}
            <div
              className="relative z-10 aspect-5/7 md:aspect-6/9 w-full overflow-hidden rounded-2xl character-media"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              {/* Layered images for smooth transition: static stays visible until video loads/covers it */}
              <LazyImage
                key={displayedSrc || 'no-media'}
                src={optimizeImageUrl(displayedSrc || '')}
                alt={`${name} character image`}
                className="h-full w-full rounded-2xl object-cover object-center transition-filter duration-200 group-hover:brightness-105"
                loading={enableLazyLoading ? 'lazy' : 'eager'}
                isAnimated={Boolean(animatedSrc)}
                onError={() => {
                  if (!staticMediaFailed && (animatedSrc || staticFallbackSrc)) {
                    setStaticMediaFailed(true);
                    return;
                  }
                  onMediaError?.();
                }}
              />
              
              {/* Overlay animated media on hover */}
              {isHovering && (webp || gif) && (
                <div className="absolute inset-0 z-10 w-full h-full"> 
                   <LazyImage
                    src={optimizeImageUrl(webp || gif || '')}
                    alt={`${name} character animation`}
                    className="h-full w-full rounded-2xl object-cover object-center"
                    loading="eager" // Load immediately on hover
                    isAnimated={true}
                    loopInterval={3500}
                  />
                </div>
              )}

              {/* Darken lower portion of the image so overlayed text is readable */}
              <div
                className="absolute inset-0 z-20 pointer-events-none"
                style={{ background: 'linear-gradient(180.11deg, rgba(0,0,0,0) 50.1%, rgba(0,0,0,0.7) 99.93%)' }}
              />

              {/* Options menu in top-right corner */}
              {showOptions && (
                <div className="absolute right-2 top-2 z-300">
                  {renderOptionsControl('right')}
                </div>
              )}
            </div>
          </div>

        <div className={`absolute inset-x-0 bottom-0 z-30 ${isCompact ? 'px-3 pb-3 pt-3' : 'px-[21px] pb-5 pt-3'}`}>
          <div className={`flex gap-3 ${metaBadgeLabel ? 'items-start justify-between' : 'items-baseline'}`}>
            {displayFullName ? (
              <h3
                className={`${isCompact
                  ? 'text-[18px] sm:text-[20px] md:text-[22px]'
                  : 'text-[21px] sm:text-[22px] md:text-[24px]'} font-semibold leading-[1.2] tracking-[0.01em] text-[#FEFEFE]`}
                style={typographyStyle}
              >
                {name}
                {typeof age === 'number' ? `, ${age}` : ''}
              </h3>
            ) : (
              <>
                <h3
                  className={`${isCompact
                    ? 'text-[18px] sm:text-[20px] md:text-[22px]'
                    : 'text-[21px] sm:text-[22px] md:text-[24px]'} font-semibold leading-[1.2] tracking-[0.01em] text-[#FEFEFE] capitalize`}
                  style={typographyStyle}
                >
                  {name.split(' ')[0]}
                  {typeof age === 'number' ? ',\t' : ''}
                </h3>
                {typeof age === 'number' && (
                  <span className={`${isCompact ? 'text-[18px] sm:text-[20px]' : 'text-[21px] sm:text-[22px] md:text-[24px]'} font-semibold text-[#FEFEFE] leading-[1.2]`} style={typographyStyle}>{age}</span>
                )}
              </>
            )}
            {metaBadgeLabel ? (
              <span
                className="inline-flex h-[36px] shrink-0 items-center rounded-[6px] bg-[rgba(255,255,255,0.08)] px-3 text-[16px] font-normal text-white backdrop-blur-[7.5px]"
                style={typographyStyle}
              >
                {metaBadgeLabel}
              </span>
            ) : null}
          </div>

          {/* Actions row: either spread (left/center/right) or the default compact layout */}
          {alignActionsSpread ? (
            <div className="mt-2.5 flex items-end justify-between gap-3">
              {/* left group: Message count + Like */}
              {(optionsOnLeft || showMessagePill || showLikePill) && (
                <div className="flex items-center gap-2">
                  {optionsOnLeft && (
                    <div className="relative z-300">
                      {renderOptionsControl('left')}
                    </div>
                  )}

                  {showLikePill && (
                    interactiveLike ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (likeActionDisabled) return;
                          onLike?.();
                        }}
                        aria-label={`Like ${name}`}
                        aria-pressed={isLiked}
                        aria-disabled={likeActionDisabled}
                        disabled={likeActionDisabled}
                        className={`allow-custom-text inline-flex items-center gap-[2.37px] ${countTextClass} text-white transition-all duration-150 ${likeButtonStateClass}`}
                        style={likePillStyle}
                      >
                        <img src={LikeIconSrc} alt="" className={countIconClass} aria-hidden="true" />
                        <span className="tabular-nums font-medium" style={typographyStyle}>{likesCount ?? 0}</span>
                      </button>
                    ) : (
                      <div className={`inline-flex cursor-pointer items-center gap-[2.37px] ${countTextClass} text-white transition-all duration-200`} style={likePillStyle}>
                        <img src={LikeIconSrc} alt="like" className={countIconClass} aria-hidden="true" />
                        <span className="tabular-nums font-medium" style={typographyStyle}>{likesCount ?? 0}</span>
                      </div>
                    )
                  )}

                  {showMessagePill && (
                    <div
                      className={`inline-flex items-center gap-[2.37px] ${countTextClass} text-white transition-all duration-200`}
                      style={{ borderRadius: '0', background: 'transparent' }}
                    >
                      <img src={ChatIcon} alt="messages" className={countIconClass} />
                      <span className="tabular-nums font-medium" style={typographyStyle}>{messageCount ?? 0}</span>
                    </div>
                  )}
                </div>
              )}

              {!hideChat && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (typeof onClick === "function") {
                      onClick();
                    } else {
                      navigate("/chat/character");
                    }
                  }}
                  aria-label={`Chat with ${name}`}
                  className={chatButtonClass}
                  style={{ ...chatButtonStyle, ...typographyStyle }}
                >
                  {actionLabel}
                </button>
              )}
            </div>
          ) : (
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {(optionsOnLeft || showMessagePill || showLikePill) && (
                  <div className="flex items-center gap-2">
                    {optionsOnLeft && (
                      <div className="relative z-300">
                        {renderOptionsControl('left')}
                      </div>
                    )}

                    {showLikePill && (
                      interactiveLike ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (likeActionDisabled) return;
                            onLike?.();
                          }}
                          aria-label={`Like ${name}`}
                          aria-pressed={isLiked}
                          aria-disabled={likeActionDisabled}
                          disabled={likeActionDisabled}
                          className={`allow-custom-text pill ${likeCompactBaseClass} transition-all duration-150 ${likeButtonStateClass}`}
                          style={likeCompactStyle}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className={`${countIconClass} ${likeIconColor}`} viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 21s-7.5-5.6-10-9.8C-0.7 7.3 1.8 3 6 3c2.4 0 4 1.6 6 3.6C14 4.6 15.6 3 18 3c4.2 0 6.7 4.3 4 8.2-2.5 4.2-10 9.8-10 9.8Z" />
                          </svg>
                          <span className="tabular-nums font-medium" style={typographyStyle}>{likesCount ?? 0}</span>
                        </button>
                      ) : (
                        <div className={`pill ${likeCompactBaseClass} transition-all duration-200 cursor-pointer`} style={likeCompactStyle}>
                          <svg xmlns="http://www.w3.org/2000/svg" className={`${countIconClass} ${likeIconColor}`} viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 21s-7.5-5.6-10-9.8C-0.7 7.3 1.8 3 6 3c2.4 0 4 1.6 6 3.6C14 4.6 15.6 3 18 3c4.2 0 6.7 4.3 4 8.2-2.5 4.2-10 9.8-10 9.8Z" />
                          </svg>
                          <span className="tabular-nums font-medium" style={typographyStyle}>{likesCount ?? 0}</span>
                        </div>
                      )
                    )}

                    {showMessagePill && (
                      <div
                        className={`pill ${likeCompactBaseClass} transition-all duration-200`}
                        style={{ borderRadius: '0', background: 'transparent' }}
                      >
                        <img src={ChatIcon} alt="messages" className={countIconClass} />
                        <span className="tabular-nums font-medium" style={typographyStyle}>{messageCount ?? 0}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!hideChat && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (typeof onClick === "function") {
                      onClick();
                    } else {
                      navigate("/chat/character");
                    }
                  }}
                  aria-label={`Chat with ${name}`}
                  className={chatButtonClass}
                  style={{ ...chatButtonStyle, ...typographyStyle }}
                >
                  {actionLabel}
                </button>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
