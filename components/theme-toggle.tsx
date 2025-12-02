"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Moon, Sun } from "lucide-react";

type ThemeToggleProps = {
  toggleTheme?: () => void;
  currentTheme?: "light" | "dark";
};

export function ThemeToggle({ toggleTheme, currentTheme }: ThemeToggleProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Initialize theme on mount from props or localStorage or prefers-color-scheme
  useEffect(() => {
    try {
      // If parent passed a currentTheme prop prefer it so SSR/RSC matches
      const saved = currentTheme ?? localStorage.getItem("theme");
      if (saved === "dark") {
        setTheme("dark");
        document.documentElement.classList.add("dark");
      } else if (saved === "light") {
        setTheme("light");
        document.documentElement.classList.remove("dark");
      } else if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        setTheme("dark");
        document.documentElement.classList.add("dark");
      } else {
        setTheme("light");
        document.documentElement.classList.remove("dark");
      }
    } catch (e) {
      // ignore
    }
  }, [currentTheme]);

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
      } catch (e) {}
    } catch (e) {}
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
