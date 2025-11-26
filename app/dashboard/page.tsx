"use client";

import Link from "next/link";

export default function Dashboard() {
  const user =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("user") || "null")
      : null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">
        Welcome, {user?.user_fname} {user?.user_lname}!
      </h1>

      <p className="text-gray-600 mb-4">You are logged in as HR Department.</p>

      <Link href="/login" className="text-blue-600 hover:underline text-sm">
        Logout
      </Link>
    </div>
  );
}
