"use client";

import { createContext, useContext, useState } from "react";

type SidebarContextProps = {
  collapsed: boolean;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const SidebarProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggle: () => setCollapsed((prev) => !prev),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
};
