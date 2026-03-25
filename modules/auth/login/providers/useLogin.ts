"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function useLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function login(email: string, password: string) {
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.status === "password") {
          toast.error("Password expired. Please reset your password.");
        } else {
          toast.error("Login failed. Please check your credentials.");
        }
        return;
      }

      if (json.status !== "success" || !json.user) {
        toast.error("Login failed. Please check your credentials.");
        return;
      }

      if (json.user_token) {
        sessionStorage.setItem("user_token", json.user_token);
      }
      toast.success("Login successful!");

      setTimeout(() => {
        router.replace("/dashboard");
      }, 300);
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return { login, loading };
}
