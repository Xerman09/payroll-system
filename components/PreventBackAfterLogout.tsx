"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PreventBackAfterLogout() {
  const router = useRouter();

  useEffect(() => {
    const handlePopState = () => {
      const session = localStorage.getItem("user");
      if (!session) router.replace("/auth/login");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  return null;
}
