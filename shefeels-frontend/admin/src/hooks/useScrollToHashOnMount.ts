import { useEffect } from 'react';

function getAdminHeaderOffset() {
  const attrEl = document.querySelector<HTMLElement>('[data-admin-header-height]');
  const raw = attrEl?.getAttribute('data-admin-header-height');
  const parsed = raw ? Number(raw) : NaN;
  const base = Number.isFinite(parsed) ? parsed : 0;
  const extraMargin = 16;
  return Math.max(0, base) + extraMargin;
}

function scrollToElementWithOffset(el: HTMLElement, behavior: ScrollBehavior) {
  const offset = getAdminHeaderOffset();
  const rect = el.getBoundingClientRect();
  const target = window.pageYOffset + rect.top - offset;
  window.scrollTo({ top: target, behavior });
}

export function useScrollToHashOnMount(onScrolled?: (id: string) => void) {
  useEffect(() => {
    const hash = window.location.hash?.replace('#', '');
    if (hash) {
      const el = document.getElementById(hash);
      if (el) {
        requestAnimationFrame(() => {
          scrollToElementWithOffset(el, 'smooth');
          onScrolled?.(hash);
        });
      }
    }
  }, []);
}
