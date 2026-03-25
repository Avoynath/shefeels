import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export function usePinnedSubnav(key: string): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [pinned, setPinned] = useState<boolean>(() => {
    try { return localStorage.getItem(key) === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(key, String(pinned)); } catch { /* ignore */ }
  }, [pinned, key]);

  return [pinned, setPinned];
}
