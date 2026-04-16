// providers/SidebarProvider.tsx
"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";

interface SidebarContextProps {
  collapsed: boolean;
  toggle: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  autoCollapse: boolean;
  setAutoCollapse: (a: boolean) => void;
  setCollapsed: (c: boolean | ((prev: boolean) => boolean)) => void;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export function SidebarProvider({ children }: { children: ReactNode }) {
  // set collapsed: true initially
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [autoCollapse, setAutoCollapseState] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("setting_sidebar_autocollapse") === "true";
    }
    return false;
  });

  // Load from localStorage on mount
  useEffect(() => {
    // No-op mount effect to ensure hydration consistency if needed
  }, []);

  const setAutoCollapse = useCallback((val: boolean) => {
    setAutoCollapseState(val);
    localStorage.setItem("setting_sidebar_autocollapse", String(val));
  }, []);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);
  const value = useMemo(
    () => ({ collapsed, toggle, mobileOpen, setMobileOpen, autoCollapse, setAutoCollapse, setCollapsed }),
    [collapsed, toggle, mobileOpen, autoCollapse, setAutoCollapse, setCollapsed]
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context)
    throw new Error("useSidebar must be used within a SidebarProvider");
  return context;
};
