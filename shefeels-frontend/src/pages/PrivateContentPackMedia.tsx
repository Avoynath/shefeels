import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/api';
import { buildApiUrl, getApiOrigin } from '../utils/apiBase';
import fetchWithAuth from '../utils/fetchWithAuth';
import { useResponsiveTheme } from '../utils/responsive';
import LikeIconSrc from "../assets/private-content/LikeIcon.svg";

// Small helper icons
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

const getMediaUrl = (item: any): string | null => {
	if (!item) return null;
	// Prefer presigned URL if present
	const keys = [
		'presigned_s3_path',
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

const normalizeId = (value: any): string | null => {
	if (value === undefined || value === null) return null;
	try {
		return String(value);
	} catch {
		return null;
	}
};

const getCharacterMediaId = (item: any): string | null => {
	if (!item) return null;
	const candidates = [
		item.character_media_id,
		item.characterMediaId,
		item.character_media?.id,
		item.media_id,
		item.mediaId,
	];
	for (const candidate of candidates) {
		const normalized = normalizeId(candidate);
		if (normalized) return normalized;
	}
	// Fallback to the primary id so UI still works if backend data lacks character_media_id
	return normalizeId(item.id ?? item._id) || null;
};

const getMapKeyForItem = (item: any): string | null => {
	if (!item) return null;
	return normalizeId(item.id) || normalizeId(item._id) || getCharacterMediaId(item);
};

function Thumb({ item, onOpen, onDownload, isDownloading = false, liked, onLike, likesBusy }: any) {
	const { colors } = useResponsiveTheme();
	const displayName = (item.character?.name || item.character?.display_name || item.name || item.title || '') as string;
	const src = getMediaUrl(item);
	const isVideo = (item.media_type === 'video') || (item.mime_type || item.content_type || '').toString().startsWith('video') || (src && /\.(mp4|webm|ogg|mov|avi)$/i.test(src));

	const candidateCharImg = item.character?.image_url_s3 || item.character?.image_url || item.character?.img || item.character_image || item.character_image_url;
	const thumbForVideo = candidateCharImg && String(candidateCharImg).trim() && candidateCharImg !== 'null' && candidateCharImg !== 'undefined' ? candidateCharImg : src;
	const thumbnailSrc = isVideo ? thumbForVideo : src;

	return (
		<div className={`rounded-lg sm:rounded-xl overflow-hidden ${colors.bg.tertiary} relative group theme-transition shadow-sm hover:shadow-md`}>
			<button type="button" onClick={() => onOpen(item)} className="w-full block">
				<div className="w-full aspect-[3/4] bg-gray-50 relative">
					{isVideo ? (
						(thumbnailSrc && /\.(mp4|webm|ogg|mov|avi)(?:$|\?)/i.test(String(thumbnailSrc))) ? (
							<video src={String(thumbnailSrc)} muted playsInline loop preload="metadata" className="w-full h-full object-cover object-top" />
						) : (
							<img src={String(thumbnailSrc || '')} alt={String(item.id)} className="w-full h-full object-cover object-top" loading="lazy" onError={(e) => { (e.target as any).style.display = 'none'; }} />
						)
					) : (
						<img src={src || ''} alt={String(item.id)} className="w-full h-full object-cover object-top" loading="lazy" />
					)}

					{isVideo && (
						<>
							<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
								<svg className="w-7 h-7 text-white ml-1 transform transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path d="M8 5v14l11-7z" />
								</svg>
							</div>
							<div className="absolute top-2 right-2 px-2 py-1 bg-red-600/90 rounded text-xs text-white font-bold backdrop-blur-sm">VIDEO</div>
						</>
					)}
				</div>
			</button>

			<div className="absolute left-3 right-14 bottom-6 text-sm text-white/95 drop-shadow-md">
				<div title={displayName} className="text-sm font-medium w-full whitespace-nowrap overflow-hidden leading-none" style={{ textTransform: 'capitalize' }}>
					{displayName}
				</div>
			</div>

			<button type="button" onClick={(e) => { e.stopPropagation(); if (onDownload && src) onDownload(src); }} className="absolute right-3 bottom-4 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/60 text-white opacity-95 hover:opacity-100 focus:opacity-100 transition-shadow shadow-sm" aria-label="Download" disabled={!src || isDownloading}>
				{isDownloading ? <IconSpinner className="w-4 h-4 text-white animate-spin" /> : <IconDownload className="w-4 h-4 text-white" />}
			</button>

			{/* Like button on thumbnail (available without opening viewer) - bottom-left to match Download at bottom-right */}
			<button
				type="button"
				onClick={(e) => { e.stopPropagation(); if (!likesBusy && onLike) onLike(); }}
				aria-pressed={!!liked}
				className={`absolute left-3 bottom-4 inline-flex items-center justify-center w-8 h-8 rounded-full transition-shadow ${liked ? 'bg-red-400/90 text-white' : 'bg-black/60 text-white'}`}
				disabled={!!likesBusy}
				aria-label="Like"
			>
				<img src={LikeIconSrc} alt="Like" className="w-4 h-4" />
			</button>
		</div>
	);
}

export default function PrivateContentPackMedia() {
	const { packId } = useParams<{ packId: string }>();
	const navigate = useNavigate();
	const { colors, isDark } = useResponsiveTheme();
	const { token } = useAuth();

	const [items, setItems] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [viewer, setViewer] = useState<any | null>(null);
	const [mediaLiked, setMediaLiked] = useState<boolean | null>(null);
	const [likesCount, setLikesCount] = useState<number | null>(null);
	const [likesBusy, setLikesBusy] = useState(false);
	const [downloading, setDownloading] = useState<string | null>(null);
	// per-item like state maps so likes are available on the grid (not only in viewer)
	const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
	const [likesMap, setLikesMap] = useState<Record<string, number>>({});
	const [likesBusyMap, setLikesBusyMap] = useState<Record<string, boolean>>({});

	const API_ORIGIN = getApiOrigin();
	const getOrigin = (u: string) => { try { return new URL(u, window.location.href).origin; } catch { return null; } };
	const isSameOrApiOrigin = (u: string | null) => { const o = getOrigin(u || ''); return o === window.location.origin || (API_ORIGIN && o === API_ORIGIN); };

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
		} catch (e) { return 'download.bin'; }
	};

	async function saveBlob(blob: Blob, suggestedName?: string) {
		if ((window as any).showSaveFilePicker) {
			try {
				const handle = await (window as any).showSaveFilePicker({ suggestedName, types: [{ description: 'File', accept: { [blob.type || 'application/octet-stream']: ['.bin'] } }] });
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
				await saveBlob(blob, getFilenameFromUrl(url));
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
				await saveBlob(blob, getFilenameFromUrl(url));
				return;
			} catch (err2) {
				console.error('Proxy fetch failed:', err2);
				alert('Download failed. Ensure S3 CORS is set OR the /characters/media/download-proxy route is enabled.');
			}
		} finally {
			setDownloading(null);
		}
	};

	const toggleLike = async () => {
		if (!viewer) return;
		// If already liked, do nothing (backend only supports one-time like)
		if (mediaLiked) return;
		const payloadId = getCharacterMediaId(viewer);
		if (!payloadId) return;

		setLikesBusy(true);
			try {
			// Call the like endpoint with payload { id }
			const res: any = await apiClient.post('/private-content/like-media', { id: payloadId });
			// If successful, backend may return a success detail. Mark liked and increment count if present
			setMediaLiked(true);
			const responseTotalLikes = res && typeof res === 'object' && typeof (res as any).total_likes === 'number' ? (res as any).total_likes : null;
			if (responseTotalLikes !== null) {
				setLikesCount(responseTotalLikes);
			} else {
				setLikesCount((c) => (typeof c === 'number' ? c + 1 : 1));
			}
			const viewerMapKey = getMapKeyForItem(viewer);
			if (viewerMapKey) {
				setLikedMap((m) => ({ ...m, [viewerMapKey]: true }));
				setLikesMap((m) => {
					const prev = m[viewerMapKey];
					const updated = responseTotalLikes !== null
						? responseTotalLikes
						: (typeof prev === 'number' ? prev + 1 : 1);
					return { ...m, [viewerMapKey]: updated };
				});
			}
		} catch (err) {
			console.warn('like-media failed', err);
			// Do not change mediaLiked (it remains false)
		} finally {
			setLikesBusy(false);
		}
	};

	const fetchMedia = useCallback(async () => {
		if (!packId) return;
		setLoading(true);
		setError(null);
		try {
			const data: any = await apiClient.post('/private-content/get-media-in-pack', { pack_id: packId });
			// backend may return an array or an object with media/images/data
			let rawItems = data;
			if (data && (data.media || data.images || data.data)) {
				rawItems = data.media || data.images || data.data;
			}
			const normalized = (rawItems || []).map((it: any, idx: number) => {
				const char = it.character || it.character_data || null;
				const candidateFromCharacter = char ? (char.image_url_s3 || char.image_url || char.img || null) : null;
				const presigned = it.presigned_s3_path || null;
				const origS3 = it.s3_path || null;
				const url = presigned || origS3 || it.s3_path_gallery || it.image_s3_url || it.image_url_s3 || it.image_url || it.url || it.path || it.image || it.signed_url || it.signedUrl || candidateFromCharacter || (it.attributes && (it.attributes.s3_path_gallery || it.attributes.url || it.attributes.path || it.attributes.image_s3_url || it.attributes.image_url_s3));
				const characterName = it.name || it.title || (char && (char.name || char.display_name || char.title)) || null;
				return {
					id: it.id ?? it._id ?? `item-${idx}`,
					mime_type: it.mime_type || it.content_type || (it.type || '').toString(),
					// expose both keys explicitly; prefer presigned for rendering
					presigned_s3_path: presigned || null,
					// keep s3_path but set it to the resolved url (presigned if present, else fallback)
					s3_path: url || null,
					image_s3_url: it.image_s3_url || (char && (char.image_url_s3 || char.image_url)) || null,
					character: char,
					characterName,
					...it,
				};
			});
			setItems(normalized);
			// reset per-item maps for the newly loaded set
			setLikedMap({});
			setLikesMap({});
			setLikesBusyMap({});
		} catch (e: any) {
			const msg = String(e && (e.message || e) || '');
			setError(msg);
		} finally {
			setLoading(false);
		}
	}, [packId]);

	useEffect(() => {
		fetchMedia();
	}, [fetchMedia]);

	useEffect(() => {
		if (!viewer) return;

		// When a viewer item opens, attempt to fetch whether this media is liked
		(async () => {
			const payloadId = getCharacterMediaId(viewer);
			if (!payloadId) return;
			try {
				setLikesBusy(true);
				setMediaLiked(null);
				// Always use the consistent payload shape required by backend
				const resp: any = await apiClient.post('/private-content/check-media-liked', { media_ids: [payloadId] });

				// Expecting response shape: { likes: [ { id, is_liked } ] }
				let liked = false;
				let candidateCount: any = null;
				if (resp && typeof resp === 'object') {
					const likesArr = Array.isArray(resp.likes) ? resp.likes : (Array.isArray(resp) ? resp : null);
					if (likesArr) {
						const entry = likesArr.find((e: any) => {
							const entryId = normalizeId(e?.id ?? e?.media_id ?? e?.character_media_id ?? e?._id);
							return !!entryId && entryId === payloadId;
						});
						if (entry) {
							liked = Boolean(entry.is_liked ?? entry.liked ?? false);
							if (typeof entry.total_likes === 'number') candidateCount = entry.total_likes;
						}
					}
				}
				setMediaLiked(Boolean(liked));
				// fallback count sources
				const fallbackCount = viewer.total_likes ?? viewer.likes_count ?? viewer.likes;
				if (typeof candidateCount === 'number') setLikesCount(candidateCount);
				else if (typeof fallbackCount === 'number') setLikesCount(fallbackCount);
				const viewerMapKey = getMapKeyForItem(viewer);
				if (viewerMapKey) {
					setLikedMap((m) => ({ ...m, [viewerMapKey]: Boolean(liked) }));
					const mapCount = typeof candidateCount === 'number' ? candidateCount : (typeof fallbackCount === 'number' ? fallbackCount : undefined);
					if (typeof mapCount === 'number') {
						setLikesMap((m) => ({ ...m, [viewerMapKey]: mapCount }));
					}
				}
			} catch (e) {
				console.warn('Failed to check media liked status', e);
			} finally {
				setLikesBusy(false);
			}
		})();

		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'ArrowLeft') { e.preventDefault(); const idx = items.findIndex((it) => it.id === viewer.id); if (idx > 0) setViewer(items[idx - 1]); }
			if (e.key === 'ArrowRight') { e.preventDefault(); const idx = items.findIndex((it) => it.id === viewer.id); if (idx >= 0 && idx < items.length - 1) setViewer(items[idx + 1]); }
			if (e.key === 'Escape') setViewer(null);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [viewer, items]);

	// When items load, try to bulk-check which media are liked so the grid can show like buttons
	useEffect(() => {
		if (!items || items.length === 0) return;

		(async () => {
			const payloadToMapKeys: Record<string, string[]> = {};
			const mediaIds: string[] = [];
			for (const item of items) {
				const payloadId = getCharacterMediaId(item);
				const mapKey = getMapKeyForItem(item);
				if (!payloadId || !mapKey) continue;
				mediaIds.push(payloadId);
				if (!payloadToMapKeys[payloadId]) payloadToMapKeys[payloadId] = [];
				if (!payloadToMapKeys[payloadId].includes(mapKey)) payloadToMapKeys[payloadId].push(mapKey);
			}
			const uniqueMediaIds = Array.from(new Set(mediaIds));
			if (uniqueMediaIds.length === 0) return;
			let resp: any = null;
			try {
				// Send a single consistent payload shape: { media_ids: [...] }
				resp = await apiClient.post('/private-content/check-media-liked', { media_ids: uniqueMediaIds });
			} catch (e) {
				console.warn('bulk check-media-liked failed', e);
			}
			// Parse response expecting { likes: [ { id, is_liked } ] }
			const likedResult: Record<string, boolean> = {};
			const countResult: Record<string, number> = {};
			if (resp) {
				const likesArr = Array.isArray(resp.likes) ? resp.likes : (Array.isArray(resp) ? resp : null);
				if (likesArr) {
					for (const entry of likesArr) {
						if (!entry) continue;
						const entryId = normalizeId(entry.id ?? entry.media_id ?? entry.character_media_id ?? entry._id);
						if (!entryId) continue;
						const targetKeys = payloadToMapKeys[entryId];
						if (!targetKeys || targetKeys.length === 0) continue;
						for (const key of targetKeys) {
							likedResult[key] = Boolean(entry.is_liked ?? entry.liked ?? false);
							if (typeof entry.total_likes === 'number') countResult[key] = entry.total_likes;
						}
					}
				}
			}
			// apply maps
			if (Object.keys(likedResult).length > 0) setLikedMap((m) => ({ ...m, ...likedResult }));
			if (Object.keys(countResult).length > 0) setLikesMap((m) => ({ ...m, ...countResult }));
		})();
	}, [items]);

	// viewer download helper state
	const viewerUrl = viewer ? getMediaUrl(viewer) : null;
	const isDownloadingViewer = !!(downloading && viewerUrl && downloading === viewerUrl);

	const likeMediaItem = async (item: any) => {
		const payloadId = getCharacterMediaId(item);
		const mapKey = getMapKeyForItem(item);
		if (!payloadId || !mapKey) return;
		if (likedMap[mapKey]) return; // already liked
		setLikesBusyMap((m) => ({ ...m, [mapKey]: true }));
		try {
			const res = await apiClient.post('/private-content/like-media', { id: payloadId });
			// mark liked
			setLikedMap((m) => ({ ...m, [mapKey]: true }));
			const responseTotalLikes = res && typeof res === 'object' && typeof (res as any).total_likes === 'number' ? (res as any).total_likes : null;
			setLikesMap((m) => {
				const prev = m[mapKey];
				const updated = responseTotalLikes !== null ? responseTotalLikes : (typeof prev === 'number' ? prev + 1 : 1);
				return { ...m, [mapKey]: updated };
			});
		} catch (e) {
			console.warn('like-media failed for id', payloadId, e);
		} finally {
			setLikesBusyMap((m) => ({ ...m, [mapKey]: false }));
		}
	};

	return (
		<section className={`w-full max-w-7xl mx-auto rounded-xl sm:rounded-2xl border p-4 sm:p-6 lg:p-8 py-6 sm:py-10 theme-transition ${
			isDark ? 'border-white/10 bg-white/[.03]' : 'border-gray-200 bg-white/80'
		}`}>
			<div className="flex items-center gap-3 mb-4">
				<button onClick={() => navigate(-1)} aria-label="Back" className="rounded-full bg-[#2b2b2b] p-2 flex items-center justify-center ring-1 ring-white/5 text-[var(--hl-gold)]">
					<ChevronLeft className="w-4 h-4" />
				</button>
				<h1 className={`text-lg sm:text-xl font-semibold ${colors.text.primary}`}>Pack Media</h1>
			</div>

			{loading && items.length === 0 ? (
				<div className={`text-center ${colors.text.secondary} py-4 text-sm`}>Loading…</div>
			) : error ? (
				<div className="text-center text-red-400 py-8">{error}</div>
			) : items.length === 0 ? (
				<div className={`text-center space-y-3 py-8 ${colors.text.secondary}`}>
					<div className="text-lg font-medium">No media found in this pack.</div>
				</div>
			) : (
				<div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 sm:gap-6">
					{items.map((it) => {
						const itUrl = getMediaUrl(it) || it.s3_path || it.presigned_s3_path || null;
						const mapKey = getMapKeyForItem(it);
						return (
							<Thumb
								key={mapKey || it.id}
								item={it}
								onOpen={(i: any) => setViewer(i)}
								onDownload={(u: string) => downloadAndSave(u)}
								isDownloading={!!(downloading && itUrl && downloading === itUrl)}
								liked={mapKey ? likedMap[mapKey] : false}
								likesCount={mapKey ? likesMap[mapKey] : undefined}
								onLike={() => likeMediaItem(it)}
								likesBusy={mapKey ? !!likesBusyMap[mapKey] : false}
							/>
						);
					})}
				</div>
			)}

			{viewer && (
				<div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 sm:p-6">
					<div className="max-w-[90vw] max-h-[90vh] w-full relative">
						<div className="mb-3 flex justify-end gap-2 items-center">
							<button onClick={() => { setViewer(null); }} className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm transition-colors">Close</button>
							<button
								onClick={() => { if (viewerUrl) downloadAndSave(viewerUrl); }}
								className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm transition-colors flex items-center gap-2"
								disabled={isDownloadingViewer}
							>
								{isDownloadingViewer ? <IconSpinner className="w-4 h-4 text-white animate-spin" /> : null}
								<span>{isDownloadingViewer ? 'Preparing…' : 'Download'}</span>
							</button>

							{/* Like button: shows current liked state (checked via /private-content/check-media-liked) */}
							<button
								type="button"
								onClick={(e) => { e.stopPropagation(); if (!likesBusy && !mediaLiked) toggleLike(); }}
								aria-pressed={!!mediaLiked}
								className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${mediaLiked ? 'bg-red-400/90 hover:bg-red-400' : 'bg-white/10 hover:bg-white/20'}`}
								disabled={likesBusy || !!mediaLiked}
							>
								<img src={LikeIconSrc} alt="Like" className="w-4 h-4" />
								<span className="text-white text-sm">{typeof likesCount === 'number' ? likesCount : ''}</span>
							</button>
						</div>
						{((viewer.media_type === 'video') || (viewer.mime_type || viewer.content_type || '').toString().startsWith('video')) ? (
							<video src={getMediaUrl(viewer) || ''} controls autoPlay className="w-full h-auto max-h-[80vh] bg-black rounded-lg" />
						) : (
							<img src={getMediaUrl(viewer) || ''} alt="full" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />
						)}
					</div>
				</div>
			)}
		</section>
	);
}
