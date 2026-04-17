//@/components/layout/DashboardLayout.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { useSidebar } from "@/providers/SidebarProvider";
import { cn } from "@/lib/utils";
import useSessionTimeout from "@/hooks/useSessionTimeout";
import PreventBackAfterLogout from "@/components/PreventBackAfterLogout";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { Toaster } from "@/components/ui/sonner";
import { getLoggedUser } from "@/lib/auth";

const DEV_SIGNATURE = "System Developed by loA_btst | 2026";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { collapsed, toggle: toggleSidebar } = useSidebar();
  const router = useRouter();
  const loading = useAuthGuard(); // protects dashboard
  useSessionTimeout(15); // auto logout 15 min

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if Alt key is pressed (no meta/ctrl for navigation to avoid conflict with browser/search)
      if (!e.altKey) return;

      const user = getLoggedUser();
      const userId = user?.user_id || "me";

      switch (e.key.toLowerCase()) {
        case "b":
          e.preventDefault();
          toggleSidebar();
          break;
        case "d":
          e.preventDefault();
          router.push(`/dashboard/${userId}`);
          break;
        case "r":
          e.preventDefault();
          router.push(`/payroll-records/${userId}`);
          break;
        case "w":
          e.preventDefault();
          router.push(`/wage/${userId}`);
          break;
        case "s":
          e.preventDefault();
          router.push(`/settings/${userId}`);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, toggleSidebar]);

  // Console signature (non-invasive; devtools only)
  useEffect(() => {
    try {
      // Runs once on mount
       
      console.log(DEV_SIGNATURE);
    } catch {}
  }, []);

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
        <Navbar />

        {/* ✅ main grows to fill remaining space, pushing footer down */}
        <main className="flex-1 p-6">{children}</main>

        <Footer codename="loA_btst" />
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}
