"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/NavBar";

export default function DashboardPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const router = useRouter();

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as
      | "light"
      | "dark"
      | null;
    if (storedTheme) setTheme(storedTheme);
  }, []);

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");
  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/auth/login");
  };

  return (
    <div
      className={`min-h-screen flex flex-col ${
        theme === "dark"
          ? "bg-gray-900 text-white"
          : "bg-muted/40 text-gray-900"
      }`}
    >
      <Navbar
        theme={theme}
        toggleTheme={toggleTheme}
        handleLogout={handleLogout}
        toggleSidebar={function (): void {
          throw new Error("Function not implemented.");
        }}
      />

      <main className="flex-1 p-6 md:p-8 mt-16">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className={`p-4 rounded-lg shadow ${
                theme === "dark" ? "bg-gray-800" : "bg-white"
              }`}
            >
              Card {i + 1}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
