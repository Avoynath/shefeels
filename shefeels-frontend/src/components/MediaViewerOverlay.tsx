// import React from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
// import { downloadUrl as downloadAndSave } from '../utils/chatUtils';
import { IconSpinner } from '../utils/chatUtils';

type MediaItem = { url: string; isVideo?: boolean };

type Props = {
  mediaViewer: MediaItem | null;
  downloading: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onDownload: (url?: string) => void;
  mediaItems: MediaItem[];
  getCurrentMediaIndex: () => number;
};

export default function MediaViewerOverlay({ mediaViewer, downloading, onClose, onNext, onPrev, onDownload, mediaItems, getCurrentMediaIndex }: Props) {
  if (!mediaViewer) return null;

  const curUrl = mediaViewer?.url;

  return createPortal(
    <div className="fixed left-0 right-0 bottom-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" style={{ top: 'var(--header-h, 80px)' }}>
      <div className="max-w-[90vw] max-h-[90vh] w-full relative">
        <div className="mb-4 flex justify-between items-center gap-2">
          <div className="text-white/80 text-sm">Media</div>
          <div className="flex items-center gap-2">
            <button onClick={() => { if (!curUrl || downloading) return; onDownload(curUrl); }} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors font-medium disabled:opacity-60" disabled={!curUrl || downloading}>
              {downloading ? <span className="inline-flex items-center gap-2 text-white"><IconSpinner className="w-4 h-4 animate-spin" /> Downloading…</span> : 'Download'}
            </button>
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors font-medium">Close</button>
          </div>
        </div>
        <div className="w-full h-[70vh] flex items-center justify-center">
          {mediaViewer.isVideo ? (
            <video src={mediaViewer.url} controls autoPlay className="max-w-full max-h-full bg-black rounded-lg" />
          ) : (
            <img src={mediaViewer.url} alt="full" className="max-w-full max-h-full object-contain rounded-lg" />
          )}
        </div>
        <button onClick={onPrev} disabled={getCurrentMediaIndex() <= 0} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 disabled:opacity-40" aria-label="Previous"><ChevronLeft className="h-6 w-6" /></button>
        <button onClick={onNext} disabled={getCurrentMediaIndex() >= mediaItems.length - 1} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 disabled:opacity-40" aria-label="Next"><ChevronRight className="h-6 w-6" /></button>
      </div>
    </div>,
    document.body
  );
}
