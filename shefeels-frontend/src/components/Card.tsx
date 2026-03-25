import React from "react";
import { useThemeStyles } from "../utils/theme";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  className?: string;
  noBase?: boolean;
};

export default function Card({ children, className = "", noBase = false, ...rest }: CardProps) {
  const { components } = useThemeStyles();
  const cardBase = components.cardBase;
  const base = noBase ? "" : cardBase;
  return (
    <div {...rest} className={`${base} ${className}`.trim()}>
      {children}
    </div>
  );
}
