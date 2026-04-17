import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Menu, Search, Bell, User, Settings, LogOut } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CommandPalette } from "./CommandPalette";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/providers/SidebarProvider";
import { getLoggedUser, type JWTPayload } from "@/lib/auth";
import { getCompanyById } from "@/lib/companies";

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const { setMobileOpen, toggle, collapsed } = useSidebar();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleMobileMenuOpen = () => {
    if (collapsed) toggle(); // Resets to expanded
    setMobileOpen(true);
  };

  const handleLogout = () => {
    setLoggingOut(true);
    localStorage.removeItem("user");
    sessionStorage.clear();

    setTimeout(() => {
      router.replace("/auth/login");
    }, 300);
  };

  const [user, setUser] = useState<JWTPayload | null>(() => getLoggedUser());
  const [companyName, setCompanyName] = useState("Vertex Technology Corps.");

  useEffect(() => {
    // Listen for storage changes in other tabs
    const handleStorage = () => setUser(getLoggedUser());
    window.addEventListener("storage", handleStorage);

    // Retrieve the active company from cookie
    const getCookie = (name: string) => {
      if (typeof document === 'undefined') return null;
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };
    
    const compId = getCookie("selected_company_id");
    if (compId) {
      const comp = getCompanyById(compId);
      if (comp) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCompanyName(comp.name);
      }
    }

    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const userName = user?.user_fname ? `${user.user_fname} ${user.user_lname}` : "My Account";
  const userRole = user?.role || "USER";

  // Construct image URL from Directus file ID
  const NEXT_PUBLIC_DIRECTUS_URL = process.env.NEXT_PUBLIC_DIRECTUS_URL || "";
  const imageUrl = user?.user_image
    ? (user.user_image.startsWith('http') ? user.user_image : `${NEXT_PUBLIC_DIRECTUS_URL}/assets/${user.user_image}`)
    : "/profile.jpg";

  return (
    <header
      className={`sticky top-0 z-40 h-[65px] flex items-center justify-between px-6 bg-white/70 dark:bg-gray-900/70 backdrop-blur border-b border-gray-200 dark:border-gray-700 shadow-sm transition-all duration-300 ${loggingOut ? "opacity-50 blur-sm" : "opacity-100"
        }`}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={handleMobileMenuOpen}
          className="md:hidden p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <Menu size={20} />
        </button>
        <h1 className="font-semibold text-lg transition-transform duration-300 hidden sm:block">
          {companyName}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div 
          onClick={() => setCommandOpen(true)}
          className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors group"
        >
          <Search size={16} className="text-gray-400 group-hover:text-primary transition-colors" />
          <div className="text-gray-500 text-sm w-32 focus:w-48 transition-all flex items-center justify-between">
            <span>Search records...</span>
          </div>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex ml-2">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>

        <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
        </button>

        <ThemeToggle toggleTheme={toggleTheme} currentTheme={theme as "light" | "dark"} />

        <div className="hidden sm:flex flex-col items-end mr-1">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
            {userName}
          </span>
          <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
            {userRole}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <div className="relative">
              <Avatar className="cursor-pointer hover:opacity-80 transition-transform duration-200 ring-2 ring-primary/10">
                <AvatarImage src={imageUrl} />
                <AvatarFallback>{user?.user_fname?.[0]}{user?.user_lname?.[0]}</AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-green-500 ring-2 ring-white dark:ring-gray-900 shadow-sm shadow-green-500/50"></span>
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-56 mr-4 mt-2 p-2 border-none shadow-xl rounded-2xl bg-white dark:bg-gray-900">
            <div className="p-3 mb-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Signed in as</p>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{user?.user_email}</p>
            </div>

            <DropdownMenuItem
              className="rounded-lg cursor-pointer py-2.5 mb-1"
              onClick={() => router.push(`/profile/${user?.user_id || "me"}`)}
            >
              <User className="mr-2 h-4 w-4" />
              <span>My Profile</span>
            </DropdownMenuItem>

            <DropdownMenuItem 
              className="rounded-lg cursor-pointer py-2.5 mb-1"
              onClick={() => router.push(`/settings/${user?.user_id || "me"}`)}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="rounded-lg text-red-600 cursor-pointer py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>{loggingOut ? "Logging out..." : "Logout"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette open={commandOpen} setOpen={setCommandOpen} />
    </header>
  );
}
