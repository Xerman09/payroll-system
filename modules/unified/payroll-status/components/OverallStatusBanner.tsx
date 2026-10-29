// modules/unified/payroll-status/components/OverallStatusBanner.tsx
"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Users,
  Coins,
  ShieldCheck,
  TrendingUp,
  Activity,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OverallPayrollStatus } from "../types";

interface OverallStatusBannerProps {
  overall: OverallPayrollStatus;
  loading?: boolean;
}

function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return "0.00";
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function OverallStatusBanner({ overall, loading }: OverallStatusBannerProps) {
  const {
    total_companies,
    online_companies,
    completed_companies,
    in_progress_companies,
    pending_companies,
    offline_companies,
    overall_percentage,
    total_enterprise_net,
    total_enterprise_gross,
    total_enterprise_headcount,
    overall_status_label,
    cutoff_label,
  } = overall;

  const isAllComplete = overall_status_label === "COMPLETED";
  const isInProgress = overall_status_label === "IN_PROGRESS";
  const isAttention = overall_status_label === "ATTENTION_REQUIRED";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {/* Background ambient gradient glow */}
      <div
        className={`absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl opacity-15 pointer-events-none transition-all ${
          isAllComplete
            ? "bg-emerald-500"
            : isInProgress
            ? "bg-blue-500"
            : isAttention
            ? "bg-rose-500"
            : "bg-amber-500"
        }`}
      />

      <div className="p-5 sm:p-6">
        {/* Top Header Row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/20">
                <Layers className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-gray-100 sm:text-lg">
                Enterprise Payroll Overview
              </h2>
              {/* Overall Status Badge */}
              {isAllComplete ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30 gap-1 font-semibold text-xs py-0.5">
                  <CheckCircle2 className="h-3 w-3" />
                  All Companies Completed
                </Badge>
              ) : isInProgress ? (
                <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/30 gap-1 font-semibold text-xs py-0.5">
                  <Activity className="h-3 w-3 animate-pulse" />
                  Payroll In Progress ({completed_companies}/{online_companies || total_companies} Completed)
                </Badge>
              ) : isAttention ? (
                <Badge className="bg-rose-500/15 text-rose-700 hover:bg-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/30 gap-1 font-semibold text-xs py-0.5">
                  <AlertTriangle className="h-3 w-3" />
                  Attention Required
                </Badge>
              ) : (
                <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30 gap-1 font-semibold text-xs py-0.5">
                  <Clock className="h-3 w-3" />
                  Pending Processing
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Aggregated real-time payroll progression for <span className="font-medium text-slate-700 dark:text-gray-300">{cutoff_label || "Active Cutoff"}</span>
            </p>
          </div>

          {/* Overall Percentage Progress Meter */}
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="flex flex-col items-end">
              <span className="text-2xs font-semibold uppercase tracking-wider text-slate-600 dark:text-gray-400">
                Completion Rate
              </span>
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-gray-100">
                {overall_percentage}%
              </span>
            </div>
            <div className="relative h-12 w-12 flex-shrink-0">
              <svg className="h-12 w-12 -rotate-90 transform" viewBox="0 0 36 36">
                <path
                  className="text-slate-100 dark:text-gray-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={
                    isAllComplete
                      ? "text-emerald-500"
                      : isInProgress
                      ? "text-blue-500"
                      : "text-amber-500"
                  }
                  strokeDasharray={`${overall_percentage}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-gray-300">
                {completed_companies}/{online_companies || total_companies}
              </div>
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800">
            <div
              className={`h-full transition-all duration-700 ${
                isAllComplete
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                  : isInProgress
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600"
                  : "bg-gradient-to-r from-amber-400 to-orange-500"
              }`}
              style={{ width: `${Math.min(Math.max(overall_percentage, 0), 100)}%` }}
            />
          </div>
        </div>

        {/* KPI Metric Cards */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Completed Entities */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-gray-800/80 bg-slate-50/70 dark:bg-gray-800/50 p-3.5">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs font-medium uppercase tracking-wider text-slate-600 dark:text-gray-400">
                Companies Completed
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-slate-900 dark:text-gray-100">
                  {completed_companies}
                </span>
                <span className="text-xs text-slate-600 dark:text-gray-400">
                  of {online_companies || total_companies} online
                </span>
              </div>
              <p className="text-2xs text-slate-600 dark:text-gray-400">
                {in_progress_companies} in review &bull; {pending_companies} pending
              </p>
            </div>
          </div>

          {/* Card 2: Total Disbursed Net */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-gray-800/80 bg-slate-50/70 dark:bg-gray-800/50 p-3.5">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Coins className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs font-medium uppercase tracking-wider text-slate-600 dark:text-gray-400">
                Enterprise Net Payout
              </p>
              <div className="truncate text-lg font-bold text-slate-900 dark:text-gray-100">
                ₱{formatMoney(total_enterprise_net)}
              </div>
              <p className="truncate text-2xs text-slate-600 dark:text-gray-400">
                Gross: ₱{formatMoney(total_enterprise_gross)}
              </p>
            </div>
          </div>

          {/* Card 3: Total Employees / Headcount */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-gray-800/80 bg-slate-50/70 dark:bg-gray-800/50 p-3.5">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs font-medium uppercase tracking-wider text-slate-600 dark:text-gray-400">
                Employees Processed
              </p>
              <div className="text-lg font-bold text-slate-900 dark:text-gray-100">
                {total_enterprise_headcount.toLocaleString()}
              </div>
              <p className="text-2xs text-slate-600 dark:text-gray-400">
                Across all active runs
              </p>
            </div>
          </div>

          {/* Card 4: Entities Monitored / Offline Alert */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-gray-800/80 bg-slate-50/70 dark:bg-gray-800/50 p-3.5">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                offline_companies > 0
                  ? "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
              }`}
            >
              {offline_companies > 0 ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-2xs font-medium uppercase tracking-wider text-slate-600 dark:text-gray-400">
                System Connectivity
              </p>
              <div className="text-lg font-bold text-slate-900 dark:text-gray-100">
                {online_companies}/{total_companies} Active
              </div>
              <p className="text-2xs text-slate-600 dark:text-gray-400">
                {offline_companies > 0
                  ? `${offline_companies} entity unreachable`
                  : "All endpoints operational"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
