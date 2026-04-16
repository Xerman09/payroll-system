"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ChevronRight, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function HeroSection() {
  const { scrollY } = useScroll();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 0);
  }, []);

  const opacity = useTransform(scrollY, [0, 400], [1, 0]);
  const scale = useTransform(scrollY, [0, 400], [1, 0.9]);
  const y = useTransform(scrollY, [0, 400], [0, 100]);
  const bgY = useTransform(scrollY, [0, 1000], [0, 300]);

  if (!mounted) return null;

  return (
    <>
      <section className="relative min-h-[110vh] flex flex-col items-center justify-center overflow-hidden bg-slate-950 pt-20">
      {/* Background Parallax Image */}
      <motion.div 
        style={{ y: bgY }}
        className="absolute inset-0 z-0 opacity-40 grayscale-[0.5] contrast-125"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src="/images/hero_dashboard.png" 
          alt="Backdrop"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/20 to-slate-950" />
      </motion.div>

      {/* Navigation */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between glass mx-4 mt-6 rounded-[2rem] md:mx-auto md:max-w-6xl shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-xl border border-white/10 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/vtc-logo.jpg" alt="VTC Logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-xl font-black tracking-tighter text-white uppercase italic">VTC</span>
        </div>

        <div className="hidden md:flex items-center gap-10">
          {["Features", "Systems", "Resources", "Why Us"].map((item) => (
            <Link
              key={item}
              href={`#${item.toLowerCase().replace(" ", "-")}`}
              className="text-xs font-bold uppercase tracking-widest text-white/50 hover:text-cyan-400 transition-colors"
            >
              {item}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/portal"
            className="px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest text-white bg-white/5 hover:bg-cyan-500/20 border border-white/10 transition-all active:scale-95 hover:border-cyan-500/50"
          >
            LOGIN
          </Link>
        </div>
      </motion.nav>

      {/* Hero Content */}
      <motion.div
        style={{ opacity, scale, y }}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="container mx-auto px-6 pt-32 pb-24 relative z-10 text-center will-change-transform will-change-opacity"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-[0.2em] mb-12 backdrop-blur-xl"
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          VTC - Advanced Payroll Systems
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-6xl md:text-[6rem] font-black tracking-tighter mb-8 leading-[0.9] uppercase text-white"
        >
          Vertex Tech Corps. <br />
          <span className="text-gradient-cyan">Payroll System</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="text-lg md:text-2xl text-white/50 mb-14 max-w-3xl mx-auto leading-relaxed font-medium"
        >
          The definitive payroll engine. Deterministic accuracy, 
          vehicle-matrix mapping, and seamless bimonthly processing.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6"
        >
          <Link
            href="/portal"
            className="group relative px-10 py-5 rounded-[2rem] bg-indigo-600 text-white font-black uppercase tracking-widest text-sm shadow-2xl shadow-indigo-600/40 hover:scale-105 transition-all flex items-center gap-3 overflow-hidden active:scale-95"
          >
            <span className="relative z-10">Access System</span>
            <ChevronRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          </Link>

          <button className="flex items-center gap-4 px-10 py-5 rounded-[2rem] text-white/50 hover:text-white transition-all group hover:bg-white/5">
            <div className="w-14 h-14 rounded-full border-2 border-white/10 flex items-center justify-center bg-white/5 group-hover:border-indigo-500 group-hover:bg-indigo-500/10 transition-all">
              <Play className="w-6 h-6 fill-white text-white" />
            </div>
            <span className="font-black uppercase tracking-widest text-xs">Watch Engine</span>
          </button>
        </motion.div>
      </motion.div>

      {/* Decorative Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/4 -right-1/4 w-full h-full bg-cyan-500/20 blur-[150px] rounded-full"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear", delay: 2 }}
          className="absolute -bottom-1/4 -left-1/4 w-full h-full bg-purple-600/20 blur-[150px] rounded-full"
        />
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-white/30 text-xs font-medium tracking-widest uppercase mb-2">Scroll</span>
        <div className="w-[1px] h-12 bg-gradient-to-b from-white/30 to-transparent" />
      </motion.div>
      </section>
    </>
  );
}
