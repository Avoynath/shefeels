import React from "react";

export const Globe: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
	<svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
		<path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4 6h-2.1a15 15 0 0 0-1.8-3.6A8 8 0 0 1 16 8zM8 8a8 8 0 0 1 3.9-3.6A15 15 0 0 0 10.1 8H8zm0 8H6a8 8 0 0 1 3.6 3.9A15 15 0 0 0 8 16zm8 0a15 15 0 0 0-1.6 3.9A8 8 0 0 1 16 16z" />
	</svg>
);
