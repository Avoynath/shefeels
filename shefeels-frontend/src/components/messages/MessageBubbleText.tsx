import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cleanLLMResponse } from '../../utils/chatUtils';
import type { Message } from '../../types/chat';
import { useEffect, useRef } from 'react';

function MessageBubbleText({ m, showTime = true, onMeasure, isContinuation = false, hasTimeAbove = false }: { m: Message; showTime?: boolean; onMeasure?: (h: number) => void; isContinuation?: boolean; hasTimeAbove?: boolean }) {
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

  // keep showTime parameter to preserve API; use noop to avoid unused-var lint
  void showTime;
  // keep hasTimeAbove parameter for compatibility; intentionally unused since spacing is row-driven
  void hasTimeAbove;

  const textColor = isMe
    ? 'text-white'
    : isDark
    ? 'text-white'
    : 'text-gray-900';
  const background = isMe
    ? '#815CF0'
    : isDark
    ? '#1A1C22'
    : '#F5F5F5';
  const bubbleShadow = isMe
    ? '0 8px 16px rgba(0,0,0,0.2)'
    : '0 8px 18px rgba(0,0,0,0.14)';

  // spacing + shape based on continuation
  const bubbleGap = 2;
  const paddingTop = 13;
  const paddingBottom = 13;
  const borderRadius = isContinuation ? 8 : 14;

  return (
    <div
      ref={outerRef}
      className={`bubble flex ${isMe ? 'justify-end' : 'justify-start'}`}
      style={{
        maxWidth: 'min(74%, 390px)',
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        boxSizing: 'border-box',
        paddingRight: isMe ? 8 : undefined,
        paddingLeft: isMe ? undefined : 8,
        display: 'flex',
        marginBottom: 0,
      }}
    >
      <div
        ref={containerRef}
        className={`flex flex-col text-[13px] leading-relaxed ${textColor}`}
        style={{
          position: 'relative',
          maxWidth: '100%',
          display: 'inline-flex',
          flexDirection: 'column',
          minWidth: 56,
          background,
          boxShadow: bubbleShadow,
          borderRadius,
          paddingTop,
          paddingLeft: 17,
          paddingRight: 17,
          paddingBottom,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          gap: bubbleGap,
        }}
      >
        <div className="min-w-0 text-sm whitespace-pre-wrap wrap-break-word" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', marginBottom: 0 }}>
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
              return sanitized.split(/(\*[^*]+\*)/g).map((part, i) => {
                if (/^\*.+\*$/.test(part))
                  return <em key={i}>{part.replace(/\*/g, '')}</em>;
                return (
                  <span
                    key={i}
                    style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                  >
                    {part}
                  </span>
                );
              });
            })()
          ) : (
            m.text
          )}
        </div>
        {/* Inner timestamp removed - timestamp is shown outside the bubble in ChatMessages */}
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export default React.memo(MessageBubbleText, (prevProps, nextProps) => {
  return (
    prevProps.m?.id === nextProps.m?.id &&
    prevProps.m?.text === nextProps.m?.text &&
    prevProps.showTime === nextProps.showTime &&
    prevProps.isContinuation === nextProps.isContinuation &&
    prevProps.hasTimeAbove === nextProps.hasTimeAbove
  );
});
