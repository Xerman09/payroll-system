"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6">
      <h1 className="font-semibold text-xl">Dashboard</h1>

      <div className="flex items-center gap-4">
        <ThemeToggle />

        {/* Profile Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <img
              src="/avatar.png"
              className="w-9 h-9 rounded-full cursor-pointer border"
            />
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-40">
            <DropdownMenuItem>My Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem className="text-red-500">Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
