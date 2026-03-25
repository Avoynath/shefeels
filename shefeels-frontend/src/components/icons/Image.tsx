import React from "react";

export const Image: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><rect x="3" y="5" width="18" height="14" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.6"/><circle cx="9" cy="11" r="2" fill="currentColor"/><path d="M21 17l-6-5-6 6" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg>
);
