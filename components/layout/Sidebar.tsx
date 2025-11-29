"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/providers/SidebarProvider";
import {
  Menu,
  ChevronLeft,
  Home,
  DollarSign,
  Users,
  Calculator,
} from "lucide-react";

import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

export default function Sidebar() {
  const { collapsed, toggle } = useSidebar();

  const menuItems = [
    { title: "Dashboard", href: "/dashboard", icon: <Home size={20} /> },
    {
      title: "Wage Management",
      href: "/dashboard/wage",
      icon: <DollarSign size={20} />,
    },
    {
      title: "Payroll System",
      href: "/dashboard/payroll",
      icon: <Calculator size={20} />,
    },
    {
      title: "Employees",
      href: "/dashboard/employees",
      icon: <Users size={20} />,
    },

    // ⭐ NEW PAYROLL SYSTEM MODULE
  ];

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "fixed top-0 left-0 h-screen flex flex-col z-50 transition-all duration-300 shadow-xl",
          collapsed
            ? "w-20 bg-gray-200 dark:bg-gray-800"
            : "w-[250px] bg-gray-100 dark:bg-gray-900"
        )}
      >
        {/* Top Section */}
        <div className="flex items-center justify-between h-[65px] px-4 border-b border-gray-300 dark:border-gray-700">
          {/* Morphing Logo */}
          <div
            className={cn(
              "font-bold text-lg transition-all duration-500 whitespace-nowrap",
              collapsed ? "opacity-0 w-0" : "opacity-100"
            )}
          >
            HR Payroll
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={toggle}
          className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-black dark:text-white shadow-lg transition-transform"
        >
          {collapsed ? <Menu size={22} /> : <ChevronLeft size={22} />}
        </button>

        {/* Menu */}
        <div className="flex flex-col gap-2 mt-6 px-2">
          {menuItems.map((item, idx) => (
            <Tooltip key={idx} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all duration-300 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700 hover:shadow-lg",
                    collapsed ? "justify-center" : "justify-start"
                  )}
                >
                  {item.icon}
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">{item.title}</TooltipContent>
              )}
            </Tooltip>
          ))}
        </div>
      </aside>
    </TooltipProvider>
  );
}
