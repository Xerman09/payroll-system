"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useTheme } from "next-themes";

export type ThemeColor = 
  | "blue"
  | "obsidian" 
  | "midnight" 
  | "circuit" 
  | "forest" 
  | "lava" 
  | "amber" 
  | "amethyst" 
  | "slate"
  | "custom"
  | string; // Support for dynamic custom IDs

interface UserTheme {
  id: string;
  name: string;
  hue: number;
  hex?: string;
}

interface ThemeConfig {
  name: string;
  hue: number;
  chroma: number;
  lightness: number;
}

const THEMES: Record<string, ThemeConfig> = {
  // Default — matches the original hardcoded blue-600 / indigo-600 brand colors
  blue:     { name: "Blue",      hue: 231, chroma: 0.22,  lightness: 0.45 },
  // Presets
  obsidian: { name: "Obsidian",  hue: 0,   chroma: 0,     lightness: 0.1  },
  midnight: { name: "Midnight",  hue: 240, chroma: 0.08,  lightness: 0.3  },
  circuit:  { name: "Circuit",   hue: 260, chroma: 0.25,  lightness: 0.45 },
  forest:   { name: "Forest",    hue: 160, chroma: 0.20,  lightness: 0.45 },
  lava:     { name: "Lava",      hue: 10,  chroma: 0.25,  lightness: 0.45 },
  amber:    { name: "Amber",     hue: 45,  chroma: 0.15,  lightness: 0.6  },
  amethyst: { name: "Amethyst",  hue: 275, chroma: 0.20,  lightness: 0.45 },
  slate:    { name: "Slate",     hue: 250, chroma: 0.05,  lightness: 0.45 },
};

