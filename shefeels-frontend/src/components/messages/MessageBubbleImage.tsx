import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Download, ShieldAlert } from 'lucide-react';
import type { Message } from '../../types/chat';
import { useEffect, useRef } from 'react';
import LazyImage from '../LazyImage';

function MessageBubbleImage({ m, showTime = true, onMeasure }: { m: Message; showTime?: boolean; onMeasure?: (h: number) => void }) {
  // use showTime as a noop to avoid unused variable diagnostics when not displayed
  void showTime;
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    try {
      if (onMeasure && containerRef.current) {
        const h = Math.ceil(containerRef.current.getBoundingClientRect().height || 0);
        onMeasure(h);
      }
    } catch (e) {}
  }, [onMeasure]);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isMe = m.from === 'me';

  if ((m as any).isViolation) {
    return (
      <div className={`bubble flex ${isMe ? 'justify-end' : 'justify-start'}`} style={{ maxWidth: '75%', alignSelf: isMe ? 'flex-end' : 'flex-start', boxSizing: 'border-box', paddingRight: isMe ? 8 : undefined, display: 'flex' }}>
         <div className={`relative inline-block overflow-hidden rounded-xl p-3 ${isDark ? 'border border-red-500/30 bg-red-500/10 text-red-100' : 'border border-red-200 bg-red-50 text-red-700'}`}>
            <div className="flex items-center gap-2">
               <ShieldAlert className="h-4 w-4" />
               <span className="text-sm font-medium">Safe Content Blocked</span>
            </div>
            <div className="text-xs opacity-80 mt-1">
               This image was flagged by our safety guardrails.
            </div>
         </div>
      </div>
    );
  }

  if (!m.imageUrl && !(m as any).animatedUrl && !(m as any).gifUrl) return <div className={isDark ? 'text-white/60' : 'text-gray-500'}>[Image unavailable]</div>;
  const url = String(m.imageUrl || '');
  const animatedUrl = String((m as any).animatedUrl || '');
  const gifUrl = String((m as any).gifUrl || '');
  // Only treat actual video formats as video, not animated webp/gif
  const isVideo = /\.(mp4|webm|ogg)$/i.test(url) || ((m as any).mime_type || '').toString().startsWith('video');
  const hasAnimated = Boolean(animatedUrl || gifUrl);

  return (
    <div className={`bubble flex ${isMe ? 'justify-end' : 'justify-start'}`} style={{ maxWidth: '76%', alignSelf: isMe ? 'flex-end' : 'flex-start', boxSizing: 'border-box', paddingRight: isMe ? 8 : undefined, display: 'flex', willChange: 'auto', contain: 'layout style paint' }}>
      <div ref={containerRef} className="relative inline-block group overflow-hidden rounded-2xl" style={{ display: 'inline-block', transform: 'translateZ(0)' }}>
        <button type="button" onClick={() => { try { window.dispatchEvent(new CustomEvent('open:media', { detail: { url: isVideo ? url : (animatedUrl || gifUrl || url), isVideo } })); } catch (e) {} }} className="block">
          {isVideo ? (
            <video src={url} controls muted loop playsInline crossOrigin="anonymous" onLoadedMetadata={(e) => { try { const h = Math.ceil((e.currentTarget as HTMLVideoElement).getBoundingClientRect().height); if (onMeasure) onMeasure(h); } catch (err) {} }} style={{ maxWidth: 'min(460px, 76vw)', maxHeight: '332px', width: 'auto', height: 'auto', objectFit: 'cover' }} />
          ) : (
            <LazyImage
              src={animatedUrl || gifUrl || url}
              alt={m.text || 'image'}
              onClick={() => {}}
              loading="lazy"
              isAnimated={hasAnimated}
              loopInterval={hasAnimated ? 3500 : 0}
              style={{ maxWidth: 'min(460px, 76vw)', maxHeight: '332px', width: 'auto', height: 'auto', objectFit: 'cover' }}
            />
          )}
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); try { window.open(url || '', '_blank', 'noopener'); } catch (err) {} }} className={`absolute bottom-2 right-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-60 ${isDark ? 'bg-black/60 text-white hover:bg-black/70' : 'bg-white/60 text-(--hl-text) hover:bg-white/70'}`} aria-label="Download">
          <Download className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Memoize to prevent re-renders when unrelated props change
export default React.memo(MessageBubbleImage, (prevProps, nextProps) => {
  return (
    prevProps.m?.id === nextProps.m?.id &&
    prevProps.m?.imageUrl === nextProps.m?.imageUrl &&
    prevProps.showTime === nextProps.showTime
  );
});
