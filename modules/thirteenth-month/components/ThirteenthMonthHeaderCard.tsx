// modules/thirteenth-month/components/ThirteenthMonthHeaderCard.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  DollarSign,
  Users,
  Settings2,
  RefreshCw,
  Sparkles,
  Layers,
  CheckCircle2,
  Clock,
  Calculator,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ThirteenthMonthHeader, ThirteenthMonthSummary } from "../types";
import { safeFormatDate } from "../providers/thirteenthMonthService";

interface ThirteenthMonthHeaderCardProps {
  header: ThirteenthMonthHeader;
  summary: ThirteenthMonthSummary;
  onEditHeader: () => void;
  onRecalculate: () => void;
  isRecalculating?: boolean;
}

export function ThirteenthMonthHeaderCard({
  header,
  summary,
  onEditHeader,
  onRecalculate,
  isRecalculating = false,
}: ThirteenthMonthHeaderCardProps) {
  const isPosted = header.status === "POSTED";

  return (
    <motion.div
      initial={{ opacity: 0, y: -15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mb-8"
    >
      <Card className="relative overflow-hidden p-6 sm:p-7 rounded-2xl border border-white/10 bg-background/60 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300">
        {/* Glow ambient background mesh */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative space-y-6">
          {/* Top Bar: Title & Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-primary/30 text-primary font-semibold text-xs tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-primary/5"
                >
                  <Layers className="w-3.5 h-3.5 mr-1.5 inline" />
                  13th Month Pay Batch
                </Badge>

                <Badge
                  className={`text-xs font-medium border ${
                    isPosted
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
                  }`}
                >
                  {isPosted ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                      Posted
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3 mr-1 inline" />
                      Calculated (Draft)
                    </>
                  )}
                </Badge>

                <span className="text-xs font-mono text-muted-foreground ml-1">
                  #{header.batch_number}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                {header.title}
              </h2>

              {/* Date Range & Working Days Info */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-primary opacity-80" />
                  Date Range:{" "}
                  <span className="font-semibold text-foreground">
                    {safeFormatDate(header.start_date)} → {safeFormatDate(header.end_date)}
                  </span>
                </span>

                <span className="flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-emerald-500" />
                  Total Period Working Days:{" "}
                  <Badge variant="secondary" className="font-mono font-bold text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0">
                    {header.total_period_working_days} days
                  </Badge>
                </span>

                {header.department_filter !== "ALL" && (
                  <span className="text-xs text-muted-foreground">
                    Dept Filter: <span className="font-medium text-foreground">{header.department_filter}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5 self-start md:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={onEditHeader}
                className="gap-1.5 rounded-xl border-border/80 hover:bg-muted/70 text-xs font-medium"
              >
                <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                Configure Date Range
              </Button>

              <Button
                size="sm"
                onClick={onRecalculate}
                disabled={isRecalculating}
                className="gap-1.5 rounded-xl text-xs font-medium shadow-md shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? "animate-spin" : ""}`} />
                {isRecalculating ? "Recalculating..." : "Recalculate"}
              </Button>
            </div>
          </div>

          {/* Quick Metrics KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-3 border-t border-border/40">
            {/* Total Net Payout */}
            <div className="p-3.5 rounded-xl bg-card/50 border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Net Disbursement</span>
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                ₱{summary.total_net_payout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Gross: ₱{summary.total_gross_13th_month.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Total Eligible Personnel */}
            <div className="p-3.5 rounded-xl bg-card/50 border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Total Employees</span>
                <Users className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                {summary.active_employees}
                {summary.on_hold_employees > 0 && (
                  <span className="text-xs font-normal text-muted-foreground ml-1.5">
                    ({summary.on_hold_employees} on hold)
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Eligible personnel
              </div>
            </div>

            {/* Average Pay */}
            <div className="p-3.5 rounded-xl bg-card/50 border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Average 13th Month</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                ₱{summary.average_payout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Per active employee
              </div>
            </div>

            {/* Period Days & Formula */}
            <div className="p-3.5 rounded-xl bg-card/50 border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Working Days Basis</span>
                <Calculator className="w-3.5 h-3.5 text-sky-500" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight font-mono text-sky-500">
                {header.total_period_working_days} <span className="text-sm font-sans font-normal text-muted-foreground">days</span>
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                Rate: Monthly ÷ {header.total_period_working_days}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
