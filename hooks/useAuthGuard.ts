"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function useAuthGuard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("user"); // <-- sessionStorage now
    if (!token) {
      router.replace("/auth/login"); // redirect if no session
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
    }

    const handlePopState = () => {
      const t = sessionStorage.getItem("user");
      if (!t) router.replace("/auth/login");
    };
    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  return loading;
}
