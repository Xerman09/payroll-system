"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoginAlert } from "../types";

export function useLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<LoginAlert | null>(null);

  async function login(email: string, password: string) {
    setLoading(true);
    setAlert(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.status === "password") {
          setAlert("password");
        } else {
          setAlert("error");
        }
        return;
      }

      if (json.status !== "success" || !json.user) {
        setAlert("error");
        return;
      }

      sessionStorage.setItem("user", JSON.stringify(json.user));
      setAlert("success");

      setTimeout(() => {
        router.replace("/dashboard");
      }, 300);
    } catch {
      setAlert("error");
    } finally {
      setLoading(false);
    }
  }

  return { login, loading, alert };
}
