import React from "react";

export const Link: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
	<svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
		<path fill="currentColor" d="M10.6 13.4a3 3 0 0 1 0-4.2l2-2a3 3 0 0 1 4.2 4.2l-2 2a3 3 0 0 1-4.2 0z" />
		<path fill="currentColor" d="M6 18a4 4 0 0 1 0-5.6l2-2" opacity=".95" />
	</svg>
);
