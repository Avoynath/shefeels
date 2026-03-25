import React from "react";

export const UserPlus: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
	<svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
		<path fill="currentColor" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
		<path fill="currentColor" d="M4 20c0-3.3 3-6 8-6s8 2.7 8 6v1H4v-1z" opacity="0.98" />
		<g transform="translate(14,6)">
			<rect x="0" y="0" width="6" height="2" rx="0.4" fill="currentColor" />
			<rect x="2" y="-2" width="2" height="6" rx="0.4" fill="currentColor" />
		</g>
	</svg>
);
