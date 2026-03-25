import React from 'react';
import { MoreVertical, Phone } from 'lucide-react';
import AvatarImg from './AvatarImg';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import type { ChatItem, Message, CharacterProfile } from '../types/chat';

type Props = {
  isMobile: boolean;
  mobileView: 'list' | 'chat' | 'details';
  setMobileView: (v: 'list' | 'chat' | 'details') => void;
  isDark: boolean;
  selected: ChatItem;
  characterSlug?: string | undefined;
  currentCharacterData?: { profile?: CharacterProfile; imageUrl?: string | null; webpImageUrl?: string | null; animatedUrl?: string | null } | null;
  isPrivatePackView: boolean;
  isPackView: boolean;
  packSlug?: string | undefined;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  endRef: React.RefObject<HTMLDivElement | null>;
  inputBarRef: React.RefObject<HTMLDivElement | null>;
  inputBarHeight: number;
  kbOffset: number;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  token?: string | null;
  historyRefreshKey: number;
  showSkeleton: boolean;
  onHistoryLoaded: () => void;
  onHistoryScroll: (offset: number, near: boolean) => void;
  input: string;
  setInput: (s: string) => void;
  send: () => void;
  handleVoiceResult: (inputUrl: string | null, outputUrl: string | null, transcript?: string, imageUrl?: string | null, imageJobId?: string | null) => void;
  isCompactContinuation: (prev?: Message, cur?: Message) => boolean;
};

export default function ChatCenterPanel({
  isMobile, mobileView, setMobileView, isDark, selected, currentCharacterData, scrollRef, endRef, inputBarRef, inputBarHeight, kbOffset,
  messages, setMessages, token, historyRefreshKey, showSkeleton, onHistoryLoaded, onHistoryScroll,
  input, setInput, send, handleVoiceResult, isCompactContinuation,
}: Props) {
  // Handler for when user clicks a preset message
  const handleSelectPreset = (text: string) => {
    setInput(text);
    // Optional: auto-send the message immediately
    // send();
  };

  return (
    <div className={`${isMobile ? (mobileView === 'chat' ? 'flex' : 'hidden') : 'flex'} flex-1 flex-col min-w-0 h-full bg-black relative z-20 border-r border-white/8`}>
      <div className={`px-4 md:px-6 py-3.5 md:py-4 border-b flex items-center justify-between shrink-0 ${isDark ? 'border-white/8' : 'border-gray-200'}`}>
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          {isMobile && (
            <button type="button" onClick={() => setMobileView('list')} aria-label="Back to chats" className={`mr-1 rounded-full p-1 ${isDark ? 'hover:bg-white/8' : 'hover:bg-gray-100'}`}>
              ←
            </button>
          )}
          <button type="button" onClick={() => { if (isMobile) setMobileView('details'); }} className="rounded-full" aria-label="Open profile">
            <AvatarImg hue={selected.hue} size={isMobile ? 56 : 64} online={selected.isOnline} imageUrl={currentCharacterData?.imageUrl} />
          </button>
          <div onClick={() => { if (isMobile) setMobileView('details'); }} className="cursor-pointer select-none min-w-0">
            <div className={`truncate font-semibold text-[20px] leading-7 md:text-[24px] md:leading-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selected.name}</div>
            {selected.isOnline && <div className="text-[12px] leading-4 md:text-[14px] md:leading-5 text-emerald-400 font-medium">Online</div>}
          </div>
        </div>
        <div className={`flex items-center gap-2 md:gap-3 ${isDark ? 'text-white/85' : 'text-gray-600'}`}>
          <button
            type="button"
            aria-label="Call"
            className={`inline-flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full transition-colors ${isDark ? 'bg-white/8 hover:bg-white/14' : 'bg-black/5 hover:bg-black/10'}`}
          >
            <Phone className="h-4 w-4 md:h-5 md:w-5" />
          </button>
          <button
            type="button"
            aria-label="More options"
            className={`inline-flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full transition-colors ${isDark ? 'bg-white/8 hover:bg-white/14' : 'bg-black/5 hover:bg-black/10'}`}
          >
            <MoreVertical className="h-4 w-4 md:h-5 md:w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 px-2 md:px-3 py-2 md:py-3 pr-0 overflow-hidden" style={{ scrollBehavior: 'smooth', overscrollBehavior: 'contain', willChange: 'scroll-position' }}>
        <div className="flex flex-col gap-4 h-full">
          <div className="flex-1 min-h-0">
            <ChatMessages
              characterId={String(selected?.id ?? '')}
              characterName={selected?.name}
              token={token}
              messages={messages}
              setMessages={setMessages}
              historyRefreshKey={historyRefreshKey}
              scrollRef={scrollRef}
              inputBarHeight={inputBarHeight}
              kbOffset={kbOffset}
              isMobile={isMobile}
              onHistoryLoaded={onHistoryLoaded}
              onHistoryScroll={onHistoryScroll}
              showSkeleton={showSkeleton}
              isCompactContinuation={isCompactContinuation}
              endRef={endRef}
              onSelectPreset={handleSelectPreset}
            />
          </div>

          {isMobile ? (
            <div aria-hidden style={{ height: `calc(${inputBarHeight}px + ${kbOffset}px + env(safe-area-inset-bottom, 0px) - 30px)`, minHeight: `0px`, width: '100%' }} />
          ) : null}
        </div>
      </div>

      <ChatInput input={input} setInput={setInput} send={send} isMobile={isMobile} isDark={isDark} inputBarRef={inputBarRef} kbOffset={kbOffset} handleVoiceResult={handleVoiceResult} />
    </div>
  );
}
