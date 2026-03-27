// import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AvatarImg from './AvatarImg';
import SearchIcon from '../assets/chat/SearchIcon.svg';
import type { ChatItem } from '../types/chat';

type Props = {
  isMobile: boolean;
  mobileView: 'list' | 'chat' | 'details';
  setMobileView: (v: 'list' | 'chat' | 'details') => void;
  isDark: boolean;
  tab: 'all' | 'ai';
  setTab: (t: 'all' | 'ai') => void;
  q: string;
  setQ: (s: string) => void;
  chatsLoading: boolean;
  filtered: ChatItem[];
  userCharactersLoading: boolean;
  userCharactersError: string | null;
  chatsLoadingFallback: boolean;
  selected?: ChatItem | null;
  onSelect: (c: ChatItem) => void;
  navigateToSelect: () => void;
  navigateToCreate: () => void;
};

export default function ChatListPanel(props: Props) {
  const { token } = useAuth();
  const {
    isMobile, mobileView, isDark, tab, setTab, q, setQ,
    userCharactersLoading, userCharactersError, filtered, chatsLoading, selected, onSelect,
  } = props;

  return (
    <div className={`${isMobile ? (mobileView === 'list' ? 'flex w-full' : 'hidden') : 'w-106.5 flex'} ${isDark ? 'border-white/8' : 'border-gray-200'
      } ${isMobile ? '' : 'border-r'} flex-col h-full bg-black`}>
      <div className={`p-4 md:p-5 border-b shrink-0 ${isDark ? 'border-white/8' : 'border-gray-200'}`}>
        <h1 className="mb-4 text-[30px] leading-9 font-medium text-white md:mb-5 md:text-[36px] md:leading-10">Chat</h1>

        <div className="relative mb-3">
          <img src={SearchIcon} alt="Search" className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 md:h-4.5 md:w-4.5 ${isDark ? 'opacity-100' : 'opacity-80'}`} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className={`h-12 md:h-13 w-full pr-4 text-[16px] md:text-[20px] focus:outline-none transition-all ${isDark ? 'text-white placeholder-white/45' : 'text-gray-900 placeholder-gray-500'}`}
            style={{ borderRadius: '70px', border: isDark ? '0.6px solid rgba(255,255,255,0.20)' : '0.6px solid rgba(0,0,0,0.12)', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', paddingLeft: '46px' }}
          />
        </div>

        <div className="mt-4">
          <div className="grid grid-cols-2 gap-2 text-sm font-medium">
            <button onClick={() => setTab('all')} className="py-2 text-center" aria-pressed={tab === 'all'} aria-label="All Chats">
              <div className="flex flex-col items-center gap-1">
                <span className={`font-medium text-[16px] md:text-[20px] ${tab === 'all' ? 'text-[#815CF0]' : 'text-[#8E8E93]'}`}>All Chats</span>
                <span className={`${tab === 'all' ? 'block w-30 md:w-38 h-px bg-[#815CF0] rounded-full' : 'block w-30 md:w-38 h-px bg-transparent'}`} />
              </div>
            </button>
            <button onClick={() => setTab('ai')} className="py-2 text-center" aria-pressed={tab === 'ai'} aria-label="My AI">
              <div className="flex flex-col items-center gap-1">
                <span className={`font-medium text-[16px] md:text-[20px] ${tab === 'ai' ? 'text-[#815CF0]' : 'text-[#8E8E93]'}`}>My AI</span>
                <span className={`${tab === 'ai' ? 'block w-30 md:w-38 h-px bg-[#815CF0] rounded-full' : 'block w-30 md:w-38 h-px bg-transparent'}`} />
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 chat-scroll">
        {(() => {
          if (tab === 'ai') {
            if (userCharactersLoading) return <div className="p-4 text-sm text-white">Loading your AI characters…</div>;
            if (userCharactersError) return <div className="p-4 text-sm text-red-400">{userCharactersError}</div>;
            if (filtered.length === 0) {
              if (chatsLoading) {
                return (
                  <div className="p-3 space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="w-full text-left p-3 flex items-center gap-2">
                        <div className="rounded-full bg-white/10" style={{ width: 48, height: 48 }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <div className="h-4 bg-white/10 rounded w-1/2" />
                            <div className="ml-1 shrink-0 text-[10px] text-white/40">&nbsp;</div>
                          </div>
                          <div className="text-xs truncate tracking-tight text-white/40">
                            <div className="h-3 bg-white/6 rounded w-3/4" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              return <div className="p-4 text-sm text-white">No characters found. Create your first AI character to start chatting.</div>;
            }
          }

          return filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className={`w-full text-left px-4 md:px-5 py-3 md:py-3.5 flex items-center gap-3.5 md:gap-4 transition-colors ${isDark ? "hover:bg-white/4" + (selected?.id === c.id ? " bg-white/6" : " bg-transparent") : "hover:bg-gray-100" + (selected?.id === c.id ? " bg-gray-100" : " bg-transparent")
                }`}
            >
              <AvatarImg hue={c.hue ?? 200} size={isMobile ? 58 : 74} online={c.isOnline} imageUrl={(c as any).imageUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div className={`truncate text-white font-medium text-[20px] leading-7 md:text-[24px] md:leading-8 tracking-tight`}>{c.name}</div>
                  {token ? (
                    <div className={`ml-1 shrink-0 text-[12px] md:text-[14px] ${isDark ? 'text-white/35' : 'text-gray-500'}`}>{c.time}</div>
                  ) : null}
                </div>
                <div className={`text-[16px] leading-6 md:text-[20px] md:leading-7 truncate tracking-tight ${isDark ? 'text-white/50' : 'text-gray-600'}`}>{c.last}</div>
              </div>
            </button>
          ));
        })()}
      </div>
    </div>
  );
}
