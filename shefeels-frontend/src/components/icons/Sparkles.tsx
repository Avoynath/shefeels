import React from "react";

export const Sparkles: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
	<svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
		<path fill="currentColor" d="M12 2l2.2 5.6L20 10l-5.8 2.4L12 18l-2.2-5.6L4 10l5.8-2.4L12 2z" />
		<circle cx="5" cy="19" r="1.4" fill="currentColor" />
		<circle cx="19" cy="6" r="1" fill="currentColor" />
	</svg>
);
