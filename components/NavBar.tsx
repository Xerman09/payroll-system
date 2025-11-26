"use client";

import {
  SunIcon,
  MoonIcon,
  UserIcon,
  LogOutIcon,
  HomeIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface NavbarProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
  handleLogout: () => void;
  toggleSidebar: () => void;
}

export default function Navbar({
  theme,
  toggleTheme,
  handleLogout,
  toggleSidebar,
}: NavbarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b px-4 md:px-6 bg-white dark:bg-gray-900">
      <div className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Sidebar toggle */}
          <Button size="icon" variant="ghost" onClick={toggleSidebar}>
            <HomeIcon size={20} />
          </Button>

          {/* Logo */}
          <a className="text-primary font-bold text-lg" href="/dashboard">
            LOGO
          </a>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <Button size="icon" variant="ghost" onClick={toggleTheme}>
            {theme === "light" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
          </Button>

          {/* User menu */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost">
                <UserIcon size={16} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2 space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2"
                onClick={() => alert("Edit Profile")}
              >
                <UserIcon size={16} /> Edit Profile
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2"
                onClick={handleLogout}
              >
                <LogOutIcon size={16} /> Logout
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  );
}
