"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { useState } from "react";
import { Lock, Mail, ArrowRight, Loader2 } from "lucide-react";

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
      {/* Email Field */}
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30 ml-1 flex items-center gap-2">
          <Mail className="w-3 h-3" />
          Corporate Email
        </Label>
        <div>
          <Input
            type="email"
            required
            id="login-email"
            placeholder="admin@vtc-systems.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="relative bg-slate-900/50 border-white/10 rounded-2xl py-6 px-5 text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300 text-sm"
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30 ml-1 flex items-center gap-2">
          <Lock className="w-3 h-3" />
          Secure Password
        </Label>
        <div>
          <Input
            type="password"
            required
            id="login-password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="relative bg-slate-900/50 border-white/10 rounded-2xl py-6 px-5 text-white placeholder:text-slate-600 focus:border-white/20 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300 text-sm"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-3">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
          <Button
            id="login-submit-btn"
            className="w-full h-14 relative overflow-hidden bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black uppercase text-xs tracking-[0.25em] rounded-2xl shadow-2xl shadow-cyan-500/20 transition-all duration-300 disabled:opacity-50 group"
            disabled={loading}
          >
            {/* Button shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            {loading ? (
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Access...</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span>Authenticate</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            )}
          </Button>
        </motion.div>
      </div>
    </form>
  );
}
