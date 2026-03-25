import React, { useEffect } from 'react';
import { getApiBaseUrl, getApiOrigin } from './apiBase';

// Lightweight spinner used by the bubble
export function IconSpinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function toDate(v?: string | number | Date) {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') {
    const s = v.trim();
    if (/^\d+$/.test(s)) return new Date(Number(s));
    const timeOnly = s.match(/^(\d{1,2}):(\d{2})(?:\s*([ap]m))?$/i);
    if (timeOnly) {
      let hh = Number(timeOnly[1]);
      const mm = Number(timeOnly[2]);
      const ampm = timeOnly[3];
      if (ampm) {
        if (/pm/i.test(ampm) && hh < 12) hh += 12;
        if (/am/i.test(ampm) && hh === 12) hh = 0;
      }
      const d = new Date();
      d.setHours(hh, mm, 0, 0);
      return d;
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function formatTime(date?: string | number | Date) {
  const d = toDate(date);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function cleanLLMResponse(text: string): string {
  try {
    if (!text) return '';
    let out = text.replace(/https?:\/\/\S+/gi, '');
    out = out.replace(/\b\S+\.(png|jpg|jpeg|gif|mp4|mp3|wav|webm|pdf|gifv)\b/gi, '');
    const garbagePhrases: RegExp[] = [
      /here('?s| is) (your|the) (image|video|audio|file|result|output)/gi,
      /click (the )?link (below|here)/gi,
      /download (it )?here/gi,
      /generated (image|video|audio)/gi,
      /see (your|the) result/gi,
      /preview/gi,
      /👇/g,
      /hope you like it/gi,
      /as requested/gi,
      /you can (download|view) it (here|below)/gi,
      /here('?s| is) the result/gi,
    ];
    for (const re of garbagePhrases) out = out.replace(re, '');
    out = out.replace(/\s{2,}/g, ' ').trim();
    return out;
  } catch (e) {
    return text;
  }
}

const API_BASE_CHAT = getApiBaseUrl();
const API_ORIGIN_CHAT = getApiOrigin();

const getOriginChat = (u: string) => {
  try {
    return new URL(u, window.location.href).origin;
  } catch {
    return null;
  }
};

const isSameOrApiOriginChat = (u: string | null) => {
  const origin = getOriginChat(u || '');
  return (
    !!origin &&
    (origin === window.location.origin || (API_ORIGIN_CHAT && origin === API_ORIGIN_CHAT))
  );
};

function getFilenameFromUrl(url: string | null) {
  try {
    if (!url) return 'download.bin';
    const clean = url.split('?')[0].split('#')[0];
    const parts = clean.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    if (last && last.includes('.')) return last;
    const extMatch = clean.match(/\.(jpg|jpeg|png|webp|mp4|webm|ogg)(?:$|\?)/i);
    const ext = extMatch ? extMatch[0].replace('.', '') : 'bin';
    return `download.${ext}`;
  } catch (e) {
    return 'download.bin';
  }
}

function getFilenameFromHeadersOrUrlChat(res: Response | { headers?: any }, url: string | null) {
  try {
    const cd = (res as any)?.headers?.get?.('content-disposition');
    if (cd) {
      const m = cd.match(/filename\*?=(?:UTF-8''|")?([^";]+)"?/i);
      if (m && m[1]) return decodeURIComponent(m[1].replace(/"/g, ''));
    }
  } catch (e) {}
  return getFilenameFromUrl(url);
}

async function saveBlobChat(blob: Blob, suggestedName?: string) {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = suggestedName || 'download.bin';
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

// download helper that mirrors Chat page logic (direct fetch + proxy fallback)
export async function downloadUrl(url: string | null) {
  if (!url) return;
  try {
    try {
      const opts: RequestInit = { method: 'GET', mode: 'cors', credentials: 'omit' };
      if (isSameOrApiOriginChat(url)) {
        const headers: Record<string, string> = {};
        const token = (() => {
          try {
            return localStorage.getItem('hl_token') || null;
          } catch {
            return null;
          }
        })();
        if (token) headers['Authorization'] = `Bearer ${String(token).replace(/^bearer\s+/i, '').trim()}`;
        else if ((import.meta as any).env?.VITE_API_AUTH_TOKEN) {
          const envToken = String((import.meta as any).env.VITE_API_AUTH_TOKEN || '');
          headers['Authorization'] = envToken.match(/^Bearer\s+/i) ? envToken : `Bearer ${envToken}`;
        }
        opts.headers = headers;
        opts.credentials = 'include';
      }
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      await saveBlobChat(blob, getFilenameFromHeadersOrUrlChat(res, url));
      return;
    } catch (err) {
      console.warn('Chat: direct fetch failed, trying proxy', err);
    }

    try {
      const base = (API_BASE_CHAT || '').replace(/\/$/, '');
      if (!base) throw new Error('Missing API base URL');
      const proxyUrl = `${base}/characters/media/download-proxy?url=${encodeURIComponent(url)}&name=${encodeURIComponent(getFilenameFromUrl(url))}`;
      const proxyHeaders: Record<string, string> = {};
      try {
        const token = (() => {
          try {
            return localStorage.getItem('hl_token') || null;
          } catch {
            return null;
          }
        })();
        if (token) proxyHeaders['Authorization'] = `Bearer ${String(token).replace(/^bearer\s+/i, '').trim()}`;
        else if ((import.meta as any).env?.VITE_API_AUTH_TOKEN) {
          const envToken = String((import.meta as any).env.VITE_API_AUTH_TOKEN || '');
          proxyHeaders['Authorization'] = envToken.match(/^Bearer\s+/i) ? envToken : `Bearer ${envToken}`;
        }
      } catch (e) {}
      const pres = await fetch(proxyUrl, { method: 'GET', credentials: 'omit', headers: proxyHeaders });
      if (!pres.ok) {
        const txt = await pres.text().catch(() => null);
        console.error('Chat proxy response:', pres.status, txt);
        throw new Error(`Proxy HTTP ${pres.status}`);
      }
      const blob = await pres.blob();
      await saveBlobChat(blob, getFilenameFromHeadersOrUrlChat(pres as any, url));
      return;
    } catch (err2) {
      console.error('Chat: proxy fetch failed', err2);
      alert('Download failed. Ensure S3 CORS is set OR the /characters/media/download-proxy route is enabled.');
    }
  } catch (e) {
    // swallow
  }
}

// Helper: get media url from common keys
export function getMediaUrlSimple(item: any): string | null {
  if (!item) return null;
  const keys = ['s3_path_gallery', 's3_path', 'image_s3_url', 'image_url_s3', 'image_url', 'url', 'path', 's3_url', 'media_url', 'file', 'img', 'image', 'signed_url', 'signedUrl'];
  for (const k of keys) {
    const v = item[k];
    if (v && typeof v === 'string') return v;
  }
  if (item.data && typeof item.data === 'object') return getMediaUrlSimple(item.data);
  return null;
}

// Local sentence splitter (copied from Chat page to remain stable)
export function splitIntoSentences(text?: string): string[] {
  try {
    if (!text || typeof text !== 'string') return [];
    const t = text.trim();
    if (!t) return [];
    const markerIdx = (() => {
      const img = t.indexOf('__IMAGES__:');
      const vid = t.indexOf('__VIDEOS__:');
      if (img !== -1 && vid !== -1) return Math.min(img, vid);
      if (img !== -1) return img;
      if (vid !== -1) return vid;
      return -1;
    })();
    const textPart = markerIdx !== -1 ? t.substring(0, markerIdx).trim() : t;
    if (!textPart) return [];
    const sentences = textPart.replace(/\r\n/g, '\n').split(/(?<=[.?!])\s+(?=[A-Z0-9"'`\(\[\-])/g).map(s => s.trim()).filter(Boolean);
    if (sentences.length === 0 && textPart) return [textPart];
    if (sentences.length === 1 && sentences[0].includes('\n')) return sentences[0].split(/\n+/).map(s => s.trim()).filter(Boolean);
    return sentences;
  } catch (e) {
    return text ? [text] : [];
  }
}

// Scroll listener attach helper (to be used with react-window listRef)
export function ScrollListenerAttach({ listRef, onScroll }: { listRef: React.RefObject<any>; onScroll: (offset: number) => void }) {
  useEffect(() => {
    const lr = (listRef as any)?.current;
    const el = lr?.outerRef?.current ?? lr?._outerRef?.current ?? lr?.innerRef?.current ?? lr?.element ?? null;
    if (!el) return;
    let raf = 0;
    const h = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { try { onScroll(el.scrollTop || 0); } catch (e) {} });
    };
    el.addEventListener('scroll', h, { passive: true });
    h();
    return () => { el.removeEventListener('scroll', h as EventListener); if (raf) cancelAnimationFrame(raf); };
  }, [listRef, onScroll]);
  return null;
}

export default {} as any;
