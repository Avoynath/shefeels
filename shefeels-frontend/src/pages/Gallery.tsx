import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useResponsiveTheme } from '../utils/responsive';
import { buildApiUrl, getApiBaseUrl, getApiOrigin } from '../utils/apiBase';
import GenerateImageNowIcon from '../assets/generate-image/GenerateImageNowIcon.svg';

// helper icons and Thumb component copied/replicated from provided sample
function IconDownload({ className = 'w-4 h-4' }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
			<path d="M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M8 11l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M21 21H3" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function IconSpinner({ className = 'w-4 h-4' }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
			<circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
			<path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function Thumb({ item, onOpen, onDownload, isDownloading = false }: any) {
	const { colors } = useResponsiveTheme();
	const navigate = useNavigate();
	const displayName = (item.character?.name || item.character?.display_name || item.name || item.title || '') as string;
	const src = item.s3_path_gallery || item.s3_path || item.s3_url || item.media_url || item.image_s3_url || item.image_url_s3 || item.image_url || item.url || item.path || item.file || item.image || item.img || item.signed_url || item.signedUrl || (item.attributes && (item.attributes.s3_path_gallery || item.attributes.url || item.attributes.path || item.attributes.image_s3_url || item.attributes.image_url_s3 || item.attributes.s3_url || item.attributes.media_url || item.attributes.file || item.attributes.img));
	const isVideo = (item.media_type === 'video') || (item.mime_type || item.content_type || '').toString().startsWith('video') || (src && /\.(mp4|webm|ogg|mov|avi)$/i.test(src));

	// Choose best thumbnail for a video: character image if present, else the media src (video) itself
	const candidateCharImg = item.character?.image_url_s3 || item.character?.image_url || item.character?.img || item.character_image || item.character_image_url;
	const thumbForVideo = candidateCharImg && String(candidateCharImg).trim() && candidateCharImg !== 'null' && candidateCharImg !== 'undefined' ? candidateCharImg : src;
	const thumbnailSrc = isVideo ? thumbForVideo : src;

	return (
		<div className={`rounded-lg sm:rounded-xl overflow-hidden ${colors.bg.tertiary} relative group theme-transition shadow-sm hover:shadow-md`}>
			<button type="button" onClick={() => onOpen(item)} className="w-full block">
				{/* Slightly taller portrait aspect to match Figma */}
				<div className="w-full aspect-3/4 bg-gray-50 relative">
					{isVideo ? (
						// If we have a character image or explicit poster, render it as an <img> poster; otherwise render a tiny muted looping video as the thumbnail
						(thumbnailSrc && /\.(mp4|webm|ogg|mov|avi)(?:$|\?)/i.test(String(thumbnailSrc))) ? (
							<video src={String(thumbnailSrc)} muted playsInline loop preload="metadata" className="w-full h-full object-cover object-top" onError={() => { /* fall through - video may not load */ }} />
						) : (
							<img src={String(thumbnailSrc || '')} alt={String(item.id)} className="w-full h-full object-cover object-top" loading="lazy" onError={(e) => { (e.target as any).style.display = 'none'; }} />
						)
					) : (
						<img src={src} alt={String(item.id)} className="w-full h-full object-cover object-top" loading="lazy" />
					)}

					{/* Video play overlay */}
					{isVideo && (
						<>
							<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
								<svg className="w-7 h-7 text-white ml-1 transform transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path d="M8 5v14l11-7z" />
								</svg>
							</div>
							<div className="absolute top-2 right-2 px-2 py-1 bg-red-600/90 rounded text-xs text-white font-bold backdrop-blur-sm">
								VIDEO
							</div>
						</>
					)}
				</div>
			</button>

			{/* Name overlay bottom-left (single-line, capitalized, clickable to open chat) */}
				<div className="absolute left-3 right-14 bottom-6 text-sm text-white/95 drop-shadow-md">
					{(() => {
						const handleNameClick = (e: any) => {
							e.stopPropagation();
							const name = displayName || 'item';
							const char = item.character || {};
							const id = (char.id ?? char._id ?? char.uuid ?? char.pk ?? (item.character_id || item.characterId) ?? item.id ?? item._id) as any;
							const slug = generateSlug(name, id || '');
							try { navigate(`/chat/${slug}`); } catch { window.location.href = `/chat/${slug}`; }
						};

						return (
							<div
								title={displayName}
								onClick={handleNameClick}
								role="button"
								tabIndex={0}
								onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { handleNameClick(e); } }}
								className="text-sm font-medium w-full whitespace-nowrap overflow-hidden leading-none cursor-pointer"
								style={{ textTransform: 'capitalize' }}
							>
								{displayName}
							</div>
						);
					})()}
				</div>

			{/* Circular download button bottom-right */}
			<button
				type="button"
				onClick={(e) => { e.stopPropagation(); if (onDownload && src) onDownload(src); }}
				className="absolute right-3 bottom-4 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/60 text-white opacity-95 hover:opacity-100 focus:opacity-100 transition-shadow shadow-sm"
				aria-label="Download"
				disabled={!src || isDownloading}
			>
				{isDownloading ? <IconSpinner className="w-4 h-4 text-white animate-spin" /> : <IconDownload className="w-4 h-4 text-white" />}
			</button>
		</div>
	);
}

