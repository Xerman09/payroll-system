"use client";

import { motion, AnimatePresence } from "framer-motion";
import { 
  Building2, 
  ChevronRight, 
  Globe, 
  Shield, 
  Zap, 
  Coffee, 
  Factory, 
  LineChart, 
  Cpu, 
  HardHat,
  Command,
  ArrowLeft
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface Entity {
  id: string;
  name: string;
  description: string;
  color: string;
}

const entityIcons: Record<string, React.ElementType> = {
  dummy: Globe,
  men2: LineChart,
  hanvin: HardHat,
  vertex: Cpu,
  rc2: Shield,
  vital: Zap,
  cafeteria: Coffee,
  manufacturing: Factory,
};

export default function EnterprisePortal() {
  const router = useRouter();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEntities() {
      try {
        const res = await fetch("/api/entities");
        if (!res.ok) {
          console.warn(`API /api/entities returned status: ${res.status}`);
          setLoading(false);
          return;
        }
        
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const json = await res.json();
          if (json.success) {
            setEntities(json.data);
          }
        } else {
          console.warn("API /api/entities did not return JSON");
        }
      } catch (err) {
        console.error("Failed to load entities:", err);
      } finally {
        setLoading(false);
      }
    }
    loadEntities();
  }, []);

  const handleSelect = (companyId: string) => {
    // Set cookie that expires in 1 day
    const date = new Date();
    date.setTime(date.getTime() + (24 * 60 * 60 * 1000));
    document.cookie = `selected_company_id=${companyId}; expires=${date.toUTCString()}; path=/`;
    
    // Smooth transition to login
    router.push("/auth/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
          <span className="text-white/30 text-xs font-black uppercase tracking-[0.3em]">Synching Hubs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden font-sans relative">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-cyan-500/10 blur-[150px] rounded-full -mr-96 -mt-96" />
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-indigo-600/10 blur-[150px] rounded-full -ml-96 -mb-96" />
        <div className="absolute inset-0 bg-[url('/images/grid.svg')] opacity-[0.03]" />
      </div>

      <div className="relative z-10 container mx-auto px-6 py-12 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between mb-16">
          <Link 
            href="/"
            className="group flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-white/50 group-hover:text-white group-hover:-translate-x-1 transition-all" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/50 group-hover:text-white">Back to Landing</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-2xl relative overflow-hidden">
               <Image src="/images/vtc-logo.jpg" alt="VTC" fill className="object-cover" />
            </div>
            <span className="text-xl font-black italic tracking-tighter">VTC</span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col justify-center max-w-7xl mx-auto w-full">
          <div className="mb-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6"
            >
              <Command className="w-3 h-3" />
              Enterprise Synchronization Port
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-8xl font-black tracking-tighter uppercase leading-[0.85] mb-6"
            >
              Enterprise <br />
              <span className="text-gradient-cyan italic">Gateway Portal</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-white/40 max-w-2xl text-lg font-medium"
            >
              Select an authorized business unit to initialize synchronization. 
              The system will dynamically resolve the appropriate neural engine and security protocols.
            </motion.p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-20">
            <AnimatePresence>
              {entities.map((entity, index) => {
                const Icon = entityIcons[entity.id] || Building2;

                return (
                  <motion.button
                    key={entity.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    onClick={() => handleSelect(entity.id)}
                    className="group relative flex flex-col p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 hover:border-white/20 transition-all text-left overflow-hidden hover:scale-[1.02] active:scale-[0.98] min-h-[280px]"
                  >
                    {/* Animated Glow on Hover */}
                    <div 
                      className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"
                      style={{ backgroundColor: entity.color }}
                    />
                    
                    <div 
                      className="absolute top-0 right-0 w-40 h-40 -mr-20 -mt-20 blur-[80px] opacity-0 group-hover:opacity-30 transition-opacity duration-700 rounded-full"
                      style={{ backgroundColor: entity.color }}
                    />

                    {/* Icon Stack */}
                    <div className="mb-auto relative z-10">
                      <div 
                        className="w-16 h-16 rounded-2xl flex items-center justify-center border border-white/10 glass-dark shadow-2xl"
                        style={{ color: entity.color }}
                      >
                        <Icon className="w-8 h-8" />
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="relative z-10">
                      <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none mb-3 group-hover:text-cyan-400 transition-colors">
                        {entity.name}
                      </h3>
                      <p className="text-xs text-white/30 font-medium leading-relaxed line-clamp-2">
                        {entity.description}
                      </p>
                    </div>

                    {/* Interaction Hint */}
                    <div className="mt-8 flex items-center justify-between relative z-10 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                      <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Connect Instance</span>
                      <div className="w-8 h-8 rounded-full bg-cyan-400/10 flex items-center justify-center border border-cyan-400/20">
                        <ChevronRight className="w-4 h-4 text-cyan-400" />
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-8 flex items-center justify-between border-t border-white/5 text-[10px] font-bold uppercase tracking-[0.3em] text-white/20">
           <span>Vertex Technology Hub v2.0 - Stable Deployment</span>
           <span className="text-cyan-500/50 italic underline">Proprietary Security Protocols Enabled</span>
        </footer>
      </div>

      <style jsx global>{`
        .text-gradient-cyan {
          background: linear-gradient(to right, #22d3ee, #3b82f6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .glass-dark {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(20px);
        }
      `}</style>
    </div>
  );
}
