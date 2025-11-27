"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    setLoggingOut(true); // start animation
    // Clear session/local storage
    localStorage.removeItem("user");
    sessionStorage.clear();

    // Give a small delay for animation/transition
    setTimeout(() => {
      router.replace("/auth/login"); // replace to prevent back
    }, 300); // 0.3s for smooth effect
  };

  return (
    <header
      className={`sticky top-0 z-40 h-[65px] flex items-center justify-between px-6 bg-white/70 dark:bg-gray-900/70 backdrop-blur border-b border-gray-200 dark:border-gray-700 shadow-sm transition-all duration-300 ${
        loggingOut ? "opacity-50 blur-sm" : "opacity-100"
      }`}
    >
      <h1 className="font-semibold text-lg transition-transform duration-300">
        Dashboard
      </h1>

      <div className="flex items-center gap-4">
        <ThemeToggle />

        {/* Profile Dropdown */}
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
              onClick={handleLogout} // ✅ logout function
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
