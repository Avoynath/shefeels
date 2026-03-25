import { useTheme } from "../contexts/ThemeContext";

// ------------------------------------------------------------
// Theme-aware style utilities
// ------------------------------------------------------------

export function useThemeStyles() {
  const { theme } = useTheme();
  
  const colors = {
    // Background colors
    /* Prefer CSS variables for surfaces so both themes follow `index.css` tokens.
       This avoids hard-coded dark hex values and makes light-mode reliable. */
    background: "bg-[var(--bg-primary)]",
    backgroundSecondary: "bg-[var(--bg-secondary)]",
    backgroundCard: "bg-[var(--hl-surface)]",
    
    // Text colors
    text: theme === "dark" ? "text-white" : "text-gray-900",
    textSecondary: theme === "dark" ? "text-white/70" : "text-gray-600",
    textMuted: theme === "dark" ? "text-white/40" : "text-gray-400",
    
    // Border colors
    border: theme === "dark" ? "border-white/10" : "border-gray-200",
    borderHover: theme === "dark" ? "border-white/30" : "border-gray-300",
    
    // Ring colors
    ring: theme === "dark" ? "ring-white/10" : "ring-gray-200",
    ringHover: theme === "dark" ? "ring-white/30" : "ring-gray-300",
    
  // Gold/accent colors (consistent across themes) - use CSS tokens
  gold: theme === "dark" ? "text-[var(--hl-gold)]" : "text-[var(--hl-gold-strong)]",
  goldBorder: theme === "dark" ? "border-[var(--hl-gold)]/70" : "border-[var(--hl-gold-strong)]/70",
  goldRing: theme === "dark" ? "ring-[var(--hl-gold)]/70" : "ring-[var(--hl-gold-strong)]/70",
    
    // Button colors
    buttonGhost: theme === "dark" 
      ? "bg-[var(--bg-secondary)] text-[var(--hl-text)] ring-[var(--hl-border)] hover:bg-[var(--bg-tertiary)]" 
      : "bg-[var(--bg-secondary)] text-[var(--hl-text)] ring-[var(--hl-border)] hover:bg-[var(--bg-tertiary)]",
  };

  const components = {
    // Base card style
  cardBase: `rounded-2xl ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,197,77,0.8)] p-6 ${colors.ring} ${colors.backgroundCard}`,
    
    // Primary button aligned to Figma CTA style
  btnPrimary: "inline-flex items-center justify-center rounded-[12px] px-6 py-3 text-base font-medium text-white border border-[rgba(255,255,255,0.5)] bg-[#e53170] hover:brightness-110 active:scale-[0.98] active:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed",
    
    // Ghost button
    btnGhost: `inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition ${colors.buttonGhost}`,
    
    // Input field
  input: `w-full rounded-xl px-4 py-3 placeholder-opacity-50 ring-1 focus:outline-none focus:ring-2 focus:ring-[rgba(255,197,77,0.8)] transition bg-[var(--hl-surface)] text-[var(--hl-text)] placeholder-[var(--hl-text-mute)] ring-[var(--hl-border)]`,
    
    // Page heading
    heading: `text-3xl font-bold ${colors.text}`,
    
    // Page subtitle
    sub: `mt-2 ${colors.textSecondary}`,
    
    // Selected state
  selected: "ring-2 ring-[var(--hl-gold)]/80 bg-[var(--hl-gold)] text-[var(--hl-black)] shadow",
    
    // Hover states
    hoverRing: `hover:${colors.ringHover}`,
    hoverBg: theme === "dark" ? "hover:bg-white/5" : "hover:bg-gray-50",
  };

  return { colors, components, theme };
}

// Convenience hook for common patterns
export function useThemeClasses() {
  const { components, colors } = useThemeStyles();
  return {
    ...components,
    ...colors,
  };
}
