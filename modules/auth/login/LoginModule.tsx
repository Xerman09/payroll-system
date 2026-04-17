"use client";

import { motion } from "framer-motion";
import LoginForm from "./components/LoginForm";
import { useLogin } from "./providers/useLogin";
import Link from "next/link";
import { Shield, Zap, Lock } from "lucide-react";

export default function LoginModule() {
  const { login, loading } = useLogin();

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-slate-950">
      {/* Premium Background */}
      <div className="absolute inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/bg/login-bg.png"
          alt="Login Background"
          className="w-full h-full object-cover"
          style={{ imageRendering: "crisp-edges" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/60 via-slate-950/40 to-slate-950/65" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/20" />
      </div>

      {/* Animated Glow Orbs */}
      <motion.div
        animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 blur-[130px] rounded-full"
      />
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.15, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/10 blur-[130px] rounded-full"
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 z-[1] opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* 2-Column Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-4xl"
      >
        {/* Card border glow */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-cyan-500/25 via-purple-500/10 to-transparent blur-sm" />

        <div className="relative grid grid-cols-1 lg:grid-cols-2 overflow-hidden rounded-2xl border border-white/10 shadow-[0_60px_120px_-20px_rgba(0,0,0,0.9)]">

          {/* LEFT SIDE — Branding */}
          <div className="relative flex flex-col justify-between p-12 bg-slate-900/80 backdrop-blur-3xl border-r border-white/8 overflow-hidden">
            {/* Background accent on left */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-cyan-500/15 blur-[80px] rounded-full" />
            <div className="absolute -bottom-24 -right-12 w-48 h-48 bg-purple-500/15 blur-[80px] rounded-full" />

            {/* Top edge highlight */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            {/* Logo & Brand */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-3 mb-12"
              >
                <div className="relative">
                  <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-cyan-500/40 to-purple-500/30 blur-sm" />
                  <div className="relative w-12 h-12 rounded-xl bg-slate-900 border border-white/15 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/vtc-logo.jpg" alt="VTC Logo" className="w-8 h-8 object-cover rounded-lg" />
                  </div>
                </div>
                <span className="text-white font-black uppercase tracking-widest text-sm italic">VTC</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic leading-none mb-2">
                  Precision
                </h1>
                <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none mb-6">
                  <span className="text-gradient-cyan">Payroll.</span>
                </h1>
                <p className="text-white/35 font-medium text-sm leading-relaxed max-w-xs">
                  Delivering compensation solutions with reliable precision.
                </p>
              </motion.div>
            </div>

            {/* Feature Pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="space-y-3"
            >
              {[
                { icon: <Shield className="w-3.5 h-3.5" />, label: "Enterprise Security" },
                { icon: <Zap className="w-3.5 h-3.5" />, label: "Real-Time Processing" },
                { icon: <Lock className="w-3.5 h-3.5" />, label: "Audit-Ready Records" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-white/30">
                  <span className="text-cyan-500/70">{item.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">{item.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* RIGHT SIDE — Login Form */}
          <div className="relative flex flex-col justify-center p-12 bg-slate-950/75 backdrop-blur-3xl overflow-hidden">
            {/* Top edge highlight */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="space-y-8"
            >
              {/* Form Header */}
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                  Login Page
                </h2>
                <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.25em]">
                  Enter your credentials to continue
                </p>
                <div className="w-12 h-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full mt-4" />
              </div>

              {/* Form */}
              <LoginForm onSubmit={login} loading={loading} />

              {/* Back Link */}
              <div className="pt-2">
                <Link
                  href="/portal"
                  className="text-[10px] font-black uppercase tracking-[0.3em] text-white/15 hover:text-cyan-400 transition-colors duration-300"
                >
                  ← Return to Portal
                </Link>
              </div>
            </motion.div>
          </div>

        </div>
      </motion.div>

      {/* Bottom badge */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10"
      >
        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white/12">
          © 2026 VTC Enterprise Systems
        </p>
      </motion.div>
    </div>
  );
}
