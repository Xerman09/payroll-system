"use client";

import { motion } from "framer-motion";
import { FileText, History, PieChart, FileCheck, ChevronRight } from "lucide-react";

const reports = [
  {
    title: "Historical Auditing",
    desc: "Every adjustment and processing step is logged with a full audit trail.",
    icon: <History className="w-5 h-5 text-blue-400" />,
  },
  {
    title: "Top Sheet Summaries",
    desc: "Aggregated views for accounting and management review, instantly generated.",
    icon: <PieChart className="w-5 h-5 text-indigo-400" />,
  },
  {
    title: "Automated PDF Engine",
    desc: "Batch generate payslips and reports with custom branding, security settings, and dynamic data integration.",
    icon: <FileText className="w-5 h-5 text-cyan-400" />,
  },
];

export function RecordsReporting() {
  return (
    <section id="features" className="relative py-32 bg-slate-950 overflow-hidden snap-section">
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="container mx-auto px-6 relative z-10 will-change-transform will-change-opacity"
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
                {/* Visual Side */}
                <div className="relative order-2 lg:order-1">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, rotateY: 5 }}
                        whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
                        viewport={{ once: false }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="relative z-10 glass-dark p-3 rounded-[3rem] border border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] overflow-hidden will-change-transform"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                            src="/images/premium_trucks.png"
                            className="w-full h-full object-cover rounded-[2.5rem] grayscale-[0.3] group-hover:grayscale-0 transition-all duration-1000"
                            alt="Logistics Flow"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
                    </motion.div>

                    {/* Floating Records Card */}
                    <motion.div
                        initial={{ x: 30, opacity: 0 }}
                        whileInView={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.5, duration: 1 }}
                        viewport={{ once: false }}
                        className="absolute -bottom-10 -right-8 z-20 glass p-8 rounded-[2rem] border border-white/20 shadow-2xl max-w-xs"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <FileCheck className="w-8 h-8 text-cyan-400" />
                            <span className="text-white font-black uppercase tracking-widest text-[10px]">Verified Record</span>
                        </div>
                        <p className="text-[11px] text-white/40 leading-relaxed font-bold uppercase tracking-wider">
                            Top Sheet Generated <br />
                            <span className="text-white">ID: VTC-2024-081</span>
                        </p>
                    </motion.div>
                </div>

                {/* Content Side */}
                <div className="order-1 lg:order-2">
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: false }}
                        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <h2 className="text-5xl md:text-7xl font-black mb-10 leading-[0.9] uppercase italic tracking-tighter text-white">
                            Reporting <br />
                            <span className="text-gradient-cyan">Refined</span>
                        </h2>
                        
                        <p className="text-xl text-white/40 mb-12 max-w-lg leading-relaxed font-medium">
                            The VTC reporting engine transforms raw data layers into
                            comprehensive PAYROLL TOP SHEETS for any
                            dispatch or vehicle scale.
                        </p>

                        <div className="space-y-8">
                            {reports.map((item, index) => (
                                <motion.div 
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: false }}
                                    transition={{ delay: index * 0.1 }}
                                    className="flex items-start gap-6 group"
                                >
                                    <div className="mt-1 w-10 h-10 border border-white/10 rounded-xl flex items-center justify-center text-white group-hover:border-cyan-500/50 transition-colors">
                                        {index + 1}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold uppercase text-xs tracking-widest mb-2 group-hover:text-cyan-400 transition-colors">{item.title}</h3>
                                        <p className="text-sm text-white/30 max-w-sm leading-relaxed font-medium">
                                            {item.desc}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="mt-16 flex items-center gap-3 text-cyan-400 font-black uppercase text-[10px] tracking-[0.3em] group"
                        >
                            Explore PDF Engine 
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </motion.button>
                    </motion.div>
                </div>
            </div>
        </motion.div>

        {/* Parallax elements */}
        <div className="absolute top-1/4 left-10 w-2 h-24 bg-gradient-to-b from-cyan-500/20 to-transparent rounded-full blur-sm" />
        <div className="absolute bottom-1/4 right-20 w-1 h-32 bg-gradient-to-t from-purple-500/20 to-transparent rounded-full blur-sm" />
    </section>
  );
}
