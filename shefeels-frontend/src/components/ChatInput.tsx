import React, { useEffect, useRef } from 'react';
import VoiceRecorder from './VoiceRecorder';
import sendMessageIcon from '../assets/chat/SendMessageIcon.svg';
// import { IconSpinner } from '../utils/chatUtils';

export function AutoGrowTextarea({ value, onChange, onEnterSend, placeholder, isDark }: { value: string; onChange: (v: string) => void; onEnterSend: () => void; placeholder?: string; isDark: boolean }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    const max = 120; // ~4-5 lines
    const base = 26; // one line height (slightly increased)
    el.style.height = 'auto';
    const sc = Math.min(el.scrollHeight, max);
    el.style.height = (value && value.trim().length > 0 ? Math.max(base, sc) : base) + 'px';
  };
  useEffect(() => { resize(); }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onInput={resize}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onEnterSend();
        }
      }}
      placeholder={placeholder}
      className={`flex-1 bg-transparent focus:outline-none text-[14px] md:text-[15px] resize-none leading-relaxed max-h-[140px] overflow-auto break-words whitespace-pre-wrap p-0 min-h-[26px] ${isDark ? 'text-white placeholder-white/40' : 'text-gray-900 placeholder-gray-500'}`}
    />
  );
}

export default function ChatInput({
  input,
  setInput,
  send,
  isMobile,
  isDark,
  inputBarRef,
  kbOffset,
  handleVoiceResult,
}: {
  input: string;
  setInput: (v: string) => void;
  send: () => void;
  isMobile: boolean;
  isDark: boolean;
  inputBarRef: React.RefObject<HTMLDivElement | null>;
  kbOffset: number;
  handleVoiceResult: (inputUrl: string | null, outputUrl: string | null, transcript?: string, imageUrl?: string | null, imageJobId?: string | null) => void;
}) {
  if (isMobile) {
    return (
      <div
        ref={inputBarRef}
        className={`fixed left-0 right-0 bottom-0 z-40 border-t flex-shrink-0 ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`}
        style={{ background: (isDark ? 'var(--bg-tertiary)' : 'var(--mobile-cream)'), padding: 0, pointerEvents: 'auto', bottom: `${kbOffset}px` }}
      >
        <div
          className={`flex items-center gap-1 px-4 py-2 transition-all relative z-10`}
          style={{
            background: isDark ? 'var(--bg-tertiary)' : 'var(--mobile-cream)',
            borderRadius: 0,
            margin: 0,
            paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 4px)`,
          }}
        >
          <AutoGrowTextarea value={input} onChange={setInput} onEnterSend={send} placeholder="Type a message" isDark={isDark} />
          <div className={`flex items-center gap-2`}>
            <VoiceRecorder onResult={handleVoiceResult} className={`w-9 h-9 flex items-center justify-center`} />
            <button onClick={send} className={`w-9 h-9 flex items-center justify-center transition-all`} style={{ borderRadius: '999px', background: '#815CF0', color: '#FFFFFF', boxShadow: 'var(--sh-lift)' }}>
              <img src={sendMessageIcon} alt="Send" className={`w-4 h-4`} />
            </button>
          </div>
        </div>
        <div className="pointer-events-none" style={{ position: 'fixed', left: 0, right: 0, bottom: `${kbOffset}px`, height: 'calc(env(safe-area-inset-bottom, 0px) + 8px)', background: (isDark ? 'var(--bg-tertiary)' : '#FFF7ED'), zIndex: 0 }} />
      </div>
    );
  }

  // Web (non-mobile): render only the visible typing interface (no extra outer box)
  return (
    <div
      ref={inputBarRef}
      className={`relative flex items-center gap-3 border-t border-white/5 px-4 md:px-5 py-3 transition-all`}
      style={{ background: isDark ? 'var(--bg-secondary)' : 'var(--mobile-cream)', borderRadius: 0, margin: 0 }}
    >
      <AutoGrowTextarea value={input} onChange={setInput} onEnterSend={send} placeholder="Type a message" isDark={isDark} />
      <div className={`flex items-center gap-3`}>
        <VoiceRecorder onResult={handleVoiceResult} className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center`} />
        <button onClick={send} className={`w-10 h-10 md:w-11 md:h-11 flex items-center justify-center transition-all`} style={{ borderRadius: '999px', background: '#815CF0', color: '#FFFFFF', boxShadow: 'var(--sh-lift)' }}>
          <img src={sendMessageIcon} alt="Send" className={`w-4 h-4`} />
        </button>
      </div>
    </div>
  );
}
