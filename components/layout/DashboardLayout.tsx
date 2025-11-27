"use client";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { useSidebar } from "@/providers/SidebarProvider";
import { cn } from "@/lib/utils";
import useSessionTimeout from "@/hooks/useSessionTimeout";
import PreventBackAfterLogout from "@/components/PreventBackAfterLogout";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { collapsed } = useSidebar();
  const loading = useAuthGuard(); // protects dashboard
  useSessionTimeout(15); // auto logout 15 min

  if (loading) return null; // prevent flashing dashboard

  return (
    <div className="flex">
      <PreventBackAfterLogout />
      <Sidebar />
      <div
        className={cn(
          "flex-1 transition-all duration-300",
          collapsed ? "ml-20" : "ml-[250px]"
        )}
      >
        <Navbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
