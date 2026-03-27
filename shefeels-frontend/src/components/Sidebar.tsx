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
	const expandedSidebarWidth = 240;
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
				className={`md:hidden fixed top-0 left-0 bottom-0 z-[60] w-64 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
				style={{ height: '100dvh' }}
				role="dialog"
				aria-modal={sidebarOpen}
				onKeyDown={(e) => e.key === 'Escape' && setSidebarOpen(false)}
			>
				<div style={{ ...shellStyle, minHeight: '100dvh' }} className="flex h-full w-full flex-col overflow-hidden theme-transition">
					<div className="px-4 pt-5 pb-4">
						<div className={`flex items-center justify-between gap-3 mb-4`}>
							<div className="flex items-center gap-3">
								<HambergerMenu size="20" color="currentColor" className={isDark ? "text-white/82" : "text-slate-700"} />
								<span className={`text-base font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Menu</span>
							</div>
							<button
								ref={mobileCloseRef}
								onClick={() => setSidebarOpen(false)}
								aria-label="Close menu"
								className={`grid h-9 w-9 place-items-center rounded-md ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
							>
								<ArrowRight2 size="16" color="currentColor" className={isDark ? 'text-white/78' : 'text-slate-700'} />
							</button>
						</div>
					</div>

					<div className="flex min-h-0 flex-1 flex-col">
						<nav className="flex-1 overflow-y-auto no-scrollbar px-3 pb-4">
							<ul className="space-y-1">
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
				className={`hidden md:fixed md:left-0 md:z-50 md:block overflow-hidden transition-all duration-300 ease-in-out ${sidebarCollapsed ? "w-16" : "w-60"} theme-transition`}
			>
				<div className={`flex h-full w-full flex-col transition-all duration-300 py-2 ${sidebarCollapsed ? "px-2.5" : "px-3"}`}>
					<div className={`mb-2 flex items-center h-12 ${sidebarCollapsed ? "justify-center px-0" : "justify-between px-2"}`}>
						{!sidebarCollapsed && (
							<div className="flex items-center gap-3">
								<HambergerMenu size="20" color="currentColor" className={isDark ? "text-white/82" : "text-slate-700"} />
								<span className={`text-base font-medium ${isDark ? "text-white" : "text-slate-900"}`}>Menu</span>
							</div>
						)}
						<button onClick={() => setSidebarCollapsed((v) => !v)} className={`grid h-9 w-9 place-items-center rounded-md ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}>
							<ArrowRight2 size="16" color="currentColor" className={`transition-transform duration-300 ${sidebarCollapsed ? "" : "rotate-180"} ${isDark ? 'text-white/78' : 'text-slate-700'}`} />
						</button>
					</div>

					<nav className="flex-1 overflow-y-auto no-scrollbar">
						<ul className={`space-y-1 py-1 ${sidebarCollapsed ? "px-0" : "px-1"}`}>
							{renderSidebarItems(sidebarCollapsed)}
						</ul>
						<div className={`my-3 border-t ${isDark ? "border-[#815CF0]/22" : "border-[#815CF0]/14"}`} />
					</nav>
				</div>
			</aside>
		</>
	);
};

export default Sidebar;
