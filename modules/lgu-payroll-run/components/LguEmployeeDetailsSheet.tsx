// modules/lgu-payroll-run/components/LguEmployeeDetailsSheet.tsx
"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Landmark,
  Coins,
  Clock,
  Wallet,
  Download,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  Scale,
  Sparkles,
} from "lucide-react";
import { formatPhp } from "../utils/lguCompute";
import { downloadLguPayslipsPdf } from "../utils/lguPayslipPdf";
import { toast } from "sonner";
import type { LguPayrollLine, LguManualAdjustment, CutoffSetting } from "../types";

interface LguEmployeeDetailsSheetProps {
  open: boolean;
  line: LguPayrollLine | null;
  cutoff: CutoffSetting | null;
  payrollRefNo: string;
  isPosted?: boolean;
  onClose: () => void;
  onAddAdjustment?: (userId: number, adjustment: Omit<LguManualAdjustment, "id">) => void;
  onEditAdjustment?: (userId: number, adjustment: LguManualAdjustment) => void;
  onDeleteAdjustment?: (userId: number, adjustmentId: string | number) => void;
}

export default function LguEmployeeDetailsSheet({
  open,
  line,
  cutoff,
  payrollRefNo,
  isPosted = false,
  onClose,
  onAddAdjustment,
  onEditAdjustment,
  onDeleteAdjustment,
}: LguEmployeeDetailsSheetProps) {
  const [activeTab, setActiveTab] = useState("timekeeping");

  // Adjustment Modal State
  const [adjModalOpen, setAdjModalOpen] = useState(false);
  const [editingAdj, setEditingAdj] = useState<LguManualAdjustment | null>(null);
  const [adjType, setAdjType] = useState<"EARNING" | "DEDUCTION">("EARNING");
  const [adjDesc, setAdjDesc] = useState("");
  const [adjAmount, setAdjAmount] = useState("");

  // Delete Alert Dialog State (No native browser dialogs)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingAdjId, setDeletingAdjId] = useState<string | number | null>(null);

  if (!line) return null;

  const handleOpenAddAdj = () => {
    setEditingAdj(null);
    setAdjType("EARNING");
    setAdjDesc("");
    setAdjAmount("");
    setAdjModalOpen(true);
  };

  const handleOpenEditAdj = (adj: LguManualAdjustment) => {
    setEditingAdj(adj);
    setAdjType(adj.type);
    setAdjDesc(adj.description);
    setAdjAmount(String(adj.amount));
    setAdjModalOpen(true);
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(adjAmount);
    if (!adjDesc.trim() || isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid description and positive amount.");
      return;
    }

    if (editingAdj) {
      if (onEditAdjustment) {
        onEditAdjustment(line.userId, {
          ...editingAdj,
          type: adjType,
          description: adjDesc.trim(),
          amount: amt,
        });
        toast.success("Adjustment updated successfully.");
      }
    } else {
      if (onAddAdjustment) {
        onAddAdjustment(line.userId, {
          type: adjType,
          description: adjDesc.trim(),
          amount: amt,
          isCustom: true,
        });
        toast.success("Adjustment added successfully.");
      }
    }

    setAdjModalOpen(false);
  };

  const promptDeleteAdj = (id: string | number) => {
    setDeletingAdjId(id);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletingAdjId != null && onDeleteAdjustment) {
      onDeleteAdjustment(line.userId, deletingAdjId);
      toast.success("Adjustment deleted.");
    }
    setDeleteConfirmOpen(false);
    setDeletingAdjId(null);
  };

  const handleDownloadSinglePayslip = async () => {
    try {
      await downloadLguPayslipsPdf({
        lines: [line],
        cutoff,
        payrollRefNo,
        singleEmployeeId: line.userId,
      });
      toast.success("Payslip downloaded successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download payslip.");
    }
  };

  // Initials for avatar
  const initials = line.employeeName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  // Minimum GAA net take-home pay check (threshold ₱5,000)
  const isBelowGaaThreshold = line.netPay < 5000 && !line.isOnHold;

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
        <DialogContent className="w-[95vw] sm:max-w-4xl lg:max-w-5xl max-h-[92vh] overflow-y-auto p-0 gap-0 border-slate-200 dark:border-gray-800 shadow-2xl">
          {/* Header Banner */}
          <div className="bg-slate-900 text-white p-6 rounded-t-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-8">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-lg text-white shadow-md border border-white/20 shrink-0">
                  {initials}
                </div>
                <div>
                  <DialogHeader className="text-left space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <DialogTitle className="text-xl font-bold tracking-tight text-white">
                        {line.employeeName}
                      </DialogTitle>
                      <Badge className="bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-mono font-semibold">
                        {line.salaryGrade || "SG-11 Step 1"}
                      </Badge>
                      <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs">
                        {line.employmentStatus || "Permanent"}
                      </Badge>
                      {line.isOnHold && (
                        <Badge className="bg-amber-500 text-black text-xs font-bold">ON HOLD</Badge>
                      )}
                    </div>
                    <DialogDescription className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{line.position}</span>
                      <span>•</span>
                      <span>{line.departmentName}</span>
                      <span>•</span>
                      <span className="font-mono">{line.employeeNo}</span>
                    </DialogDescription>
                  </DialogHeader>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadSinglePayslip}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-9 flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Payslip</span>
                </Button>
              </div>
            </div>

            {/* Public Sector Benchmarks / Rates Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5 pt-4 border-t border-slate-800 text-xs">
              <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Monthly Basic Salary</div>
                <div className="text-sm font-bold font-mono text-white mt-0.5">{formatPhp(line.monthlySalary)}</div>
              </div>
              <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">CSC Daily Rate (22 days)</div>
                <div className="text-sm font-bold font-mono text-white mt-0.5">{formatPhp(line.dailyRate)}</div>
              </div>
              <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Hourly Rate (8h)</div>
                <div className="text-sm font-bold font-mono text-white mt-0.5">{formatPhp(line.hourlyRate)}</div>
              </div>
              <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">CSC Minute Rate</div>
                <div className="text-sm font-bold font-mono text-white mt-0.5">₱{(line.minuteRate || 0).toFixed(4)}</div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Top 4 Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-1">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Gross Compensation</div>
                <div className="text-lg font-bold font-mono text-slate-900 dark:text-gray-100">
                  {formatPhp(line.totalGrossPay)}
                </div>
                <div className="text-[11px] text-slate-400">Basic + PERA + Allowances</div>
              </div>

              <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-950/60 bg-red-50/30 dark:bg-red-950/20 shadow-sm space-y-1">
                <div className="text-[11px] font-semibold text-red-700 dark:text-red-400 uppercase flex items-center justify-between">
                  <span>Personal Deductions</span>
                  {(line.uncollectedDeductions ?? 0) > 0 && (
                    <span className="text-[10px] font-bold text-amber-600 font-mono">
                      Deferred
                    </span>
                  )}
                </div>
                <div className="text-lg font-bold font-mono text-red-600 dark:text-red-400">
                  {formatPhp(line.totalPersonalDeductions)}
                </div>
                <div className="text-[11px] text-red-600/80">
                  {line.totalGrossPay <= 0 && (line.uncollectedDeductions ?? 0) > 0
                    ? "Deferred (Zero Gross Pay)"
                    : "Statutory, Loans & Taxes"}
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border shadow-sm space-y-1 ${
                line.netPay < 5000
                  ? "border-amber-200 dark:border-amber-950/60 bg-amber-50/40 dark:bg-amber-950/20"
                  : "border-emerald-200 dark:border-emerald-950/60 bg-emerald-50/40 dark:bg-emerald-950/20"
              }`}>
                <div className="text-[11px] font-semibold uppercase flex items-center justify-between">
                  <span className={
                    line.netPay < 5000
                      ? "text-amber-800 dark:text-amber-300"
                      : "text-emerald-800 dark:text-emerald-300"
                  }>Net Take-Home Pay</span>
                  {line.netPay >= 5000 ? (
                    <span className="text-[10px] font-bold text-emerald-600 font-mono">GAA OK</span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-600 font-mono">&lt; ₱5k</span>
                  )}
                </div>
                <div className={`text-lg font-extrabold font-mono ${
                  line.netPay < 5000
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-emerald-700 dark:text-emerald-400"
                }`}>
                  {formatPhp(line.netPay)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {line.netPay <= 0 ? "Zero disbursement" : "Net disbursement"}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-950/60 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-sm space-y-1">
                <div className="text-[11px] font-semibold text-indigo-800 dark:text-indigo-300 uppercase">LGU Counterpart</div>
                <div className="text-lg font-bold font-mono text-indigo-700 dark:text-indigo-400">
                  {formatPhp(line.totalLguCounterpart)}
                </div>
                <div className="text-[11px] text-indigo-600/80">LGU Share (GSIS + PH + HDMF)</div>
              </div>
            </div>

            {(line.uncollectedDeductions ?? 0) > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                <span>
                  <strong>Zero/Insufficient Earnings Advisory:</strong> Under Philippine and Civil Service payroll rules, deductions cannot exceed gross pay or create a negative disbursement. Because this employee has {formatPhp(line.totalGrossPay)} gross pay, scheduled deductions totaling <strong>{formatPhp(line.uncollectedDeductions!)}</strong> cannot be deducted and are deferred for this cutoff.
                </span>
              </div>
            )}

            {isBelowGaaThreshold && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  <strong>GAA Net Take-Home Pay Advisory:</strong> Under the General Appropriations Act, government personnel should have a minimum net take-home pay of ₱5,000.00 after all authorized deductions.
                </span>
              </div>
            )}

            {/* Tabs Section */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto p-1.5 bg-slate-100 dark:bg-gray-800 rounded-xl gap-1">
                <TabsTrigger value="timekeeping" className="text-xs py-2 px-2 text-center truncate whitespace-nowrap data-[state=active]:shadow-sm">
                  1. Attendance &amp; Earnings
                </TabsTrigger>
                <TabsTrigger value="statutory" className="text-xs py-2 px-2 text-center truncate whitespace-nowrap data-[state=active]:shadow-sm">
                  2. Statutory Cost-Sharing
                </TabsTrigger>
                <TabsTrigger value="loans" className="text-xs py-2 px-2 text-center truncate whitespace-nowrap data-[state=active]:shadow-sm">
                  3. Loans &amp; Taxes
                </TabsTrigger>
                <TabsTrigger value="adjustments" className="text-xs py-2 px-2 text-center truncate whitespace-nowrap data-[state=active]:shadow-sm">
                  4. Custom Adjustments ({line.manualAdditions.length + line.manualDeductions.length})
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Attendance & Earnings */}
              <TabsContent value="timekeeping" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* CSC Attendance & Timekeeping */}
                  <Card className="border-slate-200 dark:border-gray-800">
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-gray-800">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span>CSC Attendance &amp; Tardiness (Omnibus Rules)</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Standard 22 days/month = 11 days per bi-monthly cutoff.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                        <span className="text-slate-600 dark:text-gray-400">Standard Cutoff Days:</span>
                        <span className="font-semibold">{line.standardCutoffDays || 11} Working Days</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                        <span className="text-slate-600 dark:text-gray-400">Days Present / Worked:</span>
                        <span className="font-semibold text-emerald-600">{line.daysWorked} Days</span>
                      </div>
                      {line.absentDays > 0 && (
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800 text-red-600">
                          <span>Absences / LWOP ({line.absentDays} days):</span>
                          <span className="font-mono font-semibold">({formatPhp(line.absentDeduction)})</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                        <span className="text-slate-600 dark:text-gray-400">Late Tardiness Minutes:</span>
                        <span className="font-mono">{line.lateMinutes} mins</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                        <span className="text-slate-600 dark:text-gray-400">Tardiness Deduction:</span>
                        <span className="font-mono font-semibold text-red-600">
                          {line.lateDeduction > 0 ? `(${formatPhp(line.lateDeduction)})` : "₱0.00"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                        <span className="text-slate-600 dark:text-gray-400">Undertime Minutes:</span>
                        <span className="font-mono">{line.undertimeMinutes} mins</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-600 dark:text-gray-400">Undertime Deduction:</span>
                        <span className="font-mono font-semibold text-red-600">
                          {line.undertimeDeduction > 0 ? `(${formatPhp(line.undertimeDeduction)})` : "₱0.00"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Compensation & Allowances */}
                  <Card className="border-slate-200 dark:border-gray-800">
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-gray-800">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-emerald-600" />
                        <span>Compensation &amp; Mandated Allowances</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Authorized public sector earnings under DBM guidelines.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                        <span className="text-slate-600 dark:text-gray-400">Cutoff Basic Salary:</span>
                        <span className="font-mono font-semibold">{formatPhp(line.basicPay)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                        <div>
                          <span className="text-slate-800 dark:text-gray-200 font-medium">PERA Allowance:</span>
                          <span className="text-[10px] text-slate-400 block">Personnel Economic Relief (DBM)</span>
                        </div>
                        <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
                          {formatPhp(line.peraAllowance)}
                        </span>
                      </div>
                      {line.rataAllowance > 0 && (
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                          <div>
                            <span className="text-slate-800 dark:text-gray-200 font-medium">RATA Allowance:</span>
                            <span className="text-[10px] text-slate-400 block">Representation &amp; Transportation</span>
                          </div>
                          <span className="font-mono font-semibold">{formatPhp(line.rataAllowance)}</span>
                        </div>
                      )}
                      {line.hazardPay > 0 && (
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                          <div>
                            <span className="text-slate-800 dark:text-gray-200 font-medium">Hazard Pay:</span>
                            <span className="text-[10px] text-slate-400 block">Magna Carta (Public Health / DRRM)</span>
                          </div>
                          <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">{formatPhp(line.hazardPay)}</span>
                        </div>
                      )}
                      {line.overtimePay > 0 && (
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                          <span className="text-slate-600 dark:text-gray-400">Overtime &amp; Night Diff:</span>
                          <span className="font-mono font-semibold">{formatPhp(line.overtimePay + line.nightDiffPay)}</span>
                        </div>
                      )}
                      {line.otherAllowances > 0 && (
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                          <span className="text-slate-600 dark:text-gray-400">Other Authorized Allowances:</span>
                          <span className="font-mono font-semibold">{formatPhp(line.otherAllowances)}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1.5 pt-2 border-t border-slate-200 dark:border-gray-700 font-bold text-slate-900 dark:text-gray-100">
                        <span>Total Gross Compensation:</span>
                        <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                          {formatPhp(line.totalGrossPay)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab 2: Statutory Cost-Sharing Matrix */}
              <TabsContent value="statutory" className="space-y-4 pt-4">
                <Card className="border-slate-200 dark:border-gray-800">
                  <CardHeader className="pb-3 border-b border-slate-100 dark:border-gray-800">
                    <CardTitle className="text-sm font-bold flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-indigo-600" />
                        <span>Public Sector Statutory Cost-Sharing Scheme</span>
                      </div>
                      <Badge className="bg-indigo-600 text-white text-[10px]">Republic Acts Mandate</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Comparison of employee personal salary deduction vs. employer government counterpart obligation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4 text-xs">
                    <div className="rounded-lg border border-slate-200 dark:border-gray-800 overflow-hidden">
                      <div className="grid grid-cols-4 gap-2 bg-slate-100 dark:bg-gray-800 p-2.5 font-bold text-[11px] text-slate-700 dark:text-gray-300">
                        <span>Social Agency</span>
                        <span className="text-right text-blue-700 dark:text-blue-400">Personal (Employee 50%)</span>
                        <span className="text-right text-emerald-700 dark:text-emerald-400">LGU Share (Government)</span>
                        <span className="text-right text-slate-900 dark:text-gray-100">Total Remittance</span>
                      </div>

                      {/* GSIS Row */}
                      <div className="grid grid-cols-4 gap-2 p-3 border-b border-slate-100 dark:border-gray-800 hover:bg-slate-50/50">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-gray-100">GSIS Life &amp; Retirement</div>
                          <div className="text-[10px] text-slate-500">RA 8291 (9% vs 12%)</div>
                        </div>
                        <div className="text-right font-mono font-semibold text-blue-700 dark:text-blue-400">
                          {formatPhp(line.statutory.gsisEmployee)}
                        </div>
                        <div className="text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatPhp(line.statutory.gsisGovernment)}
                        </div>
                        <div className="text-right font-mono font-bold text-slate-900 dark:text-gray-100">
                          {formatPhp(line.statutory.gsisTotal)}
                        </div>
                      </div>

                      {/* PhilHealth Row */}
                      <div className="grid grid-cols-4 gap-2 p-3 border-b border-slate-100 dark:border-gray-800 hover:bg-slate-50/50">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-gray-100">PhilHealth (Universal Health)</div>
                          <div className="text-[10px] text-slate-500">RA 11223 (2.5% vs 2.5%)</div>
                        </div>
                        <div className="text-right font-mono font-semibold text-blue-700 dark:text-blue-400">
                          {formatPhp(line.statutory.philhealthEmployee)}
                        </div>
                        <div className="text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatPhp(line.statutory.philhealthGovernment)}
                        </div>
                        <div className="text-right font-mono font-bold text-slate-900 dark:text-gray-100">
                          {formatPhp(line.statutory.philhealthTotal)}
                        </div>
                      </div>

                      {/* Pag-IBIG Row */}
                      <div className="grid grid-cols-4 gap-2 p-3 border-b border-slate-100 dark:border-gray-800 hover:bg-slate-50/50">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-gray-100">Pag-IBIG Fund (HDMF)</div>
                          <div className="text-[10px] text-slate-500">RA 9679 (DBM Circular)</div>
                        </div>
                        <div className="text-right font-mono font-semibold text-blue-700 dark:text-blue-400">
                          {formatPhp(line.statutory.pagibigEmployee)}
                        </div>
                        <div className="text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatPhp(line.statutory.pagibigGovernment)}
                        </div>
                        <div className="text-right font-mono font-bold text-slate-900 dark:text-gray-100">
                          {formatPhp(line.statutory.pagibigTotal)}
                        </div>
                      </div>

                      {/* Statutory Totals */}
                      <div className="grid grid-cols-4 gap-2 p-3 bg-slate-50 dark:bg-gray-800/60 font-bold">
                        <span className="text-slate-900 dark:text-gray-100">Subtotal Mandatory Statutory:</span>
                        <span className="text-right font-mono text-blue-800 dark:text-blue-300">
                          {formatPhp(line.statutory.totalEmployeeStatutory)}
                        </span>
                        <span className="text-right font-mono text-emerald-800 dark:text-emerald-300">
                          {formatPhp(line.statutory.totalGovernmentStatutory)}
                        </span>
                        <span className="text-right font-mono text-indigo-900 dark:text-indigo-200">
                          {formatPhp(line.statutory.grandTotalStatutory)}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40 text-blue-900 dark:text-blue-300 text-xs">
                      <p>
                        <strong>Transparency Note:</strong> In accordance with COA and Civil Service Commission audit rules, the Local Government Unit shoulders <strong>12%</strong> for GSIS and matches employee PhilHealth and Pag-IBIG contributions directly from the General Fund / Personnel Services appropriation.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 3: Loans & Taxes */}
              <TabsContent value="loans" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* BIR Withholding Tax */}
                  <Card className="border-slate-200 dark:border-gray-800">
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-gray-800">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Scale className="h-4 w-4 text-purple-600" />
                        <span>BIR Withholding Tax (TRAIN Law)</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Graduated withholding tax computation for the cutoff.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                        <span className="text-slate-600 dark:text-gray-400">Total Gross Pay:</span>
                        <span className="font-mono">{formatPhp(line.totalGrossPay)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                        <span className="text-slate-600 dark:text-gray-400">Non-Taxable PERA &amp; Statutory:</span>
                        <span className="font-mono text-emerald-600">
                          ({formatPhp(line.peraAllowance + line.statutory.totalEmployeeStatutory)})
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800 font-medium">
                        <span className="text-slate-800 dark:text-gray-200">Taxable Compensation Income:</span>
                        <span className="font-mono text-purple-700 dark:text-purple-300">
                          {formatPhp(line.taxableIncome)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 pt-2 border-t border-slate-200 font-bold">
                        <span className="text-slate-900 dark:text-gray-100">Tax Withheld for Cutoff:</span>
                        <span className="font-mono text-sm text-red-600">
                          {formatPhp(line.taxWithholding)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Public Sector Loans */}
                  <Card className="border-slate-200 dark:border-gray-800">
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-gray-800">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Coins className="h-4 w-4 text-amber-600" />
                        <span>Government Loans &amp; Amortizations</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        GSIS and Pag-IBIG institutional salary loan deductions.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2.5 text-xs">
                      {line.gsisLoansBreakdown.length > 0 ? (
                        line.gsisLoansBreakdown.map((l, i) => (
                          <div key={i} className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                            <div>
                              <span className="font-medium text-slate-800 dark:text-gray-200">{l.loanType}</span>
                              {l.balance != null && (
                                <span className="text-[10px] text-slate-400 block">Bal: {formatPhp(l.balance)}</span>
                              )}
                            </div>
                            <span className="font-mono font-semibold text-red-600">({formatPhp(l.amount)})</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800 text-slate-400">
                          <span>GSIS Loans:</span>
                          <span className="font-mono">₱0.00</span>
                        </div>
                      )}

                      {line.pagibigLoansBreakdown.length > 0 ? (
                        line.pagibigLoansBreakdown.map((l, i) => (
                          <div key={i} className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                            <div>
                              <span className="font-medium text-slate-800 dark:text-gray-200">{l.loanType}</span>
                              {l.balance != null && (
                                <span className="text-[10px] text-slate-400 block">Bal: {formatPhp(l.balance)}</span>
                              )}
                            </div>
                            <span className="font-mono font-semibold text-red-600">({formatPhp(l.amount)})</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800 text-slate-400">
                          <span>Pag-IBIG Loans:</span>
                          <span className="font-mono">₱0.00</span>
                        </div>
                      )}

                      {line.coopDeduction > 0 && (
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                          <span>LGU Cooperative Deduction:</span>
                          <span className="font-mono font-semibold text-red-600">({formatPhp(line.coopDeduction)})</span>
                        </div>
                      )}

                      {line.unionDues > 0 && (
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                          <span>Employees Association / Union Dues:</span>
                          <span className="font-mono font-semibold text-red-600">({formatPhp(line.unionDues)})</span>
                        </div>
                      )}

                      <div className="flex justify-between py-1.5 pt-2 border-t border-slate-200 font-bold">
                        <span>Total Loan Amortizations:</span>
                        <span className="font-mono text-sm text-red-600">
                          ({formatPhp(line.gsisLoan + line.pagibigLoan + line.coopDeduction + line.unionDues)})
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab 4: Custom Adjustments */}
              <TabsContent value="adjustments" className="space-y-4 pt-4">
                <Card className="border-slate-200 dark:border-gray-800">
                  <CardHeader className="pb-3 border-b border-slate-100 dark:border-gray-800 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        <span>Manual Payroll Adjustments for This Cutoff</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Add one-time earnings (Honoraria, retroactive pay) or deductions (disallowances, shortages).
                      </CardDescription>
                    </div>

                    {!isPosted && (
                      <Button
                        size="sm"
                        onClick={handleOpenAddAdj}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 flex items-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Adjustment</span>
                      </Button>
                    )}
                  </CardHeader>

                  <CardContent className="p-4 space-y-4 text-xs">
                    {/* Additions list */}
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-gray-200 mb-2 flex items-center justify-between">
                        <span>Other Additions (Custom Earnings)</span>
                        <span className="font-mono text-emerald-600">
                          +{formatPhp(line.manualAdditions.reduce((sum, a) => sum + a.amount, 0))}
                        </span>
                      </h4>

                      {line.manualAdditions.length > 0 ? (
                        <div className="space-y-2">
                          {line.manualAdditions.map((adj) => (
                            <div
                              key={String(adj.id)}
                              className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-100 dark:border-gray-800 bg-emerald-50/30 dark:bg-emerald-950/20"
                            >
                              <div>
                                <span className="font-semibold text-slate-900 dark:text-gray-100">{adj.description}</span>
                                <span className="text-[10px] text-slate-400 block">{adj.category || "Addition"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                  +{formatPhp(adj.amount)}
                                </span>
                                {!isPosted && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleOpenEditAdj(adj)}
                                      className="h-6 w-6 text-slate-500 hover:text-blue-600"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => promptDeleteAdj(adj.id)}
                                      className="h-6 w-6 text-slate-500 hover:text-red-600"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400 italic text-[11px] py-1">No custom additions added for this employee.</p>
                      )}
                    </div>

                    {/* Deductions list */}
                    <div className="pt-2 border-t border-slate-100 dark:border-gray-800">
                      <h4 className="font-bold text-slate-800 dark:text-gray-200 mb-2 flex items-center justify-between">
                        <span>Other Deductions (Custom Reductions)</span>
                        <span className="font-mono text-red-600">
                          -({formatPhp(line.manualDeductions.reduce((sum, d) => sum + d.amount, 0))})
                        </span>
                      </h4>

                      {line.manualDeductions.length > 0 ? (
                        <div className="space-y-2">
                          {line.manualDeductions.map((adj) => (
                            <div
                              key={String(adj.id)}
                              className="flex items-center justify-between p-2.5 rounded-lg border border-red-100 dark:border-gray-800 bg-red-50/30 dark:bg-red-950/20"
                            >
                              <div>
                                <span className="font-semibold text-slate-900 dark:text-gray-100">{adj.description}</span>
                                <span className="text-[10px] text-slate-400 block">{adj.category || "Deduction"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-red-600 dark:text-red-400">
                                  -({formatPhp(adj.amount)})
                                </span>
                                {!isPosted && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleOpenEditAdj(adj)}
                                      className="h-6 w-6 text-slate-500 hover:text-blue-600"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => promptDeleteAdj(adj.id)}
                                      className="h-6 w-6 text-slate-500 hover:text-red-600"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400 italic text-[11px] py-1">No custom deductions added for this employee.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="p-4 bg-slate-50 dark:bg-gray-900 border-t border-slate-200 dark:border-gray-800 flex items-center justify-between sm:justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadSinglePayslip}
              className="text-xs text-blue-700 hover:text-blue-800 border-blue-200 hover:bg-blue-50 flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Official Payslip (PDF)</span>
            </Button>
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment Form Modal */}
      <Dialog open={adjModalOpen} onOpenChange={setAdjModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingAdj ? "Edit Payroll Adjustment" : "Add Payroll Adjustment"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Employee: {line.employeeName} ({line.position})
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAdjustment} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Adjustment Type</Label>
              <Select value={adjType} onValueChange={(v: "EARNING" | "DEDUCTION") => setAdjType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EARNING">Addition / Earning (Halimbawa: Honorarium, Allowance)</SelectItem>
                  <SelectItem value="DEDUCTION">Deduction / Bawas (Halimbawa: Disallowance, Shortage)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description / Reason</Label>
              <Input
                value={adjDesc}
                onChange={(e) => setAdjDesc(e.target.value)}
                placeholder="e.g. BAC Committee Honorarium, Provincial Coop..."
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Amount (PHP)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setAdjModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                {editingAdj ? "Update Adjustment" : "Add Adjustment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog (Strictly no browser dialogs!) */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">Delete Adjustment?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete this custom adjustment? The employee&apos;s payroll line will be recalculated immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white text-xs"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
