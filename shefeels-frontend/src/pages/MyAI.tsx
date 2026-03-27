import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { normalizeCharacters } from '../utils/normalizeCharacter';
import apiClient, { getErrorMessage } from '../utils/api';
import { useToastActions } from "../contexts/ToastContext";
import fetchWithAuth from '../utils/fetchWithAuth';
import { useAuth } from "../contexts/AuthContext";
import CharacterCard from "../components/CharacterCard";
import { generateSlug } from '../utils/slugs';
import Modal from "../components/Modal";
import ChatNowIcon from "../assets/home/ChatNowIcon.svg";
import { buildApiUrl } from '../utils/apiBase';

type Character = {
	id: number | string;
	username?: string;
	name?: string;
	bio?: string;
	age?: number | null;
	image_url_s3?: string | null;
	webp_image_url_s3?: string | null;
	gif_url_s3?: string | null;
	animated_webp_url_s3?: string | null;
};

export default function MyAI() {
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
	const [actionLoading, setActionLoading] = useState(false);
	const [characters, setCharacters] = useState<Character[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [countsMap, setCountsMap] = useState<Record<string, { likes: number; messages: number }>>({});
	const [likeStatusMap, setLikeStatusMap] = useState<Record<string, boolean>>({});
	const [likingMap, setLikingMap] = useState<Record<string, boolean>>({});
	// User requested to load without any filter by default on My AI page
	const [styleFilter, setStyleFilter] = useState<string>('any');
	const [currentStyle, setCurrentStyle] = useState<string | null>(null);
	const navigate = useNavigate();
	const { token } = useAuth();
	const { showError } = useToastActions();
	const [searchQuery, setSearchQuery] = useState<string>('');

	// Apply style filter and search to the user's characters (if any)
	const visibleCharacters = characters.filter((c: any) => {
		if (!c) return false;
		if (styleFilter && styleFilter !== 'any') {
			try {
				const s = (c && (c.style || c.art_style || c.image_style || c.type || (c as any).attributes?.style)) || '';
				const sval = String(s).toLowerCase().trim();
				if (!sval) return false;
				// match if either side contains the other or whole-word matches (e.g. 'photorealistic' vs 'realistic')
				const a = sval;
				const b = String(styleFilter || '').toLowerCase().trim();
				if (!(a.includes(b) || b.includes(a) || new RegExp('\\b' + b.replace(/[^a-z0-9]/g, '') + '\\b').test(a))) return false;
			} catch { return false; }
		}

		// Search by name/username
		if (searchQuery && String(searchQuery).trim() !== '') {
			try {
				const q = String(searchQuery).toLowerCase().trim();
				const name = ((c.name || c.username || '') + '').toLowerCase();
				if (!name.includes(q)) return false;
			} catch { return false; }
		}

		return true;
	});

	async function confirmDelete() {
		if (pendingDeleteId == null) return;
		setActionLoading(true);
		try {
			// Build the URL using env var
			// character_id is a string per backend; encode to be safe
			const url = buildApiUrl(`/characters/delete/${encodeURIComponent(pendingDeleteId)}`);
			// Use fetch directly so we can include credentials and token if present
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			if (token) headers.Authorization = `Bearer ${token}`;
			const res = await fetchWithAuth(url, { method: 'POST', credentials: 'include', headers });
			if (!res.ok) {
				const json = await res.json().catch(() => ({}));
				throw new Error(json?.message || `Delete failed (${res.status})`);
			}
			// refresh list
			const data = await apiClient.getUserCharacters();
			setCharacters(Array.isArray(data) ? normalizeCharacters(data) : []);
			setConfirmOpen(false);
			setPendingDeleteId(null);
		} catch (err) {
			console.error('Failed to delete character', err);
			try { showError('Delete failed', (err as any)?.message || getErrorMessage(err)); } catch { /* fallback */ }
		} finally {
			setActionLoading(false);
		}
	}

	const location = useLocation();

	useEffect(() => {
		let mounted = true;

		const preloadImages = (list: Character[]) => {
			for (const ch of list) {
				try {
					if (ch?.image_url_s3) {
						const img = new Image();
						img.src = ch.image_url_s3 as string;
					}
				} catch { }
			}
		};

		const collectCharacterIds = (list: Character[]): string[] => {
			const ids: string[] = [];
			const seen = new Set<string>();
			for (const ch of list) {
				const raw = ch?.id ?? (ch as any)?.character_id;
				const id = raw == null ? '' : String(raw).trim();
				if (!id || seen.has(id)) continue;
				seen.add(id);
				ids.push(id);
			}
			return ids;
		};

		const fetchCountsForIds = async (ids: string[]) => {
			if (!ids.length) {
				if (mounted) setCountsMap({});
				return;
			}
			try {
				if (token) apiClient.setAccessToken(token);
				// Only fetch counts if we have a token or if the endpoint is public (it is public, but let's be safe if it fails for admin)
				// UPDATE: getLikesMessageCount is public, so no token needed strictly, but if it uses token for user context, it might fail.
				// Actually the logs show 401 on `like-status-by-user` and `fetch-loggedin-user`.
				// `likes-message-count` returned 200 OK in the logs.
				const counts = await apiClient.getLikesMessageCount(ids);
				if (!mounted) return;
				const map: Record<string, { likes: number; messages: number }> = {};
				for (const id of ids) {
					map[id] = { likes: 0, messages: 0 };
				}
				if (Array.isArray(counts)) {
					for (const item of counts) {
						const id = String(item?.character_id ?? '').trim();
						if (!id) continue;
						map[id] = {
							likes: Number(item?.likes_count ?? 0),
							messages: Number(item?.message_count ?? 0),
						};
					}
				}
				setCountsMap(map);
			} catch (err) {
				if ((err as any)?.name === 'AbortError') return;
				console.debug('MyAI: failed to fetch counts', err);
			}
		};

		const fetchLikeStatuses = async (ids: string[]) => {
			if (!ids.length) {
				if (mounted) setLikeStatusMap({});
				return;
			}
			try {
				if (token) apiClient.setAccessToken(token);
				// Only fetch like status if we have a token
				if (!token) {
					if (mounted) setLikeStatusMap({});
					return;
				}
				const data = await apiClient.getCharacterLikeStatus(ids);

				if (!mounted) return;
				const map: Record<string, boolean> = {};
				if (Array.isArray(data)) {
					for (const item of data) {
						const id = String(item?.character_id ?? '');
						if (id) {
							map[id] = !!item.is_liked;
						}
					}
				}
				setLikeStatusMap(map);
			} catch (err) {
				if ((err as any)?.name === 'AbortError') return;
				console.debug('MyAI: failed to fetch like statuses', err);
			}
		};

		async function loadChars() {
			setError(null);
			try {
				if (token) apiClient.setAccessToken(token);
				const data = await apiClient.getUserCharacters();
				if (!mounted) return;
				const normalized = Array.isArray(data) ? normalizeCharacters(data) : [];
				// Sort by created_at (newest first)
				normalized.sort((a: any, b: any) => {
					const da = new Date(a.created_at || 0).getTime();
					const db = new Date(b.created_at || 0).getTime();
					return db - da;
				});
				setCharacters(normalized);
				preloadImages(normalized);
				const ids = collectCharacterIds(normalized);
				if (!ids.length) {
					setCountsMap({});
					setLikeStatusMap({});
					return;
				}
				fetchCountsForIds(ids);
				fetchLikeStatuses(ids);
			} catch (err: any) {
				if (err?.name === "AbortError") return;
				if (!mounted) return;
				setError(err?.message || String(err));
				try {
					const status = (err && typeof (err as any).status === 'number') ? (err as any).status : ((err as any)?.status || 0);
					if (status >= 400 && status < 500) {
						const detail = (err as any)?.body?.detail ?? (err as any)?.body?.message ?? (err as any)?.detail ?? (err as any)?.message ?? getErrorMessage(err);
						showError('Failed to load characters', detail);
					} else if (status >= 500) {
						try { console.warn('MyAI: server error', status, (err as any)?.body ?? err); } catch { }
						showError('Failed to load characters', 'Unable to load your characters currently.');
					} else {
						showError('Failed to load characters', getErrorMessage(err));
					}
				} catch (e) { }
			} finally {
				if (mounted) setLoading(false);
			}
		}

		// Only load when this route is active (safety check)
		if (location.pathname === '/my-ai') loadChars();

		// Re-fetch whenever the window gains focus or tab becomes visible to ensure fresh data
		const onFocus = () => { if (location.pathname === '/my-ai') loadChars(); };
		const onVisibility = () => { if (document.visibilityState === 'visible' && location.pathname === '/my-ai') loadChars(); };
		window.addEventListener('focus', onFocus);
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			mounted = false;
			window.removeEventListener('focus', onFocus);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, [location.pathname, token]);

	// Listen for global style changes so My AI page can filter characters by style if changed while on page
	useEffect(() => {
		function onStyle(e: any) {
			let val = '';
			try {
				if (e && (e as any).detail) val = String((e as any).detail).toLowerCase().trim();
				if (!val && (window as any).hl_current_style) val = String((window as any).hl_current_style).toLowerCase().trim();
				if (!val) {
					const s2 = localStorage.getItem('hl_style');
					if (s2) val = String(s2).toLowerCase().trim();
				}
			} catch { }

			// If val is provided, use it; otherwise 'any' (clearing filter)
			setStyleFilter(val || 'any');
			setCurrentStyle(val || null);
		}

		window.addEventListener('sf_style_changed', onStyle as EventListener);
		return () => window.removeEventListener('sf_style_changed', onStyle as EventListener);
	}, []);

	const handleLikeClick = async (characterId: string) => {
		if (!characterId || likeStatusMap[characterId] || likingMap[characterId]) return;
		setLikingMap((prev) => ({ ...prev, [characterId]: true }));
		try {
			if (token) apiClient.setAccessToken(token);
			if (!token) {
				// Redirect to login or show error if trying to like without being logged in
				// For now just return to avoid 401
				try { showError('Sign in to like characters'); } catch { }
				return;
			}
			await apiClient.likeCharacter(characterId);
			setCountsMap((prev) => {
				const prevEntry = prev[characterId] || { likes: 0, messages: 0 };
				return {
					...prev,
					[characterId]: {
						likes: (prevEntry.likes ?? 0) + 1,
						messages: prevEntry.messages ?? 0,
					},
				};
			});
			setLikeStatusMap((prev) => ({ ...prev, [characterId]: true }));
		} catch (err) {
			console.debug('MyAI: failed to like character', err);
		} finally {
			setLikingMap((prev) => {
				const next = { ...prev };
				delete next[characterId];
				return next;
			});
		}
	};

	// Small helper component for style toggle pills (copied from Header.tsx)
	const StyleToggle: React.FC<{ label: string; styleKey: string }> = ({ label, styleKey }) => {
		const isActive = currentStyle === styleKey;

		return (
			<button
				className={`inline-flex items-center rounded-full px-4 py-2 h-9 text-sm font-medium transition-all duration-200 ${isActive
					? 'bg-(--sf-purple) text-white'
					: 'bg-[rgba(255,255,255,0.10)] text-white/70 hover:text-white'
					}`}
				onClick={() => {
					try {
						if (isActive) {
							// Deselect
							if ((window as any).sf_set_style) {
								(window as any).sf_set_style('');
								try { (window as any).sf_current_style = ''; } catch { }
								try { window.dispatchEvent(new CustomEvent('sf_style_changed', { detail: '' })); } catch { }
							} else {
								try { localStorage.removeItem('sf_style'); } catch { }
								try { window.dispatchEvent(new CustomEvent('sf_style_changed', { detail: '' })); } catch { }
								try { (window as any).sf_current_style = ''; } catch { }
							}
							setCurrentStyle(null);
							setStyleFilter('any');
						} else {
							// Select
							// Use the styleKey as canonical payload (keeps stored value consistent)
							const payload = styleKey || label;
							if ((window as any).sf_set_style) {
								(window as any).sf_set_style(payload);
								try { (window as any).sf_current_style = String(payload).toLowerCase(); } catch { }
								try { window.dispatchEvent(new CustomEvent('sf_style_changed', { detail: payload })); } catch { }
							} else {
								try { localStorage.setItem('sf_style', payload); } catch { }
								try { window.dispatchEvent(new CustomEvent('sf_style_changed', { detail: payload })); } catch { }
								try { (window as any).sf_current_style = String(payload).toLowerCase(); } catch { }
							}
							setCurrentStyle(styleKey);
							setStyleFilter(String(payload).toLowerCase().trim());
						}
					} catch { }
				}}
			>
				{label}
			</button>
		);
	};

	// Card shown to unauthenticated users with clear CTA buttons
	const UnauthenticatedCard: React.FC = () => (
		<div className="flex items-center justify-center py-12">
			<div className="bg-white/5 border border-white/6 rounded-2xl p-8 max-w-xl w-full text-center">
				<div className="mb-4 grid place-items-center">
						<svg width="56" height="56" viewBox="0 0 24 24" fill="none" className="text-(--sf-purple)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zM4 20v-1c0-2.21 3.58-4 8-4s8 1.79 8 4v1H4z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
				</div>
				<h3 className="text-xl font-semibold mb-2">You&apos;re not signed in</h3>
				<p className="text-sm text-white/70 mb-6">Sign in to view and manage your AI characters, or explore public characters without an account.</p>
				<div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-2 sm:gap-3">
					<button onClick={() => navigate('/login', { state: { from: location } })} className="whitespace-nowrap px-4 py-2 rounded-full font-medium bg-(--sf-purple) text-white">Sign in</button>
					<button onClick={() => navigate('/')} className="whitespace-nowrap px-3 sm:px-4 py-2 rounded-full font-medium bg-transparent ring-1 ring-white/10 text-white/90">Explore characters</button>
					<button onClick={() => navigate('/create-character')} className="whitespace-nowrap px-4 py-2 rounded-full font-medium bg-white/6 text-white/90">Create</button>
				</div>
			</div>
		</div>
	);

	return (
		<main className="container mx-auto px-4 py-8">
			<header className="mb-6">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
					<div className="flex flex-col">
						<h2 className="text-2xl md:text-3xl font-semibold">My AI</h2>
					</div>

					{/* Buttons: Realistic, Anime, and Create Your AI */}
					<div className="flex flex-wrap items-center gap-3">

						{/* Style filter buttons - Realistic and Anime */}
						<div className="flex items-center gap-2 flex-wrap">
							<StyleToggle label="Realistic" styleKey="realistic" />
							<StyleToggle label="Anime" styleKey="anime" />
						</div>

						{/* Search input */}
						<div className="relative w-full sm:w-auto">
							<input
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search characters"
								aria-label="Search characters"
								className={`rounded-full px-4 py-2 text-sm font-medium bg-white/6 text-white/90 w-full sm:w-56`}
							/>
							<svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
								<circle cx="11" cy="11" r="5" stroke="currentColor" strokeWidth="1.6" />
							</svg>
						</div>

						{/* Create Your AI button with provided styling and icon */}
						<button
							onClick={() => navigate('/create-character')}
							className="flex items-center gap-3 px-6 py-[14px] sm:px-7 rounded-[12px] border border-white/20"
							style={{
								background: 'linear-gradient(90deg, #d9b2ff 0%, #7f5af0 38%, #9d66ff 64%, #f48db5 100%)',
								boxShadow: 'inset 0 0 8px rgba(227,222,255,0.2), inset 0 20px 20px rgba(202,172,255,0.3), inset 0 1px 2px rgba(255,255,255,1), inset 0 8px 11px rgba(255,255,255,0.1)',
								backdropFilter: 'blur(5.0490498542785645px)',
								WebkitBackdropFilter: 'blur(5.0490498542785645px)',
								borderRadius: '12px'
							}}
						>
							<img src={ChatNowIcon} alt="create" className="h-4 w-4 brightness-0 invert" />
							<span className="font-semibold text-white">Create Your AI Girl</span>
						</button>
					</div>
				</div>

				{/* Delete confirmation modal */}
				<Modal open={confirmOpen} onClose={() => { setConfirmOpen(false); setPendingDeleteId(null); }}>
					<div className="flex flex-col items-center text-center gap-4">
						<div className="h-12 w-12 rounded-2xl grid place-items-center" style={{ background: "linear-gradient(135deg,#431417,#1a0b0c)" }}>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M10 11v6M14 11v6M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="#ff6b6b" strokeWidth="1.6" /></svg>
						</div>
						<div className="text-2xl font-bold text-(--sf-purple)">Delete character</div>
						<p className="text-white/80 max-w-md">Are you sure you want to delete this character? This action cannot be reversed and all related chats and media will be deleted.</p>
						<div className="mt-2 flex items-center justify-center gap-3">
							<button className="rounded-full px-6 py-3 text-white/90 bg-white/10 ring-1 ring-white/10 hover:bg-white/15" onClick={() => { setConfirmOpen(false); setPendingDeleteId(null); }}>
								Cancel
							</button>
							<button disabled={actionLoading} className="rounded-full px-6 py-3 text-white bg-linear-to-b from-(--sf-purple) to-[#6c47d9] hover:from-[#6c47d9] hover:to-(--sf-purple)" onClick={() => confirmDelete()}>
								{actionLoading ? 'Deleting...' : 'Yes Delete'}
							</button>
						</div>
					</div>
				</Modal>
			</header>

			{!token ? (
				loading ? (
					<div className="text-center text-gray-600 text-sm py-2">Loading characters…</div>
				) : (
					<UnauthenticatedCard />
				)
			) : (
				<>
					{loading && characters.length === 0 && <div className="text-center text-gray-600 text-sm py-2">Loading characters…</div>}
					{/* Errors are surfaced via toast notifications; hide raw error details in-page */}

					{!loading && !error && characters.length === 0 && (
						<div className="flex items-center justify-center py-12">
							<div className="bg-white/5 border border-white/6 rounded-2xl p-8 max-w-xl w-full text-center">
								<h3 className="text-xl font-semibold mb-2">No characters yet</h3>
								<p className="text-sm text-white/70 mb-4">You don't have any AI characters yet. Create a character to start chatting and generating media — they'll show up here.</p>
								<div className="flex items-center justify-center gap-3">
									<button
										onClick={() => navigate('/create-character')}
										className="px-4 py-2 rounded-full font-medium text-white border border-white/20"
										style={{
											background: 'linear-gradient(90deg, #d9b2ff 0%, #7f5af0 38%, #9d66ff 64%, #f48db5 100%)',
											boxShadow: 'inset 0 0 8px rgba(227,222,255,0.2), inset 0 20px 20px rgba(202,172,255,0.3), inset 0 1px 2px rgba(255,255,255,1), inset 0 8px 11px rgba(255,255,255,0.1)'
										}}
									>
										Create your AI
									</button>
									<button onClick={() => navigate('/generate-image')} className="px-4 py-2 rounded-full font-medium bg-transparent ring-1 ring-white/10 text-white/90">Generate image</button>
									<button onClick={() => navigate('/')} className="px-4 py-2 rounded-full font-medium bg-white/6 text-white/90">Explore characters</button>
								</div>
								<div className="mt-6 text-sm text-white/60">Tip: Start with a simple character name and a short bio. You can always edit details later.</div>
							</div>
						</div>
					)}

					{/* State where characters exist but filters hide them all */}
					{!loading && !error && characters.length > 0 && visibleCharacters.length === 0 && (
						<div className="flex items-center justify-center py-12">
							<div className="bg-white/5 border border-white/6 rounded-2xl p-8 max-w-xl w-full text-center">
								<h3 className="text-xl font-semibold mb-2">No matches found</h3>
								<p className="text-sm text-white/70 mb-4">No characters match your selected style or search filters.</p>
								<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
									<button
										onClick={() => {
											// Clear filters
											setStyleFilter('any');
											setSearchQuery('');
											try {
												if ((window as any).sf_set_style) {
													(window as any).sf_set_style('');
												} else {
													localStorage.removeItem('sf_style');
												}
												setCurrentStyle(null);
												window.dispatchEvent(new CustomEvent('sf_style_changed', { detail: '' }));
											} catch { }
										}}
										className="whitespace-nowrap px-4 py-2 rounded-full font-medium bg-white/10 text-white hover:bg-white/20"
									>
										Clear filters
									</button>
									<button onClick={() => navigate('/create-character')} className="whitespace-nowrap px-4 py-2 rounded-full font-medium bg-(--sf-purple) text-white">Create new character</button>
								</div>
							</div>
						</div>
					)}

					<div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 lg:gap-8">
						{visibleCharacters.map((c) => {
							const charId = String(c.id ?? '');
							const counts = countsMap[charId] || { likes: 0, messages: 0 };
							return (
								<article key={String(c.id)} className="transition-all duration-200">
									<CharacterCard
										name={c.name || (c.username as string) || 'Unknown'}
										age={typeof c.age === 'number' ? c.age : undefined}
										img={(c.webp_image_url_s3 || c.image_url_s3) as string}
										gif={c.gif_url_s3 as string}
										webp={c.animated_webp_url_s3 as string}
										bio={c.bio}
										onClick={() => navigate('/chat', { state: { character: c } })}
										likesCount={counts.likes}
										messageCount={counts.messages}
										onLike={() => handleLikeClick(charId)}
										isLiked={likeStatusMap[charId] || false}
										likeDisabled={likingMap[charId] || false}
										onEdit={() => {
											try {
												const slug = generateSlug(c.name || (c.username as string) || 'character', c.id || '');
												navigate(`/character/${slug}`, { state: { character: c, openEditor: true } });
											} catch { navigate('/'); }
										}}
										onDelete={() => {
											// open confirm modal and set pending id as string
											setPendingDeleteId(String(c.id));
											setConfirmOpen(true);
										}}
										showOptions={true}
									/>
								</article>
							);
						})}
					</div>
				</>
			)}
		</main>
	);
}
