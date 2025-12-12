"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";

import SuccessAlert from "@/components/SuccessAlert";
import ErrorAlert from "@/components/ErrorAlert";
import PasswordAlert from "@/components/PasswordAlert";

interface User {
  user_id: number;
  user_email: string;
  user_password: string;
  user_department: number;
  user_fname: string;
  user_lname: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<"success" | "error" | "password" | null>(
    null
  );

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);

    try {
      // Fetch users
      const res = await fetch("http://100.126.246.124:8060/items/user");
      const json = await res.json();
      const users = json.data;

      // Find user with matching email and department
      const user = users.find(
        (u: User) => u.user_email === email && Number(u.user_department) === 2
      );

      if (!user) {
        setAlert("error");
        setLoading(false);
        return;
      }

      if (user.user_password !== password) {
        setAlert("password");
        setLoading(false);
        return;
      }

      // Successful login
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { user_password, ...userSafe } = user; // remove password
      sessionStorage.setItem("user", JSON.stringify(userSafe));
      setAlert("success");

      // Redirect immediately to dashboard
      router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      setAlert("error");
    } finally {
      setLoading(false);
    }
  };

  // Animation variants
  const formVariant = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const alertVariant = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-linear-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700">
      {/* Alerts */}
      <AnimatePresence>
        {alert === "success" && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={alertVariant}
          >
            <SuccessAlert />
          </motion.div>
        )}
        {alert === "error" && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={alertVariant}
          >
            <ErrorAlert />
          </motion.div>
        )}
        {alert === "password" && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={alertVariant}
          >
            <PasswordAlert />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Form */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={formVariant}
        className="w-full max-w-md rounded-xl border bg-white dark:bg-gray-900 p-8 shadow-xl dark:shadow-gray-800 space-y-4"
        style={{
          boxShadow: "0 10px 25px rgba(0,0,0,0.1), 0 6px 10px rgba(0,0,0,0.08)",
        }}
      >
        <div className="flex flex-col items-center gap-2 mb-2">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
            Enter your credentials to login to your account.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                placeholder="hi@yourcompany.com"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                placeholder="Enter your password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <motion.div whileTap={{ scale: 0.95 }}>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
}
