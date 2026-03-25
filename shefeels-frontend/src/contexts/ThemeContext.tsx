import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("hl_theme");
      if (saved === "light" || saved === "dark") return saved;
      // Default to dark if no saved preference
    } catch {}
    return "dark"; // default (force dark by default)
  });

  useEffect(() => {
    try {
      localStorage.setItem("hl_theme", theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Keep an attribute on the <html> element so CSS can target themes
  useEffect(() => {
    try {
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", theme);
      }
    } catch {}
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
