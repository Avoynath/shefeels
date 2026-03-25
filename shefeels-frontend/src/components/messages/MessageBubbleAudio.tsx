import React from 'react';
import { useEffect, useRef } from 'react';
import AudioPlayer from '../AudioPlayer';
import type { Message } from '../../types/chat';

function MessageBubbleAudio({ m, showTime = true, onMeasure }: { m: Message; showTime?: boolean; onMeasure?: (h: number) => void }) {
  const isMe = m.from === 'me';
  // keep showTime param to maintain API; use noop to avoid unused-var
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

  const bubbleBg = isMe ? 'var(--primary)' : 'rgba(255,255,255,0.10)';
  return (
    <div className={`bubble flex ${isMe ? 'justify-end' : 'justify-start'}`} style={{ maxWidth: '62%', alignSelf: isMe ? 'flex-end' : 'flex-start', boxSizing: 'border-box', paddingRight: isMe ? 8 : undefined, display: 'flex' }}>
      <div ref={containerRef} className={`flex flex-col gap-1 text-[13px] leading-relaxed`} style={{ position: 'relative', maxWidth: '100%', display: 'inline-flex', flexDirection: 'column', minWidth: 64, paddingTop: 7, paddingLeft: 10, paddingRight: 10, paddingBottom: 7, borderRadius: 12, background: bubbleBg }}>
        {m.audioUrl ? (
          <AudioPlayer audioUrl={m.audioUrl} from={m.from} />
        ) : (
          <div className="text-xs opacity-60">Audio unavailable</div>
        )}
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export default React.memo(MessageBubbleAudio, (prevProps, nextProps) => {
  return (
    prevProps.m?.id === nextProps.m?.id &&
    prevProps.m?.audioUrl === nextProps.m?.audioUrl &&
    prevProps.showTime === nextProps.showTime
  );
});
