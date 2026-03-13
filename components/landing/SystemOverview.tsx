"use client";

import { motion } from "framer-motion";
import { Cpu, Zap, Shield, Database } from "lucide-react";

const benefits = [
  {
    icon: <Zap className="w-5 h-5 text-cyan-400" />,
    title: "Next.js 16 Core",
    description: "Built on the latest React 19 and Next.js 16 architecture for unmatched speed.",
  },
  {
    icon: <Database className="w-5 h-5 text-purple-400" />,
    title: "Headless Backend",
    description: "Decoupled architecture allows for rapid schema changes and flexibility.",
  },
  {
    icon: <Cpu className="w-5 h-5 text-indigo-400" />,
    title: "Computation Engine",
    description: "High-performance processing of complex logistics payout matrices.",
  },
  {
    icon: <Shield className="w-5 h-5 text-blue-400" />,
    title: "Type-Safe Accuracy",
    description: "Deterministic computations powered by TypeScript and strict validation.",
  },
];

export function SystemOverview() {
  return (
    <section id="systems" className="relative py-32 md:py-48 overflow-hidden bg-slate-950">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="container mx-auto px-6 relative z-10 will-change-transform will-change-opacity"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="text-5xl md:text-7xl font-black mb-8 leading-[0.9] uppercase italic tracking-tighter text-white">
              Engineering <br />
              <span className="text-gradient-cyan">The Core</span>
            </h2>
            <p className="text-xl text-white/40 mb-14 max-w-xl leading-relaxed font-medium">
              VTC - Payroll System is a high-performance engine designed for bimonthly operations. We handle vehicle-area mapping and stacked holiday pay 
              logic with deterministic speed.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false }}
                  transition={{ delay: index * 0.1, duration: 0.8 }}
                  className="flex flex-col gap-6"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-2xl">
                    {benefit.icon}
                  </div>
                  <div>
                    <h3 className="text-white font-black uppercase tracking-widest text-xs mb-3">{benefit.title}</h3>
                    <p className="text-sm text-white/30 font-medium leading-relaxed">{benefit.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Visual/Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: 20 }}
            whileInView={{ opacity: 1, scale: 1, x: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative will-change-transform"
          >
            <div className="relative z-10 glass-dark rounded-[3rem] p-4 border border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] overflow-hidden aspect-video group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/images/logistics_flow.png" 
                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-[2s]"
                alt="System Flow"
              />
              <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent transition-colors duration-1000" />
            </div>

            {/* Floating Detail */}
            <motion.div
                initial={{ y: 20 }}
                animate={{ y: [-15, 15, -15] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                whileInView={{ opacity: [0, 1] }}
                viewport={{ once: false }}
                className="absolute -top-12 -right-8 z-20 glass p-8 rounded-[2rem] shadow-2xl border border-white/20 max-w-xs backdrop-blur-3xl"
            >
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <Zap className="w-6 h-6 text-cyan-400" />
                    </div>
                    <span className="text-white font-black uppercase tracking-widest text-[10px]">Real-Time Sync</span>
                </div>
                <div className="space-y-3">
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            whileInView={{ width: "94%" }}
                            viewport={{ once: false }}
                            transition={{ duration: 2, delay: 1 }}
                            className="h-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]" 
                        />
                    </div>
                    <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">Node Accuracy: 99.98%</p>
                </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
