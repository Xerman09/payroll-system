"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

type ThemeToggleProps = {
  toggleTheme?: () => void;
  currentTheme?: "light" | "dark";
};

export function ThemeToggle({ toggleTheme, currentTheme }: ThemeToggleProps) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = currentTheme ?? localStorage.getItem("theme");
      if (saved === "dark") return "dark";
      else if (saved === "light") return "light";
      else if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      )
        return "dark";
      else return "light";
    } catch {
      return "light";
    }
  });

  // Update DOM classList based on current theme
  useEffect(() => {
    const current = currentTheme ?? theme;
    if (current === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [currentTheme, theme]);

  const handleClick = () => {
    // If parent provided a toggle handler, call it so higher-level layout stays in sync
    if (typeof toggleTheme === "function") toggleTheme();
    else toggleThemeInternal();
  };

  function toggleThemeInternal() {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    try {
      localStorage.setItem("theme", newTheme);
      try {
        document.cookie = `theme=${newTheme}; path=/; max-age=${
          60 * 60 * 24 * 365
        }; samesite=lax`;
      } catch {}
    } catch {}
    if (newTheme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }

  return (
    <button
      onClick={handleClick}
      className="p-2 rounded-md border hover:bg-accent transition flex items-center"
    >
      {(currentTheme ?? theme) === "light" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}

export default ThemeToggle;
