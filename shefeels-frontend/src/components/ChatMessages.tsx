import React from 'react';
import ChatHistory from './ChatHistory';
import { MemoMessageBubble } from './MessageBubble';
import ChatPresets from './ChatPresets';
import type { Message } from '../types/chat';
import { useTheme } from '../contexts/ThemeContext';
import { formatTime } from '../utils/chatUtils';

type Props = {
  characterId: string;
  characterName?: string;
  token?: string | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  historyRefreshKey: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  inputBarHeight: number;
  kbOffset: number;
  isMobile: boolean;
  onHistoryLoaded: () => void;
  onHistoryScroll: (offset: number, near: boolean) => void;
  showSkeleton: boolean;
  isCompactContinuation: (prev?: Message, cur?: Message) => boolean;
  endRef: React.RefObject<HTMLDivElement | null>;
  onSelectPreset?: (text: string) => void;
};

function ChatMessages({
  characterId, characterName, token, messages, setMessages, historyRefreshKey, scrollRef, inputBarHeight, kbOffset, isMobile,
  onHistoryLoaded, onHistoryScroll, showSkeleton, isCompactContinuation, endRef, onSelectPreset,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Show presets when a chat has no messages.
  // For authenticated users, wait until history loading finishes so we do not
  // flash starters before the existing conversation is fetched.
  const shouldShowPresets = messages.length === 0 && onSelectPreset && (!token || !showSkeleton);

  return (
    <div className="flex h-full min-h-0 flex-col relative">
      {token ? (
        <div className="relative flex-1 min-h-0">
          <ChatHistory
            characterId={characterId}
            messages={messages}
            setMessages={setMessages}
            refreshKey={historyRefreshKey}
            scrollContainerRef={scrollRef}
            inputBarHeight={inputBarHeight}
            kbOffset={kbOffset}
            onLoaded={onHistoryLoaded}
            onScroll={onHistoryScroll}
            isCompactContinuation={isCompactContinuation}
          />

          {shouldShowPresets ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-(--bg-primary)">
              <ChatPresets
                characterId={characterId}
                characterName={characterName}
                onSelectPreset={onSelectPreset}
                isDark={isDark}
                isMobile={isMobile}
              />
            </div>
          ) : null}

          {showSkeleton && (
            <div className="absolute inset-0 z-30 pointer-events-none p-4">
              <div aria-hidden className="max-w-full mx-auto space-y-4">
                <div className="flex items-start"><div className="skeleton rounded-2xl h-10 w-3/5" /></div>
                <div className="flex items-start"><div className="ml-auto skeleton rounded-2xl h-8 w-2/5" /></div>
                <div className="flex items-start"><div className="skeleton rounded-xl h-44 w-[320px]" /></div>
                <div className="flex items-start gap-4"><div className="skeleton rounded-2xl h-8 w-2/5" /><div className="ml-auto skeleton rounded-2xl h-8 w-1/3" /></div>
                <div className="flex items-start"><div className="ml-auto skeleton rounded-lg h-32 w-60" /></div>
                <div className="space-y-2"><div className="skeleton rounded-md h-3 w-1/2" /><div className="skeleton rounded-md h-3 w-1/3" /></div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden chat-scroll flex flex-col">
          {/* Show preset messages for guest users to encourage engagement */}
          {shouldShowPresets ? (
            <div className="flex-1 flex items-center justify-center py-2">
              <ChatPresets
                characterId={characterId}
                characterName={characterName}
                onSelectPreset={onSelectPreset}
                isDark={isDark}
                isMobile={isMobile}
              />
            </div>
          ) : (
            messages.map((m, i) => {
              const prev = i > 0 ? messages[i - 1] : undefined;
              // Treat any consecutive AI messages as continuations for tight spacing
              const isConsecutiveAI = prev?.from === 'ai' && m.from === 'ai';
              const compact = isConsecutiveAI || isCompactContinuation(prev, m);
              const next = i < messages.length - 1 ? messages[i + 1] : undefined;
              const continuesAfter = (m.from === 'ai' && next?.from === 'ai') || isCompactContinuation(m, next as any);
              const showTime = Boolean(m.time) && !continuesAfter;
              const timeLabel = showTime && m.time ? formatTime(m.time) : '';
              // Spacing handled by marginTop in MessageBubbleText
              const internalGap = showTime ? 2 : 0;
              return (
                <div
                  key={m.id}
                  className={`flex w-full ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="flex w-full max-w-full" style={{ justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
                    <div className="flex flex-col w-full max-w-full" style={{ alignItems: m.from === 'me' ? 'flex-end' : 'flex-start', gap: internalGap }}>
                      <MemoMessageBubble m={m} showTime={showTime} isContinuation={compact} />
                      {showTime && timeLabel ? (
                        <div
                          className={`leading-tight font-medium text-[10px] md:text-[11px] ${m.from === 'me' ? 'text-right' : 'text-left'} ${isDark ? 'text-white/50' : 'text-gray-500'}`}
                          style={{
                            maxWidth: '75%',
                            width: 'fit-content',
                            alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start',
                            paddingRight: m.from === 'me' ? 16 : 0,
                            paddingLeft: m.from === 'me' ? 0 : 16,
                            marginTop: 2,
                          }}
                        >
                          <time dateTime={m.time ? String(m.time) : undefined}>{timeLabel}</time>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

// Memoize to prevent re-renders when parent state changes (like input text)
export default React.memo(ChatMessages, (prevProps, nextProps) => {
  return (
    prevProps.characterId === nextProps.characterId &&
    prevProps.token === nextProps.token &&
    prevProps.messages === nextProps.messages &&
    prevProps.historyRefreshKey === nextProps.historyRefreshKey &&
    prevProps.inputBarHeight === nextProps.inputBarHeight &&
    prevProps.kbOffset === nextProps.kbOffset &&
    prevProps.isMobile === nextProps.isMobile &&
    prevProps.showSkeleton === nextProps.showSkeleton
  );
});
