"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

const rows = [
    { label: "Industry Focus", standard: "Generic SaaS", premium: "Logistics-Centric" },
    { label: "Rate Logic", standard: "Flat/Fixed Rates", premium: "Dynamic Matrix Mapping" },
    { label: "Architecture", standard: "Monolithic/Rigid", premium: "Headless & Flexible" },
    { label: "Accuracy", standard: "Manual Corrections", premium: "Deterministic / Type-Safe" },
    { label: "Reporting", standard: "Basic CSVs", premium: "Premium PDF Engine" },
];

export function ComparisonTable() {
    return (
        <section id="why-us" className="relative py-24 md:py-32 bg-slate-950">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="container mx-auto px-6 will-change-transform will-change-opacity"
            >
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-bold text-white mb-4">The Standard vs. <span className="text-gradient-cyan">Precision</span></h2>
                    <p className="text-white/40">Why logistics leaders choose VTC - Payroll System over generic alternatives.</p>
                </div>

                <div className="max-w-4xl mx-auto">
                    <div className="glass-dark rounded-3xl border border-white/10 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/5">
                                    <th className="p-6 text-white/40 font-medium text-sm border-r border-white/10">Features</th>
                                    <th className="p-6 text-white/40 font-medium text-sm border-r border-white/10 text-center">Standard Systems</th>
                                    <th className="p-6 text-cyan-400 font-bold text-sm text-center">VTC - Payroll System</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, index) => (
                                    <motion.tr 
                                        key={index}
                                        initial={{ opacity: 0, x: -20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: false }}
                                        transition={{ delay: index * 0.1 }}
                                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                    >
                                        <td className="p-6 text-white font-medium border-r border-white/5">{row.label}</td>
                                        <td className="p-6 text-white/30 border-r border-white/5 text-center italic">{row.standard}</td>
                                        <td className="p-6 text-white font-bold bg-cyan-500/5 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Check className="w-4 h-4 text-cyan-400" />
                                                {row.premium}
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </motion.div>
        </section>
    );
}
