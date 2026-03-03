"use client";

import { motion, useSpring, useTransform, useInView } from "framer-motion";
import { useEffect, useRef } from "react";

function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true });
    
    const spring = useSpring(0, {
        stiffness: 40,
        damping: 20,
    });
    
    const displayValue = useTransform(spring, (current) => Math.floor(current).toLocaleString() + suffix);

    useEffect(() => {
        if (isInView) {
            spring.set(value);
        }
    }, [isInView, spring, value]);

    return <motion.span ref={ref}>{displayValue}</motion.span>;
}

const metrics = [
    { label: "Accuracy Rate", value: 99.9, suffix: "%" },
    { label: "Payroll Runs", value: 10000, suffix: "+" },
    { label: "Processing Speed", value: 5, suffix: "m" },
    { label: "Client Retention", value: 98, suffix: "%" },
];

export function MetricsCounters() {
    return (
        <section id="why-us" className="relative py-24 md:py-32 bg-slate-950">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="container mx-auto px-6 will-change-transform will-change-opacity"
            >
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
                    {metrics.map((metric, index) => (
                        <motion.div 
                            key={index}
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: false }}
                            transition={{ delay: index * 0.1 }}
                            className="text-center group"
                        >
                            <h3 className="text-4xl md:text-6xl font-black text-white mb-2 group-hover:scale-110 transition-transform duration-500">
                                <Counter value={metric.value} suffix={metric.suffix} />
                            </h3>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                                {metric.label}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </section>
    );
}
