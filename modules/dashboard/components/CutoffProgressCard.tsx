"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Building2, 
  CheckCircle2, 
  Clock, 
  CalendarDays, 
  DollarSign, 
  Sparkles,
  Layers
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { CutoffProgressData } from "../types";
import { format } from "date-fns";

interface CutoffProgressCardProps {
  cutoffProgress: CutoffProgressData;
  loading?: boolean;
}

function safeFormatDate(dStr?: string | null): string {
  if (!dStr) return "N/A";
  try {
    const parts = dStr.slice(0, 10).split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return format(new Date(y, m, d), "MMM dd, yyyy");
    }
    return format(new Date(dStr), "MMM dd, yyyy");
  } catch {
    return dStr;
  }
}

export function CutoffProgressCard({ cutoffProgress, loading }: CutoffProgressCardProps) {
  const [filter, setFilter] = useState<"ALL" | "COMPLETED" | "PENDING">("ALL");

  if (loading) {
    return (
      <Card className="p-6 rounded-2xl border-white/10 bg-background/60 backdrop-blur-md shadow-xl mb-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-7 w-64" />
            </div>
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full rounded-full" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      </Card>
    );
  }

  const {
    cutoffTitle,
    startDate,
    endDate,
    payoutDate,
    paidDayPlusOne,
    isWindowActive,
    totalDepartments,
    completedDepartments,
    percentage,
    departments,
  } = cutoffProgress;

  const pendingCount = Math.max(0, totalDepartments - completedDepartments);

  const displayedDepts = departments.filter((d) => {
    if (filter === "COMPLETED") return d.isCompleted;
    if (filter === "PENDING") return !d.isCompleted;
    return true;
  });

  const isAllDone = totalDepartments > 0 && completedDepartments >= totalDepartments;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15 }}
      className="mb-8"
    >
      <Card className="relative overflow-hidden p-6 rounded-2xl border-white/10 bg-background/60 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300">
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative space-y-6">
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/30 text-primary font-semibold text-xs tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-primary/5">
                  <Layers className="w-3.5 h-3.5 mr-1.5 inline" />
                  Current Cutoff Payroll
                </Badge>
                {isWindowActive && (
                  <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                    <Clock className="w-3 h-3 mr-1 inline" />
                    Window Active (+1 Day Window)
                  </Badge>
                )}
              </div>
              
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                {cutoffTitle}
              </h2>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1">
                {startDate && endDate && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5 opacity-70" />
                    Period: <span className="font-medium text-foreground">{safeFormatDate(startDate)} → {safeFormatDate(endDate)}</span>
                  </span>
                )}
                {payoutDate && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                    Paid Day: <span className="font-medium text-foreground">{safeFormatDate(payoutDate)}</span>
                  </span>
                )}
                {paidDayPlusOne && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-sky-500" />
                    +1 Day Cutoff Window: <span className="font-medium text-foreground">{safeFormatDate(paidDayPlusOne)}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Percentage Display & Metric */}
            <div className="flex items-center gap-4 self-start md:self-auto">
              <div className="text-right">
                <div className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
                  {percentage}%
                </div>
                <div className="text-xs text-muted-foreground font-medium">
                  {completedDepartments} of {totalDepartments} Departments Done
                </div>
              </div>

              <div className={`p-3 rounded-2xl ring-1 ${
                isAllDone 
                  ? "bg-emerald-500/15 text-emerald-500 ring-emerald-500/30" 
                  : "bg-primary/10 text-primary ring-primary/20"
              }`}>
                {isAllDone ? (
                  <Sparkles className="w-7 h-7" />
                ) : (
                  <Building2 className="w-7 h-7" />
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-muted/60 rounded-full h-3.5 overflow-hidden p-0.5 border border-white/10 shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-full rounded-full transition-all ${
                  isAllDone
                    ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400"
                    : "bg-gradient-to-r from-primary via-indigo-500 to-emerald-500"
                }`}
              />
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>0% Started</span>
              <span className="font-medium text-foreground">
                {isAllDone 
                  ? "✓ 100% All Departments Posted" 
                  : `${pendingCount} Department${pendingCount === 1 ? "" : "s"} Pending`}
              </span>
              <span>100% Completed</span>
            </div>
          </div>

          {/* Department Breakdown Section */}
          <div className="pt-2 border-t border-border/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Department Payroll Status
              </span>

              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-white/5 text-xs">
                <button
                  type="button"
                  onClick={() => setFilter("ALL")}
                  className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                    filter === "ALL" 
                      ? "bg-background text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({totalDepartments})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("COMPLETED")}
                  className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                    filter === "COMPLETED" 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Done ({completedDepartments})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("PENDING")}
                  className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                    filter === "PENDING" 
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Pending ({pendingCount})
                </button>
              </div>
            </div>

            {/* Department Chips */}
            <div className="flex flex-wrap gap-2 pt-1 max-h-44 overflow-y-auto pr-1">
              {displayedDepts.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2 italic">
                  No departments match the selected filter.
                </div>
              ) : (
                displayedDepts.map((dept) => (
                  <div
                    key={dept.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      dept.isCompleted
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 shadow-sm"
                        : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/60"
                    }`}
                  >
                    {dept.isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
                    )}
                    <span className="truncate max-w-[200px]">{dept.name}</span>
                    <span className="text-[10px] opacity-60">#{dept.id}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
