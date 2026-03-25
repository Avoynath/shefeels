import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import apiClient, { getErrorMessage } from "../utils/api";
import { buildApiUrl } from '../utils/apiBase';
import { useToastActions } from "../contexts/ToastContext";
import Modal from "../components/Modal";
import Button from "../components/Button";
import UnlockIcon from "../assets/private-content/UnLockIcon.svg";
import UnlockIconWhite from "../assets/private-content/UnlockIconWhite.svg";
import CoinIconSrc from "../assets/private-content/CoinIcon.svg";
import LikeIconSrc from "../assets/private-content/LikeIcon.svg";
import ImageIconSrc from "../assets/private-content/ImageIcon.svg";

type PrivateCardData = {
	id: string;
	creatorName: string;
	avatarUrl: string;
	imageUrl: string;
	titleLine1: string;
	titleLine2: string;
	description?: string;
	locked: boolean;
	priceTokens?: number;
	stats: {
		views: number;
		videos: number;
		tokens: number;
	};
};

type Pack = {
	id: string;
	name: string;
	price_tokens: number;
	num_videos: number;
	num_images: number;
	thumbnail_s3_path?: string;
	presigned_thumbnail_s3_path?: string;
	character_id?: string;
	created_by?: string;
	description?: string;
	access?: boolean;
	total_likes?: number;
};

// Back button icon is inlined in the markup below (uses project color variables)

// Removed inline Eye/Video icons; using asset SVGs per spec

// Using SVG asset from Figma spec instead of inline SVG

/* const LockIcon = ({
	className = "w-5 h-5",
	color = "currentColor",
}: {
	className?: string;
	color?: string;
}) => (
	<svg
		className={className}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<rect x="5" y="11" width="14" height="9" rx="2" />
		<path d="M8 11V8a4 4 0 118 0v3" />
	</svg>
); */



// clamp helper for 2-line truncation
const clampTwoLines: React.CSSProperties = {
	display: "-webkit-box",
	WebkitLineClamp: 2,
	WebkitBoxOrient: "vertical" as const,
	overflow: "hidden",
};

