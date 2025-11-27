"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/providers/SidebarProvider";

import { LayoutDashboard, Wallet } from "lucide-react";

export default function Sidebar() {
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={cn(
        "h-screen bg-card border-r p-4 flex flex-col transition-all duration-300",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Collapse Button */}
      <button
        onClick={toggle}
        className="mb-6 p-2 rounded-md hover:bg-accent transition"
      >
        {collapsed ? "➡️" : "⬅️"}
      </button>

      <nav className="flex flex-col gap-2">
        <SidebarItem
          label="Dashboard"
          href="/dashboard"
          icon={<LayoutDashboard className="w-5 h-5" />}
          collapsed={collapsed}
        />

        <SidebarItem
          label="Wage Management"
          href="/dashboard/wage"
          icon={<Wallet className="w-5 h-5" />}
          collapsed={collapsed}
        />
      </nav>
    </aside>
  );
}

function SidebarItem({
  label,
  href,
  icon,
  collapsed,
}: {
  label: string;
  href: string;
  icon: React.ReactNode;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-md hover:bg-accent transition group relative"
    >
      {icon}

      {/* Label hidden when collapsed */}
      <span
        className={cn(
          "transition-all whitespace-nowrap",
          collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
        )}
      >
        {label}
      </span>

      {/* Hover tooltip */}
      {collapsed && (
        <span className="absolute left-20 bg-popover text-popover-foreground px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition">
          {label}
        </span>
      )}
    </Link>
  );
}
