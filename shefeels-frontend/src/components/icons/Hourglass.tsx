import React from "react";

export const Hourglass: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
	<svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
		<path d="M7 3h10v3a5 5 0 0 1-2 4 5 5 0 0 1 2 4v3H7v-3a5 5 0 0 1 2-4 5 5 0 0 1-2-4V3z" fill="none" stroke="currentColor" strokeWidth="1.6"/>
		<path d="M9 6h6M9 18h6" stroke="currentColor" strokeWidth="1.6"/>
	</svg>
);
