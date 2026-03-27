// import React from 'react';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Brain } from 'lucide-react';
import LazyImage from './LazyImage';
import chatNowIcon from '../assets/home/ChatNowIcon.svg';
import unlockIconWhite from '../assets/chat/UnlockIconWhite.svg';
// import Images from 'lucide-react';
import BodyIcon from '../assets/chat/BodyIcon.svg';
import DickIcon from '../assets/chat/DickIcon.svg';
import BreastIcon from '../assets/chat/BreastIcon.svg';
import ButtIcon from '../assets/chat/ButtIcon.svg';
import EyeIcon from '../assets/chat/EyeIcon.svg';
import EthnicityIcon from '../assets/chat/EthnicityIcon.svg';
import HairIcon from '../assets/chat/HairIcon.svg';
import HobbiesIcon from '../assets/chat/HobbiesIcon.svg';
import OccupationIcon from '../assets/chat/OccupationIcon.svg';
import RelationshipIcon from '../assets/chat/RelationshipIcon.svg';

export default function ChatSidebar({
  isMobile,
  mobileView,
  setMobileView,
  isDark,
  currentCharacterData,
  selected,
  galleryRefreshKey,
  navigate,
  ChatGallery,
  theme,
  socialItems,
}: any) {
  const [packsLoading, setPacksLoading] = useState(false);
  const [hasPacks, setHasPacks] = useState<boolean | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  // Build array of media items: max 2 items (1 static, 1 animated)
  // Static: prefer webp_image_url_s3, fallback to image_url_s3 (PNG)
  // Animated: prefer animated_webp_url_s3, fallback to gif_url_s3
  const mediaItems = [];

  // Static image (already prefers WebP in currentCharacterData.imageUrl from Chat.tsx)
  if (currentCharacterData?.imageUrl) {
    mediaItems.push({ url: currentCharacterData.imageUrl, type: 'static' });
  }

  // Animated media (prefer animated WebP, fallback to GIF)
  const animatedUrl = currentCharacterData?.animatedUrl;
  if (animatedUrl) {
    mediaItems.push({ url: animatedUrl, type: 'animated' });
  }

  // Reset media index when character changes
  useEffect(() => {
    setCurrentMediaIndex(0);
  }, [selected?.id]);

  const goToPrevMedia = () => {
    setCurrentMediaIndex((prev) => (prev > 0 ? prev - 1 : mediaItems.length - 1));
  };

  const goToNextMedia = () => {
    setCurrentMediaIndex((prev) => (prev < mediaItems.length - 1 ? prev + 1 : 0));
  };

  const currentMedia = mediaItems[currentMediaIndex] || null;

  // Fetch characters with packs using the optimized batch endpoint
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setPacksLoading(true);
        setHasPacks(null);
        if (!selected || !selected.id) {
          if (mounted) {
            setHasPacks(false);
            setPacksLoading(false);
          }
          return;
        }
        // Use the batch endpoint to check if character has packs
        try {
          const apiClient = (await import('../utils/api')).default;
          const { character_ids } = await apiClient.getCharactersWithPacks();
          if (!mounted) return;
          // Check if current character is in the list
          const hasPacksForChar = character_ids.some(
            (id) => String(id) === String(selected.id)
          );
          setHasPacks(hasPacksForChar);
        } catch (err) {
          // If request fails (e.g., unauthenticated), treat as no packs available for UI purpose
          if (!mounted) return;
          setHasPacks(false);
        }
      } finally {
        if (mounted) setPacksLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [selected?.id]);
  return (
    <div
      className={`${isMobile ? (mobileView === 'details' ? 'flex w-full' : 'hidden') : 'w-[330px] flex'} ${isDark ? "border-white/8" : "border-gray-200"} flex-col h-full shrink-0 relative z-0`}
      style={{ background: '#000' }}
    >
      {isMobile && (
        <div className={`p-3 border-b flex items-center gap-2 ${isDark ? 'border-white/6' : 'border-gray-200'}`}>
          <button type="button" onClick={() => setMobileView('chat')} aria-label="Back to chat" className={`rounded-full p-1 ${isDark ? 'hover:bg-white/8' : 'hover:bg-gray-100'}`}>
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
          <div className="text-sm text-white/80">Profile</div>
        </div>
      )}
      {!currentCharacterData ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-xl p-4" style={{ background: isDark ? 'linear-gradient(180deg, rgba(255,255,255,0.02), transparent)' : 'rgba(255,255,255,0.02)' }}>
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 w-28 h-28 rounded-2xl flex items-center justify-center" style={{ background: isDark ? 'linear-gradient(135deg,#3b2b20,#24180f)' : 'linear-gradient(135deg,#fff1e6,#ffe6b3)' }}>
                <div className="w-16 h-16 rounded-full shadow-inner opacity-95" />
              </div>

              <div className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>No character selected</div>
              <div className={`text-sm leading-relaxed ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Select a character to view profile, gallery and private content. Here are a few suggestions to get started.</div>

              <div className="w-full flex flex-col gap-3 mt-4">
                <button onClick={() => navigate('/private-content/select-character')} className={`w-full px-3 py-2 rounded-full font-semibold ${isDark ? 'bg-white/8 text-white hover:bg-white/12' : 'bg-(--primary) text-(--hl-black) hover:brightness-95'}`}>
                  Select a character
                </button>
                <button onClick={() => navigate('/create-character')} className={`w-full px-3 py-2 rounded-full font-medium border ${isDark ? 'border-white/8 text-white/80 hover:bg-white/6' : 'border-(--primary) text-(--primary) hover:bg-[rgba(255,197,77,0.06)]'}`}>
                  Create character
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white/80' : 'text-gray-800'}`}>Tips & Private Content</h4>
            <div className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-600'} space-y-3`}>
              <div>• Private content contains exclusive images and packs for characters. To access it, first select a character, then click <strong>Private Content</strong> in the profile.</div>
              <div>• If you created characters, open the <strong>My AI</strong> tab to find them quickly and manage private packs.</div>
              <div>• Want custom media? Use <strong>Generate Now</strong> inside a character profile to create images tied to that character.</div>
              <div>• Note: some private packs require tokens or purchase. Check the Private Content page for available packs and pricing.</div>
              <div className="pt-2">
                <button onClick={() => navigate('/private-content')} className={`w-full px-3 py-2 rounded-full font-semibold ${isDark ? 'bg-white/8 text-white hover:bg-white/12' : 'bg-(--primary) text-(--hl-black) hover:brightness-95'}`}>
                  Explore Private Content
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 chat-scroll">
          <div className="space-y-4 pr-3 pb-5 pt-0">
            <div className="relative">
              <div className={`relative aspect-[4/5] md:h-84 w-full overflow-hidden ${isDark ? "bg-white/2" : "bg-gray-100"}`}>
                {currentMedia?.url ? (
                  // For animated media, render as image with LazyImage which handles animation properly
                  <LazyImage src={currentMedia.url} alt={currentCharacterData?.profile?.name || ''} className="w-full h-full object-cover object-center" loading="lazy" isAnimated={currentMedia.type === 'animated'} loopInterval={currentMedia.type === 'animated' ? 3500 : 0} />
                ) : currentCharacterData?.imageUrl ? (
                  <LazyImage src={currentCharacterData?.imageUrl} alt={currentCharacterData?.profile?.name || ''} className="w-full h-full object-cover object-center" loading="lazy" />
                ) : (
                  <div className="w-full h-full" style={{ background: `linear-gradient(135deg, hsla(${selected.hue},80%,60%,0.45), transparent)` }} />
                )}
                <div className="absolute inset-x-0 top-0 h-16 bg-linear-to-b from-black/50 via-black/20 to-transparent pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-34 md:h-36 bg-linear-to-b from-transparent via-black/60 to-(--hl-black) pointer-events-none" />

                <div className="absolute left-0 right-0 bottom-5 md:bottom-6 z-20 px-4 md:px-5 pb-0">
                  <div className="flex flex-col gap-1">
                    <div className="text-xl md:text-2xl font-semibold text-white">{currentCharacterData?.profile?.name}{typeof currentCharacterData?.profile?.age === 'number' && currentCharacterData?.profile?.age ? `, ${currentCharacterData?.profile?.age}` : ''}</div>
                    <div className="flex items-center gap-2 flex-nowrap">
                      {socialItems
                        .filter((it: any) => {
                          try {
                            return Boolean(it && it.url && String(it.url).trim().length > 0);
                          } catch (e) { return false; }
                        })
                        .map(({ key, src, label, url, accent }: any) => {
                          const href = String(url).trim();
                          const cls = `inline-flex items-center justify-center h-8 w-8 rounded-full transition-shadow`;
                          const style: any = { background: accent || 'transparent', boxShadow: '0 4px 10px rgba(0,0,0,0.35)' };
                          const imgEl = (<img src={src} alt={label} className="h-5 w-5 object-contain" />);
                          return (
                            <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={cls} style={style}>{imgEl}</a>
                          );
                        })}
                    </div>
                  </div>
                </div>
                {mediaItems.length > 1 && (
                  <>
                    <button type="button" onClick={goToPrevMedia} className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 rounded-full h-9 w-9 bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/80 transition hover:bg-black/70 z-30" aria-label="Previous image"><ChevronLeft className="h-4 w-4" /></button>
                    <button type="button" onClick={goToNextMedia} className="absolute right-3.5 md:right-4 top-1/2 -translate-y-1/2 rounded-full h-9 w-9 bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/80 transition hover:bg-black/70 z-30" aria-label="Next image"><ChevronRight className="h-4 w-4" /></button>
                    <div className="absolute bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
                      {mediaItems.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentMediaIndex(idx)}
                          className={`h-1.5 rounded-full transition-all ${idx === currentMediaIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}
                          aria-label={`Go to ${idx === 0 ? 'static image' : 'animated media'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="px-4 md:px-5 -mt-5"><p className="text-sm md:text-base text-white">{currentCharacterData?.profile?.bio}</p></div>
            <div className="px-4 md:px-5 space-y-3">
              <button onClick={() => { try { const char = { id: selected?.id, name: currentCharacterData?.profile?.name, age: currentCharacterData?.profile?.age, image_url_s3: currentCharacterData?.imageUrl, } as any; navigate('/generate-image', { state: { character: char } }); } catch (e) { } }} className="w-full h-12 py-2.5 font-semibold flex items-center justify-center gap-2 text-white transition-all" style={{ background: 'linear-gradient(90deg,#815CF0 0%, #CFA8F9 100%)', border: '1px solid rgba(255, 255, 255, 0.50)', borderRadius: '8px' }}>
                <img src={chatNowIcon} alt="" aria-hidden className="h-5 w-5" />
                <span>Generate Now</span>
              </button>
              {/* Private Content button: show fallback CTA when no packs exist */}
              {packsLoading ? (
                <button type="button" disabled className="w-full py-2.5 font-normal flex items-center justify-center gap-2 text-white/60 transition-all" style={{ borderRadius: '60px', background: 'rgba(255, 255, 255, 0.06)' }}>
                  <img src={unlockIconWhite} alt="" aria-hidden className="h-5 w-5" />
                  <span>Checking private content…</span>
                </button>
              ) : hasPacks ? (
                <button type="button" onClick={() => { try { const id = (selected && (selected.id ?? null)); if (id !== undefined && id !== null && String(id) !== '') { navigate(`/private-content/character/${id}/packs`); return; } } catch (e) { } try { const slug = `${selected.name}-${selected.id}`; navigate(`/chat/${slug}/private-pack`); } catch (e) { } }} className="w-full py-2.5 font-normal flex items-center justify-center gap-2 text-white transition-all" style={{ borderRadius: '60px', background: 'rgba(255, 255, 255, 0.14)' }}>
                  <img src={unlockIconWhite} alt="" aria-hidden className="h-5 w-5" />
                  <span>Private Content</span>
                </button>
              ) : null}
            </div>

            <div className="px-0 space-y-4">
              <div className="border-t border-white/8 px-4 md:px-5 pt-4">
                <h3 className="text-lg md:text-xl font-medium text-[#815CF0] mb-2">Gallery</h3>
                {ChatGallery ? <ChatGallery characterId={selected?.id} key={galleryRefreshKey} /> : null}
              </div>

              <div className="border-t border-white/8 px-4 md:px-5 pt-4">
                <h3 className="text-lg md:text-xl font-medium text-[#815CF0] mb-3">Details</h3>
                <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                  {(currentCharacterData?.profile?.details || []).filter((detail: any) => detail?.value && detail.value !== '—' && detail.value.trim() !== '').map((detail: any) => (
                    <div key={`${detail.label}-${detail.value}`} className="flex items-center gap-2.5">
                      {(() => {
                        const map: Record<string, string> = { Body: BodyIcon, Dick: DickIcon, Breast: BreastIcon, Butt: ButtIcon, Eye: EyeIcon, Ethnicity: EthnicityIcon, Hair: HairIcon };
                        const src = map[detail.iconKey];
                        return src ? (
                          <div className="flex-none shrink-0 h-8 w-8 aspect-square rounded-full overflow-hidden flex items-center justify-center" style={{ border: '1px solid var(--muted-404)', background: (theme === 'dark' ? 'var(--hl-black)' : 'var(--hl-surface)') }}>
                            <img src={src} alt={detail.label} className="h-4 w-4 object-contain" />
                          </div>
                        ) : (
                          <div className="flex-none shrink-0 h-8 w-8 aspect-square" style={{ border: '1px solid var(--muted-404)', background: (theme === 'dark' ? 'var(--hl-black)' : 'var(--hl-surface)') }} />
                        );
                      })()}
                      <div className="min-w-0">
                        <div className={`text-[10px] md:text-[11px] uppercase tracking-[0.14em] ${theme === 'dark' ? 'text-white/60' : 'text-(--text-muted)'}`}>{detail.label}</div>
                        <div className={`text-[13px] md:text-[15px] font-semibold ${theme === 'dark' ? 'text-white' : 'text-(--text-primary)'} leading-tight truncate`}>{detail.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-2 border-t border-white/8 px-4 md:px-5 pt-4">
                <h3 className="text-lg md:text-xl font-medium text-[#815CF0] mb-2">Her Traits</h3>
                <div className="space-y-3">
                  {((currentCharacterData?.profile?.traits || []) as any[]).filter((trait: any) => trait?.value && trait.value !== '—' && trait.value.trim() !== '').map((trait: any) => (
                    <div key={trait.label} className="flex items-center gap-2.5">
                      {(() => {
                        if (trait.iconKey === 'Personality') {
                          return (
                            <div className="flex-none shrink-0 h-8 w-8 aspect-square rounded-full flex items-center justify-center" style={{ border: '1px solid var(--muted-404)', background: (theme === 'dark' ? 'var(--hl-black)' : 'var(--hl-surface)') }}>
                              <Brain className="h-4 w-4 text-pink-400" />
                            </div>
                          );
                        }
                        const map: Record<string, string> = { Occupation: OccupationIcon, Relationship: RelationshipIcon, Hobbies: HobbiesIcon };
                        const src = map[trait.iconKey];
                        return src ? (
                          <div className="flex-none shrink-0 h-8 w-8 aspect-square rounded-full overflow-hidden flex items-center justify-center" style={{ border: '1px solid var(--muted-404)', background: (theme === 'dark' ? 'var(--hl-black)' : 'var(--hl-surface)') }}>
                            <img src={src} alt={trait.label} className="h-4 w-4 object-contain" />
                          </div>
                        ) : (
                          <div className="flex-none shrink-0 h-8 w-8 aspect-square rounded-full" style={{ border: '1px solid var(--muted-404)', background: (theme === 'dark' ? 'var(--hl-black)' : 'var(--hl-surface)') }} />
                        );
                      })()}
                      <div className="min-w-0">
                        <div className={`text-[10px] md:text-[11px] uppercase tracking-[0.14em] ${theme === 'dark' ? 'text-white/60' : 'text-(--text-muted)'}`}>{trait.label}</div>
                        <div className={`text-[13px] md:text-[15px] font-semibold ${theme === 'dark' ? 'text-white' : 'text-(--text-primary)'} leading-snug`}>{trait.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