// ─────────────────────────────────────────
// Media block (image card area)
// ─────────────────────────────────────────
function MediaBlock({
	imageUrl,
	creatorName,
	titleLine1: _titleLine1,
	titleLine2: _titleLine2,
	description,
	locked,
	priceTokens,
	onUnlock,
	isUnlocking = false,
}: {
	imageUrl: string;
	creatorName: string;
	titleLine1: string;
	titleLine2: string;
	description?: string;
	locked: boolean;
	priceTokens?: number;
	onUnlock?: () => void;
	isUnlocking?: boolean;
}) {
	// Per design: show a short image_description text.
	// Use backend-provided description with sensible fallbacks.
	const imageDescription = description?.trim() || _titleLine2?.trim() || "Unlock exclusive pack previews.";
	return (
		<div
			className="relative w-full overflow-hidden rounded-[10px] border border-white/5 bg-black"
			style={{
				// maintain ~319x400 ratio from Figma → 400/319 ≈ 1.25
				paddingBottom: "125%",
			}}
		>
			{/* base image */}
			<img
				src={imageUrl}
				alt={locked ? "" : `${creatorName} preview`}
				className={
					"absolute inset-0 h-full w-full object-cover transition-transform duration-200 ease-linear " +
					(locked ? "scale-[1.02] blur-[6px]" : "")
				}
			/>

			{locked ? (
				<>
					{/* frosted dark veil */}
					<div
						className="absolute inset-0 rounded-[10px]"
						style={{
							background: "rgba(0,0,0,0.5)",
							backdropFilter: "blur(10px)",
							WebkitBackdropFilter: "blur(10px)",
						}}
					/>

					{/* price badge top-right (Figma) */}
					{typeof priceTokens === "number" && (
						<div className="absolute right-3 top-3 z-20 flex items-center gap-1 text-[13px] font-medium text-(--hl-gold-strong)-shadow">
							<img
								src={CoinIconSrc}
								alt=""
								className="w-[16px] h-[16px] aspect-square"
								aria-hidden="true"
							/>
							<span className="text-[13px] font-medium text-(--hl-gold-strong)">
								{priceTokens} Tokens
							</span>
						</div>
					)}

					{/* centered unlock icon overlay (Figma) */}
					{locked && (
						<div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
							<img
								src={UnlockIconWhite}
								alt=""
								aria-hidden="true"
								className="w-[40px] h-[40px] aspect-square -translate-y-[28px]"
							/>
						</div>
					)}

					{/* bottom overlay region */}
					<div className="absolute inset-x-0 bottom-0 p-3">
						{/* black gradient up */}
						<div
							className="pointer-events-none absolute inset-0"
							style={{
								background:
									"linear-gradient(180deg, rgba(0,0,0,0.00) -6.88%, var(--hl-black) 100%)",
							}}
						/>

						<div className="relative z-10 flex flex-col items-center text-center gap-3">
							{/* lock pill */}
							{/* <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 shadow-[0_8px_24px_rgba(0,0,0,0.8)]">
								<LockIcon className="h-5 w-5" color="#FFFFFF" />
							</div> */}

							{/* image_description (locked) - rendered above Unlock */}
							<div
								className="text-[12px] font-normal leading-[1.4] text-(--white)"
								style={clampTwoLines}
							>
								{imageDescription}
							</div>

							{/* unlock CTA */}
							<button
								type="button"
								onClick={onUnlock}
								disabled={isUnlocking}
								aria-label={`Unlock for ${priceTokens ?? 0} tokens`}
								className="focus:outline-none focus-visible:ring-2 focus-visible:ring-(--hl-ring)"
								style={{
									display: "flex",
									height: "35px",
									padding: "10px 10px", // top right bottom left
									justifyContent: "center",
									alignItems: "center",
									gap: "8px",
									flexShrink: 0,
									alignSelf: "stretch",
									borderRadius: "60px",
									border: "1px solid rgba(255,255,255,0.5)",
									background: isUnlocking ? "rgba(255,255,255,0.2)" : "var(--primary-gradient)",
									color: isUnlocking ? "rgba(255,255,255,0.5)" : "var(--hl-black)",
									fontWeight: 600,
									fontSize: "14px",
									boxShadow: "0 6px 20px rgba(255,198,74,0.35)",
									cursor: isUnlocking ? "not-allowed" : "pointer",
									opacity: isUnlocking ? 0.7 : 1,
								}}
							>
								<img src={UnlockIcon} alt="unlock" className="h-5 w-5" />
								<span>{isUnlocking ? "Unlocking..." : "Unlock"}</span>
							</button>
						</div>
						{/* stats removed from image overlay - rendered outside image by parent card */}
					</div>
				</>
			) : (
				// unlocked card
				<div className="absolute inset-x-0 bottom-0 p-3">
					<div
						className="pointer-events-none absolute inset-0"
						style={{
							background:
								"linear-gradient(180deg, rgba(0,0,0,0.00) -6.88%, var(--hl-black) 100%)",
						}}
					/>
					<div className="relative z-10 flex flex-col text-left gap-2">
						{/* image_description (unlocked) - rendered at bottom of image */}
						<div
							className="text-[12px] font-normal leading-[1.4] text-(--white)"
							style={clampTwoLines}
						>
							{imageDescription}
						</div>
						{/* stats removed from image overlay - rendered outside image by parent card */}
					</div>
				</div>
			)}
		</div>
	);
}

