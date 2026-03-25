type Gender = 'Male' | 'Female' | 'Trans' | string;

const STORAGE_KEY = 'hl_gender';

type Listener = (g: Gender) => void;

const listeners: Set<Listener> = new Set();

export function getGender(): Gender {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v || '';
  } catch {
    return '';
  }
}

export function setGender(g: Gender) {
  try {
    localStorage.setItem(STORAGE_KEY, g);
  } catch {}
  try { window.dispatchEvent(new CustomEvent('hl_gender_changed', { detail: g })); } catch {}
  for (const l of Array.from(listeners)) {
    try { l(g); } catch {}
  }
}

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export default { getGender, setGender, subscribe };
