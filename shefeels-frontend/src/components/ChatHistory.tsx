import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/api';
import { mapBackendMessages } from '../utils/chatMapping';
import { MemoMessageBubble } from './MessageBubble';
import { formatTime, splitIntoSentences, toDate } from '../utils/chatUtils';

const ROW_GAP = 6; // single source of truth for vertical spacing between rows

export type Message = {
  id: string;
  from: 'ai' | 'me';
  type: 'text' | 'audio' | 'image' | 'voice' | 'image-pending';
  text?: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  inputAudioUrl?: string | null;
  duration?: string;
  time?: string;
  // Async image generation support
  imageJobId?: string | null;
  imageJobStatus?: 'queued' | 'generating' | 'completed' | 'failed' | null;
  imageJobError?: string | null;
  // allow arbitrary extra fields
  [k: string]: any;
};

export default function ChatHistory({ characterId, messages, setMessages, refreshKey, onLoaded, scrollContainerRef, onScroll, inputBarHeight, kbOffset, isCompactContinuation }: { characterId: string | number; messages: Message[]; setMessages: React.Dispatch<React.SetStateAction<Message[]>>; refreshKey?: number; onLoaded?: () => void; scrollContainerRef?: React.RefObject<HTMLDivElement | null>; onScroll?: (offset: number, nearBottom: boolean) => void; inputBarHeight?: number; kbOffset?: number; isCompactContinuation?: (prev?: Message, cur?: Message) => boolean }) {
  const { token } = useAuth();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [, setInitialLoading] = useState(false);
  const fetchingOlderRef = useRef(false);
  const messagesRef = useRef<Message[]>(messages);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messageCacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const listOuterRef = useRef<HTMLDivElement | null>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  const handleOuterRef = useCallback((node: HTMLDivElement | null) => {
    listOuterRef.current = node;
    setScrollEl(node);
    if (scrollContainerRef && 'current' in scrollContainerRef) {
      (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  }, [scrollContainerRef]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const hasOptimisticMessages = useCallback(() => {
    const list = messagesRef.current || [];
    return list.some((m) => {
      if (!m || !m.id) return false;
      const id = String(m.id);
      // Check for both old (u-) and new (user-) patterns, plus ai-loading and img-pending
      return id.startsWith('u-') || id.startsWith('user-') || id.startsWith('ai-loading') || id.includes('ai-loading') || id.includes('img-pending');
    });
  }, []);

  useEffect(() => {
    let aborted = false;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const load = async () => {
      try {
        if (!token) { setMessages([]); setNextCursor(null); return; }
        if (characterId === undefined || characterId === null || String(characterId) === '') { setMessages([]); setNextCursor(null); return; }
        setInitialLoading(true);
        const cacheKey = `messages_${characterId}`;
        const cached = messageCacheRef.current.get(cacheKey);
        const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;
        if (cached && cacheAge < 30000) {
          if (!aborted) {
            const mapped = mapBackendMessages(cached.data.messages || [], new Set<string>(), splitIntoSentences);
            const next = cached.data.next_cursor || null;
            setNextCursor(next);
            const defer = hasOptimisticMessages();
            try { if (onLoaded) onLoaded(); } catch (e) { }
            if (defer) {
              // Preserve optimistic messages (user-side temporary IDs) while
              // still showing the server-provided history. Append optimistic
              // messages after the mapped history so they remain visible and
              // are not clobbered by the cached data.
              try {
                const existing = messagesRef.current || [];
                const optimistic = existing.filter((m) => {
                  if (!m || !m.id) return false;
                  const id = String(m.id);
                  // Support both old and new ID patterns and img-pending
                  return id.startsWith('u-') || id.startsWith('user-') || id.startsWith('ai-loading') || id.includes('ai-loading') || id.includes('img-pending');
                });
                const merged = [...mapped, ...optimistic];
                setMessages(merged);
                window.setTimeout(() => { try { doImmediateScroll(); } catch (e) { } }, 80);
              } catch (e) { setMessages(mapped); }
              return;
            }
            setMessages(mapped);
            try {
              window.setTimeout(() => { try { doImmediateScroll(); } catch (e) { } }, 80);
            } catch (e) { }
          }
        }
        try {
          const data: any = await apiClient.getChatMessages(String(characterId), 200, undefined, controller.signal);
          if (aborted || controller.signal.aborted) return;
          const rawItems = Array.isArray(data?.messages) ? data.messages : [];
          const next = data?.next_cursor || null;
          messageCacheRef.current.set(cacheKey, { data: { messages: rawItems, next_cursor: next }, timestamp: Date.now() });
          setNextCursor(next);
          const mapped = mapBackendMessages(rawItems, new Set<string>(), splitIntoSentences);
          const defer = hasOptimisticMessages();
          try { if (onLoaded) onLoaded(); } catch (e) { }
          if (defer) {
            try {
              const existing = messagesRef.current || [];
              const optimistic = existing.filter((m) => {
                if (!m || !m.id) return false;
                const id = String(m.id);
                // Support both old and new ID patterns and img-pending
                return id.startsWith('u-') || id.startsWith('user-') || id.startsWith('ai-loading') || id.includes('ai-loading') || id.includes('img-pending');
              });
              const merged = [...mapped, ...optimistic];
              setMessages(merged);
              window.setTimeout(() => { try { doImmediateScroll(); } catch (e) { } }, 80);
            } catch (e) { setMessages(mapped); }
            return;
          }
          setMessages(mapped);
          try {
            window.setTimeout(() => { try { doImmediateScroll(); } catch (e) { } }, 80);
          } catch (e) { }
        } catch (e: any) {
          if (e.name === 'AbortError') return;
          console.error('ChatHistory: failed initial load', e);
        } finally { if (!aborted) setInitialLoading(false); }
      } catch (e) { console.error('ChatHistory load error', e); }
    };

    load();
    return () => { aborted = true; controller.abort(); };
  }, [characterId, token, refreshKey]);

  const loadOlderMessages = useCallback(async () => {
    const container = scrollEl || scrollContainerRef?.current;
    if (!container) return;
    if (!nextCursor) return;
    if (!characterId && characterId !== 0) return;
    if (fetchingOlderRef.current) return;
    fetchingOlderRef.current = true;
    setLoadingOlder(true);
    const prevScrollTop = container.scrollTop;
    const prevScrollHeight = container.scrollHeight;

    try {
      const data: any = await apiClient.getChatMessages(String(characterId), 200, nextCursor, abortControllerRef.current?.signal);
      const rawItems = Array.isArray(data?.messages) ? data.messages : [];
      const existingIds = new Set((messagesRef.current || []).map((m) => m.id));
      const olderMapped = mapBackendMessages(rawItems, existingIds, splitIntoSentences);
      if (olderMapped.length > 0) setMessages((prevMessages) => [...olderMapped, ...prevMessages]);
      setNextCursor(data?.next_cursor || null);
      window.requestAnimationFrame(() => { try { const newHeight = container.scrollHeight; container.scrollTop = Math.max(0, newHeight - prevScrollHeight + prevScrollTop); } catch (e) { } });
    } catch (e) { console.error('Failed to fetch older messages', e); } finally { setLoadingOlder(false); fetchingOlderRef.current = false; }
  }, [characterId, nextCursor, scrollContainerRef, scrollEl]);

  // Group messages by day - OPTIMIZED: Only regroup when message IDs change, not content
  const messageIds = useMemo(() => messages.map(m => m.id).join(','), [messages]);

  const groups = useMemo(() => {
    const out: Array<{ type: 'day'; key: string; time?: string } | { type: 'msg'; msg: Message } | { type: 'spacer'; key: string }> = [];
    let lastKey: string | null = null;
    for (const m of messages) {
      const key = (new Date(m.time || new Date().toISOString())).toISOString().slice(0, 10);
      if (key !== lastKey) { out.push({ type: 'day', key, time: m.time }); lastKey = key; }
      out.push({ type: 'msg', msg: m });
    }
    // Add spacer for bottom padding
    out.push({ type: 'spacer', key: 'spacer' });
    return out;
  }, [messageIds, messages]);

  /**
   * Helpers to determine continuation + timestamp rules on demand.
   * These are used both for sizing (getItemSize) and for rendering (RowInner),
   * so live chat and history stay perfectly in sync.
   */

  // Find the previous/next "msg" group index, stopping at a day separator.
  const findNeighborMsgIndex = useCallback((startIndex: number, direction: 1 | -1) => {
    for (let i = startIndex + direction; i >= 0 && i < groups.length; i += direction) {
      const g = groups[i] as any;
      if (!g) continue;
      if (g.type === 'day') break;
      if (g.type === 'msg') return i;
    }
    return null;
  }, [groups]);

  const isContinuationPair = useCallback(
    (a?: Message, b?: Message) => {
      if (!a || !b) return false;

      const aIsUser = a.from === 'me';
      const bIsUser = b.from === 'me';

      // Compact any consecutive non-user (AI/character) messages to keep live + history consistent
      if (!aIsUser && !bIsUser) {
        return true;
      }

      // Allow parent to extend/override heuristics in either order
      if (isCompactContinuation) {
        try {
          if (isCompactContinuation(a, b)) return true;
        } catch (e) { }
        try {
          if (isCompactContinuation(b, a)) return true;
        } catch (e) { }
      }

      // Fallback: same sender, text, close in time
      if (a.from === b.from && a.type === 'text' && b.type === 'text' && a.time && b.time) {
        const delta = Math.abs(toDate(b.time).getTime() - toDate(a.time).getTime());
        if (delta <= 2000) return true;
      }

      return false;
    },
    [isCompactContinuation]
  );

  // Whether this message continues into the next one (controls bottom gap + timestamp)
  const continuesAfterIndex = useCallback((index: number): boolean => {
    const g = groups[index] as any;
    if (!g || g.type !== 'msg') return false;
    const thisMsg: Message = g.msg;

    const nextIdx = findNeighborMsgIndex(index, 1);
    if (nextIdx == null) return false;
    const nextGroup = groups[nextIdx] as any;
    if (!nextGroup || nextGroup.type !== 'msg') return false;
    const nextMsg: Message = nextGroup.msg;

    return isContinuationPair(thisMsg, nextMsg);
  }, [groups, findNeighborMsgIndex, isContinuationPair]);

  // Whether *this* row should be rendered as a continuation (controls bubble rounding / top margin)
  const isContinuationAtIndex = useCallback((index: number): boolean => {
    const g = groups[index] as any;
    if (!g || g.type !== 'msg') return false;
    const thisMsg: Message = g.msg;

    const prevIdx = findNeighborMsgIndex(index, -1);
    if (prevIdx == null) return false;
    const prevGroup = groups[prevIdx] as any;
    if (!prevGroup || prevGroup.type !== 'msg') return false;
    const prevMsg: Message = prevGroup.msg;

    return isContinuationPair(prevMsg, thisMsg);
  }, [groups, findNeighborMsgIndex, isContinuationPair]);

  const shouldShowTimeAtIndex = useCallback((index: number): boolean => {
    const g = groups[index] as any;
    if (!g || g.type !== 'msg') return false;
    const m: Message = g.msg;
    if (!m.time) return false;

    // Show the time only on the LAST message in a compact block
    const continuesAfter = continuesAfterIndex(index);
    return !continuesAfter;
  }, [groups, continuesAfterIndex]);

  const lastNearBottomRef = useRef<boolean>(true);
  const lastMessageMetaRef = useRef<{ count: number; lastId: string | null }>({
    count: messages.length,
    lastId: (messages[messages.length - 1]?.id as string | undefined) ?? null,
  });

  // Extra breathing room so the fixed input/keyboard never hides the latest bubble
  const bottomSpace = useMemo(() => {
    const bar = Number(inputBarHeight || 0);
    const kb = Number(kbOffset || 0);
    const buffer = 5; // keep timestamps clear of the input bar and its shadow
    const min = 10;
    const max = 40;
    return Math.min(max, Math.max(min, Math.round(bar + kb + buffer)));
  }, [inputBarHeight, kbOffset]);

  const doImmediateScroll = useCallback(() => {
    try {
      const el = listOuterRef.current ?? scrollEl ?? scrollContainerRef?.current ?? null;
      if (el) {
        const prev = (el as HTMLElement).style.scrollBehavior;
        try { (el as HTMLElement).style.scrollBehavior = 'auto'; } catch (e) { }
        try { (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight; } catch (e) { }
        window.setTimeout(() => { try { (el as HTMLElement).style.scrollBehavior = prev || ''; } catch (e) { } }, 60);
        return true;
      }
    } catch (e) { }
    return false;
  }, [scrollEl, scrollContainerRef]);

  // Scroll to bottom when new messages arrive
  useLayoutEffect(() => {
    const prev = lastMessageMetaRef.current;
    const lastMsg = messages[messages.length - 1];
    const newCount = messages.length;
    const newLastId = (lastMsg?.id as string | undefined) ?? null;
    const addedMessage = newCount > prev.count || (newLastId && newLastId !== prev.lastId);

    if (addedMessage && lastMsg) {
      const forceScroll = lastMsg.from === 'me';
      const shouldScroll = forceScroll || lastNearBottomRef.current;

      if (shouldScroll) {
        const container = listOuterRef.current || scrollEl || scrollContainerRef?.current;
        if (container) {
          // Immediate scroll in layout effect
          const prevBehavior = container.style.scrollBehavior;
          container.style.scrollBehavior = 'auto';
          const target = container.scrollHeight + bottomSpace;
          container.scrollTop = target;
          container.style.scrollBehavior = prevBehavior || '';
        }
      }
    }
  }, [messages, scrollEl, scrollContainerRef, bottomSpace]);

  // Additional scroll retries with delays for async content (images, audio)
  useEffect(() => {
    const prev = lastMessageMetaRef.current;
    const lastMsg = messages[messages.length - 1];
    const newCount = messages.length;
    const newLastId = (lastMsg?.id as string | undefined) ?? null;
    const addedMessage = newCount > prev.count || (newLastId && newLastId !== prev.lastId);

    if (addedMessage && lastMsg) {
      const forceScroll = lastMsg.from === 'me';
      const shouldScroll = forceScroll || lastNearBottomRef.current;

      if (shouldScroll) {
        lastNearBottomRef.current = true;

        const scrollToBottom = () => {
          try {
            const container = listOuterRef.current || scrollEl || scrollContainerRef?.current;
            if (container) {
              const prevBehavior = container.style.scrollBehavior;
              container.style.scrollBehavior = 'auto';
              container.scrollTop = container.scrollHeight + bottomSpace;
              container.style.scrollBehavior = prevBehavior || '';
            }
          } catch (e) { }
        };

        // Multiple delayed retries for async content
        const delays = [50, 100, 150, 200, 300, 400, 500, 750, 1000, 1500];
        delays.forEach(delay => {
          window.setTimeout(scrollToBottom, delay);
        });
      }

      lastMessageMetaRef.current = { count: newCount, lastId: newLastId };
    }
  }, [messages, scrollEl, scrollContainerRef, bottomSpace]);

  const Row = ({ index, style }: { index: number; style?: React.CSSProperties }) => {
    const g = groups[index];

    if ((g as any).type === 'day') {
      return (
        <div style={{ ...style, width: '100%' }} className="flex items-center justify-center w-full">
          <div className="px-3 py-1 rounded-full bg-white/6 text-xs text-white/60 font-medium">{(g as any).time ? new Date((g as any).time).toLocaleDateString() : ''}</div>
        </div>
      );
    }

    if ((g as any).type === 'spacer') {
      const spacerHeight = Math.max(0, Number(inputBarHeight || 0) + Number(kbOffset || 0) - 30);
      return (
        <div style={{ ...style, width: '100%' }} className="w-full" aria-hidden>
          <div style={{ height: spacerHeight, width: '100%' }} />
        </div>
      );
    }

    const m = (g as any).msg as Message;

    const isContinuation = isContinuationAtIndex(index);
    const showTime = shouldShowTimeAtIndex(index);
    const timeLabel = showTime && m.time ? formatTime(m.time) : '';
    const internalGap = showTime ? 2 : 0;

    // Does the previous message row show a timestamp?
    let hasTimeAbove = false;
    const prevMsgIndex = findNeighborMsgIndex(index, -1);
    if (prevMsgIndex != null) {
      hasTimeAbove = shouldShowTimeAtIndex(prevMsgIndex);
    }

    return (
      <div
        style={{ ...style, width: '100%' }}
        className={`flex flex-col ${m.from === 'me' ? 'items-end' : 'items-start'} w-full`}
      >
        <div
          className="message-inner flex w-full max-w-full"
          style={{ justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start' }}
        >
          <div className="flex flex-col w-full max-w-full" style={{ alignItems: m.from === 'me' ? 'flex-end' : 'flex-start', gap: internalGap }}>
            <MemoMessageBubble
              m={m as any}
              showTime={showTime}
              isContinuation={isContinuation}
              hasTimeAbove={hasTimeAbove}
            />
            {showTime && timeLabel ? (
              <div
                className={`leading-tight font-medium text-[10px] md:text-[11px] ${m.from === 'me' ? 'text-right' : 'text-left'} text-white/50`}
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
        {/* Spacer div for row gap */}
        <div style={{ height: ROW_GAP, width: '100%', flexShrink: 0 }} aria-hidden />
      </div>
    );
  };

  // Unified rendering - simple non-virtualized list with standard scrolling
  return (
    <>
      {loadingOlder && (
        <div className="absolute left-0 right-0 top-0 z-20 flex justify-center text-[11px] text-white/60 py-2 pointer-events-none">
          Loading earlier messages…
        </div>
      )}

      <div
        ref={handleOuterRef}
        className="w-full h-full overflow-y-auto overflow-x-hidden chat-scroll"
        style={{
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 2,
          scrollPaddingBottom: bottomSpace,
          boxSizing: 'border-box',
          position: 'relative',
          overscrollBehavior: 'contain',
          minHeight: 0,
        }}
        onScroll={(e) => {
          const target = e.currentTarget;
          const offset = target.scrollTop;
          const nearBottom =
            target.scrollHeight - target.scrollTop - target.clientHeight < 100;
          const isTrusted = typeof (e as any).isTrusted === 'boolean' ? (e as any).isTrusted : true;

          try {
            if (isTrusted && onScroll) onScroll(offset, nearBottom);
          } catch (err) { }

          try {
            if (isTrusted) lastNearBottomRef.current = Boolean(nearBottom);
          } catch (err) { }

          // load older when near top
          if (isTrusted && offset < 300 && nextCursor && !fetchingOlderRef.current) {
            loadOlderMessages();
          }
        }}
      >
        {groups.map((g, index) => (
          <Row
            key={
              (g as any).type === 'day'
                ? `day-${(g as any).key}-${index}`
                : (g as any).type === 'spacer'
                  ? `spacer-${index}`
                  : ((g as any).msg?.id as string) || index
            }
            index={index}
          />
        ))}
      </div>
    </>
  );
}