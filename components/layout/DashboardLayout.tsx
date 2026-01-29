//@/components/layout/DashboardLayout.tsx
"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { useSidebar } from "@/providers/SidebarProvider";
import { cn } from "@/lib/utils";
import useSessionTimeout from "@/hooks/useSessionTimeout";
import PreventBackAfterLogout from "@/components/PreventBackAfterLogout";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { Toaster } from "@/components/ui/sonner";

const DEV_SIGNATURE = "System Developed by loA_btst | 2026";

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

  // Console signature (non-invasive; devtools only)
  useEffect(() => {
    try {
      // Runs once on mount
      // eslint-disable-next-line no-console
      console.log(DEV_SIGNATURE);
    } catch {}
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

  // DashboardLayout.tsx (only showing the relevant return block)

  return (
    <div className="flex min-h-screen">
      <PreventBackAfterLogout />
      <Sidebar />

      <div
        className={cn(
          // ✅ make this a column flex container and full height
          "flex-1 flex min-h-screen flex-col transition-all duration-200 ease-out bg-gray-50 dark:bg-gray-900",
          "md:ml-20",
          !collapsed && "md:ml-[250px]",
        )}
      >
        <Navbar toggleTheme={toggleTheme} currentTheme={theme} />

        {/* ✅ main grows to fill remaining space, pushing footer down */}
        <main className="flex-1 p-6">{children}</main>

        <Footer codename="loA_btst" />
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}
