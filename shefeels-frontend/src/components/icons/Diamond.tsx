import React from "react";

export const Diamond: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path fill="currentColor" d="M12 2l6 6-6 14L6 8l6-6z" />
  </svg>
);
