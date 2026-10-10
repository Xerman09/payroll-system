// modules/lgu-payroll-run/components/LguPayrollAdjustStep.tsx
"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Eye,
  ArrowRight,
  ArrowLeft,
  Download,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";
import { downloadLguPayslipsPdf } from "../utils/lguPayslipPdf";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPhp } from "../utils/lguCompute";
import LguEmployeeDetailsSheet from "./LguEmployeeDetailsSheet";
import type {
  LguPayrollLine,
  LguPayrollSummary,
  Department,
  CutoffSetting,
  LguManualAdjustment,
} from "../types";

interface LguPayrollAdjustStepProps {
  lines: LguPayrollLine[];
  summary: LguPayrollSummary;
  departments: Department[];
  cutoff: CutoffSetting | null;
  payrollRefNo: string;
  onToggleHold: (userId: number) => void;
  onAddAdjustment?: (userId: number, adjustment: Omit<LguManualAdjustment, "id">) => void;
  onEditAdjustment?: (userId: number, adjustment: LguManualAdjustment) => void;
  onDeleteAdjustment?: (userId: number, adjustmentId: string | number) => void;
  onRecompute?: () => void;
  onProceed: () => void;
  onBack: () => void;
  isProcessing?: boolean;
}

export default function LguPayrollAdjustStep({
  lines,
  summary,
  departments,
  cutoff,
  payrollRefNo,
  onToggleHold,
  onAddAdjustment,
  onEditAdjustment,
  onDeleteAdjustment,
  onRecompute,
  onProceed,
  onBack,
  isProcessing = false,
}: LguPayrollAdjustStepProps) {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "HOLD">("ALL");

  // Detail Sheet State
  const [activeUserId, setActiveUserId] = useState<number | null>(null);

  const activeLine = useMemo(() => {
    if (activeUserId == null) return null;
    return lines.find((l) => l.userId === activeUserId) || null;
  }, [lines, activeUserId]);

  const handleDownloadSinglePayslip = async (userId: number) => {
    const target = lines.find((l) => l.userId === userId);
    if (!target) return;
    try {
      await downloadLguPayslipsPdf({
        lines: [target],
        cutoff,
        payrollRefNo,
        singleEmployeeId: userId,
      });
      toast.success("Payslip downloaded successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download payslip.");
    }
  };

  const filteredLines = useMemo(() => {
    return lines.filter((l) => {
      if (statusFilter === "ACTIVE" && l.isOnHold) return false;
      if (statusFilter === "HOLD" && !l.isOnHold) return false;

      if (deptFilter !== "ALL" && String(l.departmentId) !== deptFilter) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = l.employeeName.toLowerCase().includes(q);
        const matchPos = l.position.toLowerCase().includes(q);
        const matchDept = l.departmentName.toLowerCase().includes(q);
        const matchNo = (l.employeeNo || "").toLowerCase().includes(q);
        const matchSg = (l.salaryGrade || "").toLowerCase().includes(q);
        if (!matchName && !matchPos && !matchDept && !matchNo && !matchSg) return false;
      }

      return true;
    });
  }, [lines, search, deptFilter, statusFilter]);

  return (
    <div className="space-y-5">
      {/* Top Aggregation Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 uppercase">
            Headcount
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-gray-100">
            {summary.activeHeadcount} <span className="text-xs font-normal text-slate-400">/ {summary.totalHeadcount}</span>
          </div>
          <div className="text-[10px] text-amber-600 font-semibold">{summary.onHoldHeadcount} On-Hold</div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 uppercase">
            Gross Compensation
          </div>
          <div className="text-lg font-bold font-mono text-slate-900 dark:text-gray-100">
            {formatPhp(summary.totalGrossPay)}
          </div>
          <div className="text-[10px] text-slate-400">PERA: {formatPhp(summary.totalPeraAllowance)}</div>
        </div>

        <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-950/60 bg-red-50/40 dark:bg-red-950/20 shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-red-700 dark:text-red-400 uppercase">
            Personal Deductions
          </div>
          <div className="text-lg font-bold font-mono text-red-600 dark:text-red-400">
            {formatPhp(summary.totalPersonalDeductions)}
          </div>
          <div className="text-[10px] text-red-600/80">Statutory, Loans &amp; Tax</div>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-950/60 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase">
            Net Take-Home Pay
          </div>
          <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
            {formatPhp(summary.totalNetPay)}
          </div>
          <div className="text-[10px] text-emerald-600/80">Net payroll disbursement</div>
        </div>

        <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-950/60 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-indigo-800 dark:text-indigo-300 uppercase">
            LGU Counterpart
          </div>
          <div className="text-lg font-bold font-mono text-indigo-700 dark:text-indigo-400">
            {formatPhp(summary.totalLguCounterpart)}
          </div>
          <div className="text-[10px] text-indigo-600/80">GSIS (12%), PH (2.5%), HDMF</div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-900 bg-slate-900 text-white shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-indigo-200 uppercase">
            Total LGU Appropriation
          </div>
          <div className="text-lg font-extrabold font-mono text-emerald-400">
            {formatPhp(summary.grandTotalAppropriation)}
          </div>
          <div className="text-[10px] text-slate-300">Public funds required</div>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border-slate-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-gray-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <span>Step 2: Preview, Adjustments &amp; Verification</span>
                {summary.varianceAlerts > 0 && (
                  <Badge variant="outline" className="border-amber-400 text-amber-600 text-xs">
                    {summary.varianceAlerts} Variance Alerts
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Review civil service payroll computations, customize allowances &amp; deductions, or place employees on hold.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {onRecompute && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRecompute}
                  className="text-xs h-9 flex items-center gap-1.5"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  <span>Recompute</span>
                </Button>
              )}
              <Button
                onClick={onProceed}
                disabled={isProcessing || summary.activeHeadcount === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 flex items-center gap-1.5 px-4"
              >
                <span>Proceed to Process &amp; Review</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search name, position, salary grade, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>

            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.department_id} value={String(d.department_id)}>
                    {d.department_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status ({lines.length})</SelectItem>
                <SelectItem value="ACTIVE">Active Only ({summary.activeHeadcount})</SelectItem>
                <SelectItem value="HOLD">On-Hold Only ({summary.onHoldHeadcount})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-gray-800 text-[11px]">
                <TableRow>
                  <TableHead className="w-[85px] text-center">Status</TableHead>
                  <TableHead className="min-w-[200px]">Personnel / Position</TableHead>
                  <TableHead className="min-w-[130px]">Department</TableHead>
                  <TableHead className="text-right">Monthly MBS</TableHead>
                  <TableHead className="text-center">Days / Late</TableHead>
                  <TableHead className="text-right">Cutoff Basic</TableHead>
                  <TableHead className="text-right">PERA</TableHead>
                  <TableHead className="text-right">Overtime / RATA</TableHead>
                  <TableHead className="text-right">Gross Pay</TableHead>
                  <TableHead className="text-right text-red-600">Deductions</TableHead>
                  <TableHead className="text-right font-bold text-emerald-700">Net Pay</TableHead>
                  <TableHead className="text-right font-bold text-indigo-700">LGU Share</TableHead>
                  <TableHead className="text-center">Variance</TableHead>
                  <TableHead className="w-[100px] text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="text-xs">
                {filteredLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="py-10 text-center text-slate-400">
                      No personnel matching your search or filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLines.map((l) => {
                    return (
                      <TableRow
                        key={l.userId}
                        className={`hover:bg-slate-50/70 dark:hover:bg-gray-800/40 border-b dark:border-gray-800 transition-colors ${
                          l.isOnHold ? "opacity-60 bg-amber-50/30 dark:bg-amber-950/10" : ""
                        }`}
                      >
                        {/* Status Switch */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Switch
                              checked={!l.isOnHold}
                              onCheckedChange={() => onToggleHold(l.userId)}
                              title={l.isOnHold ? "Click to set Active" : "Click to place On-Hold"}
                            />
                            <span className="text-[10px] font-bold">
                              {l.isOnHold ? (
                                <span className="text-amber-600">HOLD</span>
                              ) : (
                                <span className="text-emerald-600">ACTIVE</span>
                              )}
                            </span>
                          </div>
                        </TableCell>

                        {/* Personnel Name, Position & SG */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-gray-100 flex items-center gap-1.5">
                                <span>{l.employeeName}</span>
                                {l.salaryGrade && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono font-normal">
                                    {l.salaryGrade}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-gray-400 flex items-center gap-1">
                                <span>{l.position}</span>
                                <span className="text-slate-300">•</span>
                                <span className="font-mono text-[10px]">{l.employeeNo}</span>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Department */}
                        <TableCell className="text-slate-600 dark:text-gray-300">
                          {l.departmentName}
                        </TableCell>

                        {/* Monthly MBS */}
                        <TableCell className="text-right font-mono tabular-nums text-slate-600 dark:text-gray-300">
                          {formatPhp(l.monthlySalary)}
                        </TableCell>

                        {/* Days / Late */}
                        <TableCell className="text-center font-mono tabular-nums">
                          <div>{l.daysWorked} d</div>
                          {l.lateMinutes > 0 && (
                            <div className="text-[10px] text-red-500">+{l.lateMinutes}m</div>
                          )}
                        </TableCell>

                        {/* Cutoff Basic Pay */}
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatPhp(l.basicPay)}
                        </TableCell>

                        {/* PERA */}
                        <TableCell className="text-right font-mono tabular-nums text-blue-700 dark:text-blue-400 font-medium">
                          {formatPhp(l.peraAllowance)}
                        </TableCell>

                        {/* Overtime & RATA */}
                        <TableCell className="text-right font-mono tabular-nums text-slate-600 dark:text-gray-300">
                          {formatPhp(l.overtimePay + l.nightDiffPay + l.rataAllowance + l.hazardPay)}
                        </TableCell>

                        {/* Gross Pay */}
                        <TableCell className="text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-gray-100">
                          {formatPhp(l.totalGrossPay)}
                        </TableCell>

                        {/* Deductions */}
                        <TableCell className="text-right font-mono tabular-nums font-semibold text-red-600 dark:text-red-400">
                          ({formatPhp(l.totalPersonalDeductions)})
                        </TableCell>

                        {/* Net Pay */}
                        <TableCell className="text-right font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                          {formatPhp(l.netPay)}
                        </TableCell>

                        {/* LGU Share */}
                        <TableCell className="text-right font-mono tabular-nums font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/10">
                          {formatPhp(l.totalLguCounterpart)}
                        </TableCell>

                        {/* Variance */}
                        <TableCell className="text-center">
                          {l.variancePct != null ? (
                            <span
                              className={`text-[10px] font-mono font-semibold ${
                                l.varianceFlag
                                  ? "text-red-600 bg-red-50 dark:bg-red-950/30 px-1 py-0.5 rounded"
                                  : "text-slate-500"
                              }`}
                            >
                              {l.variancePct > 0 ? `+${l.variancePct}%` : `${l.variancePct}%`}
                            </span>
                          ) : (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">
                              NEW
                            </Badge>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveUserId(l.userId)}
                              className="h-7 px-2 text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              <span>Details</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadSinglePayslip(l.userId)}
                              className="h-7 w-7 text-slate-500 hover:text-blue-600"
                              title="Download Payslip"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isProcessing}
          className="text-xs h-9 flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Configuration</span>
        </Button>

        <Button
          onClick={onProceed}
          disabled={isProcessing || summary.activeHeadcount === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 flex items-center gap-1.5 px-6"
        >
          <span>Proceed to Process &amp; Top Sheet</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Rich Employee Details Slide-out Sheet */}
      <LguEmployeeDetailsSheet
        open={activeUserId != null}
        line={activeLine}
        cutoff={cutoff}
        payrollRefNo={payrollRefNo}
        onClose={() => setActiveUserId(null)}
        onAddAdjustment={onAddAdjustment}
        onEditAdjustment={onEditAdjustment}
        onDeleteAdjustment={onDeleteAdjustment}
      />
    </div>
  );
}
