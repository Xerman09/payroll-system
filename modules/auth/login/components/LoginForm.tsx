"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { useState } from "react";

export default function LoginForm({
  onSubmit,
  loading,
}: {
  onSubmit: (email: string, password: string) => void;
  loading: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(email, password);
      }}
      className="space-y-5"
    >
      <div className="flex flex-col gap-2">
        <Label>Email</Label>
        <Input
          type="email"
          required
          placeholder="hi@yourcompany.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Password</Label>
        <Input
          type="password"
          required
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <motion.div whileTap={{ scale: 0.95 }}>
        <Button className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </motion.div>
    </form>
  );
}
