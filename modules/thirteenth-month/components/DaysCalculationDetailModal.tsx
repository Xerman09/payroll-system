// modules/thirteenth-month/components/DaysCalculationDetailModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  Calendar,
  User,
  Clock,
  PlusCircle,
  Check,
  ShieldCheck,
  RotateCcw,
  Edit3,
  SlidersHorizontal,
} from "lucide-react";
import type { ThirteenthMonthEmployeeLine, EmployeeManualAdjustment } from "../types";
import { safeFormatDate } from "../providers/thirteenthMonthService";
import { toast } from "sonner";

interface DaysCalculationDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  line: ThirteenthMonthEmployeeLine | null;
  onSaveAdjustment: (
    userId: number,
    data: EmployeeManualAdjustment
  ) => void;
}

export function DaysCalculationDetailModal({
  open,
  onOpenChange,
  line,
  onSaveAdjustment,
}: DaysCalculationDetailModalProps) {
  const [adjustmentDays, setAdjustmentDays] = useState(0);
  const [advanceDeduction, setAdvanceDeduction] = useState(0);
  const [onHold, setOnHold] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [breakdownView, setBreakdownView] = useState<"MONTHLY" | "CUTOFF">("MONTHLY");
  const [monthlyDays, setMonthlyDays] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open && line) {
      setAdjustmentDays(line.adjustment_days || 0);
      setAdvanceDeduction(line.advance_deduction || 0);
      setOnHold(Boolean(line.on_hold));
      setRemarks(line.remarks || "");
      setBreakdownView("MONTHLY");

      const map: Record<string, number> = {};
      line.monthly_breakdown.forEach((m) => {
        map[m.month_key] = m.days_worked;
      });
      setMonthlyDays(map);
    }
  }, [open, line]);

  if (!line) return null;

  // Sum of editable monthly days
  const sumMonthlyDays = line.monthly_breakdown.reduce((sum, m) => {
    const val = monthlyDays[m.month_key] !== undefined ? monthlyDays[m.month_key] : m.days_worked;
    return sum + val;
  }, 0);

  // Dynamic preview calculation
  const effectiveDays = Math.max(0, sumMonthlyDays + Number(adjustmentDays));
  const previewGross = Math.round(effectiveDays * line.pay_per_day * 100) / 100;
  const taxable = Math.max(0, previewGross - 90000);
  const previewTax = taxable > 0 ? Math.round(taxable * 0.15 * 100) / 100 : 0;
  const previewNet = Math.max(0, Math.round((previewGross - Number(advanceDeduction) - previewTax) * 100) / 100);

  const hasModifications =
    line.monthly_breakdown.some(
      (m) =>
        (monthlyDays[m.month_key] !== undefined && monthlyDays[m.month_key] !== m.actual_days_worked)
    ) ||
    adjustmentDays !== (line.adjustment_days || 0) ||
    advanceDeduction !== (line.advance_deduction || 0) ||
    onHold !== Boolean(line.on_hold);

  const handleSave = () => {
    onSaveAdjustment(line.user_id, {
      adjustment_days: Number(adjustmentDays),
      advance_deduction: Number(advanceDeduction),
      on_hold: onHold,
      remarks: remarks.trim(),
      monthly_days: monthlyDays,
    });
    toast.success(`Saved monthly days & adjustment parameters for ${line.employee_name}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-4xl lg:max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-border/80 bg-background shadow-2xl">
        {/* MODAL HEADER */}
        <div className="px-6 py-5 border-b border-border/60 bg-muted/20 relative pr-14">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-[240px]">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className="border-primary/30 text-primary text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-primary/10 flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5" />
                  Employee Calculation Sheet
                </Badge>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                  ID: #{line.user_id}
                </span>
                {line.on_hold && (
                  <Badge variant="destructive" className="text-[11px] px-2 py-0.5 font-medium">
                    On Hold
                  </Badge>
                )}
              </div>

              <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
                {line.employee_name}
              </DialogTitle>

              <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground">Dept:</span>
                  <b className="text-foreground font-medium">{line.department_name}</b>
                </span>
                <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/40" />
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground">Position:</span>
                  <b className="text-foreground font-medium">{line.position}</b>
                </span>
                {line.hire_date && (
                  <>
                    <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/40" />
                    <span className="flex items-center gap-1">
                      <span className="text-muted-foreground">Hired:</span>
                      <b className="text-foreground font-medium">{safeFormatDate(line.hire_date)}</b>
                    </span>
                  </>
                )}
              </DialogDescription>
            </div>

            {/* Financial Highlight Card */}
            <div className="flex items-center gap-4 bg-card border border-border/80 rounded-xl px-5 py-3 shadow-xs">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  Estimated 13th Month Pay
                </div>
                <div className="text-2xl font-mono font-black text-primary">
                  ₱{previewNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono flex items-center justify-end gap-1.5">
                  <span>Gross: ₱{previewGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  {Number(advanceDeduction) > 0 && (
                    <span className="text-rose-600 dark:text-rose-400 font-medium">
                      (-₱{Number(advanceDeduction).toLocaleString()})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SCROLLABLE MODAL BODY */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-sm">
          {/* Step-by-Step Mathematical Formula Visual Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-muted/40 border border-border/60 space-y-3.5">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Computation Formula Breakdown
              </span>
              <span className="text-[11px] font-normal text-muted-foreground normal-case">
                DOLE Standard: (Total Basic Salary Earned ÷ 12) or (Pay Per Day × Days Worked)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
              {/* Step 1: Pay Per Day */}
              <div className="p-3.5 rounded-xl bg-background border border-border/70 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">1. Pay Per Day</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">Daily Rate</Badge>
                </div>
                <div className="text-lg font-mono font-bold text-foreground">
                  ₱{line.pay_per_day.toFixed(2)}<span className="text-xs text-muted-foreground font-normal"> / day</span>
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  ₱{line.monthly_salary.toLocaleString()} ÷ {line.period_working_days} working days
                </div>
              </div>

              {/* Step 2: Total Work Days */}
              <div className="p-3.5 rounded-xl bg-background border border-border/70 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">2. Total Days Worked</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">Credited</Badge>
                </div>
                <div className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {effectiveDays.toFixed(2)}<span className="text-xs text-muted-foreground font-normal"> days</span>
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  {sumMonthlyDays.toFixed(2)} base {adjustmentDays !== 0 ? `${adjustmentDays > 0 ? '+' : ''}${adjustmentDays} adj` : ''}
                </div>
              </div>

              {/* Step 3: Product */}
              <div className="p-3.5 rounded-xl bg-background border border-border/70 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">3. 13th Month Pay</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono text-primary bg-primary/10">Computed Gross</Badge>
                </div>
                <div className="text-lg font-mono font-bold text-primary">
                  ₱{previewGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  {effectiveDays.toFixed(2)} days × ₱{line.pay_per_day.toFixed(2)}
                </div>
              </div>
            </div>

            {taxable > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  Exceeds TRAIN Law ₱90k tax-free ceiling. Taxable excess: <b>₱{taxable.toLocaleString()}</b> (Tax withheld: ₱{previewTax.toLocaleString()})
                </span>
              </div>
            )}
          </div>

          {/* Itemized Table Section with Monthly vs Cutoff Switcher */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                Days Worked Calculation Breakdown
              </Label>

              {/* Toggle View */}
              <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/50 text-xs">
                <button
                  type="button"
                  onClick={() => setBreakdownView("MONTHLY")}
                  className={`px-3 py-1.5 rounded-lg transition-all font-medium flex items-center gap-1.5 cursor-pointer ${
                    breakdownView === "MONTHLY"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  Monthly View ({line.monthly_breakdown?.length || 0} Mos)
                </button>
                <button
                  type="button"
                  onClick={() => setBreakdownView("CUTOFF")}
                  className={`px-3 py-1.5 rounded-lg transition-all font-medium flex items-center gap-1.5 cursor-pointer ${
                    breakdownView === "CUTOFF"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-sky-500" />
                  Cutoff Runs ({line.days_breakdown?.length || 0})
                </button>
              </div>
            </div>

            {/* MONTHLY BREAKDOWN VIEW */}
            {breakdownView === "MONTHLY" ? (
              <div className="border border-border/70 rounded-xl overflow-hidden bg-card shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-semibold">
                        <th className="py-3 px-4 text-left font-semibold">Calendar Month</th>
                        <th className="py-3 px-4 text-right font-semibold">
                          <span>Total Working Days</span>
                          <span className="block text-[10px] font-normal text-muted-foreground">Scheduled in Month</span>
                        </th>
                        <th className="py-3 px-4 text-right font-semibold">
                          <span className="flex items-center justify-end gap-1.5">
                            <span>Employee Work Days</span>
                            <Edit3 className="w-3.5 h-3.5 text-primary opacity-80" />
                          </span>
                          <span className="block text-[10px] font-normal text-muted-foreground">Directly Editable</span>
                        </th>
                        <th className="py-3 px-4 text-center font-semibold">Attendance %</th>
                        <th className="py-3 px-4 text-right font-semibold">Month Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {(!line.monthly_breakdown || line.monthly_breakdown.length === 0) ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-muted-foreground italic">
                            No monthly intervals generated for this date range.
                          </td>
                        </tr>
                      ) : (
                        line.monthly_breakdown.map((m, idx) => {
                          const currentDays = monthlyDays[m.month_key] !== undefined ? monthlyDays[m.month_key] : m.days_worked;
                          const isModified = currentDays !== m.actual_days_worked;
                          const monthShare = Math.round(currentDays * line.pay_per_day * 100) / 100;
                          const completionPct = m.total_working_days > 0 ? Math.min(100, Math.round((currentDays / m.total_working_days) * 100)) : 0;
                          const isFull = currentDays >= m.total_working_days && m.total_working_days > 0;

                          return (
                            <tr key={idx} className="hover:bg-muted/20 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-semibold text-foreground flex items-center gap-1.5">
                                  <span>{m.month_name}</span>
                                  {isModified && (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/50 text-amber-600 dark:text-amber-400 font-mono bg-amber-500/10">
                                      Custom
                                    </Badge>
                                  )}
                                </div>
                                {m.cutoffs_count > 0 && (
                                  <div className="text-[10px] text-muted-foreground pt-0.5">
                                    {m.cutoffs_count} cutoffs (DB actual: {m.actual_days_worked}d)
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-muted-foreground font-medium">
                                {m.total_working_days} days
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max={m.total_working_days}
                                    value={currentDays}
                                    onChange={(e) => {
                                      const raw = parseFloat(e.target.value);
                                      const val = isNaN(raw) ? 0 : Math.min(m.total_working_days, Math.max(0, raw));
                                      setMonthlyDays((prev) => ({
                                        ...prev,
                                        [m.month_key]: val,
                                      }));
                                    }}
                                    className={`w-24 h-8 text-right text-xs font-mono font-bold px-2.5 py-1 rounded-lg ${
                                      isModified
                                        ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 focus:ring-amber-500"
                                        : "border-border/70 bg-background"
                                    }`}
                                  />
                                  {isModified && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setMonthlyDays((prev) => ({
                                          ...prev,
                                          [m.month_key]: m.actual_days_worked,
                                        }));
                                      }}
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                      title={`Reset to database actual (${m.actual_days_worked} days)`}
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge
                                  variant="secondary"
                                  className={`text-[10px] font-mono px-2 py-0.5 ${
                                    isFull
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-bold"
                                      : completionPct > 0
                                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 font-medium"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {completionPct}%
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                                ₱{monthShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/50 font-bold text-foreground">
                        <td className="py-3 px-4 font-semibold">Total Across All Months</td>
                        <td className="py-3 px-4 text-right font-mono text-muted-foreground font-bold">
                          {line.period_working_days} days
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                          {sumMonthlyDays.toFixed(2)} days
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-xs font-bold">
                          {line.period_working_days > 0 ? `${Math.round((sumMonthlyDays / line.period_working_days) * 100)}%` : "0%"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-primary font-bold text-sm">
                          ₱{(Math.round(sumMonthlyDays * line.pay_per_day * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              /* CUTOFF BREAKDOWN VIEW */
              <div className="border border-border/70 rounded-xl overflow-hidden bg-card shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-semibold">
                        <th className="py-3 px-4 text-left font-semibold">Cutoff Period</th>
                        <th className="py-3 px-4 text-left font-semibold">Reference No.</th>
                        <th className="py-3 px-4 text-right font-semibold">Days Worked</th>
                        <th className="py-3 px-4 text-right font-semibold">Share Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {line.days_breakdown.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-muted-foreground italic">
                            No individual historical cutoff runs found for this date range. Base days defaulted from hire date / calendar ({line.actual_days_worked.toFixed(2)} days).
                          </td>
                        </tr>
                      ) : (
                        line.days_breakdown.map((item, idx) => {
                          const shareAmount = Math.round(item.days_worked * line.pay_per_day * 100) / 100;
                          return (
                            <tr key={idx} className="hover:bg-muted/20 transition-colors">
                              <td className="py-2.5 px-4 font-medium text-foreground">
                                {item.cutoff_label}
                              </td>
                              <td className="py-2.5 px-4 font-mono text-muted-foreground">
                                {item.run_ref}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono font-semibold text-foreground">
                                {item.days_worked.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono text-muted-foreground font-medium">
                                ₱{shareAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/50 font-bold text-foreground">
                        <td colSpan={2} className="py-3 px-4 font-semibold">
                          Total Days Accumulated from Runs
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                          {line.actual_days_worked.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-primary font-bold text-sm">
                          ₱{(Math.round(line.actual_days_worked * line.pay_per_day * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Manual Adjustment & Override Section */}
          <div className="p-4 sm:p-5 rounded-2xl bg-muted/30 border border-border/60 space-y-4">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-sky-500" />
              Adjustments & Deductions
            </Label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Adjustment Days (+/-)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={adjustmentDays}
                  onChange={(e) => setAdjustmentDays(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 2 for +2 days, -1 for -1 day"
                  className="rounded-xl border-border/80 font-mono text-xs h-9 bg-background"
                />
                <p className="text-[11px] text-muted-foreground">
                  Add credited leave days or deduct unrecorded LWOP days.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Mid-Year Advance Deduction (₱)</Label>
                <Input
                  type="number"
                  step="100"
                  min="0"
                  value={advanceDeduction}
                  onChange={(e) => setAdvanceDeduction(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 5000"
                  className="rounded-xl border-border/80 font-mono text-xs h-9 bg-background"
                />
                <p className="text-[11px] text-muted-foreground">
                  Deduct any earlier 13th month advances disbursed.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Remarks (Optional)</Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Reason for adjustment, if any"
                className="rounded-xl border-border/80 text-xs h-9 bg-background"
              />
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="holdEmployee"
                checked={onHold}
                onChange={(e) => setOnHold(e.target.checked)}
                className="w-4 h-4 rounded border-border/80 cursor-pointer accent-primary"
              />
              <label htmlFor="holdEmployee" className="text-xs text-foreground cursor-pointer select-none">
                Put this employee&apos;s 13th month pay <b>On Hold</b> (excludes from disbursement total)
              </label>
            </div>
          </div>
        </div>

        {/* FIXED FOOTER */}
        <div className="px-6 py-4 border-t border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {hasModifications ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5" />
                Unsaved modifications in days or adjustments
              </span>
            ) : (
              <span>Values match current calculation records</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs h-9 px-4 cursor-pointer"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-md shadow-primary/20 h-9 px-4 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