// ─────────────────────────────────────────
// One full card
// ─────────────────────────────────────────
function PrivateContentCard({
	data,
	onUnlock,
	isUnlocking = false,
}: {
	data: PrivateCardData;
	onUnlock?: (id: string) => void;
	isUnlocking?: boolean;
}) {
	const {
		avatarUrl,
		creatorName,
		imageUrl,
		titleLine1,
		titleLine2,
		locked,
		priceTokens,
		stats,
		description,
	} = data;

	return (
		<div
			className="
				flex h-full w-full flex-col
				rounded-[10px]
				border border-[rgba(255,255,255,0.16)]
				bg-[rgba(255,255,255,0.08)]
				shadow-[0_8px_24px_rgba(0,0,0,0.6)]
			"
			style={{
				padding: "10px 12px 12px 12px", // add bottom padding so icon row doesn't touch container edge
			}}
		>
			{/* header avatar + name */}
			<div className="mb-3 flex items-center gap-2	">
				<img
					src={avatarUrl}
					alt=""
					className="h-6 w-6 rounded-full ring-1 ring-white/60 object-cover"
				/>
				<div className="text-[13px] font-semibold leading-[1.4] text-[#FAFAFA]">
					{creatorName}
				</div>
			</div>

			{/* media / content */}
			<MediaBlock
				imageUrl={imageUrl}
				creatorName={creatorName}
				titleLine1={titleLine1}
				titleLine2={titleLine2}
				description={description}
				locked={locked}
				priceTokens={priceTokens}
				onUnlock={() => onUnlock?.(data.id)}
				isUnlocking={isUnlocking}
			/>			{/* stats row - align chat left, videos+images right (per Figma) */}
			<div className="mt-3 flex w-full items-center">
				{/* Left: Chat */}
				<div
					className="inline-flex items-center gap-2 text-[10px] leading-none text-[#FAFAFA]"
					style={{ borderRadius: "60px", background: "rgba(255,255,255,0.15)", padding: "5px 10px" }}
					aria-label={`Chat ${stats.views}`}
				>
					<img src={LikeIconSrc} alt="" className="w-[16px] h-[16px]" aria-hidden="true" />
					<span>{stats.views}</span>
				</div>

				{/* Right group: Image count only (video pill removed per spec) */}
				<div className="ml-auto flex items-center">
					<div
						className="inline-flex items-center gap-2 text-[10px] leading-none text-[#FAFAFA]"
						style={{ borderRadius: "60px", background: "rgba(255,255,255,0.15)", padding: "5px 10px" }}
						aria-label={`Images ${stats.tokens}`}
					>
						<img src={ImageIconSrc} alt="" className="w-[16px] h-[16px]" aria-hidden="true" />
						<span>{stats.tokens}</span>
					</div>
				</div>
			</div>
		</div>
	);
}

// Mocks removed


// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────
export default function PrivateContent() {
	const navigate = useNavigate();
	const { token, refreshProfile } = useAuth();
	const location = useLocation();
	const params = useParams<{ characterId?: string }>();
	// characterId may come from route param (/private-content/character/:characterId/packs)
	const routeCharId = params.characterId ?? null;
	// or from navigation state OR query string (backwards-compat)
	const navigationState = location.state as any;
	const locationStateCharId = navigationState?.characterId ?? null;
	const locationCharacter = navigationState?.character;
	const searchParams = new URLSearchParams(location.search);
	const queryCharId = searchParams.get('characterId');
	const characterId = routeCharId || locationStateCharId || queryCharId || null;

	const [packs, setPacks] = useState<Pack[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [characterMeta, setCharacterMeta] = useState<{ name?: string; avatarUrl?: string } | null>(null);
	const [unlocking, setUnlocking] = useState<string | null>(null);
	const [packToUnlock, setPackToUnlock] = useState<Pack | null>(null);
	const { showError } = useToastActions();

	const handleUnlockClick = (id: string) => {
		const pack = packs.find(p => p.id === id);
		if (pack) {
			setPackToUnlock(pack);
		}
	};

	const handleConfirmUnlock = async () => {
		if (unlocking || !packToUnlock) return;
		const id = packToUnlock.id;
		setPackToUnlock(null);

		// If user is not logged in, trigger auth modal via global event
		if (!token) {
			try { window.dispatchEvent(new CustomEvent('hl_trigger_auth_modal')); } catch { }
			return;
		}

		// Find the pack to get coin (price_tokens) and character_id
		const pack = packs.find(p => p.id === id);
		if (!pack) {
			console.error('Pack not found');
			try { showError('Failed to unlock pack', 'Pack not found. Please try again.'); } catch { }
			return;
		}

		// Get character_id - prefer the route/state characterId, fallback to pack's character_id
		const packCharacterId = characterId || pack.character_id || '';
		if (!packCharacterId) {
			console.error('Character ID not available');
			try { showError('Failed to unlock pack', 'Character information is missing. Please try again.'); } catch { }
			return;
		}

		setUnlocking(id);
		try {
			const response: any = await apiClient.post('/private-content/unlock-pack', {
				pack_id: id,
				coin: pack.price_tokens || 0,
				character_id: packCharacterId
			});

			// Check if the pack was successfully unlocked
			if (response?.is_pack_access === true) {
				// Update the pack's access status in the local state
				setPacks(prevPacks =>
					prevPacks.map(p =>
						p.id === id ? { ...p, access: true } : p
					)
				);
				// Optional: Show success message
				console.log('Pack unlocked successfully:', response.detail || 'Pack unlocked');
				refreshProfile();
			} else {
				console.error('Failed to unlock pack: access not granted');
				const detailMsg = response?.detail ?? 'Failed to unlock pack. Please try again.';
				try { showError('Failed to unlock pack', detailMsg); } catch { }
			}
		} catch (err: any) {
			console.error('Failed to unlock pack', err);
			try {
				const status = (err && typeof err.status === 'number') ? err.status : (err && (err as any).status) || 0;

				if (status >= 400 && status < 500) {
					const detail = err?.body?.detail ?? err?.body?.message ?? err?.detail ?? err?.message ?? getErrorMessage(err);
					showError('Failed to unlock pack', detail);
				} else if (status >= 500) {
					console.warn('unlock-pack: server error', status, err?.body ?? err);
					showError('Failed to unlock pack', 'Unable to process your request currently.');
				} else {
					showError('Failed to unlock pack', getErrorMessage(err));
				}
			} catch (e) {
				try { showError('Failed to unlock pack', getErrorMessage(err)); } catch { }
			}
		} finally {
			setUnlocking(null);
		}
	};

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			setLoading(true);
			setError(null);
			try {
				// If we don't have a character id, skip network call and use empty array (UI will show mocks)
				if (!characterId) {
					setPacks([]);
					return;
				}

				// Use the batch API which accepts a list of character_ids
				// Backend returns: [{ character_id: [pack, ...] }, ...]
				const data = await apiClient.getPacksForCharacters([characterId]);
				if (cancelled) return;

				// Extract packs from the response mapping
				let extractedPacks: Pack[] = [];
				if (Array.isArray(data)) {
					for (const mapping of data) {
						// Each mapping is { character_id: [pack, ...] }
						const packsForChar = mapping[characterId];
						if (Array.isArray(packsForChar)) {
							extractedPacks = packsForChar;
							break;
						}
					}
				}
				setPacks(extractedPacks);
			} catch (err: any) {
				console.error('Failed to fetch private content packs', err);
				if (!cancelled) setError(err?.message || 'Failed to load packs');
			} finally {
				if (!cancelled) setLoading(false);
			}
		};

		load();

		return () => {
			cancelled = true;
		};
	}, [token, characterId]);

	useEffect(() => {
		if (locationCharacter) {
			setCharacterMeta({
				name: locationCharacter.name || locationCharacter.username || '',
				avatarUrl:
					locationCharacter.presigned_image_url_s3 ||
					locationCharacter.webp_image_url_s3 ||
					locationCharacter.image_url_s3 ||
					locationCharacter.image_url ||
					locationCharacter.avatar ||
					'',
			});
			return;
		}

		if (!characterId) {
			setCharacterMeta(null);
			return;
		}

		let cancelled = false;
		(async () => {
			try {
				const resp = await apiClient.getCharacterById(characterId);
				if (cancelled) return;
				const characterData = (resp as any)?.character ?? resp;
				setCharacterMeta({
					name: characterData?.name || characterData?.username || '',
					avatarUrl:
						characterData?.presigned_image_url_s3 ||
						characterData?.webp_image_url_s3 ||
						characterData?.image_url_s3 ||
						characterData?.image_url ||
						characterData?.avatar ||
						'',
				});
			} catch (err) {
				if (!cancelled) setCharacterMeta(null);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [characterId, locationCharacter]);

	return (
		<div className="min-h-[calc(100vh-var(--header-h))] w-full bg-black text-white">
			{/* UPDATED PADDING (flush to sidebar/right on large screens):
			     - mobile: px-1 (4px)
			     - sm:     px-2 (8px)
			     - lg+:    px-0 (0px)
			*/}
			<div className="w-full px-1 sm:px-2 lg:px-0 xl:px-0 2xl:px-0 py-8 md:py-6 lg:py-3">
				{/* Header (back button + title) */}
				<div className="mb-6 flex items-center gap-3 md:mb-4">
					<button
						type="button"
						onClick={() => navigate(-1)}
						aria-label="Back"
						className="inline-flex h-10 w-10 items-center justify-center rounded-full p-0 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--hl-ring)"
					>
						{/* Inline BackButtonIcon.svg content so CSS variables can be used for fill. */}
						{/* The SVG contains its own rounded rect background so we avoid an extra outer bg — matches Figma. */}
						<svg
							className="h-8 w-8"
							viewBox="0 0 44 44"
							xmlns="http://www.w3.org/2000/svg"
							aria-hidden="true"
						>
							<rect width="44" height="44" rx="22" transform="matrix(0 -1 -1 0 44 44)" fill="white" fillOpacity="0.2" />
							<path
								fillRule="evenodd"
								clipRule="evenodd"
								d="M26.6997 30.5957C27.2388 30.0567 27.2388 29.1827 26.6997 28.6436L19.7283 21.6722C19.6332 21.5771 19.6332 21.4229 19.7283 21.3278L26.6997 14.3564C27.2388 13.8173 27.2388 12.9433 26.6997 12.4043C26.1607 11.8652 25.2867 11.8652 24.7476 12.4043L17.7762 19.3757C16.603 20.5489 16.603 22.4511 17.7762 23.6243L24.7476 30.5957C25.2867 31.1348 26.1607 31.1348 26.6997 30.5957Z"
								fill="var(--primary)"
							/>
						</svg>
					</button>

					<h1 className="text-[20px] font-semibold text-white md:text-[24px]">
						Private Content Packs
					</h1>
				</div>

				{/* Grid of cards - reduce gaps between cards */}
				<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-5">
					{loading && (
						<>
							{/* Industry-standard skeleton cards */}
							{Array.from({ length: 4 }).map((_, i) => (
								<div
									key={i}
									className="flex h-full w-full flex-col rounded-[10px] border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.08)] shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
									style={{ padding: "10px 12px 12px 12px" }}
								>
									{/* Header skeleton - avatar + name */}
									<div className="mb-3 flex items-center gap-2">
										<div className="h-6 w-6 rounded-full bg-white/10 animate-pulse" />
										<div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
									</div>
									{/* Image skeleton area */}
									<div
										className="relative w-full overflow-hidden rounded-[10px] border border-white/5 bg-black"
										style={{ paddingBottom: "125%" }}
									>
										<div className="absolute inset-0 bg-linear-to-r from-white/3 via-white/8 to-white/3 animate-pulse">
											<div
												className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent"
												style={{
													animation: 'shimmer 1.5s ease-in-out infinite',
													transform: 'translateX(-100%)',
												}}
											/>
										</div>
									</div>
									{/* Stats row skeleton */}
									<div className="mt-3 flex w-full items-center justify-between">
										<div className="h-6 w-16 rounded-full bg-white/10 animate-pulse" />
										<div className="h-6 w-16 rounded-full bg-white/10 animate-pulse" />
									</div>
								</div>
							))}
						</>
					)}

					{!loading && error && (
						<div className="col-span-1 text-center text-sm text-red-400">{error}</div>
					)}

					{!loading && !error && packs.length === 0 && (
						<div className="col-span-full pt-12 flex flex-col items-center justify-center text-center opacity-60">
							<div className="text-xl font-medium mb-2">No Private Content Found</div>
							<p className="text-sm">There are no media packs available for this character yet.</p>
						</div>
					)}

					{!loading && packs.length > 0 && packs.map((p) => {
					const imageUrl = p.presigned_thumbnail_s3_path
							|| (p.thumbnail_s3_path
								? (/^https?:\/\//i.test(p.thumbnail_s3_path) ? p.thumbnail_s3_path : buildApiUrl(p.thumbnail_s3_path))
								: '');
						const card: PrivateCardData = {
							id: p.id,
							// prefer the selected character meta for the header avatar
							creatorName: characterMeta?.name || p.name || 'Creator',
							avatarUrl: characterMeta?.avatarUrl || imageUrl || '',
							imageUrl: imageUrl || '',
							titleLine1: p.name,
							titleLine2: p.description || '',
							description: p.description || '',
							locked: !Boolean(p.access),
							priceTokens: p.price_tokens,
							stats: {
								views: p.total_likes ?? 0,
								videos: p.num_videos ?? 0,
								tokens: p.num_images ?? 0,
							},
						};

						// Only allow navigation if the pack is unlocked (access === true)
						const isLocked = !Boolean(p.access);

						return (
							<div
								key={p.id}
								className={isLocked ? "p-2" : "p-2 cursor-pointer"}
								role={isLocked ? undefined : "button"}
								tabIndex={isLocked ? undefined : 0}
								onClick={isLocked ? undefined : () => navigate(`/private-content/pack/${p.id}/media`, { state: { packId: p.id } })}
								onKeyDown={isLocked ? undefined : (e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										navigate(`/private-content/pack/${p.id}/media`, { state: { packId: p.id } });
									}
								}}
							>
								<PrivateContentCard key={p.id} data={card} onUnlock={handleUnlockClick} isUnlocking={unlocking === p.id} />
							</div>
						);
					})}
				</div>
			</div>

			<Modal open={!!packToUnlock} onClose={() => setPackToUnlock(null)}>
				<div className="flex flex-col items-center text-center">
					{(() => {
						const packImg = packToUnlock?.presigned_thumbnail_s3_path
							|| (packToUnlock?.thumbnail_s3_path
								? (/^https?:\/\//i.test(packToUnlock.thumbnail_s3_path) ? packToUnlock.thumbnail_s3_path : buildApiUrl(packToUnlock.thumbnail_s3_path))
								: '');
						const displayImg = characterMeta?.avatarUrl || packImg;

						if (!displayImg) return null;

						return (
							<div className="mb-4 rounded-full p-1 border border-[var(--hl-gold)]/30 bg-black/50 overflow-hidden ring-2 ring-white/5">
								<img
									src={displayImg}
									alt=""
									className="w-16 h-16 rounded-full object-cover"
								/>
							</div>
						);
					})()}
					
					<h2 className="text-xl font-bold text-white mb-2">Confirm Purchase</h2>
					<p className="text-gray-300 mb-6">
						You are about to unlock <span className="text-[var(--hl-gold)] font-medium">"{packToUnlock?.name}"</span>.
					</p>

					<div className="bg-white/5 rounded-xl p-4 mb-6 w-full max-w-sm border border-white/10">
						<div className="text-sm text-gray-400 mb-1">Total Cost</div>
						<div className="flex items-center justify-center gap-2 text-2xl font-bold text-[var(--hl-gold)]">
							<img src={CoinIconSrc} alt="" className="w-6 h-6" />
							{packToUnlock?.price_tokens} Tokens
						</div>
					</div>

					<p className="text-sm text-gray-500 mb-8 max-w-xs">
						These packs contain premium content. Please confirm that you want to spend your tokens.
					</p>

					<div className="flex gap-3 w-full max-w-sm">
						<Button
							variant="secondary"
							className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
							onClick={() => setPackToUnlock(null)}
						>
							Cancel
						</Button>
						<Button
							variant="primary"
							className="flex-1"
							onClick={handleConfirmUnlock}
						>
							Confirm & Unlock
						</Button>
					</div>
				</div>
			</Modal>
		</div>
	);
}
