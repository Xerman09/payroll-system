// modules/unified/payroll-status/components/DepartmentBreakdownModal.tsx
"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  CheckCircle2,
  Clock,
  FileCheck2,
  Calendar,
  DollarSign,
  Users,
  Search,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CompanyPayrollStatus, DepartmentPayrollDetail } from "../types";

interface DepartmentBreakdownModalProps {
  company: CompanyPayrollStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d =
      typeof dateStr === "string" && dateStr.includes("T")
        ? parseISO(dateStr)
        : new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return format(d, "MMM dd, yyyy");
  } catch {
    return String(dateStr);
  }
}

function formatMoney(amount?: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return `₱${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function DepartmentBreakdownModal({
  company,
  open,
  onOpenChange,
}: DepartmentBreakdownModalProps) {
  const [search, setSearch] = React.useState("");

  if (!company) return null;

  const {
    company_name,
    company_color,
    company_description,
    current_cutoff,
    financials,
    departments_detail,
    progress_percentage,
    departments_completed,
    departments_total,
  } = company;

  const filteredDepts = departments_detail.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      (d.payroll_ref_no && d.payroll_ref_no.toLowerCase().includes(q)) ||
      d.status.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
        {/* Header */}
        <div className="border-b border-slate-200/80 bg-slate-50/70 p-5 dark:border-gray-800 dark:bg-gray-900/60">
          <DialogHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-4 w-4 rounded-full flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: company_color || "#3b82f6" }}
                />
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-gray-100">
                  {company_name}
                </DialogTitle>
                <Badge variant="outline" className="text-2xs font-mono uppercase">
                  {company.company_id}
                </Badge>
              </div>

              {/* Progress pill */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-gray-400">
                  {departments_completed} of {departments_total} Depts Done
                </span>
                <Badge
                  className={
                    progress_percentage === 100
                      ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30"
                      : progress_percentage > 0
                      ? "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/30"
                      : "bg-slate-500/15 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400 border border-slate-500/30"
                  }
                >
                  {progress_percentage}% Done
                </Badge>
              </div>
            </div>

            <DialogDescription className="text-xs text-slate-500 dark:text-gray-400 mt-1">
              {company_description}
            </DialogDescription>
          </DialogHeader>

          {/* Cutoff & Financial Summary Chips */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200/70 bg-white dark:border-gray-800 dark:bg-gray-800/80 p-2.5">
              <span className="text-2xs uppercase tracking-wider text-slate-600 dark:text-gray-400 font-semibold block">
                Cutoff Period
              </span>
              <span className="text-xs font-medium text-slate-800 dark:text-gray-200 truncate block mt-0.5">
                {current_cutoff?.start_date && current_cutoff?.end_date
                  ? `${formatDateSafe(current_cutoff.start_date)} - ${formatDateSafe(
                      current_cutoff.end_date
                    )}`
                  : current_cutoff?.label || "—"}
              </span>
            </div>

            <div className="rounded-lg border border-slate-200/70 bg-white dark:border-gray-800 dark:bg-gray-800/80 p-2.5">
              <span className="text-2xs uppercase tracking-wider text-slate-600 dark:text-gray-400 font-semibold block">
                Payout Date
              </span>
              <span className="text-xs font-medium text-slate-800 dark:text-gray-200 block mt-0.5">
                {formatDateSafe(current_cutoff?.payout_date)}
              </span>
            </div>

            <div className="rounded-lg border border-slate-200/70 bg-white dark:border-gray-800 dark:bg-gray-800/80 p-2.5">
              <span className="text-2xs uppercase tracking-wider text-slate-600 dark:text-gray-400 font-semibold block">
                Total Net Amount
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-gray-100 block mt-0.5">
                {formatMoney(financials.total_net)}
              </span>
            </div>

            <div className="rounded-lg border border-slate-200/70 bg-white dark:border-gray-800 dark:bg-gray-800/80 p-2.5">
              <span className="text-2xs uppercase tracking-wider text-slate-600 dark:text-gray-400 font-semibold block">
                Employees Processed
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-gray-100 block mt-0.5">
                {financials.headcount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-5 py-3 border-b border-slate-200/60 dark:border-gray-800 flex items-center justify-between gap-3 bg-white dark:bg-gray-900">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search department or run reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs bg-slate-50/50 dark:bg-gray-800/50"
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-gray-400">
            Showing {filteredDepts.length} of {departments_detail.length} departments
          </span>
        </div>

        {/* Scrollable Department List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {filteredDepts.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-gray-400">
              No matching departments found.
            </div>
          ) : (
            filteredDepts.map((d) => {
              const isPosted = d.status === "POSTED";
              const isPendingApproval = d.status === "PENDING_APPROVER";
              const isPendingChecker = d.status === "PENDING_CHECKER";
              const isDraft = d.status === "DRAFT" || d.status === "PROCESSED";
              const isNotStarted = d.status === "NOT_STARTED";

              return (
                <div
                  key={d.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                    isPosted
                      ? "border-emerald-200/70 bg-emerald-50/30 dark:border-emerald-950/60 dark:bg-emerald-950/10"
                      : isPendingApproval || isPendingChecker || isDraft
                      ? "border-blue-200/70 bg-blue-50/20 dark:border-blue-950/60 dark:bg-blue-950/10"
                      : "border-slate-200/70 bg-slate-50/30 dark:border-gray-800/60 dark:bg-gray-900/40"
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900 dark:text-gray-100">
                        {d.name}
                      </span>
                      {/* Department Status Badge */}
                      {isPosted ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30 text-2xs py-0 gap-1 font-semibold">
                          <Check className="h-3 w-3" />
                          POSTED
                        </Badge>
                      ) : isPendingApproval ? (
                        <Badge className="bg-purple-500/15 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/30 text-2xs py-0 gap-1">
                          PENDING APPROVER
                        </Badge>
                      ) : isPendingChecker ? (
                        <Badge className="bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/30 text-2xs py-0 gap-1">
                          PENDING CHECKER
                        </Badge>
                      ) : isDraft ? (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30 text-2xs py-0 gap-1">
                          IN DRAFT
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 dark:text-gray-400 text-2xs py-0">
                          NOT STARTED
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-slate-500 dark:text-gray-400">
                      {d.payroll_ref_no && (
                        <span>
                          Ref: <span className="font-mono font-medium text-slate-700 dark:text-gray-300">{d.payroll_ref_no}</span>
                        </span>
                      )}
                      {d.posted_at && (
                        <span>
                          Posted: <span className="text-slate-700 dark:text-gray-300">{formatDateSafe(d.posted_at)}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financial / Headcount */}
                  <div className="flex items-center gap-4 self-end sm:self-center">
                    {d.headcount != null && d.headcount > 0 && (
                      <div className="text-right">
                        <span className="text-2xs text-slate-600 dark:text-gray-400 block font-semibold">
                          Employees
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-gray-200">
                          {d.headcount}
                        </span>
                      </div>
                    )}

                    {d.total_net != null && d.total_net > 0 && (
                      <div className="text-right">
                        <span className="text-2xs text-slate-600 dark:text-gray-400 block font-semibold">
                          Net Pay
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-gray-100">
                          {formatMoney(d.total_net)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
