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
  variant?: 'premium' | 'buyToken' | 'support';
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
  const isPremium = variant === 'premium';
  const isBuyToken = variant === 'buyToken';
  const isSupport = variant === 'support';
  const isSpecial = isPremium || isBuyToken;

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

  const resolvedLabel = displayLabel || label;

  const liClassName = sidebarCollapsed
    ? 'px-2.5'
    : isSpecial
      ? 'px-5'
      : '';

  const heightClass = sidebarCollapsed
    ? 'h-12'
    : isSupport
      ? 'h-[54px]'
    : isSpecial
        ? 'h-[62px]'
        : 'h-[54px]';

  const shapeClass = sidebarCollapsed
    ? 'rounded-[18px]'
    : isSpecial
      ? 'rounded-full'
      : isSupport || active
        ? 'rounded-none'
        : 'rounded-[18px]';

  const contentPaddingClass = sidebarCollapsed
    ? 'justify-center px-0'
    : isSpecial
      ? 'justify-start px-6'
      : active
        ? 'justify-start pl-[26px] pr-[20px]'
        : 'justify-start pl-[30px] pr-[20px]';

  let toneClassName = '';
  let buttonStyle: React.CSSProperties | undefined;

  if (isBuyToken) {
    toneClassName = 'text-[#1C1408]';
    buttonStyle = {
      background: 'linear-gradient(90deg, #F3B94A 0%, #FFD166 100%)',
      boxShadow: active
        ? '0 14px 34px rgba(243, 185, 74, 0.30)'
        : '0 10px 24px rgba(243, 185, 74, 0.22)',
    };
  } else if (isPremium) {
    toneClassName = 'text-white';
    buttonStyle = {
      background: 'linear-gradient(90deg, #F2709C 0%, #FF9472 100%)',
      boxShadow: active
        ? '0 14px 34px rgba(242, 112, 156, 0.34)'
        : '0 10px 24px rgba(242, 112, 156, 0.22)',
    };
  } else if (active) {
    toneClassName = 'text-white';
    buttonStyle = {
      background: '#7F5AF0',
      borderLeft: '4px solid #FFFFFF',
    };
  } else if (isSupport) {
    toneClassName = isDark
      ? 'text-white/92 hover:bg-white/[0.03] hover:text-white'
      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900';
  } else {
    toneClassName = isDark
      ? 'text-white/78 hover:bg-white/6 hover:text-white'
      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900';
  }

  const buttonClassName = [
    'relative group flex w-full items-center gap-[10px] overflow-hidden transition-all duration-200 focus:outline-none theme-transition',
    heightClass,
    shapeClass,
    contentPaddingClass,
    toneClassName,
    active && isSpecial ? 'ring-1 ring-white/20' : '',
  ].filter(Boolean).join(' ');

  const iconClassName = [
    'grid h-6 w-6 shrink-0 place-items-center transition-colors duration-200',
    isBuyToken
      ? 'text-[#1C1408]'
      : isPremium
        ? 'text-white'
        : active && !isSupport && !sidebarCollapsed
          ? 'text-[#15101F]'
          : active
            ? 'text-white'
            : isSupport
              ? (isDark ? 'text-white/82 group-hover:text-white' : 'text-slate-500 group-hover:text-slate-900')
              : (isDark ? 'text-white/78 group-hover:text-white' : 'text-slate-500 group-hover:text-slate-900'),
  ].join(' ');

  const labelClassName = [
    'min-w-0 flex-1 truncate text-left leading-[28px]',
    isSpecial ? 'text-[17px] font-semibold' : 'text-[20px] font-medium',
    isBuyToken
      ? 'text-[#1C1408]'
      : isPremium
        ? 'text-white'
        : active
          ? 'text-white'
          : isSupport
            ? (isDark ? 'text-white/92 group-hover:text-white' : 'text-slate-800 group-hover:text-slate-900')
            : (isDark ? 'text-white group-hover:text-white' : 'text-slate-800 group-hover:text-slate-900'),
  ].join(' ');

  const labelStyle = isSpecial
    ? undefined
    : ({ fontFamily: '"Plus Jakarta Sans", sans-serif' } as React.CSSProperties);

  return (
    <li className={liClassName}>
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
        className={buttonClassName}
        style={buttonStyle}
      >
        <span className={iconClassName}>
          {icon}
        </span>

        {!sidebarCollapsed && (
          <span className={labelClassName} style={labelStyle}>
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
