// app/components/Sidebar.jsx
"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/providers/SidebarProvider";
import {
  Menu,
  ChevronLeft,
  Home,
  Calculator,
  Calendar,
  HandCoins,
  Calendars,
  PiggyBank,
  PhilippinePeso,
  Folders,
  Anchor,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { getLoggedUser } from "@/lib/auth";

import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

function Sidebar() {
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebar();
  const pathname = usePathname();
  const [openDropdowns, setOpenDropdowns] = React.useState<string[]>([]);

  const [userId, setUserId] = React.useState<string | number>("me");

  React.useEffect(() => {
    const user = getLoggedUser();
    if (user?.user_id) {
      setUserId(user.user_id);
    }
  }, []);

  const menuItems = useMemo(
    () => [
      {
        panel: "Dashboard",
        items: [
          { title: "Dashboard", href: `/dashboard/${userId}`, icon: <Home size={20} /> },
        ],
      },
      {
        panel: "File Management",
        items: [
          {
            title: "Compensation Management",
            href: `/wage/${userId}`,
            icon: <PhilippinePeso size={20} />,
          },
          {
            title: "COOP",
            href: `/coop/${userId}`,
            icon: <PiggyBank size={20} />,
          },
          {
            title: "Holiday Calendar",
            href: `/calendar-management/${userId}`,
            icon: <Calendar size={20} />,
          },
          {
            title: "Benefits Management",
            href: `/benefit-settings/${userId}`,
            icon: <HandCoins size={20} />,
          },
          {
            title: "Cutoff Settings",
            href: `/cutoff-settings/${userId}`,
            icon: <Calendars size={20} />,
          },
          {
            title: "Logistics Compensation",
            href: "#",
            icon: <Anchor size={20} />,
            subItems: [
              {
                title: "Compensation Settings",
                href: `/logistics-compensation/settings/${userId}`,
              },
              {
                title: "Wage Matrix",
                href: `/logistics-compensation/wage-matrix/${userId}`,
              },
            ],
          },
        ],
      },
      {
        panel: "Processing",
        items: [
          {
            title: "Payroll Run",
            href: `/payroll-run/${userId}`,
            icon: <Calculator size={20} />,
          },
        ],
      },
      {
        panel: "Records",
        items: [
          {
            title: "Payroll Records",
            href: `/payroll-records/${userId}`,
            icon: <Folders size={20} />,
          },
        ],
      },
    ],
    [userId]
  );

  const toggleDropdown = (title: string) => {
    setOpenDropdowns((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  // Auto-expand parent if sub-item is active
  React.useEffect(() => {
    const activeParents: string[] = [];
    menuItems.forEach(panel => {
      panel.items.forEach(item => {
        if (item.subItems?.some(sub => pathname === sub.href)) {
          activeParents.push(item.title);
        }
      });
    });
    
    if (activeParents.length > 0) {
      setOpenDropdowns(prev => {
        const next = [...prev];
        activeParents.forEach(p => {
          if (!next.includes(p)) next.push(p);
        });
        return next;
      });
    }
  }, [pathname, menuItems]);


  return (
    <TooltipProvider disableHoverableContent>
      <AnimatePresence>
        {(typeof window !== "undefined" ? window.innerWidth >= 768 : true) ||
        mobileOpen ? (
          <motion.aside
            initial={mobileOpen ? { x: "-100%" } : { width: collapsed ? 80 : 250 }}
            animate={mobileOpen ? { x: 0 } : { width: collapsed ? 80 : 250 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn(
              "fixed top-0 left-0 h-screen flex flex-col z-50 shadow-xl",
              "bg-gray-100 dark:bg-gray-900 border-r border-gray-300 dark:border-gray-700",
              collapsed && "bg-gray-200 dark:bg-gray-800",
              mobileOpen ? "w-full md:w-[250px]" : "hidden md:flex"
            )}
            style={{
              contain: "layout paint",
              backfaceVisibility: "hidden",
            }}
          >
        {/* Header */}
        <div className="flex items-center justify-between h-[65px] px-4 border-b border-gray-300 dark:border-gray-700">
          <div
            className={cn(
              "font-bold text-lg transition-opacity duration-150 ease-out",
              collapsed ? "opacity-0" : "opacity-100"
            )}
            style={{ willChange: "opacity" }}
          >
            HR Payroll
          </div>
        </div>

        {/* Collapse Button */}
        <button
          onClick={() => {
            if (mobileOpen) {
              setMobileOpen(false);
            } else {
              toggle();
            }
          }}
          className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-black dark:text-white shadow-lg transition-transform"
          style={{ willChange: "transform" }}
        >
          {mobileOpen ? (
            <ChevronLeft size={22} />
          ) : collapsed ? (
            <Menu size={22} />
          ) : (
            <ChevronLeft size={22} />
          )}
        </button>

        {/* Navigation */}
        <div className="flex flex-col mt-6 px-2">
          {menuItems.map((panel, pIdx) => (
            <div key={pIdx} className="mb-4">
              {/* Panel Title */}
              {!collapsed && (
                <div className="px-3 mb-1 text-xs text-gray-500 uppercase font-medium">
                  {panel.panel}
                </div>
              )}

              {/* Items */}
              {panel.items.map((item, idx) => {
                const hasSubItems = item.subItems && item.subItems.length > 0;
                const isOpen = openDropdowns.includes(item.title);
                const isActive = pathname === item.href || (hasSubItems && item.subItems.some(sub => pathname === sub.href));

                return (
                  <div key={idx}>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        {hasSubItems ? (
                          <button
                            onClick={() => {
                              if (collapsed) {
                                toggle();
                                if (!isOpen) toggleDropdown(item.title);
                              } else {
                                toggleDropdown(item.title);
                              }
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ease-out",
                              "text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700 hover:shadow-lg",
                              collapsed ? "justify-center" : "justify-start",
                              isActive && "bg-blue-500/10 text-blue-600 dark:bg-blue-600/10 dark:text-blue-400"
                            )}
                          >
                            {item.icon}
                            {!collapsed && (
                              <>
                                <span className="flex-1 text-left">{item.title}</span>
                                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </>
                            )}
                          </button>
                        ) : (
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ease-out",
                              "text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700 hover:shadow-lg",
                              collapsed ? "justify-center" : "justify-start",
                              pathname === item.href &&
                                "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                            )}
                          >
                            {item.icon}
                            {!collapsed && <span>{item.title}</span>}
                          </Link>
                        )}
                      </TooltipTrigger>

                      <TooltipContent
                        side="right"
                        className={cn(!collapsed ? "hidden" : "")}
                      >
                        {item.title}
                      </TooltipContent>
                    </Tooltip>

                    {/* Sub Items */}
                    <AnimatePresence>
                      {hasSubItems && isOpen && !collapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="mt-1 ml-9 flex flex-col gap-1 border-l-2 border-gray-300 dark:border-gray-700 pl-4">
                            {item.subItems.map((sub, sIdx) => (
                              <Link
                                key={sIdx}
                                href={sub.href}
                                className={cn(
                                  "p-2 text-sm rounded-lg transition-colors",
                                  "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-800",
                                  pathname === sub.href && "text-blue-600 dark:text-blue-400 font-medium"
                                )}
                              >
                                {sub.title}
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </motion.aside>
    ) : null}
  </AnimatePresence>
</TooltipProvider>
  );
}

export default React.memo(Sidebar);
