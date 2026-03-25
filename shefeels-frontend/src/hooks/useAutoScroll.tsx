import { useCallback, useRef, useState, useEffect } from 'react';

type ScrollRef = React.RefObject<HTMLElement | null>;

export function useAutoScroll(scrollRef: ScrollRef, endRef: ScrollRef) {
  const scrollTimersRef = useRef<number[]>([]);
  const imageListenersRef = useRef<Array<{ img: HTMLImageElement; handler: EventListener }>>([]);
  const firstLoadRef = useRef<boolean>(true);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  const clearScrollTimers = useCallback(() => {
    try {
      for (const id of scrollTimersRef.current) {
        try { window.clearTimeout(id); } catch (e) {}
      }
    } finally { scrollTimersRef.current = []; }
  }, []);

  const detachImageListeners = useCallback(() => {
    try {
      for (const it of imageListenersRef.current) {
        try { it.img.removeEventListener('load', it.handler); } catch (e) {}
      }
    } finally { imageListenersRef.current = []; }
  }, []);

  const attachImageLoadListeners = useCallback(() => {
    try {
      const el = scrollRef.current;
      if (!el) return;
      // remove previous listeners first
      detachImageListeners();
      const imgs = Array.from(el.querySelectorAll('img')) as HTMLImageElement[];
      for (const img of imgs) {
        const handler = (() => {
          return (() => {
            try {
              clearScrollTimers();
              const container = scrollRef.current;
              if (container) {
                try { container.scrollTo({ top: container.scrollHeight, behavior: 'auto' }); } catch (e) {}
              } else {
                try { endRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' }); } catch (e) {}
              }
            } catch (e) {}
          }) as EventListener;
        })();
        try { img.addEventListener('load', handler); imageListenersRef.current.push({ img, handler }); } catch (e) {}
      }
    } catch (e) {}
  }, [scrollRef, endRef, clearScrollTimers, detachImageListeners]);

  const jumpToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    try {
      if (!autoScroll && !firstLoadRef.current) return;
      const container = scrollRef.current;
      if (container) {
        try { container.scrollTo({ top: container.scrollHeight, behavior }); } catch (e) {}
        window.requestAnimationFrame(() => { try { container.scrollTop = container.scrollHeight; } catch (e) {} });

        clearScrollTimers();
        scrollTimersRef.current.push(window.setTimeout(() => { try { const c = scrollRef.current; if (c) { try { c.scrollTo({ top: c.scrollHeight, behavior: 'auto' }); } catch (e) {} } } catch (e) {} }, 80) as unknown as number);
        scrollTimersRef.current.push(window.setTimeout(() => { try { const c = scrollRef.current; if (c) { try { c.scrollTo({ top: c.scrollHeight, behavior: 'auto' }); } catch (e) {} } } catch (e) {} }, 300) as unknown as number);

        // watch images and re-scroll when they load
        attachImageLoadListeners();
        return;
      }
    } catch (e) {}
    try { endRef.current?.scrollIntoView({ behavior, block: 'end' }); } catch (e) {}
  }, [scrollRef, endRef, autoScroll, clearScrollTimers, attachImageLoadListeners]);

  // When user disables auto-scroll (scrolls up), clear pending retry timers
  useEffect(() => {
    if (!autoScroll) clearScrollTimers();
  }, [autoScroll, clearScrollTimers]);

  return {
    autoScroll,
    setAutoScroll,
    jumpToLatest,
    attachImageLoadListeners,
    clearScrollTimers,
    detachImageListeners,
    firstLoadRef,
  };
}

export default useAutoScroll;
