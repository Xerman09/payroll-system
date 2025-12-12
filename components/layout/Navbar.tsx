"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/providers/SidebarProvider";

// Define props interface
interface NavbarProps {
  toggleTheme: () => void;
  currentTheme: "light" | "dark";
}

export default function Navbar({ toggleTheme, currentTheme }: NavbarProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const { setMobileOpen } = useSidebar();

  const handleLogout = () => {
    setLoggingOut(true);
    localStorage.removeItem("user");
    sessionStorage.clear();

    setTimeout(() => {
      router.replace("/auth/login");
    }, 300);
  };

  return (
    <header
      className={`sticky top-0 z-40 h-[65px] flex items-center justify-between px-6 bg-white/70 dark:bg-gray-900/70 backdrop-blur border-b border-gray-200 dark:border-gray-700 shadow-sm transition-all duration-300 ${
        loggingOut ? "opacity-50 blur-sm" : "opacity-100"
      }`}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <Menu size={20} />
        </button>
        <h1 className="font-semibold text-lg transition-transform duration-300">
          Vertex Technology Corps.
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle toggleTheme={toggleTheme} currentTheme={currentTheme} />

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar className="cursor-pointer hover:opacity-80 transition-transform duration-200">
              <AvatarImage src="/profile.jpg" />
              <AvatarFallback>MK</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="mr-2">
            <DropdownMenuItem>My Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600 cursor-pointer hover:bg-red-100 dark:hover:bg-red-800 transition-colors"
              onClick={handleLogout}
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
