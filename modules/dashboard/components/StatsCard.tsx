"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  description?: string;
  loading?: boolean;
  delay?: number;
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  description,
  loading,
  delay = 0,
}: StatsCardProps) {
  if (loading) {
    return (
      <Card className="p-4 sm:p-5 rounded-2xl border-white/10 bg-background/60 backdrop-blur-md shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2 flex-1 min-w-0">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
        </div>
      </Card>
    );
  }

  const isLongValue = String(value).length > 8;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay * 0.08 }}
      whileHover={{ y: -3 }}
      className="h-full"
    >
      <Card className="relative h-full overflow-hidden p-4 sm:p-5 rounded-2xl border-white/10 bg-background/60 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300 group flex flex-col justify-between">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        
        <div className="relative flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate" title={title}>
              {title}
            </p>
            <h3 
              className={`mt-1 font-bold tracking-tight text-foreground truncate ${
                isLongValue 
                  ? "text-lg sm:text-xl lg:text-lg xl:text-xl 2xl:text-2xl" 
                  : "text-2xl sm:text-3xl"
              }`}
              title={typeof value === "string" ? value : undefined}
            >
              {value}
            </h3>
            
            {(trend || description) && (
              <div className="mt-2 flex items-center gap-1.5 text-xs min-w-0 flex-wrap">
                {trend && (
                  <span
                    className={`font-semibold shrink-0 ${
                      trendUp === true 
                        ? "text-emerald-500 dark:text-emerald-400" 
                        : trendUp === false 
                        ? "text-rose-500 dark:text-rose-400" 
                        : "text-primary dark:text-primary/90"
                    }`}
                  >
                    {trend}
                  </span>
                )}
                {trend && description && (
                  <span className="text-muted-foreground/40 shrink-0">•</span>
                )}
                {description && (
                  <span className="text-muted-foreground truncate" title={description}>
                    {description}
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-primary/10 rounded-xl text-primary ring-1 ring-primary/20 group-hover:bg-primary/20 transition-colors shrink-0">
            <Icon className="w-5 h-5 shrink-0" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
