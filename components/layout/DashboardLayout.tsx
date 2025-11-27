"use client";

import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { useSidebar } from "@/providers/SidebarProvider";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { collapsed } = useSidebar();

  return (
    <div className="flex h-screen">
      <Sidebar />

      <div className="flex flex-col flex-1 transition-all duration-300">
        <Navbar />

        <main className="p-6 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