const getMediaUrl = (item: any): string | null => {
	if (!item) return null;
	const keys = [
		's3_path_gallery',
		's3_path',
		'image_s3_url',
		'image_url_s3',
		'image_url',
		'url',
		'path',
		's3_url',
		'media_url',
		'file',
		'img',
		'image',
		'signed_url',
		'signedUrl',
	];
	for (const k of keys) {
		const v = item[k];
		if (v && typeof v === 'string') return v;
	}
	if (item.attributes) {
		for (const k of ['s3_path_gallery', 'url', 'path', 'image']) {
			const v = (item.attributes as any)[k];
			if (v && typeof v === 'string') return v;
		}
	}
	if (item.data && typeof item.data === 'object') {
		return getMediaUrl(item.data) || null;
	}
	return null;
};

import fetchWithAuth from '../utils/fetchWithAuth';
import { useToastActions } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/api';
import { generateSlug } from '../utils/slugs';

export default function Gallery() {
	const navigate = useNavigate();
	const location = useLocation();
	const { colors, isDark } = useResponsiveTheme();
	const galleryActionStyle = {
		border: '1px solid rgba(255,255,255,0.22)',
		background: 'linear-gradient(90deg, #d9b2ff 0%, #7f5af0 38%, #9d66ff 64%, #f48db5 100%)',
		boxShadow: 'inset 0 0 8px rgba(227,222,255,0.2), inset 0 20px 20px rgba(202,172,255,0.3), inset 0 1px 2px rgba(255,255,255,1), inset 0 8px 11px rgba(255,255,255,0.1)',
		color: '#fff',
	} as const;

	const [items, setItems] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [viewer, setViewer] = useState<any | null>(null);
	const [downloading, setDownloading] = useState<string | null>(null);
	const { token } = useAuth();
	const { showError } = useToastActions();
	const isLoggedIn = Boolean(token);

	// Navigation helpers for full-screen viewer
	const findViewerIndex = (v = viewer) => {
		if (!v || !Array.isArray(items)) return -1;
		return items.findIndex((it) => {
			try {
				if (v.id != null && it.id != null) return String(it.id) === String(v.id);
				const a = getMediaUrl(it);
				const b = getMediaUrl(v);
				return a && b && String(a) === String(b);
			} catch (e) {
				return false;
			}
		});
	};

	const goPrev = () => {
		const idx = findViewerIndex();
		if (idx > 0) setViewer(items[idx - 1]);
	};

	const goNext = () => {
		const idx = findViewerIndex();
		if (idx >= 0 && idx < items.length - 1) setViewer(items[idx + 1]);
	};


	const API_BASE = getApiBaseUrl();
	const API_ORIGIN = getApiOrigin();
	const getOrigin = (u: string) => { try { return new URL(u, window.location.href).origin; } catch { return null; } };
	const isSameOrApiOrigin = (u: string | null) => { const o = getOrigin(u || ''); return o === window.location.origin || (API_ORIGIN && o === API_ORIGIN); };

	const getFilenameFromHeadersOrUrl = (res: Response | { headers?: any }, url: string | null) => {
		try {
			const cd = (res as any)?.headers?.get?.('content-disposition');
			if (cd) {
				const m = cd.match(/filename\*?=(?:UTF-8''|")?([^\";]+)\"?/i);
				if (m && m[1]) return decodeURIComponent(m[1].replace(/\"/g, ''));
			}
		} catch (e) {}
		return getFilenameFromUrl(url);
	};

	const getFilenameFromUrl = (url: string | null) => {
		try {
			if (!url || typeof url !== 'string') return 'download.bin';
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
	};

	async function saveBlob(blob: Blob, suggestedName?: string) {
		if ((window as any).showSaveFilePicker) {
			try {
				const handle = await (window as any).showSaveFilePicker({
					suggestedName,
					types: [{ description: 'File', accept: { [blob.type || 'application/octet-stream']: ['.bin'] } }],
				});
				const writable = await handle.createWritable();
				await writable.write(blob);
				await writable.close();
				return;
			} catch (e) {
				const name = e && (e as any).name ? (e as any).name : '';
				const msg = e && (e as any).message ? (e as any).message : '';
				if (name === 'AbortError' || name === 'NotAllowedError' || name === 'SecurityError' || /cancel/i.test(msg)) {
					return;
				}
			}
		}
		const blobUrl = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = blobUrl;
		a.download = suggestedName || 'download.bin';
		a.rel = 'noopener';
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
	}

	const downloadAndSave = async (url: string | null) => {
		if (!url) return;
		setDownloading(url);
		try {
				try {
					const opts: any = { method: 'GET', mode: 'cors', credentials: 'omit' };
														if (isSameOrApiOrigin(url)) {
																const headers: Record<string, string> = {};
																const t = token || localStorage.getItem('hl_token');
																if (t) headers['Authorization'] = `Bearer ${String(t).replace(/^bearer\s+/i, '').trim()}`;
																else if ((import.meta as any).env?.VITE_API_AUTH_TOKEN) {
																	const envToken = String((import.meta as any).env.VITE_API_AUTH_TOKEN || '');
																	headers['Authorization'] = envToken.match(/^Bearer\s+/i) ? envToken : `Bearer ${envToken}`;
																}
																opts.headers = headers;
																opts.credentials = 'include';
														}
				const res = await fetchWithAuth(url, opts);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const blob = await res.blob();
				await saveBlob(blob, getFilenameFromHeadersOrUrl(res, url));
				return;
			} catch (err) {
				console.warn('Direct fetch failed (likely CORS). Will try proxy.', err);
			}

			try {
				const proxyBase = buildApiUrl('/characters/media/download-proxy');
				const proxyUrl = `${proxyBase}?url=${encodeURIComponent(url)}&name=${encodeURIComponent(getFilenameFromUrl(url))}`;
				const proxyHeaders: Record<string, string> = {};
				try {
															const t = token || localStorage.getItem('hl_token');
															if (t) proxyHeaders['Authorization'] = `Bearer ${String(t).replace(/^bearer\s+/i, '').trim()}`;
															else if ((import.meta as any).env?.VITE_API_AUTH_TOKEN) {
																const envToken = String((import.meta as any).env.VITE_API_AUTH_TOKEN || '');
																proxyHeaders['Authorization'] = envToken.match(/^Bearer\s+/i) ? envToken : `Bearer ${envToken}`;
															}
				} catch (e) {}
				const pres = await fetchWithAuth(proxyUrl, { method: 'GET', credentials: 'omit', headers: proxyHeaders });
				if (!pres.ok) {
					const txt = await pres.text().catch(() => null);
					console.error('Proxy response status/text:', pres.status, txt);
					throw new Error(`Proxy HTTP ${pres.status}`);
				}
				const blob = await pres.blob();
				await saveBlob(blob, getFilenameFromHeadersOrUrl(pres as any, url));
				return;
			} catch (err2) {
				console.error('Proxy fetch failed:', err2);
				try { showError('Download failed', 'Ensure S3 CORS is set OR the /characters/media/download-proxy route is enabled. Check proxy auth and logs.'); } catch { /* fallback */ }
			}
		} finally {
			setDownloading(null);
		}
	};

	// Redirect to login if not authenticated
	useEffect(() => {
		if (!isLoggedIn) {
			navigate('/login', { state: { from: location }, replace: true });
		}
	}, [isLoggedIn, navigate, location]);

	const lastTokenRef = useRef<string | null>(null);
	const fetchGallery = useCallback(async (force = false) => {
		const CACHE_KEY = 'pronily:gallery:cache';
		const CACHE_TTL = 1000 * 60 * 60 * 6;
		
		// Don't show loading state initially if we have cache
		const hasCache = (() => {
			try {
				const raw = localStorage.getItem(CACHE_KEY);
				if (raw) {
					const parsed = JSON.parse(raw);
					return parsed && parsed.expiresAt && Number(parsed.expiresAt) > Date.now() && Array.isArray(parsed.items);
				}
			} catch (e) { }
			return false;
		})();
		
		// Only show loading if no cache
		if (!hasCache || force) {
			setLoading(true);
		}
		
		setError(null);
		try {
			if (!force) {
				try {
					const raw = localStorage.getItem(CACHE_KEY);
					if (raw) {
						const parsed = JSON.parse(raw);
						if (parsed && parsed.expiresAt && Number(parsed.expiresAt) > Date.now() && Array.isArray(parsed.items)) {
							setItems(parsed.items);
							setLoading(false);
							return;
						}
					}
				} catch (e) { console.warn('Gallery: cache read failed', e); }
			}

			const url = buildApiUrl('/characters/media/get-users-character-media');
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
					const t = token || localStorage.getItem('hl_token');
					if (t) {
						headers['Authorization'] = `Bearer ${String(t).replace(/^bearer\s+/i, '').trim()}`;
					} else if ((import.meta as any).env?.VITE_API_AUTH_TOKEN) {
						const envToken = String((import.meta as any).env.VITE_API_AUTH_TOKEN || '');
						headers['Authorization'] = envToken.match(/^Bearer\s+/i) ? envToken : `Bearer ${envToken}`;
					}
			const res = await fetchWithAuth(url, { headers });
			if (!res.ok) {
				let parsed = null;
				try { parsed = await res.json(); } catch (e) { parsed = null; }
				const authMsg = parsed && (parsed.detail || parsed.message || parsed.error) ? String(parsed.detail || parsed.message || parsed.error) : null;
				if (authMsg && /not authenticated/i.test(authMsg)) {
					navigate('/login', { state: { background: location } });
					return;
				}
				if (parsed && parsed.detail && /no images found/i.test(String(parsed.detail))) {
					setItems([]);
					setLoading(false);
					return;
				}
						const txt = await res.text().catch(() => null);
						const body = parsed ?? txt ?? null;
						const message = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : (res.statusText || `HTTP ${res.status}`);
						const errObj: any = new Error(message);
						errObj.status = res.status;
						errObj.body = body;
						throw errObj;
			}
			const data = await res.json();
			// backend now returns media array: { media: [ ... ] }
			const rawItems = data.media || data.images || data.data || [];
			// Include all media returned by backend (including chat_image types)
			const onlyImages = rawItems || [];

			const normalized = (onlyImages || []).map((it: any, idx: number) => {
				// if backend nests character info, merge commonly used image fields to top-level so
				// existing getMediaUrl logic continues to work.
				const char = it.character || it.character_data || null;
				const candidateFromCharacter = char ? (char.image_url_s3 || char.image_url || char.img || null) : null;
				const url = it.s3_path_gallery || it.s3_path || it.image_s3_url || it.image_url_s3 || it.image_url || it.url || it.path || it.image || it.signed_url || it.signedUrl || candidateFromCharacter || (it.attributes && (it.attributes.s3_path_gallery || it.attributes.url || it.attributes.path || it.attributes.image_s3_url || it.attributes.image_url_s3));
				const characterName = it.name || it.title || (char && (char.name || char.display_name || char.title)) || null;
				return {
					id: it.id ?? it._id ?? `item-${idx}`,
					mime_type: it.mime_type || it.content_type || (it.type || '').toString(),
					s3_path_gallery: url || null,
					// prefer explicit top-level character image fields if present, otherwise fall back to character
					image_s3_url: it.image_s3_url || (char && (char.image_url_s3 || char.image_url)) || null,
					image_url_s3: it.image_url_s3 || (char && (char.image_url_s3 || char.image_url)) || null,
					// keep original item data available
					character: char,
					// normalized character name for easier rendering
					characterName,
					...it,
				};
			});
			setItems(normalized);
			try { const payload = { items: normalized, expiresAt: Date.now() + CACHE_TTL }; localStorage.setItem(CACHE_KEY, JSON.stringify(payload)); } catch (e) { console.warn('Gallery: cache write failed', e); }
		} catch (e: any) {
			const msg = String(e && (e.message || e) || '');
			if (/not authenticated/i.test(msg)) { navigate('/login', { state: { background: location } }); return; }
			setError(msg);
			try {
				const status = (e && typeof (e as any).status === 'number') ? (e as any).status : ((e as any)?.status || 0);
				if (status >= 400 && status < 500) {
					const detail = (e as any)?.body?.detail ?? (e as any)?.body?.message ?? (e as any)?.detail ?? (e as any)?.message ?? getErrorMessage(e);
					showError('Failed to load gallery', detail);
				} else if (status >= 500) {
					try { console.warn('Gallery: server error', status, (e as any)?.body ?? e); } catch {}
					showError('Failed to load gallery', 'Unable to load gallery currently.');
				} else {
					showError('Failed to load gallery', getErrorMessage(e));
				}
			} catch (ex) {}
		} finally {
			setLoading(false);
		}
	}, [API_BASE, navigate, location]);

	useEffect(() => {
		const onOpen = () => console.log('open:gallery event received');
		window.addEventListener('open:gallery', onOpen);
		fetchGallery(true);
		const onReload = () => { fetchGallery(true); };
		window.addEventListener('gallery:reload', onReload);
		function onStorage(e: StorageEvent) { if (e.key === 'hl_token') { const newVal = e.newValue; if (newVal) fetchGallery(true); } }
		window.addEventListener('storage', onStorage);
		lastTokenRef.current = (() => { try { return localStorage.getItem('hl_token'); } catch { return null; } })();
		const pollInterval = setInterval(() => { try { const cur = localStorage.getItem('hl_token'); if (cur !== lastTokenRef.current) { if (cur) fetchGallery(true); lastTokenRef.current = cur; } } catch (e) {} }, 1000);
		return () => { window.removeEventListener('gallery:reload', onReload); window.removeEventListener('open:gallery', onOpen); window.removeEventListener('storage', onStorage); clearInterval(pollInterval); };
	}, [fetchGallery]);

	// Keyboard navigation for viewer (left/right/escape)
	useEffect(() => {
		if (!viewer) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				goPrev();
			}
			if (e.key === 'ArrowRight') {
				e.preventDefault();
				goNext();
			}
			if (e.key === 'Escape') {
				setViewer(null);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [viewer, items]);

	return (
		<section className={`w-full max-w-7xl mx-auto rounded-xl sm:rounded-2xl border p-4 sm:p-6 lg:p-8 py-6 sm:py-10 theme-transition ${
			isDark 
				? "border-white/10 bg-white/3" 
				: "border-gray-200 bg-white/80"
		}`}>
			<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
				<div className="flex items-center gap-3">
					<button
						onClick={() => navigate(-1)}
						aria-label="Back"
						className="rounded-full p-2 flex items-center justify-center text-white transition-transform hover:scale-[1.03]"
						style={galleryActionStyle}
					>
						<ChevronLeft className="w-4 h-4" />
					</button>
					<h1 className={`text-lg sm:text-xl font-semibold ${colors.text.primary}`}>Gallery</h1>
				</div>

				<div className="flex gap-2">
					<button
						onClick={() => { try { navigate('/generate-image'); } catch { window.location.href = '/generate-image'; } }}
						className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-transform hover:scale-[1.01]`}
						style={galleryActionStyle}
					>
						Generate New Image
					</button>

					<button
						onClick={() => { setItems([]); setLoading(true); setError(null); const ev = new Event('gallery:reload'); window.dispatchEvent(ev); }}
						className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-transform hover:scale-[1.01]`}
						style={galleryActionStyle}
					>
						Refresh Gallery
					</button>
				</div>
			</div>

			{loading && items.length === 0 ? (
				<div className={`text-center ${colors.text.secondary} py-4 text-sm`}>Loading…</div>
			) : error ? (
				/* Errors are surfaced via toast notifications; hide raw error details in-page */
				null
			) : items.length === 0 ? (
					!isLoggedIn ? (
						<div className={`text-center space-y-3 py-8 ${colors.text.secondary}`}>
							<div className="text-lg font-medium">You are not logged in.</div>
							<div className="text-sm">Sign in to view your Character Images and Videos.</div>
							<div className="mt-3">
								<button 
									onClick={() => navigate('/login', { state: { background: location } })} 
									className="rounded-xl px-4 py-2 font-semibold text-white bg-linear-to-r from-pink-500 via-pink-400 to-indigo-500 hover:shadow-lg transition-shadow"
								>
									Sign in
								</button>
							</div>
						</div>
					) : (
						<div className={`text-center space-y-4 py-8 ${colors.text.secondary}`}>
							<div className="text-2xl font-semibold">No images yet</div>
							<div className="text-sm max-w-xl mx-auto">It looks like you haven't generated or uploaded any media yet. Create images with the AI generator, start a chat to save images, or upload existing media — they'll appear here.</div>
							<div className="flex items-center justify-center gap-3 mt-4">
								<button
									onClick={() => navigate('/generate-image')}
									className="inline-flex items-center rounded-[60px] px-4 py-3 text-sm font-semibold transition-shadow"
									style={{ ...galleryActionStyle, borderRadius: '60px' }}
								>
									<img src={GenerateImageNowIcon} alt="" className="w-4 h-4 mr-2" />
									Generate Image
								</button>
								<button
									onClick={() => navigate('/create-character')}
									className="rounded-[60px] px-4 py-3 text-sm font-semibold bg-transparent ring-1 ring-white/10"
								>
									Create Character
								</button>
								<button
									onClick={() => navigate('/my-ai')}
									className="rounded-[60px] px-4 py-3 text-sm font-semibold bg-white/6"
								>
									View My AI
								</button>
							</div>
							{/* Removed placeholder preview tiles */}
						</div>
					)
			) : (
				<div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 sm:gap-6">
					{items.map((it) => {
						const itUrl = getMediaUrl(it);
						return (
							<Thumb
								key={it.id}
								item={it}
								onOpen={(i: any) => setViewer(i)}
								onDownload={(url: string) => downloadAndSave(url)}
								isDownloading={!!(downloading && itUrl && downloading === itUrl)}
							/>
						);
					})}
				</div>
			)}

			{viewer && (
				<div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 sm:p-6">
					<div className="max-w-[90vw] max-h-[90vh] w-full relative">
						<div className="mb-3 flex justify-end gap-2">
							<button 
								onClick={() => { setViewer(null); }} 
								className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
							>
								Close
							</button>
							{(() => {
								const viewerUrl = getMediaUrl(viewer);
								const isCurDownloading = !!(viewerUrl && downloading && downloading === viewerUrl);
								return (
									<button
										onClick={() => viewerUrl && downloadAndSave(viewerUrl)}
										className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm transition-colors disabled:opacity-50"
										disabled={!viewerUrl || isCurDownloading}
									>
										{isCurDownloading ? (
											<span className="inline-flex items-center gap-2">
												<IconSpinner className="w-4 h-4 text-white animate-spin" />
												Downloading…
											</span>
										) : (
											'Download'
										)}
									</button>
								);
							})()}
						</div>
						{/* Layout media with Prev/Next as siblings so buttons sit next to the image regardless of global absolute rules */}
						<div className="w-full flex items-center justify-center">
							<div className="flex items-center justify-center gap-4">
								<button
									onClick={() => goPrev()}
									disabled={findViewerIndex() <= 0}
									className="rounded-full bg-black/30 p-2 text-white hover:bg-black/50 disabled:opacity-40"
									aria-label="Previous"
								>
									<ChevronLeft className="w-6 h-6" />
								</button>
								<div className="relative">
									{((viewer.media_type === 'video') || (viewer.mime_type || viewer.content_type || '').toString().startsWith('video')) ? (
										<video
											src={getMediaUrl(viewer) || ''}
											controls
											autoPlay
											className="max-w-[90vw] max-h-[80vh] w-auto h-auto bg-black rounded-lg"
										/>
									) : (
										<img
											src={getMediaUrl(viewer) || ''}
											alt="full"
											className="max-w-[90vw] max-h-[80vh] w-auto h-auto object-contain rounded-lg"
										/>
									)}
								</div>
								<button
									onClick={() => goNext()}
									disabled={findViewerIndex() >= items.length - 1}
									className="rounded-full bg-black/30 p-2 text-white hover:bg-black/50 disabled:opacity-40"
									aria-label="Next"
								>
									<ChevronRight className="w-6 h-6" />
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</section>
	);
}
