// providers/SidebarProvider.tsx
"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface SidebarContextProps {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export function SidebarProvider({ children }: { children: ReactNode }) {
  // set collapsed: true initially
  const [collapsed, setCollapsed] = useState(true);

  const toggle = () => setCollapsed(!collapsed);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context)
    throw new Error("useSidebar must be used within a SidebarProvider");
  return context;
};