interface ColorThemeContextType {
  activeColor: ThemeColor;
  setActiveColor: (color: ThemeColor) => void;
  customHue: number;
  setCustomHue: (hue: number) => void;
  customHex: string;
  setCustomHex: (hex: string) => void;
  savedThemes: UserTheme[];
  addSavedTheme: (name: string, hue: number, hex?: string) => void;
  removeSavedTheme: (id: string) => void;
  themes: typeof THEMES;
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(undefined);

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const [activeColor, setActiveColorState] = useState<ThemeColor>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("vtc_theme_color") as ThemeColor) || "blue";
    }
    return "blue";
  });
  const [customHue, setCustomHueState] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("vtc_custom_hue");
      return saved ? Number(saved) : 260;
    }
    return 260;
  });
  const [customHex, setCustomHexState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("vtc_custom_hex") || "#0448ff";
    }
    return "#0448ff";
  });
  const [savedThemes, setSavedThemes] = useState<UserTheme[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("vtc_themes_library");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const { theme: mode } = useTheme();

  // No-op mount effect to ensure hydration consistency if needed, 
  // but state is now initialized lazily.
  useEffect(() => {
    // We can keep this empty or remove if not needed for other side effects
  }, []);

  const setActiveColor = (color: ThemeColor) => {
    setActiveColorState(color);
    localStorage.setItem("vtc_theme_color", color);
  };

  const setCustomHue = (hue: number) => {
    setCustomHueState(hue);
    localStorage.setItem("vtc_custom_hue", String(hue));
  };

  const setCustomHex = (hex: string) => {
    setCustomHexState(hex);
    localStorage.setItem("vtc_custom_hex", hex);
  };

  const addSavedTheme = (name: string, hue: number, hex?: string) => {
    const newTheme: UserTheme = {
      id: `custom-${Date.now()}`,
      name,
      hue,
      hex
    };
    const updated = [...savedThemes, newTheme];
    setSavedThemes(updated);
    localStorage.setItem("vtc_themes_library", JSON.stringify(updated));
    setActiveColor(newTheme.id); // Automatically activate the new theme
  };

  const removeSavedTheme = (id: string) => {
    const updated = savedThemes.filter((t) => t.id !== id);
    setSavedThemes(updated);
    localStorage.setItem("vtc_themes_library", JSON.stringify(updated));
    if (activeColor === id) {
      setActiveColor("blue"); // Revert to default if active theme is deleted
    }
  };

  // Inject CSS Variables
  useEffect(() => {
    const root = document.documentElement;
    // Find hue: 1. Curated List, 2. Library, 3. Custom Wheel
    const config = THEMES[activeColor as string];
    const savedTheme = !config ? savedThemes.find(t => t.id === activeColor) : null;
    
    const isDark = mode === "dark";

    // Primary values
    let primaryL = isDark ? 0.7 : (config?.lightness ?? 0.45);
    let primaryC = isDark ? 0.15 : (config?.chroma ?? 0.25);
    
    let primaryH;
    if (config) primaryH = config.hue;
    else if (savedTheme) primaryH = savedTheme.hue;
    else primaryH = customHue; // Fallback to current wheel hue or "Spectrum" mode

    // Special case for Obsidian (Grayscale)
    if (activeColor === "obsidian") {
      primaryL = isDark ? 0.95 : 0.1;
      primaryC = 0;
    }

    // Secondary values derivation
    const secondaryL = isDark ? 0.24 : 0.94;
    const secondaryC = 0.02;

    // Accent values derivation
    const accentL = isDark ? 0.24 : 0.96;
    const accentC = 0.03;

    // Apply primary via Hex if available to ensure exact user selection mapping
    let finalPrimary = `oklch(${primaryL} ${primaryC} ${primaryH})`;
    let finalPrimaryFg = isDark ? `oklch(0.12 0.02 ${primaryH})` : `oklch(0.985 0 ${primaryH})`;

    const targetHex = !config ? (savedTheme?.hex || (activeColor === 'custom' ? customHex : null)) : null;

    if (targetHex) {
       finalPrimary = targetHex;
       // Calculate Relative Luminance to adapt foreground correctly
       const r = parseInt(targetHex.slice(1, 3), 16);
       const g = parseInt(targetHex.slice(3, 5), 16);
       const b = parseInt(targetHex.slice(5, 7), 16);
       const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
       finalPrimaryFg = luminance > 0.6 ? "#000000" : "#ffffff";
    }

    // Inject into style attribute for immediate override
    root.style.setProperty("--primary", finalPrimary);
    root.style.setProperty("--primary-foreground", finalPrimaryFg);
    
    root.style.setProperty("--secondary", `oklch(${secondaryL} ${secondaryC} ${primaryH})`);
    root.style.setProperty("--secondary-foreground", isDark ? `oklch(0.93 0.01 ${primaryH})` : `oklch(0.205 0 ${primaryH})`);
    
    root.style.setProperty("--accent", `oklch(${accentL} ${accentC} ${primaryH})`);
    root.style.setProperty("--accent-foreground", isDark ? `oklch(0.96 0  ${primaryH})` : `oklch(0.205 0 ${primaryH})`);
    
    root.style.setProperty("--ring", `oklch(${primaryL} ${primaryC} ${primaryH} / 50%)`);
    
    // Sidebar sync
    root.style.setProperty("--sidebar-primary", finalPrimary);
    root.style.setProperty("--sidebar-primary-foreground", finalPrimaryFg);
    root.style.setProperty("--sidebar-ring", `oklch(${primaryL} ${primaryC} ${primaryH} / 50%)`);

  }, [activeColor, mode, customHue, customHex, savedThemes]);

  return (
    <ColorThemeContext.Provider value={{ 
      activeColor, 
      setActiveColor, 
      customHue, 
      setCustomHue, 
      customHex,
      setCustomHex,
      savedThemes,
      addSavedTheme,
      removeSavedTheme,
      themes: THEMES 
    }}>
      {children}
    </ColorThemeContext.Provider>
  );
}

export function useColorTheme() {
  const context = useContext(ColorThemeContext);
  if (context === undefined) {
    throw new Error("useColorTheme must be used within a ColorThemeProvider");
  }
  return context;
}
