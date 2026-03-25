import React from "react";

export const User: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path fill="currentColor" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    <path fill="currentColor" d="M4 20c0-3.3 4-6 8-6s8 2.7 8 6v1H4v-1z" opacity="0.95" />
  </svg>
);
