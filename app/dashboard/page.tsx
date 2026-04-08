"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getLoggedUser } from "@/lib/auth";

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    const user = getLoggedUser();
    if (user?.user_id) {
      router.replace(`/dashboard/${user.user_id}`);
    } else {
      router.replace("/auth/login");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
    </div>
  );
}
