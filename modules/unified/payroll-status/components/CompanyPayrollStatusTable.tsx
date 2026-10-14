// modules/unified/payroll-status/components/CompanyPayrollStatusTable.tsx
"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Eye,
  Users,
  Coins,
  Layers,
  ArrowUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CompanyPayrollStatus } from "../types";

interface CompanyPayrollStatusTableProps {
  companies: CompanyPayrollStatus[];
  onSelectCompany: (company: CompanyPayrollStatus) => void;
  loading?: boolean;
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

export default function CompanyPayrollStatusTable({
  companies,
  onSelectCompany,
  loading,
}: CompanyPayrollStatusTableProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="inline-flex h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
        <p className="text-xs text-slate-500 dark:text-gray-400">
          Gathering live payroll statuses across enterprise entities...
        </p>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <Building2 className="mx-auto h-8 w-8 text-slate-300 dark:text-gray-600 mb-2" />
        <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">
          No companies found
        </p>
        <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">
          Try adjusting your search query or status filter.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-600 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400">
              <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-2xs">
                Company / Entity
              </th>
              <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-2xs">
                Cutoff Window
              </th>
              <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-2xs">
                Department Progress
              </th>
              <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-2xs">
                Status
              </th>
              <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-2xs text-right">
                Net Disbursed
              </th>
              <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-2xs text-center">
                Headcount
              </th>
              <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-2xs text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-gray-800/80">
            {companies.map((c) => {
              const isCompleted = c.status === "COMPLETED";
              const isInProgress = c.status === "IN_PROGRESS";
              const isOffline = c.status === "OFFLINE";
              const isPending = c.status === "PENDING" || c.status === "NO_CUTOFF";

              return (
                <tr
                  key={c.company_id}
                  onClick={() => onSelectCompany(c)}
                  className="group hover:bg-slate-50/80 dark:hover:bg-gray-800/40 cursor-pointer transition-colors"
                >
                  {/* Company Column */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3.5 w-3.5 rounded-full flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: c.company_color || "#3b82f6" }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 dark:text-gray-100 group-hover:text-primary transition-colors">
                            {c.company_name}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-3xs font-mono uppercase px-1 py-0 text-slate-500"
                          >
                            {c.company_id}
                          </Badge>
                        </div>
                        <p className="text-2xs text-slate-600 dark:text-gray-400 truncate max-w-xs mt-0.5">
                          {c.company_description}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Cutoff Window Column */}
                  <td className="py-3.5 px-4">
                    {c.current_cutoff ? (
                      <div>
                        <div className="font-medium text-slate-800 dark:text-gray-200">
                          {c.current_cutoff.start_date && c.current_cutoff.end_date ? (
                            <span>
                              {formatDateSafe(c.current_cutoff.start_date)} -{" "}
                              {formatDateSafe(c.current_cutoff.end_date)}
                            </span>
                          ) : (
                            c.current_cutoff.label
                          )}
                        </div>
                        <div className="text-2xs text-slate-600 dark:text-gray-400 mt-0.5">
                          Paid: {formatDateSafe(c.current_cutoff.payout_date)}
                          {c.current_cutoff.cutoff_type && (
                            <span className="ml-1.5 font-medium text-slate-700 dark:text-gray-300">
                              ({c.current_cutoff.cutoff_type.toUpperCase() === "FIRST" ? "1st" : "2nd"} Cutoff)
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600 dark:text-gray-400 italic">No Active Window</span>
                    )}
                  </td>

                  {/* Department Progress Column */}
                  <td className="py-3.5 px-4">
                    {isOffline ? (
                      <span className="text-2xs text-rose-500 font-medium">Instance unreachable</span>
                    ) : (
                      <div className="w-44 space-y-1">
                        <div className="flex items-center justify-between text-2xs">
                          <span className="font-medium text-slate-700 dark:text-gray-300">
                            {c.departments_completed} of {c.departments_total} Depts
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-gray-100">
                            {c.progress_percentage}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isCompleted
                                ? "bg-emerald-500"
                                : isInProgress
                                ? "bg-blue-500"
                                : "bg-slate-300 dark:bg-gray-600"
                            }`}
                            style={{ width: `${c.progress_percentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Status Column */}
                  <td className="py-3.5 px-4">
                    {isCompleted ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30 gap-1 font-semibold text-2xs py-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                        Completed
                      </Badge>
                    ) : isInProgress ? (
                      <Badge className="bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/30 gap-1 font-semibold text-2xs py-0.5">
                        <Clock className="h-3 w-3" />
                        In Progress
                      </Badge>
                    ) : isOffline ? (
                      <Badge className="bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/30 gap-1 font-semibold text-2xs py-0.5">
                        <AlertTriangle className="h-3 w-3" />
                        Offline
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30 gap-1 font-semibold text-2xs py-0.5">
                        <Clock className="h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </td>

                  {/* Net Amount Column */}
                  <td className="py-3.5 px-4 text-right">
                    <span className="font-bold text-slate-900 dark:text-gray-100">
                      {formatMoney(c.financials.total_net)}
                    </span>
                    {c.financials.total_gross > 0 && (
                      <span className="block text-2xs text-slate-600 dark:text-gray-400">
                        Gross: {formatMoney(c.financials.total_gross)}
                      </span>
                    )}
                  </td>

                  {/* Headcount Column */}
                  <td className="py-3.5 px-4 text-center">
                    <span className="font-semibold text-slate-800 dark:text-gray-200">
                      {c.financials.headcount.toLocaleString()}
                    </span>
                  </td>

                  {/* Actions Column */}
                  <td className="py-3.5 px-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCompany(c);
                      }}
                      className="h-7 text-xs px-2.5 rounded-lg text-primary hover:text-primary hover:bg-primary/10 gap-1 font-medium"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Details</span>
                      <ChevronRight className="h-3 w-3 opacity-60" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
