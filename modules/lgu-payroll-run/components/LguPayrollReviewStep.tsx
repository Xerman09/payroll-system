// modules/lgu-payroll-run/components/LguPayrollReviewStep.tsx
"use client";

import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  FileSpreadsheet,
  CheckCircle2,
  Printer,
  ArrowLeft,
  Building2,
  Wallet,
  Coins,
  Shield,
  HeartPulse,
  Landmark,
  FileCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { formatPhp } from "../utils/lguCompute";
import type { LguPayrollLine, LguPayrollSummary, CutoffSetting } from "../types";

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

interface LguPayrollReviewStepProps {
  lines: LguPayrollLine[];
  summary: LguPayrollSummary;
  cutoff: CutoffSetting | null;
  payrollRefNo: string;
  onPost: () => Promise<void>;
  onBack: () => void;
  isPosted: boolean;
}

export default function LguPayrollReviewStep({
  lines,
  summary,
  cutoff,
  payrollRefNo,
  onPost,
  onBack,
  isPosted,
}: LguPayrollReviewStepProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [posting, setPosting] = useState(false);

  const handleConfirmPost = async () => {
    setPosting(true);
    try {
      await onPost();
      setConfirmOpen(false);
    } finally {
      setPosting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-slate-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-600 text-white shadow-sm">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-gray-100">
                LGU Payroll Register &amp; Top Sheet (Panghuling Pagsusuri)
              </h2>
              {isPosted ? (
                <Badge className="bg-emerald-600 text-white text-xs">POSTED &amp; LOCKED</Badge>
              ) : (
                <Badge className="bg-blue-600 text-white text-xs">DRAFT REVIEW</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Ref: <span className="font-mono font-semibold">{payrollRefNo}</span> • Panahon:{" "}
              {cutoff ? `${formatDateSafe(cutoff.start_date)} hanggang ${formatDateSafe(cutoff.end_date)}` : "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="text-xs h-9 flex items-center gap-1.5"
          >
            <Printer className="h-4 w-4" />
            <span>I-Print ang Top Sheet</span>
          </Button>

          {!isPosted && (
            <Button
              onClick={() => setConfirmOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 flex items-center gap-1.5 px-5"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>I-Post at I-Finalize ang Payroll</span>
            </Button>
          )}
        </div>
      </div>

      {/* Summary Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-slate-500 dark:text-gray-400">Kabuuang Sweldo (Gross)</div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-gray-100 font-mono">
            {formatPhp(summary.totalGrossPay)}
          </div>
          <div className="text-[11px] text-slate-400">
            Basic: {formatPhp(summary.totalBasicPay)} • PERA: {formatPhp(summary.totalPeraAllowance)}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">Bawas sa Empleyado (Deductions)</div>
          <div className="text-xl font-extrabold text-blue-700 dark:text-blue-300 font-mono">
            {formatPhp(summary.totalPersonalDeductions)}
          </div>
          <div className="text-[11px] text-blue-600/80">
            GSIS 9%: {formatPhp(summary.totalGsisEmployee)} • PH: {formatPhp(summary.totalPhilhealthEmployee)}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Netong Ibinayad (Net Payroll)</div>
          <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">
            {formatPhp(summary.totalNetPay)}
          </div>
          <div className="text-[11px] text-emerald-600/80">
            Net disbursement sa {summary.activeHeadcount} kawani
          </div>
        </div>

        <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Sagot ng LGU (Gov&apos;t Share)</div>
          <div className="text-xl font-extrabold text-indigo-700 dark:text-indigo-300 font-mono">
            {formatPhp(summary.totalLguCounterpart)}
          </div>
          <div className="text-[11px] text-indigo-600/80">
            GSIS 12%: {formatPhp(summary.totalGsisGovernment)} • PH: {formatPhp(summary.totalPhilhealthGovernment)}
          </div>
        </div>
      </div>

      {/* LGU Top Sheet & Disbursement Summary (Voucher Format) */}
      <Card className="border-slate-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
        <CardHeader className="border-b border-slate-100 dark:border-gray-800 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-gray-100">
                LGU Disbursement Voucher &amp; Statutory Top Sheet
              </CardTitle>
              <CardDescription className="text-xs">
                Pang-reconcile at audit ng pampublikong pondo para sa Tanggapan ng Accounting at Ingat-Yaman.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              Obligation Request / DV
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Left: Employee Withholding Breakdown */}
            <div className="rounded-lg border border-slate-200 dark:border-gray-800 p-4 space-y-2 bg-slate-50/50 dark:bg-gray-800/30">
              <div className="font-bold text-slate-900 dark:text-gray-100 border-b border-slate-200 pb-1.5 flex justify-between">
                <span>Personal Deductions (Kaltas sa Sahod)</span>
                <span className="text-blue-700 font-mono">{formatPhp(summary.totalPersonalDeductions)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                <span>GSIS Employee Share (9%):</span>
                <span className="font-mono font-semibold">{formatPhp(summary.totalGsisEmployee)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                <span>PhilHealth Employee Share (2.5%):</span>
                <span className="font-mono font-semibold">{formatPhp(summary.totalPhilhealthEmployee)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                <span>Pag-IBIG Employee Contribution:</span>
                <span className="font-mono font-semibold">{formatPhp(summary.totalPagibigEmployee)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                <span>Government &amp; Benefit Loans:</span>
                <span className="font-mono font-semibold">{formatPhp(summary.totalLoans)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Withholding Tax:</span>
                <span className="font-mono font-semibold">{formatPhp(summary.totalTaxes)}</span>
              </div>
            </div>

            {/* Right: Government LGU Counterpart Breakdown */}
            <div className="rounded-lg border border-indigo-200 dark:border-indigo-900/60 p-4 space-y-2 bg-indigo-50/40 dark:bg-indigo-950/20">
              <div className="font-bold text-indigo-950 dark:text-indigo-200 border-b border-indigo-200 pb-1.5 flex justify-between">
                <span>LGU Counterpart (Sagot ng Pamahalaan)</span>
                <span className="text-indigo-700 font-mono">{formatPhp(summary.totalLguCounterpart)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-indigo-100 dark:border-indigo-900/40">
                <span>GSIS Government Share (12%):</span>
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatPhp(summary.totalGsisGovernment)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-indigo-100 dark:border-indigo-900/40">
                <span>PhilHealth Government Share (2.5%):</span>
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatPhp(summary.totalPhilhealthGovernment)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-indigo-100 dark:border-indigo-900/40">
                <span>Pag-IBIG Government Counterpart:</span>
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatPhp(summary.totalPagibigGovernment)}
                </span>
              </div>
              <div className="pt-2 border-t border-indigo-200 dark:border-indigo-900 flex justify-between font-bold text-indigo-950 dark:text-indigo-100">
                <span>Kabuuang LGU Statutory Remittance:</span>
                <span className="font-mono">
                  {formatPhp(summary.totalPersonalDeductions + summary.totalLguCounterpart)}
                </span>
              </div>
            </div>
          </div>

          {/* Grand Total Public Fund Required */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md">
            <div>
              <div className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">
                Kabuuang Appropriation / Pondo ng Pamahalaan (Total LGU Obligation)
              </div>
              <div className="text-xs text-slate-300">
                Gross Salaries + LGU Counterpart Remittance
              </div>
            </div>
            <div className="text-2xl font-extrabold font-mono text-emerald-400">
              {formatPhp(summary.grandTotalAppropriation)}
            </div>
          </div>

          {/* Departmental Allocation Table */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold text-slate-800 dark:text-gray-200 uppercase tracking-wider">
              Departmental Obligation Breakdown
            </h3>
            <div className="rounded-lg border border-slate-200 dark:border-gray-800 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-gray-800 text-[11px]">
                  <TableRow>
                    <TableHead>Departamento</TableHead>
                    <TableHead className="text-center">Kawani</TableHead>
                    <TableHead className="text-right">Basic Pay</TableHead>
                    <TableHead className="text-right">PERA</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Bawas</TableHead>
                    <TableHead className="text-right font-semibold text-emerald-700">Net Pay</TableHead>
                    <TableHead className="text-right font-semibold text-indigo-700">LGU Share</TableHead>
                    <TableHead className="text-right font-bold">Total Pondo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {summary.departmentSummaries.map((dept) => (
                    <TableRow key={dept.departmentName} className="hover:bg-slate-50/50">
                      <TableCell className="font-semibold text-slate-900 dark:text-gray-100">
                        {dept.departmentName}
                      </TableCell>
                      <TableCell className="text-center font-mono">{dept.headcount}</TableCell>
                      <TableCell className="text-right font-mono">{formatPhp(dept.totalBasicPay)}</TableCell>
                      <TableCell className="text-right font-mono">{formatPhp(dept.totalPera)}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatPhp(dept.totalGrossPay)}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">{formatPhp(dept.totalPersonalDeductions)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-emerald-700">{formatPhp(dept.totalNetPay)}</TableCell>
                      <TableCell className="text-right font-mono font-medium text-indigo-700">{formatPhp(dept.totalLguCounterpart)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-900">{formatPhp(dept.totalAppropriation)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* LGU Signatories Section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-200 dark:border-gray-800 text-xs">
            <div className="space-y-8">
              <div className="text-slate-500">Inihanda ni (Prepared by):</div>
              <div className="border-t border-slate-300 dark:border-gray-700 pt-1">
                <div className="font-bold text-slate-900 dark:text-gray-100">HRMO / Payroll Officer</div>
                <div className="text-[11px] text-slate-500">Human Resource Management Office</div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="text-slate-500">Pinatotohanan (Certified Correct):</div>
              <div className="border-t border-slate-300 dark:border-gray-700 pt-1">
                <div className="font-bold text-slate-900 dark:text-gray-100">Municipal / City Accountant</div>
                <div className="text-[11px] text-slate-500">Accounting Office</div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="text-slate-500">Inaprubahan para sa Pagbabayad (Approved):</div>
              <div className="border-t border-slate-300 dark:border-gray-700 pt-1">
                <div className="font-bold text-slate-900 dark:text-gray-100">Local Chief Executive / Mayor</div>
                <div className="text-[11px] text-slate-500">Office of the Mayor / Governor</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={onBack}
          className="text-xs h-9 flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Bumalik sa Kalkulasyon</span>
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>I-Post at I-Finalize ang LGU Payroll?</AlertDialogTitle>
            <AlertDialogDescription>
              Ang hakbang na ito ay magla-lock sa talaan ng payroll para sa cutoff na ito. Ang mga kaukulang
              statutory logs para sa GSIS, PhilHealth, at Pag-IBIG ay awtomatikong maitatala.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={posting}>Kanselahin</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPost}
              disabled={posting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {posting ? "Nagpo-post..." : "Oo, I-Post ang Payroll"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
