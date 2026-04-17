"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type ThemeToggleProps = {
  // Keeping props for backward compatibility if needed, 
  // but we prioritize useTheme() internal hook
  toggleTheme?: () => void;
  currentTheme?: "light" | "dark";
};

export function ThemeToggle({ toggleTheme, currentTheme }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by waiting for mount
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button className="p-2 rounded-md border bg-transparent flex items-center opacity-0">
        <Sun className="h-5 w-5" />
      </button>
    );
  }

  const handleClick = () => {
    if (typeof toggleTheme === "function") {
      toggleTheme();
    } else {
      setTheme(theme === "dark" ? "light" : "dark");
    }
  };

  const activeTheme = currentTheme ?? theme;

  return (
    <button
      onClick={handleClick}
      className="p-2 rounded-md border hover:bg-accent transition flex items-center bg-transparent dark:border-gray-700"
      title={`Switch to ${activeTheme === "dark" ? "light" : "dark"} mode`}
    >
      {activeTheme === "light" ? (
        <Sun className="h-5 w-5 text-orange-500" />
      ) : (
        <Moon className="h-5 w-5 text-blue-400" />
      )}
    </button>
  );
}

export default ThemeToggle;
