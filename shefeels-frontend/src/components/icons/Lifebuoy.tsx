import React from "react";

export const Lifebuoy: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path fill="currentColor" d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />
    <path fill="currentColor" d="M5 5l3 3M19 5l-3 3M5 19l3-3M19 19l-3-3" opacity=".9" />
  </svg>
);
