"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { useSidebar } from "@/providers/SidebarProvider";
import { cn } from "@/lib/utils";
import useSessionTimeout from "@/hooks/useSessionTimeout";
import PreventBackAfterLogout from "@/components/PreventBackAfterLogout";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { collapsed } = useSidebar();
  const loading = useAuthGuard(); // protects dashboard
  useSessionTimeout(15); // auto logout 15 min

  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    }
  }, []);

  // Update localStorage and html class whenever theme changes
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    try {
      // set a cookie so server rendering can pick up the user's preference
      document.cookie = `theme=${newTheme}; path=/; max-age=${
        60 * 60 * 24 * 365
      }; samesite=lax`;
    } catch {}
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  if (loading) return null; // prevent flashing dashboard

  return (
    <div className="flex min-h-screen">
      <PreventBackAfterLogout />
      <Sidebar />
      <div
        className={cn(
          "flex-1 transition-all duration-200 ease-out bg-gray-50 dark:bg-gray-900",
          // On mobile, no margin, on md+, margin based on collapsed
          "md:ml-20",
          !collapsed && "md:ml-[250px]"
        )}
      >
        <Navbar toggleTheme={toggleTheme} currentTheme={theme} />
        <main className="p-6">{children}</main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
