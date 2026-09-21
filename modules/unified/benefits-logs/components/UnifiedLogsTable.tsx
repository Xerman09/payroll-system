// modules/unified/benefits-logs/components/UnifiedLogsTable.tsx
"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
} from "lucide-react";
import type { UnifiedBenefitLogRow } from "../types";

function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = typeof dateStr === "string" && dateStr.includes("T") ? parseISO(dateStr) : new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return format(d, "MMM dd, yyyy");
  } catch {
    return String(dateStr);
  }
}

function formatMoney(v: number) {
  if (!Number.isFinite(v)) return "0.00";
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface UnifiedLogsTableProps {
  rows: UnifiedBenefitLogRow[];
  loading: boolean;
}

export default function UnifiedLogsTable({ rows, loading }: UnifiedLogsTableProps) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  // Reset to first page when filtered row count changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [rows.length]);

  const totalPages = Math.ceil(rows.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, rows.length);
  const currentRows = React.useMemo(
    () => rows.slice(startIndex, endIndex),
    [rows, startIndex, endIndex]
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-gray-800/60 border-b border-slate-200 dark:border-gray-800">
                <TableHead className="font-semibold text-slate-700 dark:text-gray-200">Company</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-gray-200">Employee</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-gray-200">Account #</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-gray-200">Benefit</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-gray-200">Type</TableHead>
                <TableHead className="text-right font-semibold text-slate-700 dark:text-gray-200">
                  Deducted
                </TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-gray-200">Payroll Ref</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-gray-200">Cutoff Period</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-gray-200">Posted Date</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell>
                      <div className="h-4 w-28 bg-slate-200 dark:bg-gray-800 rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-36 bg-slate-200 dark:bg-gray-800 rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-20 bg-slate-200 dark:bg-gray-800 rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-slate-200 dark:bg-gray-800 rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-20 bg-slate-200 dark:bg-gray-800 rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-20 bg-slate-200 dark:bg-gray-800 rounded ml-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-24 bg-slate-200 dark:bg-gray-800 rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-32 bg-slate-200 dark:bg-gray-800 rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-24 bg-slate-200 dark:bg-gray-800 rounded" />
                    </TableCell>
                  </TableRow>
                ))
              ) : currentRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-12 text-center text-sm text-slate-500 dark:text-gray-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Layers className="h-8 w-8 text-slate-300 dark:text-gray-600" />
                      <p className="font-medium">No compiled benefit logs match the selected filters.</p>
                      <p className="text-xs text-slate-400">
                        Try adjusting your search query, company entity, or date ranges.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                currentRows.map((r) => {
                  const postedDate = formatDateSafe(r.posted_at || r.created_date);
                  const cutoffRange =
                    r.cutoff_start && r.cutoff_end
                      ? `${formatDateSafe(r.cutoff_start)} – ${formatDateSafe(r.cutoff_end)}`
                      : "—";

                  return (
                    <TableRow
                      key={r.benefit_log_id}
                      className="hover:bg-slate-50/70 dark:hover:bg-gray-800/50 border-b border-slate-100 dark:border-gray-800/80 transition-colors"
                    >
                      {/* Company Badge */}
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-900 shrink-0"
                            style={{ backgroundColor: r.company_color || "#3b82f6" }}
                          />
                          <span className="font-medium text-xs text-slate-800 dark:text-gray-200" title={r.company_name}>
                            {r.company_name}
                          </span>
                        </div>
                      </TableCell>

                      {/* Employee Name */}
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-gray-100">
                          {r.employee_name || "Employee"}
                        </div>
                        {r.department_name && (
                          <div className="text-[11px] text-slate-500 dark:text-gray-400">
                            {r.department_name}
                          </div>
                        )}
                      </TableCell>

                      {/* Account # */}
                      <TableCell className="font-mono text-xs text-slate-600 dark:text-gray-400">
                        {r.account_no || "—"}
                      </TableCell>

                      {/* Benefit Badge */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            r.benefit_code === "SSS"
                              ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/40 text-[11px] font-semibold"
                              : r.benefit_code === "PHILHEALTH"
                              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40 text-[11px] font-semibold"
                              : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40 text-[11px] font-semibold"
                          }
                        >
                          {r.benefit_code}
                        </Badge>
                      </TableCell>

                      {/* Type Badge */}
                      <TableCell>
                        {r.log_type === "LOAN" ? (
                          <Badge
                            variant="secondary"
                            className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40 text-[11px]"
                          >
                            Loan
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-slate-50 dark:bg-gray-800 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700 text-[11px]"
                          >
                            Contribution
                          </Badge>
                        )}
                      </TableCell>

                      {/* Deducted Amount */}
                      <TableCell className="text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-gray-100">
                        ₱{formatMoney(r.deducted_amount)}
                      </TableCell>

                      {/* Payroll Ref */}
                      <TableCell className="font-mono text-xs text-primary font-medium">
                        {r.payroll_ref_no || "—"}
                      </TableCell>

                      {/* Cutoff Period */}
                      <TableCell className="text-xs text-slate-600 dark:text-gray-400">
                        {cutoffRange}
                      </TableCell>

                      {/* Posted Date */}
                      <TableCell className="text-xs text-slate-500 dark:text-gray-400">
                        {postedDate}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        {!loading && rows.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/40 text-xs text-slate-600 dark:text-gray-400">
            <div>
              Showing <span className="font-semibold text-slate-800 dark:text-gray-200">{startIndex + 1}</span> to{" "}
              <span className="font-semibold text-slate-800 dark:text-gray-200">{endIndex}</span> of{" "}
              <span className="font-semibold text-slate-800 dark:text-gray-200">{rows.length}</span> entries
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-2">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-7 rounded border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-xs"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>

              <span className="px-2">
                Page {currentPage} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
