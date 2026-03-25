import React from "react";

export const Compass: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.6 6.3l-3.8 1.3-1.3 3.8 3.8-1.3 1.3-3.8z" />
    <path fill="currentColor" opacity=".9" d="M11.2 14.3l-1.1-3.3 3.3-1.1 1.1 3.3-3.3 1.1z" />
  </svg>
);
