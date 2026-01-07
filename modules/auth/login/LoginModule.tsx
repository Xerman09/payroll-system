"use client";

import { motion } from "framer-motion";
import LoginForm from "./components/LoginForm";
import { useLogin } from "./providers/useLogin";

export default function LoginModule() {
  const { login, loading } = useLogin();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-gray-900 border rounded-xl p-8 shadow-xl space-y-4"
      >
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to continue
          </p>
        </div>

        <LoginForm onSubmit={login} loading={loading} />
      </motion.div>
    </div>
  );
}
