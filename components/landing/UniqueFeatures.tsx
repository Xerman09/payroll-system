"use client";

import { motion } from "framer-motion";
import { Truck, Calculator, ShieldAlert, Sparkles, Layers } from "lucide-react";

const uniqueFeatures = [
    {
        title: "Rate & Payout Matrix",
        detail: "Vehicle classification + Service Area",
        description: "Dynamic mapping engine that automatically calculates base rates and incentives based on vehicle type and delivery zones.",
        icon: <Truck className="w-6 h-6" />,
        accent: "border-cyan-500/20 group-hover:border-cyan-500/50",
    },
    {
        title: "Computation Engine",
        detail: "Deterministic & Audit-Ready",
        description: "Engineered with effective-date proration and stacked holiday pay logic. Built with strict TypeScript validation for 100% accuracy.",
        icon: <Calculator className="w-6 h-6" />,
        accent: "border-purple-500/20 group-hover:border-purple-500/50",
    },
    {
        title: "Industry-Specific Deductions",
        detail: "DR Payments & Shortages",
        description: "Logistics-aware deduction system for handling delivery receipts, fuel shortages, and equipment maintenance tracking.",
        icon: <ShieldAlert className="w-6 h-6" />,
        accent: "border-rose-500/20 group-hover:border-rose-500/50",
    },
];

export function UniqueFeatures() {
    return (
        <section className="relative py-24 bg-slate-950 overflow-hidden">
             {/* Background Effects */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,0)_0%,rgba(2,6,23,1)_100%)] z-10" />
             <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-white/5 rounded-full z-0" 
             />
             <motion.div 
                animate={{ rotate: -360 }}
                transition={{ duration: 70, repeat: Infinity, ease: "linear" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/5 rounded-full z-0" 
             />

            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="container mx-auto px-6 relative z-10 will-change-transform will-change-opacity"
            >
                <div className="text-center mb-20">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: false }}
                        className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em] mb-10"
                    >
                        <Sparkles className="w-4 h-4" />
                        VTC - Logistics Specialization
                    </motion.div>
                    <h2 className="text-5xl md:text-8xl font-black mb-8 uppercase italic tracking-tighter text-white">
                        Next-Gen <span className="text-gradient-cyan">Logic</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {uniqueFeatures.map((feature, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.9, y: 50 }}
                            whileInView={{ opacity: 1, scale: 1, y: 0 }}
                            viewport={{ once: false }}
                            transition={{ delay: index * 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className={`group relative glass-dark p-12 rounded-[3.5rem] border-2 transition-all duration-700 ${feature.accent} hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.8)]`}
                        >
                            <div className="mb-8">
                                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-white/10 transition-all duration-500">
                                    {feature.icon}
                                </div>
                            </div>
                            
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2 block">
                                {feature.detail}
                            </span>
                            <h3 className="text-2xl font-bold text-white mb-4">
                                {feature.title}
                            </h3>
                            <p className="text-white/50 leading-relaxed font-medium">
                                {feature.description}
                            </p>

                            <Layers className="absolute top-10 right-10 w-12 h-12 text-white/5 group-hover:text-white/10 transition-colors" />
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </section>
    );
}
