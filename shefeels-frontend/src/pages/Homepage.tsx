import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { normalizeCharacters } from '../utils/normalizeCharacter';
import apiClient from '../utils/api';
import CharacterCard from "../components/CharacterCard";
import SEOHead from "../components/SEOHead";
import VirtualScroll from "../components/VirtualScroll";
import chunk from '../utils/chunk';
import LoadingSpinner from "../components/LoadingSpinner";
import { usePerformance } from "../contexts/PerformanceContext";
import LoadMoreButton from "../components/LoadMoreButton";
import CHARACTER_LIKE_ENDPOINT from "../utils/characterLikeEndpoint";
import { generateSlug } from "../utils/slugs";

type Character = {
	id: number | string;
	username: string;
	name: string;
	bio: string;
	age?: number | null;
	image_url_s3?: string | null;
	webp_image_url_s3?: string | null;
	gif_url_s3?: string | null;
	animated_webp_url_s3?: string | null;
	// new optional fields used for filtering
	gender?: string | null;
	style?: string | null;
	updated_at?: string; // used for sorting
};

const INITIAL_VISIBLE_ROWS = 3;
const CHARACTERS_PER_ROW = 4;
const ROWS_PER_LOAD = 2;
const INITIAL_VISIBLE_COUNT = INITIAL_VISIBLE_ROWS * CHARACTERS_PER_ROW;
const LOAD_MORE_COUNT = ROWS_PER_LOAD * CHARACTERS_PER_ROW;

