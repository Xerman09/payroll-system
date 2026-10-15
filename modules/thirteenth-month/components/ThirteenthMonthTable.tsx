// modules/thirteenth-month/components/ThirteenthMonthTable.tsx
"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  SlidersHorizontal,
  Building2,
  CreditCard,
  Banknote,
  Eye,
  PauseCircle,
  PlayCircle,
  HelpCircle,
  ArrowUpDown,
  Download,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ThirteenthMonthEmployeeLine } from "../types";

interface ThirteenthMonthTableProps {
  lines: ThirteenthMonthEmployeeLine[];
  departments: { id: number | string; name: string }[];
  onOpenDetail: (line: ThirteenthMonthEmployeeLine) => void;
  onToggleHold: (userId: number, currentHold: boolean) => void;
  onExportCsv: () => void;
}

export function ThirteenthMonthTable({
  lines,
  departments,
  onOpenDetail,
  onToggleHold,
  onExportCsv,
}: ThirteenthMonthTableProps) {
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "BANK" | "CASH">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ON_HOLD">("ALL");
  const [sortBy, setSortBy] = useState<"name" | "salary" | "days" | "payout">("payout");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Filtering
  const filteredLines = useMemo(() => {
    return lines.filter((line) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = line.employee_name.toLowerCase().includes(q);
        const matchId = String(line.user_id).includes(q);
        const matchDept = line.department_name.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchDept) return false;
      }

      // Dept
      if (selectedDept !== "ALL" && String(line.department_id) !== selectedDept) {
        return false;
      }

      // Payment
      if (paymentFilter !== "ALL" && line.payment_method !== paymentFilter) {
        return false;
      }

      // Status
      if (statusFilter === "ACTIVE" && line.on_hold) return false;
      if (statusFilter === "ON_HOLD" && !line.on_hold) return false;

      return true;
    });
  }, [lines, search, selectedDept, paymentFilter, statusFilter]);

  // Sorting
  const sortedLines = useMemo(() => {
    return [...filteredLines].sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.employee_name.localeCompare(b.employee_name);
      } else if (sortBy === "salary") {
        comparison = a.monthly_salary - b.monthly_salary;
      } else if (sortBy === "days") {
        comparison = a.effective_days_worked - b.effective_days_worked;
      } else if (sortBy === "payout") {
        comparison = a.net_13th_month - b.net_13th_month;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [filteredLines, sortBy, sortOrder]);

  const toggleSort = (col: "name" | "salary" | "days" | "payout") => {
    if (sortBy === col) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortOrder("desc");
    }
  };

  // Subtotals
  const totalFilteredPayout = sortedLines.reduce(
    (sum, l) => sum + (l.on_hold ? 0 : l.net_13th_month),
    0
  );

  return (
    <Card className="p-5 sm:p-6 rounded-2xl border-white/10 bg-background/60 backdrop-blur-md shadow-xl space-y-5">
      {/* Search and Filters Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 text-xs">
        {/* Left: Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee by name, ID, or department..."
            className="pl-9 rounded-xl border-border/80 text-xs bg-background/70"
          />
        </div>

        {/* Right: Dropdowns & Filter Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Payment Method Switcher */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-white/5 text-xs">
            <button
              type="button"
              onClick={() => setPaymentFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                paymentFilter === "ALL" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setPaymentFilter("BANK")}
              className={`px-2.5 py-1 rounded-lg transition-colors font-medium flex items-center gap-1 ${
                paymentFilter === "BANK" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CreditCard className="w-3 h-3 text-sky-500" />
              Bank
            </button>
            <button
              type="button"
              onClick={() => setPaymentFilter("CASH")}
              className={`px-2.5 py-1 rounded-lg transition-colors font-medium flex items-center gap-1 ${
                paymentFilter === "CASH" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Banknote className="w-3 h-3 text-emerald-500" />
              Cash
            </button>
          </div>

          {/* Export CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            className="rounded-xl text-xs gap-1.5 border-border/80"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Subheader / Result Count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
        <div>
          Showing <span className="font-semibold text-foreground">{sortedLines.length}</span> of {lines.length} personnel
        </div>
        <div className="font-medium text-foreground">
          Filtered Net Total:{" "}
          <span className="font-mono font-bold text-primary">
            ₱{totalFilteredPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Master 13th Month Calculation Table */}
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/30">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/70 bg-muted/60 text-muted-foreground font-semibold">
              <th className="py-3 px-3.5 text-left cursor-pointer select-none" onClick={() => toggleSort("name")}>
                <div className="flex items-center gap-1">
                  <span>Employee</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-3 text-left">Department</th>
              <th className="py-3 px-3 text-right cursor-pointer select-none" onClick={() => toggleSort("salary")}>
                <div className="flex items-center justify-end gap-1">
                  <span>Monthly Base</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-3 text-right">
                <span>Pay Per Day</span>
                <span className="block text-[9px] font-normal opacity-70">Monthly ÷ Days</span>
              </th>
              <th className="py-3 px-3.5 text-right cursor-pointer select-none" onClick={() => toggleSort("days")}>
                <div className="flex items-center justify-end gap-1">
                  <span>Total Work</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
                <span className="block text-[9px] font-normal opacity-70">Actual Days Worked</span>
              </th>
              <th className="py-3 px-3 text-right cursor-pointer select-none" onClick={() => toggleSort("payout")}>
                <div className="flex items-center justify-end gap-1">
                  <span>13th Month Pay</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
                <span className="block text-[9px] font-normal opacity-70">Work × Pay/Day</span>
              </th>
              <th className="py-3 px-3 text-right">Advances / Tax</th>
              <th className="py-3 px-3.5 text-right font-bold text-foreground">Net Payout</th>
              <th className="py-3 px-3 text-center">Disbursement</th>
              <th className="py-3 px-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {sortedLines.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-muted-foreground italic">
                  No employee records matched your filter criteria.
                </td>
              </tr>
            ) : (
              sortedLines.map((line) => {
                const isHold = line.on_hold;
                return (
                  <tr
                    key={line.id}
                    className={`hover:bg-muted/40 transition-colors ${
                      isHold ? "opacity-50 bg-rose-500/5" : ""
                    }`}
                  >
                    {/* Employee Info */}
                    <td className="py-3 px-3.5">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <span>{line.employee_name}</span>
                        {isHold && (
                          <Badge variant="destructive" className="text-[9px] py-0 px-1 font-mono">
                            HOLD
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        ID: #{line.user_id} • {line.position}
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-3 px-3 text-muted-foreground">
                      <div className="font-medium text-foreground truncate max-w-[140px]">
                        {line.department_name}
                      </div>
                    </td>

                    {/* Monthly Salary */}
                    <td className="py-3 px-3 text-right font-mono font-medium text-foreground">
                      ₱{line.monthly_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Pay Per Day */}
                    <td className="py-3 px-3 text-right font-mono text-muted-foreground">
                      <span className="font-medium text-foreground">
                        ₱{line.pay_per_day.toFixed(2)}
                      </span>
                      <span className="block text-[10px] text-muted-foreground/70">
                        /day
                      </span>
                    </td>

                    {/* Total Work (Days) */}
                    <td className="py-3 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(line)}
                        className="inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all cursor-pointer"
                        title="Click to view full calculation breakdown of days worked"
                      >
                        <span>{line.effective_days_worked.toFixed(2)}</span>
                        <Eye className="w-3 h-3 opacity-70" />
                      </button>
                      {line.adjustment_days !== 0 && (
                        <span className="block text-[10px] font-mono text-sky-500">
                          {line.adjustment_days > 0 ? `+${line.adjustment_days}` : line.adjustment_days} adj
                        </span>
                      )}
                    </td>

                    {/* Gross 13th Month */}
                    <td className="py-3 px-3 text-right font-mono font-medium text-foreground">
                      ₱{line.computed_13th_month.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Deductions / Tax */}
                    <td className="py-3 px-3 text-right font-mono text-xs">
                      {line.advance_deduction > 0 || line.tax_withheld > 0 ? (
                        <div>
                          {line.advance_deduction > 0 && (
                            <div className="text-rose-500 text-[11px]">
                              -₱{line.advance_deduction.toLocaleString()} <span className="text-[9px] opacity-70">(Adv)</span>
                            </div>
                          )}
                          {line.tax_withheld > 0 && (
                            <div className="text-amber-500 text-[11px]">
                              -₱{line.tax_withheld.toLocaleString()} <span className="text-[9px] opacity-70">(Tax)</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Net Payout */}
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-sm text-primary">
                      ₱{line.net_13th_month.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Payment Mode */}
                    <td className="py-3 px-3 text-center">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 ${
                          line.payment_method === "BANK"
                            ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {line.payment_method}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenDetail(line)}
                          className="h-7 w-7 p-0 rounded-lg hover:bg-muted"
                          title="View calculation breakdown sheet"
                        >
                          <Eye className="w-3.5 h-3.5 text-primary" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggleHold(line.user_id, line.on_hold)}
                          className={`h-7 w-7 p-0 rounded-lg hover:bg-muted ${
                            isHold ? "text-amber-500" : "text-muted-foreground"
                          }`}
                          title={isHold ? "Release Hold" : "Put on Hold"}
                        >
                          {isHold ? (
                            <PlayCircle className="w-3.5 h-3.5" />
                          ) : (
                            <PauseCircle className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
