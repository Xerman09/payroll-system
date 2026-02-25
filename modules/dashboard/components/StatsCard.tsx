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
      <Card className="p-6 rounded-2xl border-white/10 bg-background/60 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay * 0.1 }}
      whileHover={{ y: -5 }}
    >
      <Card className="relative overflow-hidden p-6 rounded-2xl border-white/10 bg-background/60 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300 group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <h3 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              {value}
            </h3>
            
            {(trend || description) && (
              <div className="mt-2 flex items-center text-xs">
                {trend && (
                  <span
                    className={`font-medium ${
                      trendUp ? "text-emerald-500" : "text-rose-500"
                    } mr-2`}
                  >
                    {trend}
                  </span>
                )}
                {description && (
                  <span className="text-muted-foreground">{description}</span>
                )}
              </div>
            )}
          </div>
          
          <div className="p-3 bg-primary/10 rounded-xl text-primary ring-1 ring-primary/20 group-hover:bg-primary/20 transition-colors">
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
