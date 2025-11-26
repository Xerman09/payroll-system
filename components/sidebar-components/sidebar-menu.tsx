import { HomeIcon, FileTextIcon, SettingsIcon } from "lucide-react";

export const sidebarMenu = [
  {
    label: "Dashboard",
    items: [{ name: "Home", href: "/dashboard", icon: HomeIcon }],
  },
  {
    label: "Management",
    items: [
      { name: "Wage Management", href: "/dashboard/wage", icon: FileTextIcon },
      { name: "Settings", href: "/dashboard/settings", icon: SettingsIcon },
    ],
  },
];
