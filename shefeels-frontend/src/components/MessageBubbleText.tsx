import { useTheme } from '../contexts/ThemeContext';
import { cleanLLMResponse } from '../utils/chatUtils';
import type { Message } from '../types/chat';
import { useEffect, useRef } from 'react';

export default function MessageBubbleText({ m, showTime = true, onMeasure, isContinuation = false }: { m: Message; showTime?: boolean; onMeasure?: (h: number) => void; isContinuation?: boolean }) {
  // keep showTime param for API parity; unused here because timestamp renders outside the bubble
  void showTime;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const outerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    try {
      if (!onMeasure) return;
      const el = outerRef.current || containerRef.current;
      if (!el) return;
      const measure = () => {
        try {
          const h = Math.ceil(el.getBoundingClientRect().height || 0);
          if (h) onMeasure(h);
        } catch (e) {}
      };
      measure();
      const ro = new ResizeObserver(measure);
      try { ro.observe(el); } catch (e) {}
      return () => { try { ro.disconnect(); } catch (e) {} };
    } catch (e) {}
  }, [onMeasure]);

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isMe = m.from === 'me';
  const isVoice = m.type === 'voice' || m.type === 'audio';

  const textColor = isMe ? 'text-[var(--hl-black)]' : isDark ? 'text-white' : 'text-gray-900';
  const background = isMe ? 'var(--primary)' : isDark ? 'rgba(255,255,255,0.10)' : '#F5F5F5';
  const bubbleShadow = isMe ? '0 10px 24px rgba(0,0,0,0.18)' : '0 8px 18px rgba(0,0,0,0.14)';

  return (
    <div
      ref={outerRef}
      className={`bubble flex ${isMe ? 'justify-end' : 'justify-start'}`}
      style={{ maxWidth: '75%', alignSelf: isMe ? 'flex-end' : 'flex-start', boxSizing: 'border-box', paddingRight: isMe ? 12 : undefined, display: 'flex' }}
    >
      <div
        ref={containerRef}
        className={`flex flex-col ${isContinuation ? 'gap-0' : 'gap-1'} rounded-2xl text-[13px] leading-relaxed ${textColor}`}
        style={{
          position: 'relative',
          maxWidth: '100%',
          display: 'inline-flex',
          flexDirection: 'column',
          minWidth: 56,
          background,
          boxShadow: bubbleShadow,
          paddingTop: isContinuation ? 2 : 10,
          paddingLeft: 14,
          paddingRight: 14,
          paddingBottom: isContinuation ? 2 : 12,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
        }}
      >
        <div className="min-w-0 text-sm whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', marginBottom: 0 }}>
          {isVoice ? (
            m.audioUrl ? (
              // Audio player handled elsewhere; keep a placeholder link
              <audio src={m.audioUrl} controls />
            ) : (
              <span className="text-xs opacity-60">Voice message unavailable</span>
            )
          ) : typeof m.text === 'string' ? (
            (() => {
              const sanitized = cleanLLMResponse(String(m.text || ''));
              return sanitized.split(/(\*[^*]+\*)/g).map((part: string, i: number) => {
                if (/^\*.+\*$/.test(part)) return <em key={i}>{part.replace(/\*/g, '')}</em>;
                return <span key={i} style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{part}</span>;
              });
            })()
          ) : (
            m.text
          )}
        </div>
      </div>
    </div>
  );
}
