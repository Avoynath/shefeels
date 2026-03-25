import React from "react";
import { useThemeStyles } from "../utils/theme";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "secondary" | "agePrimary" | "ageSecondary";
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
};

export default function Button({ 
  variant = "primary", 
  size = "md",
  className = "", 
  children, 
  ...rest 
}: ButtonProps) {
  const { components } = useThemeStyles();
  
  const sizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-3.5 text-lg"
  };

  const btnPrimary = `inline-flex items-center justify-center gap-2 rounded-[12px] font-medium text-white border border-[rgba(255,255,255,0.5)] bg-[#e53170] hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 ${sizeClasses[size]}`;
  
  const btnGhost = components.btnGhost;
  const btnSecondary = `inline-flex items-center justify-center rounded-[12px] font-medium text-white border border-[rgba(255,255,255,0.5)] bg-[#292929] hover:bg-[#333333] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 ${sizeClasses[size]}`;
  const agePrimary = `inline-flex items-center justify-center gap-2 rounded-[8px] font-medium text-white border border-[rgba(255,255,255,0.5)] bg-gradient-to-r from-[#be97f3] to-[#4b28ad] shadow-[0_6px_18px_rgba(75,40,173,0.35)] hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 ${sizeClasses[size]}`;
  const ageSecondary = `inline-flex items-center justify-center rounded-[8px] font-medium text-white border border-[rgba(255,255,255,0.14)] bg-black hover:bg-[#0f0f0f] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 ${sizeClasses[size]}`;

  const base = variant === "ghost" 
    ? btnGhost 
    : variant === "secondary" 
    ? btnSecondary 
    : variant === "agePrimary"
    ? agePrimary
    : variant === "ageSecondary"
    ? ageSecondary
    : btnPrimary;

  return (
    <button className={`${base} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}
