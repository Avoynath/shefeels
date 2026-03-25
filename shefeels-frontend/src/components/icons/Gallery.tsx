import React from "react";

export const Gallery: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
	<svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
		<rect x="2" y="4" width="20" height="16" rx="2" fill="currentColor" />
		<circle cx="8" cy="10" r="2.2" fill="white" />
		<path d="M4 18l5-6 4 5 7-8v7H4z" fill="white" />
	</svg>
);
