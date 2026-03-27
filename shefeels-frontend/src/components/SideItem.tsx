import React from "react";
import { useTheme } from "../contexts/ThemeContext";
import CollapsedTooltip from './CollapsedTooltip';
import prefetchRoute from '../utils/prefetchRoute';

type Props = {
  icon: React.ReactNode;
  label: string;
  displayLabel?: string;
  active?: boolean;
  pill?: boolean;
  sidebarCollapsed?: boolean;
  onClick?: () => void;
  // Optional visual variant for special button styles
  variant?: 'premium' | 'buyToken';
};

export const SideItem: React.FC<Props> = ({
  icon,
  label,
  displayLabel,
  active,
  pill,
  sidebarCollapsed,
  onClick,
  variant,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [hovered, setHovered] = React.useState(false);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);
  const ref = React.useRef<HTMLButtonElement | null>(null);

  const resolvedLabel = displayLabel || label;

  const routeMap: Record<string, string> = {
    'Explore': '/',
    'Create Character': '/create-character',
    'Generate Image': '/generate-image',
    'Profile': '/profile',
    'Chat': '/chat',
    'My AI': '/my-ai',
    'Gallery': '/gallery',
    'Help Center': '/help-center',
    'Contact Us': '/contact-center',
    'Buy Token': '/buy-tokens',
    'Get Premium': '/premium',
  };

  return (
    <li>
      <button
        ref={ref}
        onMouseEnter={() => {
          setHovered(true);
          try { setAnchorRect(ref.current?.getBoundingClientRect() ?? null); } catch {}
          try {
            const route = routeMap[label];
            if (route) prefetchRoute(route);
          } catch {}
        }}
        onMouseLeave={() => setHovered(false)}
        onClick={onClick}
        className={`relative group w-full h-10 flex items-center ${
          sidebarCollapsed ? "justify-center px-2" : "justify-start px-4"
        } gap-3 rounded-[50px] transition-colors duration-200 focus:outline-none theme-transition ${
          variant === 'premium'
            ? 'text-white font-medium'
            : variant === 'buyToken'
              ? 'text-white font-medium bg-(--sf-purple)'
              : (
                active
                  ? "bg-[#7F5AF0] text-white font-medium"
                  : (isDark
                      ? "text-white/70 hover:text-white/80 hover:bg-[#404040] bg-transparent"
                      : "text-gray-700 hover:text-gray-600 hover:bg-gray-100 bg-transparent"
                    )
              )
        }`}
        style={variant === 'premium' ? {
          borderRadius: 50,
          background: 'linear-gradient(90deg, #F2709C 0%, #FF9472 100%)',
          boxShadow: '0 6px 20px 0 rgba(245, 120, 146, 0.30)'
        } : variant === 'buyToken' ? { borderRadius: 50, background: 'var(--sf-purple)' } : undefined}
      >
        <span
          className={`grid place-items-center h-5 w-5 shrink-0 transition-all duration-200 ${
            active 
              ? "text-white" 
                : (isDark 
                    ? "text-white/70 group-hover:text-white/80" 
                    : "text-gray-600 group-hover:text-gray-500"
                  )
          }`}
        >
          {icon}
        </span>

        {!sidebarCollapsed && (
          <span
              className={`text-sm font-medium leading-tight truncate ${
                    variant === 'premium'
                      ? 'text-white'
                      : variant === 'buyToken'
                        ? 'text-black'
                        : (
                          active 
                            ? "text-white" 
                            : (isDark 
                                ? "text-[var(--Primary-Color-25,_#FFF)] group-hover:text-white/80" 
                                : "text-gray-800 group-hover:text-gray-600"
                              )
                        )
                  }`}
          >
            {resolvedLabel}
          </span>
        )}

        {pill && !sidebarCollapsed && (
          <span className="ml-auto inline-flex items-center rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            Premium
          </span>
        )}

        {sidebarCollapsed && (
          <CollapsedTooltip visible={hovered} anchorRect={anchorRect} label={resolvedLabel} />
        )}
      </button>
    </li>
  );
};

export default SideItem;
