import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import SideItem from "./SideItem";

// Iconsax Imports
import {
	HambergerMenu, 
	ArrowRight2 
} from 'iconsax-react';

import exploreIcon from '../assets/sidebar/figma/explore.svg';
import createIcon from '../assets/sidebar/figma/create.svg';
import generateIcon from '../assets/sidebar/figma/generate.svg';
import chatIcon from '../assets/sidebar/figma/chat.svg';
import myAiIcon from '../assets/sidebar/figma/my-ai.svg';
import galleryIcon from '../assets/sidebar/figma/gallery.svg';
import helpCenterIcon from '../assets/sidebar/figma/help-center.svg';
import contactUsIcon from '../assets/sidebar/figma/contact-us.svg';
import discordIcon from '../assets/sidebar/figma/discord.svg';

type Props = {
	sidebarOpen: boolean;
	sidebarCollapsed: boolean;
	setSidebarCollapsed: (v: React.SetStateAction<boolean>) => void;
	setSidebarOpen: (v: React.SetStateAction<boolean>) => void;
	selectedItem: string;
	setSelectedItem: (item: string) => void;
};

export const Sidebar: React.FC<Props> = ({ sidebarOpen, sidebarCollapsed, setSidebarCollapsed, setSidebarOpen, selectedItem, setSelectedItem }) => {
	const expandedSidebarWidth = 220;
	const navigate = useNavigate();
	const location = useLocation();
	const { theme } = useTheme();
	const mobileCloseRef = React.useRef<HTMLButtonElement | null>(null);
	const isDark = theme === "dark";

	React.useEffect(() => {
		if (sidebarOpen) {
			try { mobileCloseRef.current?.focus(); } catch {}
		}
	}, [sidebarOpen]);

	function getPathForLabel(label: string) {
		switch (label) {
			case "Explore": return "/";
			case "Create Character": return "/create-character";
			case "Generate Image": return "/generate-image";
			case "Chat": return "/chat";
			case "My AI": return "/my-ai";
			case "Gallery": return "/gallery";
			case "Buy Token": return "/buy-tokens";
			case "Help Center": return "/help-center";
			case "Contact Us": return "/contact-center";
			case "Discord": return "#";
			default: return undefined;
		}
	}

	function getLabelForPath(path: string) {
		switch (path) {
			case "/":
			case "/ai-girlfriend":
			case "/ai-boyfriend":
			case "/ai-transgender":
				return "Explore";
			case "/create-character": return "Create Character";
			case "/generate-image": return "Generate Image";
			case "/chat": return "Chat";
			case "/my-ai": return "My AI";
			case "/gallery": return "Gallery";
			case "/buy-tokens": return "Buy Token";
			case "/help-center": return "Help Center";
			case "/contact-center": return "Contact Us";
			default: return undefined;
		}
	}

	React.useEffect(() => {
		const label = getLabelForPath(location.pathname);
		if (label) setSelectedItem(label);
	}, [location.pathname, setSelectedItem]);

	function handleItemClick(label: string) {
		setSelectedItem(label);
		const path = getPathForLabel(label);
		if (path) {
			navigate(path);
			try { if (sidebarOpen) setSidebarOpen(false); } catch {}
		}
	}

	const getIcon = (src: string, alt: string) => (
		<img src={src} alt={alt} className="block h-[22px] w-[22px] shrink-0 object-contain" />
	);

	const sidebarItems = [
		{ label: "Explore", icon: getIcon(exploreIcon, "Explore") },
		{ label: "Create Character", displayLabel: "Create", icon: getIcon(createIcon, "Create") },
		{ label: "Generate Image", displayLabel: "Generate", icon: getIcon(generateIcon, "Generate") },
		{ label: "Chat", icon: getIcon(chatIcon, "Chat") },
		{ label: "My AI", icon: getIcon(myAiIcon, "My AI") },
		{ label: "Gallery", icon: getIcon(galleryIcon, "Gallery") },
		{ label: "Help Center", icon: getIcon(helpCenterIcon, "Help Center") },
		{ label: "Contact Us", icon: getIcon(contactUsIcon, "Contact Us") },
		{ label: "Discord", icon: getIcon(discordIcon, "Discord") },
	];

	const shellStyle: React.CSSProperties = isDark
		? {
			borderRadius: "0 30px 0 0",
			borderRight: "1px solid #7F5AF0",
			backgroundColor: "#09070E",
			backgroundImage: "radial-gradient(271.02% 117% at 50% 22.76%, rgba(149, 113, 255, 0.80) 0%, rgba(0, 0, 0, 0.80) 29.22%, rgba(0, 0, 0, 0.80) 54.88%, rgba(229, 49, 112, 0.80) 100%)",
			boxShadow: "18px 0 46px rgba(0, 0, 0, 0.24)",
		}
		: {
			borderRadius: "0 30px 0 0",
			borderRight: "1px solid rgba(226, 232, 240, 1)",
			backgroundColor: "#FFFFFF",
			boxShadow: "10px 0 24px rgba(15, 23, 42, 0.08)",
		};

	const renderSidebarItems = (collapsed: boolean) => sidebarItems.map((item) => (
		<SideItem
			key={item.label}
			icon={item.icon}
			label={item.label}
			displayLabel={item.displayLabel}
			active={selectedItem === item.label}
			sidebarCollapsed={collapsed}
			onClick={() => handleItemClick(item.label)}
		/>
	));
	
	return (
		<>
			{/* Mobile Overlay */}
			<div 
				className={`md:hidden transition-opacity duration-300 ${sidebarOpen ? 'fixed inset-0 z-[55] bg-black/60 opacity-100 backdrop-blur-[2px]' : 'pointer-events-none fixed inset-0 opacity-0'}`}
				onClick={() => setSidebarOpen(false)}
			/>

			{/* Mobile Drawer */}
			<div
				className={`md:hidden fixed top-0 left-0 bottom-0 z-[60] w-full transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
				style={{ width: `min(${expandedSidebarWidth}px, 85vw)`, height: '100dvh' }}
				role="dialog"
				aria-modal={sidebarOpen}
				onKeyDown={(e) => e.key === 'Escape' && setSidebarOpen(false)}
			>
				<div style={{ ...shellStyle, minHeight: '100dvh' }} className="flex h-full w-full flex-col overflow-hidden theme-transition">
					<div className="px-0 pt-5">
						<div className={`mx-0 flex h-[54px] items-center justify-between border-b px-[30px] ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
							<div className="flex items-center gap-4">
								<HambergerMenu size="22" color="currentColor" className={isDark ? "text-white/82" : "text-slate-700"} />
								<span className={`text-[18px] font-semibold tracking-[-0.02em] ${isDark ? 'text-white' : 'text-slate-900'}`}>Menu</span>
							</div>
							<button
								ref={mobileCloseRef}
								onClick={() => setSidebarOpen(false)}
								aria-label="Close menu"
								className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${isDark ? 'text-white/78 hover:bg-white/8 hover:text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`}
							>
								<ArrowRight2 size="18" color="currentColor" />
							</button>
						</div>
					</div>

					<div className="flex min-h-0 flex-1 flex-col pt-4">
						<nav className="flex-1 overflow-y-auto no-scrollbar pb-4">
							<ul className="space-y-[6px]">
								{renderSidebarItems(false)}
							</ul>
						</nav>
					</div>
				</div>
			</div>

			{/* Desktop Sidebar */}
			<aside
				onDoubleClick={() => setSidebarCollapsed((v) => !v)}
				style={{ ...shellStyle, top: "var(--header-h)", height: "calc(100vh - var(--header-h))" } as React.CSSProperties}
				className={`hidden md:fixed md:left-0 md:z-50 md:block overflow-hidden transition-all duration-300 ease-in-out ${sidebarCollapsed ? "w-[72px]" : "w-[220px]"} theme-transition`}
			>
				<div className="flex h-full w-full flex-col">
					<div className="pt-5">
						<div className={`flex h-[54px] items-center border-b transition-all duration-300 ${isDark ? "border-white/10" : "border-slate-200"} ${sidebarCollapsed ? "justify-center px-0" : "justify-between px-[30px]"}`}>
							{!sidebarCollapsed && (
								<div className="flex items-center gap-4">
									<HambergerMenu size="22" color="currentColor" className={isDark ? "text-white/82" : "text-slate-700"} />
									<span className={`text-[18px] font-semibold tracking-[-0.02em] ${isDark ? "text-white" : "text-slate-900"}`}>Menu</span>
								</div>
							)}
							<button
								onClick={() => setSidebarCollapsed((v) => !v)}
								aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
								className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${isDark ? "text-white/78 hover:bg-white/8 hover:text-white" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"}`}
							>
								<ArrowRight2 size="18" color="currentColor" className={`transition-transform duration-300 ${sidebarCollapsed ? "" : "rotate-180"}`} />
							</button>
						</div>
					</div>

					<div className="flex min-h-0 flex-1 flex-col pt-4">
						<nav className="flex-1 overflow-y-auto no-scrollbar pb-4">
							<ul className="space-y-[6px]">
								{renderSidebarItems(sidebarCollapsed)}
							</ul>
						</nav>
					</div>
				</div>
			</aside>
		</>
	);
};

export default Sidebar;
