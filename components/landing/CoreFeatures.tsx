"use client";

import { motion } from "framer-motion";
import { 
  Users, 
  Clock, 
  Wand2, 
  HeartPulse, 
  PiggyBank, 
  BarChart3 
} from "lucide-react";

const features = [
  {
    title: "Wage Management",
    description: "Dynamic rate & payout matrix mapping vehicle classifications to service areas.",
    icon: <Users className="w-6 h-6" />,
    color: "from-blue-500 to-cyan-500",
  },
  {
    title: "Bi-Monthly Cutoffs",
    description: "Sophisticated timeline logic for accurate bimonthly payroll processing.",
    icon: <Clock className="w-6 h-6" />,
    color: "from-purple-500 to-pink-500",
  },
  {
    title: "Payroll Run Wizard",
    description: "Deterministic 4-step process: Configure → Adjust → Process → Review.",
    icon: <Wand2 className="w-6 h-6" />,
    color: "from-orange-500 to-amber-500",
  },
  {
    title: "Government Benefits",
    description: "Deeply integrated modules for SSS, Philhealth, and Pagibig compliance.",
    icon: <HeartPulse className="w-6 h-6" />,
    color: "from-red-500 to-rose-500",
  },
  {
    title: "Loan Management",
    description: "Automated deduction tracking with clear historical auditing and logs.",
    icon: <PiggyBank className="w-6 h-6" />,
    color: "from-emerald-500 to-teal-500",
  },
  {
    title: "Records & Analysis",
    description: "Real-time top sheet summaries and automated PDF reporting engine.",
    icon: <BarChart3 className="w-6 h-6" />,
    color: "from-indigo-500 to-blue-500",
  },
];

export function CoreFeatures() {
  return (
    <section id="features" className="relative py-32 bg-slate-950 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 0.8 }}
        className="container mx-auto px-6 relative z-10"
      >
        <div className="flex flex-col lg:flex-row gap-20 items-center mb-20">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.8 }}
            className="lg:w-1/2"
          >
            <h2 className="text-5xl md:text-8xl font-black text-white mb-8 leading-[0.8] uppercase italic tracking-tighter">
              The Engine of <br />
              <span className="text-gradient-gold">Precision</span>
            </h2>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.8 }}
            className="lg:w-1/2"
          >
            <p className="text-xl text-white/40 leading-relaxed font-medium">
              We&apos;ve automated the most complex logic layers of logistics payroll. 
              From multi-node payout matrices to daily driver performance tracking, 
              everything is deterministic.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: false }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="group glass p-10 rounded-[2.5rem] border border-white/5 hover:border-white/20 transition-all duration-500 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] bg-white/[0.02]"
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} p-[1px] mb-8 group-hover:scale-110 transition-transform duration-500`}>
                <div className="w-full h-full rounded-2xl bg-slate-950 flex items-center justify-center text-white">
                  {feature.icon}
                </div>
              </div>
              
              <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tight">{feature.title}</h3>
              <p className="text-white/30 text-sm leading-relaxed font-medium">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 blur-[150px] -z-10" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 blur-[150px] -z-10" />
    </section>
  );
}
