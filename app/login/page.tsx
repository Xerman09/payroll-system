"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://100.126.246.124:8060/items/user");
      const json = await res.json();
      type User = {
        user_email: string;
        user_password: string;
        user_department: string | number;
        [key: string]: any;
      };
      const users: User[] = json.data as User[];

      const user = users.find(
        (u: User) =>
          u.user_email === email &&
          u.user_password === password &&
          Number(u.user_department) === 2 // HR only
      );

      if (!user) {
        setError("Invalid credentials or unauthorized department.");
        setLoading(false);
        return;
      }

      localStorage.setItem("user", JSON.stringify(user));
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-6">
      <form
        onSubmit={handleLogin}
        className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md"
      >
        <h1 className="text-2xl font-semibold mb-6 text-center">HR Login</h1>

        {error && (
          <p className="bg-red-200 text-red-700 p-2 rounded mb-4 text-sm">
            {error}
          </p>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            className="w-full border rounded p-2 focus:ring focus:ring-blue-300"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            className="w-full border rounded p-2 focus:ring focus:ring-blue-300"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        >
          {loading ? "Checking..." : "Login"}
        </button>

        {/* Link example using Next.js Link */}
        <p className="text-center mt-4 text-sm text-gray-500">
          Not an HR staff?{" "}
          <Link href="/" className="text-blue-600 hover:underline">
            Go back
          </Link>
        </p>
      </form>
    </div>
  );
}
