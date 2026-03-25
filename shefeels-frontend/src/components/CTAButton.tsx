import React from 'react';
import chatNowIcon from '../assets/home/ChatNowIcon.svg';
import prefetchRoute from '../utils/prefetchRoute';

type Props = {
  children: React.ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
  centerText?: boolean;
  prefetchPath?: string;
};

const CTAButton: React.FC<Props> = ({ children, onClick, ariaLabel, className, centerText = false, prefetchPath = '/chat' }) => {
  // When `centerText` is true we render the icon as a fixed element on the left
  // and center the label within the button. This keeps the icon visually anchored
  // while the label is always centered (useful for narrow fixed-width CTAs).
    if (centerText) {
    return (
      <button
        onClick={onClick}
        onMouseEnter={() => prefetchRoute(prefetchPath)}
        aria-label={ariaLabel}
        className={`relative inline-flex items-center justify-center whitespace-nowrap rounded-full px-6 py-3.5 text-base font-semibold text-zinc-900 transition-all h-8 sm:h-auto sm:text-base min-w-40 ${className || ''}`}
        style={{ background: 'var(--primary-gradient)', boxShadow: '0 12px 40px rgba(246,185,75,.16)' }}
      >
        <span className="absolute left-4 inline-grid h-6 w-6 place-items-center text-lg pointer-events-none">
          <img src={chatNowIcon} alt="" className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-center block w-full px-2">{children}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => prefetchRoute(prefetchPath)}
      aria-label={ariaLabel}
      // Prevent the button label from wrapping to a second line. Ensure flex doesn't wrap
      // and the icon does not shrink so the label stays on a single row.
      className={
        `relative inline-flex items-center flex-nowrap whitespace-nowrap gap-0 rounded-full 
         px-6 py-3.5 text-base font-semibold text-zinc-900 
         transition-all 
         h-8 sm:h-auto         /* 🔹 mobile height fix only */ sm:text-base       /* 🔹 optional: smaller text on mobile */
         ` + (className || '')
      }
      style={{ background: 'var(--primary-gradient)', boxShadow: '0 12px 40px rgba(246,185,75,.16)' }}
    >
      <span className="inline-grid h-6 w-8 place-items-center text-lg shrink-0">
        <img src={chatNowIcon} alt="" className="h-4 w-4" aria-hidden />
      </span>
      <span className="whitespace-nowrap">{children}</span>
    </button>
  );
};

export default CTAButton;
