"use client";

import { motion } from "framer-motion";
import { Send } from "lucide-react";
import Link from "next/link";

export function CTAAndFooter() {
    return (
        <>
            <section id="cta" className="relative py-24 bg-slate-950 overflow-hidden">
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: false, amount: 0.1 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="container mx-auto px-6 will-change-transform will-change-opacity"
                >
                    <div className="relative glass-dark p-12 md:p-24 rounded-[4rem] text-center overflow-hidden border border-white/10">
                        {/* Background Blobs */}
                        <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-purple-500/10 blur-[100px] rounded-full -translate-y-1/2 -translate-x-1/2" />
                        <div className="relative z-10 max-w-3xl mx-auto">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: false }}
                            >
                                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />

                                <h2 className="text-4xl md:text-6xl font-bold mb-8 leading-tight text-white">
                                    Ready to Transform Your <br />
                                    <span className="text-gradient-cyan">Payroll Accuracy?</span>
                                </h2>
                                
                                <p className="text-xl text-white/40 mb-12 font-medium">
                                    Join the logistics leaders who trust our deterministic payout 
                                    architecture for their entire fleet operations.
                                </p>

                                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                                    <Link href="/auth/login">
                                        <motion.button 
                                            whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(6, 182, 212, 0.3)" }}
                                            whileTap={{ scale: 0.95 }}
                                            className="px-12 py-5 bg-cyan-500 text-slate-950 font-black uppercase text-xs tracking-[0.2em] rounded-full shadow-2xl shadow-cyan-500/20"
                                        >
                                            Access System
                                        </motion.button>
                                    </Link>
                                    <button className="text-white/40 font-bold uppercase text-[10px] tracking-widest hover:text-white transition-colors">
                                        Request Demo
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>
            </section>

            <footer className="bg-slate-950 border-t border-white/5 pt-20 pb-10">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                        <div className="col-span-1 md:col-span-2">
                             <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-xl border border-white/10 bg-white">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/images/vtc-logo.jpg" alt="VTC Logo" className="w-full h-full object-cover" />
                                </div>
                                <span className="text-2xl font-black text-white italic tracking-tighter uppercase">VTC</span>
                            </div>
                            <p className="text-white/30 max-w-sm leading-relaxed mb-10 font-medium">
                                VTC - Payroll System. Engineering the future of logistics-centric 
                                compensation with deterministic accuracy and headless flexibility.
                            </p>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="email" 
                                    placeholder="Stay updated" 
                                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors w-full max-w-[200px]"
                                />
                                <button className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                                    <Send className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-white font-semibold mb-6">System</h4>
                            <ul className="space-y-4">
                                {["Features", "Accuracy", "API", "Logs"].map(l => (
                                    <li key={l}><Link href="#" className="text-white/40 text-sm hover:text-cyan-400 transition-colors">{l}</Link></li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white font-semibold mb-6">Company</h4>
                            <ul className="space-y-4">
                                {["About", "Resources", "Legal", "Security"].map(l => (
                                    <li key={l}><Link href="#" className="text-white/40 text-sm hover:text-cyan-400 transition-colors">{l}</Link></li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                        <p className="text-white/20 text-[10px] uppercase tracking-[0.3em] font-black">
                            © 2026 VTC Enterprise Systems. All rights reserved.
                        </p>
                        <div className="flex gap-8">
                             <Link href="#" className="text-white/20 text-[10px] uppercase tracking-widest font-bold hover:text-white/40 transition-colors">Twitter</Link>
                             <Link href="#" className="text-white/20 text-[10px] uppercase tracking-widest font-bold hover:text-white/40 transition-colors">GitHub</Link>
                             <Link href="#" className="text-white/20 text-[10px] uppercase tracking-widest font-bold hover:text-white/40 transition-colors">Status</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </>
    );
}
