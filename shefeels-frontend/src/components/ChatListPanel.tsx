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
    <div className={`${isMobile ? (mobileView === 'list' ? 'flex w-full' : 'hidden') : 'w-[320px] flex'} ${isDark ? 'border-white/5' : 'border-gray-200'
      } ${isMobile ? '' : 'border-r'} flex-col h-full bg-(--bg-primary)`}>
      <div className={`p-4 md:p-5 border-b shrink-0 ${isDark ? 'border-white/5' : 'border-gray-200'}`}>
        <h1 className="mb-3 text-lg leading-7 font-semibold text-white md:mb-4 md:text-xl md:leading-8">Chat</h1>

        <div className="relative mb-2">
          <img src={SearchIcon} alt="Search" className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 md:h-4 md:w-4 ${isDark ? 'opacity-90' : 'opacity-80'}`} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className={`h-9 md:h-10 w-full pr-4 text-[13px] md:text-sm focus:outline-none transition-all ${isDark ? 'text-white placeholder-white/35' : 'text-gray-900 placeholder-gray-500'}`}
            style={{ borderRadius: '70px', border: isDark ? '0.6px solid rgba(255,255,255,0.12)' : '0.6px solid rgba(0,0,0,0.12)', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', paddingLeft: '42px' }}
          />
        </div>

        <div className="mt-4">
          <div className="grid grid-cols-2 gap-2 text-sm font-medium">
            <button onClick={() => setTab('all')} className="py-2 text-center" aria-pressed={tab === 'all'} aria-label="All Chats">
              <div className="flex flex-col items-center gap-1">
                <span className={`font-medium text-sm md:text-base ${tab === 'all' ? 'text-[#815CF0]' : 'text-[#8E8E93]'}`}>All Chats</span>
                <span className={`${tab === 'all' ? 'block w-full h-px bg-[#815CF0] rounded-full' : 'block w-full h-px bg-transparent'}`} />
              </div>
            </button>
            <button onClick={() => setTab('ai')} className="py-2 text-center" aria-pressed={tab === 'ai'} aria-label="My AI">
              <div className="flex flex-col items-center gap-1">
                <span className={`font-medium text-sm md:text-base ${tab === 'ai' ? 'text-[#815CF0]' : 'text-[#8E8E93]'}`}>My AI</span>
                <span className={`${tab === 'ai' ? 'block w-full h-px bg-[#815CF0] rounded-full' : 'block w-full h-px bg-transparent'}`} />
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
                        <div className="rounded-full bg-white/10" style={{ width: 40, height: 40 }} />
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
              className={`w-full text-left px-4 md:px-5 py-3 md:py-3 flex items-center gap-3 md:gap-4 transition-colors ${isDark ? "hover:bg-white/4" + (selected?.id === c.id ? " bg-white/6" : " bg-transparent") : "hover:bg-gray-100" + (selected?.id === c.id ? " bg-gray-100" : " bg-transparent")
                }`}
            >
              <AvatarImg hue={c.hue ?? 200} size={isMobile ? 48 : 48} online={c.isOnline} imageUrl={(c as any).imageUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div className={`truncate text-white font-medium text-sm md:text-base tracking-tight`}>{c.name}</div>
                  {token ? (
                    <div className={`ml-1 shrink-0 text-[10px] md:text-xs ${isDark ? 'text-white/35' : 'text-gray-500'}`}>{c.time}</div>
                  ) : null}
                </div>
                <div className={`text-xs md:text-sm truncate tracking-tight ${isDark ? 'text-white/50' : 'text-gray-600'}`}>{c.last}</div>
              </div>
            </button>
          ));
        })()}
      </div>
    </div>
  );
}
