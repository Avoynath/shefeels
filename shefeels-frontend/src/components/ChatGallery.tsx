import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import apiClient from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Images, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { downloadUrl } from '../utils/chatUtils';

function getMediaUrlSimple(item: any): string | null {
  if (!item) return null;
  const keys = ['s3_path_gallery', 's3_path', 'image_s3_url', 'image_url_s3', 'image_url', 'url', 'path', 's3_url', 'media_url', 'file', 'img', 'image', 'signed_url', 'signedUrl'];
  for (const k of keys) {
    const v = item[k];
    if (v && typeof v === 'string') return v;
  }
  if (item.data && typeof item.data === 'object') return getMediaUrlSimple(item.data);
  return null;
}

export default function ChatGallery({ characterId }: { characterId?: string | number | null }) {
  const { token } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noMedia404, setNoMedia404] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [viewer, setViewer] = useState<any | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    async function load() {
      if (!token) return;
      if (!characterId || String(characterId).trim() === '' || String(characterId) === 'NaN') {
        setItems([]); setNoMedia404(false); setError(null); setLoading(false); return;
      }
      setLoading(true); setError(null); setNoMedia404(false);
      try {
        const res: any = await apiClient.getUserCharacterChatMedia(String(characterId));
        if (aborted) return;
        const raw = Array.isArray(res?.media) ? res.media : Array.isArray(res?.images) ? res.images : [];
        const arr = (raw || []).map((it: any) => {
          const char = it.character || null;
          return {
            ...it,
            image_s3_url: it.image_s3_url || (char && (char.image_url_s3 || char.image_url)) || null,
            image_url_s3: it.image_url_s3 || (char && (char.image_url_s3 || char.image_url)) || null,
            img: it.img || (char && char.img) || null,
          };
        });
        if (!aborted) setItems(arr);
      } catch (e: any) {
        if (!aborted) {
          try {
            if (e && (e as any).status === 404 && /no media found/i.test((e as any).message || '')) {
              setItems([]); setNoMedia404(true); setError(null);
            } else {
              setError('Failed to load media.');
            }
          } catch (_) { setError('Failed to load media.'); }
        }
      } finally { if (!aborted) setLoading(false); }
    }
    load();
    return () => { aborted = true; };
  }, [token, characterId]);

  if (!token) return <div className="text-white">Login to see gallery.</div>;

  const hasItems = items.length > 0;
  const hasMore = items.length > 3;

  const findViewerIndex = (v = viewer) => {
    if (!v || !Array.isArray(items)) return -1;
    return items.findIndex((it) => {
      try {
        if (v.id != null && it.id != null) return String(it.id) === String(v.id);
        const a = getMediaUrlSimple(it);
        const b = getMediaUrlSimple(v);
        return a && b && String(a) === String(b);
      } catch (e) { return false; }
    });
  };

  const goPrev = () => { const idx = findViewerIndex(); if (idx > 0) setViewer(items[idx - 1]); };
  const goNext = () => { const idx = findViewerIndex(); if (idx >= 0 && idx < items.length - 1) setViewer(items[idx + 1]); };

  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      if (e.key === 'Escape') setViewer(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer, items]);

  const downloadMedia = useCallback(async (url: string | null) => {
    if (!url) return;
    setDownloading(url);
    try {
      await downloadUrl(url);
    } finally {
      setTimeout(() => setDownloading((prev) => (prev === url ? null : prev)), 1000);
    }
  }, [downloadUrl]);

  return (
    <div>
      {loading ? (
        <div className="text-white">Loading media...</div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : !hasItems ? (
        <div className="text-white">{noMedia404 ? <span className="text-sm">Generate your first imagaination using Chat Window.</span> : 'No media found.'}</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1">
            {items.slice(0, Math.min(3, items.length)).map((it: any, idx: number) => {
              const url = getMediaUrlSimple(it) || it?.s3_path_gallery || null;
              const isVideo = ((it.mime_type || it.content_type || '') || '').toString().startsWith('video') || (url && /\.(mp4|webm|ogg)$/i.test(url));
              const isCollapsedThird = !showAll && hasMore && idx === 2;
              return (
                <div
                  key={it?.id ?? `i-${idx}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => { if (isCollapsedThird && hasMore) { setShowAll(true); } else { setViewer(it); } }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (isCollapsedThird && hasMore) setShowAll(true); else setViewer(it); } }}
                  className={`relative overflow-hidden rounded-lg border ${isDark ? 'border-white/[0.08] bg-white/[0.03]' : 'border-gray-200 bg-gray-100'}`}
                  style={{ aspectRatio: '1 / 1', cursor: 'pointer' }}
                >
                  {url ? (
                    isVideo ? (
                      <video src={url} className="w-full h-full object-cover" muted preload="metadata" />
                    ) : (
                      <img src={url} alt={`media-${idx}`} className="w-full h-full object-cover" />
                    )
                  ) : (
                    <div className="w-full h-full" style={{ background: `linear-gradient(135deg, hsla(${(it as any)?.hue ?? 200},80%,60%,0.25), transparent)` }} />
                  )}
                  {isVideo && !isCollapsedThird && (
                    <span className={`absolute top-2 left-2 px-2 py-1 text-[10px] uppercase tracking-widest rounded-full ${isDark ? 'bg-black/60 text-white' : 'bg-white/60 text-[var(--hl-text)]'}`}>Video</span>
                  )}
                  {isCollapsedThird && (
                    <div className={`absolute inset-0 backdrop-blur-sm flex flex-col items-center justify-center gap-2 ${isDark ? 'bg-black/70 text-white' : 'bg-white/70 text-[var(--hl-text)]'}`}>
                      <Images className="h-5 w-5 text-[var(--hl-gold)]" />
                      <span className="text-sm font-semibold">View More</span>
                    </div>
                  )}
                  {!isCollapsedThird && url && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); const u = url; if (!u) return; if (downloading === u) return; downloadMedia(u); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); const u = url; if (!u) return; if (downloading === u) return; downloadMedia(u); } }}
                      className={`absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full transition ${isDark ? 'bg-black/60 text-white hover:bg-black/70' : 'bg-white/60 text-[var(--hl-text)] hover:bg-white/70'}`}
                      aria-label="Download"
                    >
                      {(() => { const u = url; return (u && downloading === u) ? <svg viewBox="0 0 24 24" className="h-4 w-4 text-white animate-spin"><circle cx="12" cy="12" r="9" strokeOpacity="0.2" stroke="currentColor" strokeWidth="1.8" fill="none" /></svg> : <Download className="h-4 w-4" />; })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {showAll && hasMore && (
            <div className="grid grid-cols-3 gap-1 mt-2">
              {items.slice(3).map((it: any, idx: number) => {
                const url = getMediaUrlSimple(it) || it?.s3_path_gallery || null;
                const isVideo = ((it.mime_type || it.content_type || '') || '').toString().startsWith('video') || (url && /\.(mp4|webm|ogg)$/i.test(url));
                return (
                  <div key={it?.id ?? `more-${idx}`} className={`relative rounded-lg overflow-hidden border ${isDark ? 'border-white/[0.08] bg-white/[0.03]' : 'border-gray-200 bg-gray-100'}`}>
                    <button type="button" onClick={() => setViewer(it)} className="block w-full" style={{ aspectRatio: '1 / 1' }}>
                      {url ? (
                        isVideo ? (
                          <video src={url} className="w-full h-full object-cover" muted preload="metadata" />
                        ) : (
                          <img src={url} alt={`media-${idx + 3}`} className="w-full h-full object-cover" />
                        )
                      ) : (
                        <div className="w-full h-full" style={{ background: `linear-gradient(135deg, hsla(${(it as any)?.hue ?? 200},80%,60%,0.25), transparent)` }} />
                      )}
                      {isVideo && (<span className={`absolute top-2 left-2 px-2 py-1 text-[10px] uppercase tracking-widest rounded-full ${isDark ? 'bg-black/60 text-white' : 'bg-white/60 text-[var(--hl-text)]'}`}>Video</span>)}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); const mediaUrl = getMediaUrlSimple(it) || it?.s3_path_gallery || null; if (!mediaUrl) return; setDownloading(mediaUrl); downloadMedia(mediaUrl).finally(() => setDownloading(null)); }}
                      className={`absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-60 ${isDark ? 'bg-black/60 text-white hover:bg-black/70' : 'bg-white/60 text-[var(--hl-text)] hover:bg-white/70'}`}
                      disabled={(() => { const u = getMediaUrlSimple(it) || it?.s3_path_gallery || null; return !!(u && downloading === u); })()}
                      aria-label="Download"
                    >
                      {(() => { const u = getMediaUrlSimple(it) || it?.s3_path_gallery || null; return (u && downloading === u) ? <svg viewBox="0 0 24 24" className="h-4 w-4 text-white animate-spin"><circle cx="12" cy="12" r="9" strokeOpacity="0.2" stroke="currentColor" strokeWidth="1.8" fill="none" /></svg> : <Download className="h-4 w-4" />; })()}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {hasMore && (
            <div className="mt-3 flex justify-center">
              <button type="button" className="text-sm text-[var(--hl-gold)] font-medium hover:text-[var(--hl-gold-strong)] transition-colors" onClick={() => setShowAll((s) => !s)}>
                {showAll ? 'Show Less' : 'View All'}
              </button>
            </div>
          )}

          {viewer && createPortal(
            <div className="fixed left-0 right-0 bottom-0 z-[2000] bg-black/90 flex items-center justify-center p-4" style={{ top: 'var(--header-h, 80px)' }}>
              <div className="max-w-[90vw] max-h-[120vh] w-full relative">
                <div className="mb-3 flex justify-end items-center gap-2 mt-0">
                  {(() => {
                    const vUrl = getMediaUrlSimple(viewer);
                    const isBusy = vUrl && downloading === vUrl;
                    return (
                      <button onClick={() => { if (!vUrl || isBusy) return; setDownloading(vUrl); downloadMedia(vUrl).finally(() => setDownloading(null)); }} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-60" disabled={!vUrl || !!isBusy}>
                        {isBusy ? <span className="inline-flex items-center gap-2 text-white"><svg viewBox="0 0 24 24" className="w-4 h-4 animate-spin"><circle cx="12" cy="12" r="9" strokeOpacity="0.2" stroke="currentColor" strokeWidth="1.8" fill="none" /></svg> Downloading…</span> : 'Download'}
                      </button>
                    );
                  })()}
                  <button onClick={() => setViewer(null)} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">Close</button>
                </div>
                {((viewer.mime_type || viewer.content_type || '').toString().startsWith('video')) ? (
                  <video src={getMediaUrlSimple(viewer) || ''} controls autoPlay className="w-full h-auto max-h-[80vh] bg-black" />
                ) : (
                  <img src={getMediaUrlSimple(viewer) || ''} alt="full" className="w-full h-auto max-h-[80vh] object-contain" />
                )}

                <button onClick={() => goPrev()} disabled={findViewerIndex() <= 0} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white hover:bg-black/50" aria-label="Previous">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button onClick={() => goNext()} disabled={findViewerIndex() >= items.length - 1} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white hover:bg-black/50" aria-label="Next">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}