export default function Homepage() {
	const { theme } = useTheme();
	const { isSlowConnection } = usePerformance();
	const isDark = theme === "dark";
	const [characters, setCharacters] = useState<Character[]>([]);
	const [genderFilter, setGenderFilter] = useState<string>('any');
	const [styleFilter, setStyleFilter] = useState<string>('any');
	const [activeFilters, setActiveFilters] = useState<string[]>([]);

	// reference setter to avoid unused-variable compile errors when pills navigate instead of toggling
	useEffect(() => {
		// intentionally no-op; keeps `setActiveFilters` included for future use
	}, [setActiveFilters]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [countsMap, setCountsMap] = useState<Record<string, { likes: number; messages: number }>>({});
	const [likeStatusMap, setLikeStatusMap] = useState<Record<string, boolean>>({});
	const [likingMap, setLikingMap] = useState<Record<string, boolean>>({});
	const [useVirtualScrolling, setUseVirtualScrolling] = useState<boolean>(false);
	const [visibleCount, setVisibleCount] = useState<number>(INITIAL_VISIBLE_COUNT);
	const [cols, setCols] = useState<number>(() => {
		try {
			if (typeof window === 'undefined') return 2;
			const w = window.innerWidth;
			if (w >= 1024) return 4;
			if (w >= 768) return 3;
			return 2;
		} catch {
			return 2;
		}
	});
	const [nsfwEnabled, setNsfwEnabled] = useState<boolean>(() => {
		try {
			return localStorage.getItem('hl_nsfw') === 'true';
		} catch {
			return false;
		}
	});
	const refreshingMediaRef = useRef<Record<string, boolean>>({});

	useEffect(() => {
		const abort = new AbortController();

		const sanitizeIds = (ids: Array<string | number>) =>
			Array.from(new Set(ids.map((val) => String(val ?? '')).filter((val) => val && val !== 'undefined')));

		async function fetchCountsForIds(ids: string[]) {
			if (!ids || ids.length === 0) {
				console.log('Homepage: no ids provided to fetchCountsForIds, skipping');
				return;
			}
			try {
				console.log('Homepage: fetching counts for ids', ids);
				const data = await apiClient.getLikesMessageCount(ids);
				if (abort.signal.aborted) return;
				const map: Record<string, { likes: number; messages: number }> = {};
				for (const id of ids) {
					map[id] = { likes: 0, messages: 0 };
				}
				if (Array.isArray(data)) {
					for (const item of data) {
						const id = String(item?.character_id ?? '');
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
				console.debug('Homepage: failed to fetch counts', err);
			}
		}

		async function fetchLikeStatuses(ids: string[]) {
			if (!ids || ids.length === 0) return;
			try {
				// We need to check if user is logged in before fetching like status
				// Homepage doesn't use useAuth explicitly but we can check if apiClient has a token or pass it in
				// A better way is to import useAuth
				const token = apiClient.getAccessToken(); // Check if client has token
				if (!token) return;

				const data = await apiClient.getCharacterLikeStatus(ids);
				if (abort.signal.aborted) return;

				const map: Record<string, boolean> = {};
				if (Array.isArray(data)) {
					for (const item of data) {
						const id = String(item?.character_id ?? '');
						if (id) {
							map[id] = !!item.is_liked;
						}
					}
				}

				setLikeStatusMap((prev) => ({
					...prev,
					...map
				}));
			} catch (err) {
				if ((err as any)?.name === 'AbortError') return;
				console.debug('Homepage: failed to fetch like statuses', err);
			}
		}

		async function fetchCharacters() {
			setLoading(true);
			setError(null);
			try {
				const data = await (await import('../utils/api')).default.getDefaultCharacters();
				const list = Array.isArray(data) ? normalizeCharacters(data) : [];
				// Remove dummy / fallback characters: only include entries with a valid image
				const filtered = list.filter((c) => !!(c && (c.image_url_s3 || c.image_url)));

				// Sort characters by updated_at descending
				filtered.sort((a: any, b: any) => {
					const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
					const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
					return dateB - dateA;
				});

				setCharacters(filtered);

				// debug: log first few characters to help verify field names for filtering
				try { console.debug('Homepage: fetched characters sample', list.slice(0, 5)); } catch { }

				// Preload images to warm the browser cache for filtered list
				for (const ch of filtered) {
					if (ch?.image_url_s3) {
						const img = new Image();
						img.src = ch.image_url_s3;
						// Store in frontend presigned cache keyed by character id for quick reuse
						try {
							const key = String(ch.id ?? ch.character_id ?? ch.username ?? '');
							if (key) apiClient.setCachedPresigned(key, ch.image_url_s3, 60 * 15);
						} catch { }
					}
				}

				// fetch counts and like status immediately after we have characters
				const ids = sanitizeIds(filtered.map((c) => (c?.id ?? (c as any)?.character_id)));
				console.log('Homepage: characters fetched, will request counts for ids', ids);
				fetchCountsForIds(ids);
				fetchLikeStatuses(ids);
			} catch (err: any) {
				if (err?.name === "AbortError") return;
				setError(err?.message || String(err));
			} finally {
				setLoading(false);
			}
		}

		fetchCharacters();
		return () => abort.abort();
	}, []);



	const navigate = useNavigate();

	const openCharacterChat = (character: Character) => {
		const characterId = getCharacterId(character);
		if (characterId) {
			const baseName = character.name || character.username || 'character';
			const slug = generateSlug(baseName, characterId);
			navigate(`/chat/${slug}`, { state: { character } });
			return;
		}

		navigate('/chat', { state: { character } });
	};

	const handleCharacterMediaError = async (character: Character) => {
		const id = getCharacterId(character);
		if (!id) return;
		if (refreshingMediaRef.current[id]) return;
		refreshingMediaRef.current[id] = true;

		try {
			const response = await apiClient.getCharacterById(id);
			const fresh = response?.character;
			if (!fresh) return;

			setCharacters((prev) => prev.map((item) => {
				const itemId = String((item as any)?.id ?? (item as any)?.character_id ?? '');
				if (itemId !== id) return item;
				return {
					...item,
					image_url_s3: fresh.image_url_s3 || item.image_url_s3,
					webp_image_url_s3: fresh.webp_image_url_s3 || item.webp_image_url_s3,
					gif_url_s3: fresh.gif_url_s3 || item.gif_url_s3,
					animated_webp_url_s3: fresh.animated_webp_url_s3 || item.animated_webp_url_s3,
				};
			}));
		} catch (err) {
			console.debug('Homepage: media refresh failed for character', id, err);
		} finally {
			refreshingMediaRef.current[id] = false;
		}
	};

	// initialize from localStorage and listen for global changes
	useEffect(() => {
		try {
			const g = localStorage.getItem('hl_gender');
			if (g) setGenderFilter(String(g).toLowerCase().trim());
		} catch { }
		try {
			const s = localStorage.getItem('hl_style');
			if (s) setStyleFilter(String(s).toLowerCase().trim());
			// Also if a global setter exposed the current style, pick it up immediately
			try { const gcs = (window as any).hl_current_style; if (!s && gcs) setStyleFilter(String(gcs).toLowerCase().trim()); } catch { }
		} catch { }

		function onStyle(e: any) {
			let val = '';
			try {
				if (e && (e as any).detail) val = String((e as any).detail).toLowerCase().trim();
				// fallback to global variable if available
				if (!val && (window as any).hl_current_style) val = String((window as any).hl_current_style).toLowerCase().trim();
				// fallback to localStorage
				if (!val) {
					const s2 = localStorage.getItem('hl_style');
					if (s2) val = String(s2).toLowerCase().trim();
				}
			} catch { }
			if (val) setStyleFilter(val);
		}
		function onGender(e: any) {
			const val = (e && e.detail) ? String(e.detail).toLowerCase().trim() : '';
			if (val) setGenderFilter(val);
		}

		window.addEventListener('hl_style_changed', onStyle as EventListener);
		window.addEventListener('hl_gender_changed', onGender as EventListener);
		return () => {
			window.removeEventListener('hl_style_changed', onStyle as EventListener);
			window.removeEventListener('hl_gender_changed', onGender as EventListener);
		};
	}, []);

	// filter options based on the Figma design - Gender, Style, Filter, All Models/Private Content
	const filterOptions = [
		{ id: 'gender', label: 'Gender', isDropdown: true, hasChevron: true },
		{ id: 'style', label: 'Style', isDropdown: true, hasChevron: true },
		{ id: 'filter', label: 'Filter', isDropdown: false, hasChevron: true },
		{ id: 'private_content', label: 'Private Content', isActive: activeFilters.includes('private_content') },
	];

	// toggleFilter removed: mobile 'Private Content' pill now navigates to /select-character

	const getCharacterId = (character: Character) => {
		const rawId = (character?.id ?? (character as any)?.character_id);
		return rawId != null ? String(rawId) : '';
	};

	// filtered view of characters based on selects
	const filteredCharacters = useMemo(() => {
		function readField(obj: any, key: string) {
			try {
				if (!obj) return undefined;
				if (key.indexOf('.') === -1) return obj[key];
				return key.split('.').reduce((acc: any, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), obj);
			} catch {
				return undefined;
			}
		}

		function getNormalized(obj: any, keys: string[]) {
			for (const k of keys) {
				const v = readField(obj, k);
				if (v != null && String(v).trim() !== '') return String(v).toLowerCase().trim();
			}
			return '';
		}

		return characters.filter((c) => {
			// Apply active filter states
			if (activeFilters.includes('private_content')) {
				// Filter for characters with private content
				const hasPrivate = readField(c, 'has_private_content') || readField(c, 'private_content') || readField(c, 'premium');
				if (!hasPrivate) return false;
			}

			if (activeFilters.includes('nsfw')) {
				// Filter for NSFW characters
				const isNsfw = readField(c, 'nsfw') || readField(c, 'is_nsfw') || readField(c, 'adult_content');
				if (!isNsfw) return false;
			}


			// Gender matching: match whole words to avoid e.g. 'female' matching 'male'
			const genderVal = getNormalized(c, ['gender', 'sex', 'gender_identity', 'profile.gender', 'meta.gender']);
			try {
				const g = String(genderFilter || '').toLowerCase().trim();
				if (g && g !== 'any' && g !== 'all') {
					if (!genderVal) return false;

					const matchWord = (text: string, words: string[]) => {
						try {
							const t = String(text || '').toLowerCase();
							for (const w of words) {
								const re = new RegExp('\\b' + w.replace(/[^a-z0-9]/g, '') + '\\b');
								if (re.test(t)) return true;
							}
						} catch { }
						return false;
					};

					if (g === 'male') {
						if (!matchWord(genderVal, ['male', 'man', 'guy', 'boy'])) return false;
					} else if (g === 'female') {
						if (!matchWord(genderVal, ['female', 'woman', 'girl'])) return false;
					} else if (g === 'trans') {
						// Match any gender starting with 'trans' (e.g., 'transgender', 'trans', etc.)
						if (!genderVal.startsWith('trans')) return false;
					} else {
						// Generic match: require whole-word match for the filter value
						if (!matchWord(genderVal, [g])) return false;
					}
				}
			} catch { }

			const styleVal = getNormalized(c, ['style', 'art_style', 'image_style', 'type']);
			try {
				const s = String(styleFilter || '').toLowerCase().trim();
				if (s && s !== 'any' && s !== 'all') {
					if (!styleVal) return false;
					// match if either side contains the other (e.g. 'realistic' vs 'photorealistic')
					if (!(styleVal.includes(s) || s.includes(styleVal))) return false;
				}
			} catch { }

			return true;
		});
	}, [characters, genderFilter, styleFilter, activeFilters]);

	useEffect(() => {
		setVisibleCount(Math.min(INITIAL_VISIBLE_COUNT, filteredCharacters.length || INITIAL_VISIBLE_COUNT));
	}, [genderFilter, styleFilter, activeFilters, filteredCharacters.length]);

	// Enable virtual scrolling for large lists or slow connections
	useEffect(() => {
		setUseVirtualScrolling(filteredCharacters.length > 20 || isSlowConnection);
	}, [filteredCharacters.length, isSlowConnection]);

	// update cols on resize so we can calculate how many items make 3 rows
	useEffect(() => {
		function calcCols() {
			try {
				const w = window.innerWidth;
				if (w >= 1024) return 4; // lg: 4 columns
				if (w >= 768) return 3; // md: 3 columns
				return 2; // sm: 2 columns
			} catch { return 2; }
		}
		const onResize = () => setCols(calcCols());
		onResize();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, [setCols]);

	const handleLikeClick = async (characterId: string) => {
		if (!characterId) return;
		if (likeStatusMap[characterId] || likingMap[characterId]) return;
		setLikingMap((prev) => ({ ...prev, [characterId]: true }));
		try {
			const token = apiClient.getAccessToken();
			if (!token) {
				// Optionally prompt login
				return;
			}
			await apiClient.post(CHARACTER_LIKE_ENDPOINT, { character_id: String(characterId) });
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
			console.debug('Homepage: failed to like character', err);
		} finally {
			setLikingMap((prev) => {
				const next = { ...prev };
				delete next[characterId];
				return next;
			});
		}
	};

	// (renderCharacterItem removed) — previously unused; rendering handled by `renderRow` and inline maps

	const limitedCharacters = filteredCharacters.slice(0, Math.min(visibleCount, filteredCharacters.length));

	// Build rows for virtualized grid when enabled
	const rows = (() => {
		if (!filteredCharacters || filteredCharacters.length === 0) return [] as Character[][];
		return chunk(filteredCharacters, cols);
	})();

	const renderRow = (rowItems: Character[], rowIndex: number) => {
		return (
			<div key={`row-${rowIndex}`} className="grid gap-3 md:gap-6 lg:gap-8" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
				{rowItems.map((c) => {
					const id = getCharacterId(c);
					const counts = countsMap[id] || { likes: 0, messages: 0 };
					const isLiked = !!likeStatusMap[id];
					const isLiking = !!likingMap[id];
					return (
						<article key={id || c.id} className="transition-all duration-200">
							<CharacterCard
								name={c.name}
								age={c.age}
								img={c.webp_image_url_s3 || c.image_url_s3}
								gif={c.gif_url_s3}
								webp={c.animated_webp_url_s3}
								bio={c.bio}
								onClick={() => openCharacterChat(c)}
								showOptions={false}
								alignActionsSpread={true}
								likesCount={counts.likes}
								messageCount={counts.messages}
								onLike={() => handleLikeClick(id)}
								isLiked={isLiked}
								likeDisabled={isLiked || isLiking}
								onMediaError={() => handleCharacterMediaError(c)}
							/>
						</article>
					);
				})}
			</div>
		);
	};
	const handleLoadMore = () => {
		setVisibleCount((prev) => Math.min(prev + LOAD_MORE_COUNT, filteredCharacters.length));
	};

	return (
		<>
			<SEOHead
				title="HoneyLove — AI Characters & Virtual Companions"
				description="Chat with AI companions on HoneyLove. Create custom characters, enjoy personalized conversations, and discover virtual companions tailored to you."
				keywords="AI companion, AI characters, virtual companion, custom AI character, artificial intelligence chat"
				canonical="/"
			/>
			<main className={`min-h-screen flex flex-col ${isDark ? 'bg-[#000000] text-white' : 'bg-gray-50 text-gray-900'}`}>
				<div className="container mx-auto px-0 md:px-4 py-4 md:py-8 max-w-330 grow">
					<header className="mb-4 md:mb-8">
						<div className="flex flex-col gap-4 md:gap-8">
							<div className="text-center hidden md:block">
								<h1 className={`text-3xl md:text-4xl font-bold mb-3 leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
									<span className="text-(--hl-gold)">HoneyLove</span> Characters
								</h1>
								<p className={`text-base md:text-lg max-w-3xl mx-auto ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
									Our AI girlfriend bot expert, guys emotionally incline, and uniquely trained to understand you.
								</p>
							</div>

							<div className="md:flex md:flex-row md:items-center md:gap-4">
								{/* Section header and filter pills removed from here — they are now managed in AppLayout for better persistence and layout control */}
							</div>
						</div>
					</header>

					{loading && (
						<LoadingSpinner
							size="lg"
							text="Loading your perfect AI companions..."
						/>
					)}

					{error && (
						<div className="text-center text-red-400">Error loading characters: {error}</div>
					)}

					{!loading && !error && characters.length === 0 && (
						<div className={`text-center ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
							No characters found.
						</div>
					)}

					{!loading && !error && filteredCharacters.length > 0 && (
						<>
							{(() => {
								if (useVirtualScrolling) {
									return (
										<>
											<VirtualScroll
												items={rows}
												itemHeight={560} // Updated for 376:519 card ratio plus row spacing
												containerHeight={800} // Height of the scrollable container
												renderItem={renderRow}
												className="w-full"
												overscan={3}
											/>
											{filteredCharacters.length > limitedCharacters.length && (
												<div className="mt-6 flex justify-center">
													<LoadMoreButton onClick={handleLoadMore} />
												</div>
											)}
										</>
									);
								}
								return (
									<>
										<div
											className="grid gap-3 md:gap-6 lg:gap-8 px-4 md:px-0"
											style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
										>
											{limitedCharacters.map((c) => {
												const id = getCharacterId(c);
												const counts = countsMap[id] || { likes: 0, messages: 0 };
												const isLiked = !!likeStatusMap[id];
												const isLiking = !!likingMap[id];
												return (
													<article
														key={id || c.id}
														className="transition-all duration-200"
													>
														<CharacterCard
															name={c.name}
															age={c.age}
															img={c.webp_image_url_s3 || c.image_url_s3}
															gif={c.gif_url_s3}
															webp={c.animated_webp_url_s3}
															bio={c.bio}
															onClick={() => openCharacterChat(c)}
															showOptions={false}
															alignActionsSpread={true}
															likesCount={counts.likes}
															messageCount={counts.messages}
															onLike={() => handleLikeClick(id)}
															isLiked={isLiked}
															likeDisabled={isLiked || isLiking}
															onMediaError={() => handleCharacterMediaError(c)}
														/>
													</article>
												);
											})}
										</div>
										{/* Load More button */}
										{filteredCharacters.length > limitedCharacters.length && (
											<div className="mt-6 flex justify-center">
												<LoadMoreButton onClick={handleLoadMore} />
											</div>
										)}
									</>
								);
							})()}
						</>
					)}
				</div>

				{/* Full-width footer (spans edge-to-edge) */}
				<footer className="w-full mt-auto bg-linear-to-r from-[#2b1a0f] to-[#1a1209] text-gray-100">
					<div className="max-w-330 mx-auto px-4 py-12">
						<div className="grid grid-cols-1 md:grid-cols-4 gap-8">
							<div>
								<div className="flex items-center gap-3 mb-4">
									<div className="w-10 h-10 rounded-md bg-(--hl-gold) flex items-center justify-center font-bold text-(--hl-black)">hl</div>
									<span className="text-xl font-semibold">honey love</span>
								</div>
								<p className="text-sm text-white/70">Chat with AI companions tailored to your preferences. Create custom characters and enjoy personalized conversations.</p>
							</div>
							{/*
							<div>
								<h4 className="font-semibold mb-3">Features</h4>
								<ul className="text-sm space-y-2 text-white/80">
									<li>Cum Facial Generator</li>
									<li>AI Chatbot</li>
									<li>NSFW Image Generator</li>
									<li>Create Custom Characters</li>
								</ul>
							</div>
							*/}
							<div>
								<h4 className="font-semibold mb-3">Resources</h4>
								<ul className="text-sm space-y-2 text-white/80">
									{/* <li>About</li> */}
									{/* <li>Press & announcements</li> */}
									<li>Contact us</li>
									<li>Terms of use</li>
								</ul>
							</div>
							<div>
								<h4 className="font-semibold mb-3">Social Media</h4>
								<ul className="text-sm space-y-2 text-white/80">
									<li>Homey Love AI on Instagram</li>
									<li>Homey Love AI on Facebook</li>
									<li>Homey Love AI on Twitter</li>
								</ul>
							</div>
						</div>
						<div className="border-t border-white/10 mt-8 pt-6 text-sm text-white/70 flex flex-col md:flex-row justify-between items-center gap-4">
							<div>© All rights reserved.</div>
							<div>Terms &amp; Condition · Refund Policy · Privacy Policy</div>
						</div>
					</div>
				</footer>
			</main>
		</>
	);
}
