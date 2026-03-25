import React from "react";

export const Gamepad: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
	<svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
		<rect x="2" y="6" width="20" height="12" rx="3" fill="currentColor" />
		<circle cx="8" cy="12" r="1.2" fill="white" />
		<path d="M16 11v2M17 12h-2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);
