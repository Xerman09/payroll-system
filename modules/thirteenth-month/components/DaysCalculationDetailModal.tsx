// modules/thirteenth-month/components/DaysCalculationDetailModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  ArrowRight,
  PlusCircle,
  FileSpreadsheet,
  Check,
  AlertCircle,
  ShieldCheck,
  RotateCcw,
  Edit3,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/30 text-primary text-xs font-semibold uppercase px-2 py-0.5 rounded-full bg-primary/5">
                <User className="w-3.5 h-3.5 mr-1 inline" />
                Employee Calculation Sheet
              </Badge>
              {line.on_hold && (
                <Badge variant="destructive" className="text-xs">
                  On Hold
                </Badge>
              )}
            </div>
            <span className="text-xs font-mono text-muted-foreground">User ID: #{line.user_id}</span>
          </div>

          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground flex items-center justify-between pt-1">
            <span>{line.employee_name}</span>
            <span className="text-lg font-mono font-bold text-primary">
              ₱{previewNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-3 pt-0.5">
            <span>Dept: <b className="text-foreground">{line.department_name}</b></span>
            <span>Position: <b className="text-foreground">{line.position}</b></span>
            {line.hire_date && (
              <span>Hired: <b className="text-foreground">{safeFormatDate(line.hire_date)}</b></span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3 text-sm">
          {/* Step-by-Step Mathematical Formula Visual Card */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <span>Computation Formula Breakdown</span>
              <Calculator className="w-4 h-4 text-emerald-500" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Step 1: Pay Per Day */}
              <div className="p-3 rounded-xl bg-background/70 border border-border/60 space-y-1">
                <div className="text-muted-foreground font-medium">1. Pay Per Day</div>
                <div className="text-sm font-mono font-bold text-foreground">
                  ₱{line.pay_per_day.toFixed(2)}/day
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  ₱{line.monthly_salary.toLocaleString()} ÷ {line.period_working_days} days
                </div>
              </div>

              {/* Step 2: Total Work Days */}
              <div className="p-3 rounded-xl bg-background/70 border border-border/60 space-y-1">
                <div className="text-muted-foreground font-medium">2. Total Days Worked</div>
                <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {effectiveDays.toFixed(2)} days
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {line.actual_days_worked.toFixed(2)} base {adjustmentDays !== 0 ? `${adjustmentDays > 0 ? '+' : ''}${adjustmentDays} adj` : ''}
                </div>
              </div>

              {/* Step 3: Product */}
              <div className="p-3 rounded-xl bg-background/70 border border-border/60 space-y-1">
                <div className="text-muted-foreground font-medium">3. 13th Month Pay</div>
                <div className="text-sm font-mono font-bold text-primary">
                  ₱{previewGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {effectiveDays.toFixed(2)} days × ₱{line.pay_per_day.toFixed(2)}
                </div>
              </div>
            </div>

            {taxable > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  Exceeds TRAIN Law ₱90k tax-free ceiling. Taxable excess: ₱{taxable.toLocaleString()} (Tax withheld: ₱{previewTax.toLocaleString()})
                </span>
              </div>
            )}
          </div>

          {/* Itemized Table Section with Monthly vs Cutoff Switcher */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                Days Worked Calculation Breakdown
              </Label>

              {/* Toggle View */}
              <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-white/5 text-xs">
                <button
                  type="button"
                  onClick={() => setBreakdownView("MONTHLY")}
                  className={`px-3 py-1 rounded-lg transition-colors font-medium flex items-center gap-1.5 ${
                    breakdownView === "MONTHLY"
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Calendar className="w-3 h-3 text-primary" />
                  Monthly View ({line.monthly_breakdown?.length || 0} Mos)
                </button>
                <button
                  type="button"
                  onClick={() => setBreakdownView("CUTOFF")}
                  className={`px-3 py-1 rounded-lg transition-colors font-medium flex items-center gap-1.5 ${
                    breakdownView === "CUTOFF"
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Clock className="w-3 h-3 text-sky-500" />
                  Cutoff Runs ({line.days_breakdown?.length || 0})
                </button>
              </div>
            </div>

            {/* MONTHLY BREAKDOWN VIEW */}
            {breakdownView === "MONTHLY" ? (
              <div className="border border-border/60 rounded-xl overflow-hidden bg-card/40">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/50 text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3 text-left">Calendar Month</th>
                      <th className="py-2.5 px-3 text-right">
                        <span>Total Working Days</span>
                        <span className="block text-[9px] font-normal opacity-70">Scheduled In Month</span>
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        <span className="flex items-center justify-end gap-1">
                          <span>Employee Work Days</span>
                          <Edit3 className="w-3 h-3 text-primary opacity-80" />
                        </span>
                        <span className="block text-[9px] font-normal opacity-70">Directly Editable</span>
                      </th>
                      <th className="py-2.5 px-3 text-center">Attendance %</th>
                      <th className="py-2.5 px-3 text-right">Month Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {(!line.monthly_breakdown || line.monthly_breakdown.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-muted-foreground italic">
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
                          <tr key={idx} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-foreground flex items-center gap-1.5">
                                <span>{m.month_name}</span>
                                {isModified && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/50 text-amber-600 dark:text-amber-400 font-mono bg-amber-500/10">
                                    Custom
                                  </Badge>
                                )}
                              </div>
                              {m.cutoffs_count > 0 && (
                                <div className="text-[10px] text-muted-foreground">
                                  {m.cutoffs_count} cutoffs (DB actual: {m.actual_days_worked}d)
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                              {m.total_working_days} days
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
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
                                  className={`w-20 h-7 text-right text-xs font-mono font-bold px-2 py-0 rounded-lg ${
                                    isModified
                                      ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 focus:ring-amber-500"
                                      : "border-border/60 bg-background/80"
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
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                    title={`Reset to database actual (${m.actual_days_worked} days)`}
                                  >
                                    <RotateCcw className="w-3 h-3 text-amber-500" />
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] font-mono px-1.5 py-0.5 ${
                                  isFull
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
                                    : completionPct > 0
                                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {completionPct}%
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium text-foreground">
                              ₱{monthShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border/80 bg-muted/60 font-bold text-foreground">
                      <td className="py-2.5 px-3">Total Across All Months</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                        {line.period_working_days} days
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {sumMonthlyDays.toFixed(2)} days
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-xs">
                        {line.period_working_days > 0 ? `${Math.round((sumMonthlyDays / line.period_working_days) * 100)}%` : "0%"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-primary">
                        ₱{(Math.round(sumMonthlyDays * line.pay_per_day * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              /* CUTOFF BREAKDOWN VIEW */
              <div className="border border-border/60 rounded-xl overflow-hidden bg-card/40">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/50 text-muted-foreground font-semibold">
                      <th className="py-2 px-3 text-left">Cutoff Period</th>
                      <th className="py-2 px-3 text-left">Reference No.</th>
                      <th className="py-2 px-3 text-right">Days Worked</th>
                      <th className="py-2 px-3 text-right">Share Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {line.days_breakdown.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-muted-foreground italic">
                          No individual historical cutoff runs found for this date range. Base days defaulted from hire date / calendar ({line.actual_days_worked.toFixed(2)} days).
                        </td>
                      </tr>
                    ) : (
                      line.days_breakdown.map((item, idx) => {
                        const shareAmount = Math.round(item.days_worked * line.pay_per_day * 100) / 100;
                        return (
                          <tr key={idx} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2 px-3 font-medium text-foreground">
                              {item.cutoff_label}
                            </td>
                            <td className="py-2 px-3 font-mono text-muted-foreground">
                              {item.run_ref}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-foreground">
                              {item.days_worked.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                              ₱{shareAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border/80 bg-muted/60 font-bold text-foreground">
                      <td colSpan={2} className="py-2.5 px-3">
                        Total Days Accumulated from Runs
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {line.actual_days_worked.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-primary">
                        ₱{(Math.round(line.actual_days_worked * line.pay_per_day * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Manual Adjustment & Override Section */}
          <div className="p-4 rounded-2xl bg-muted/30 border border-white/5 space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <PlusCircle className="w-3.5 h-3.5 text-sky-500" />
              Adjustments & Deductions
            </Label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Adjustment Days (+/-)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={adjustmentDays}
                  onChange={(e) => setAdjustmentDays(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 2 for +2 days"
                  className="rounded-xl border-border/80 font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Add credited leave days or deduct unrecorded LWOP days.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Mid-Year Advance Deduction (₱)</Label>
                <Input
                  type="number"
                  step="100"
                  min="0"
                  value={advanceDeduction}
                  onChange={(e) => setAdvanceDeduction(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 5000"
                  className="rounded-xl border-border/80 font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Deduct any earlier 13th month advances disbursed.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-medium">Remarks</Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Reason for adjustment, if any"
                className="rounded-xl border-border/80 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="holdEmployee"
                checked={onHold}
                onChange={(e) => setOnHold(e.target.checked)}
                className="rounded border-border/80 cursor-pointer"
              />
              <label htmlFor="holdEmployee" className="text-xs text-muted-foreground cursor-pointer select-none">
                Put this employee&apos;s 13th month pay <b>On Hold</b> (excludes from disbursement total)
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs"
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="rounded-xl text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-md shadow-primary/20"
          >
            <Check className="w-4 h-4" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
