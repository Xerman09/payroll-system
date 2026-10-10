// modules/lgu-payroll-run/components/LguPayrollReviewStep.tsx
"use client";

import React, { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  FileSpreadsheet,
  CheckCircle2,
  Printer,
  ArrowLeft,
  Building2,
  Shield,
  HeartPulse,
  Landmark,
  Download,
  FileText,
  Search,
  Scale,
  Eye,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { downloadLguPayslipsPdf } from "../utils/lguPayslipPdf";
import { exportLguLandbankCsv, downloadLguTopSheetPdf } from "../utils/lguExportUtils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import LguEmployeeDetailsSheet from "./LguEmployeeDetailsSheet";
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
  const [activeTab, setActiveTab] = useState("voucher");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Search in Master Register
  const [regSearch, setRegSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const selectedLine = useMemo(() => {
    if (selectedUserId == null) return null;
    return lines.find((l) => l.userId === selectedUserId) || null;
  }, [lines, selectedUserId]);

  const handleDownloadAllPayslips = async () => {
    setDownloading(true);
    try {
      await downloadLguPayslipsPdf({
        lines,
        cutoff,
        payrollRefNo,
      });
      toast.success("Payslips downloaded successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download payslips.");
    } finally {
      setDownloading(false);
    }
  };

  const handleExportTopSheetPdf = async () => {
    try {
      await downloadLguTopSheetPdf({
        summary,
        cutoff,
        payrollRefNo,
      });
      toast.success("General Payroll Top Sheet downloaded.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download Top Sheet PDF.");
    }
  };

  const handleExportLandbankCsv = () => {
    try {
      exportLguLandbankCsv(lines, payrollRefNo);
      toast.success("Landbank Electronic Payroll (LBP WeAccess CSV) exported.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to export Landbank CSV.");
    }
  };

  const handleConfirmPost = async () => {
    setPosting(true);
    try {
      await onPost();
      setConfirmOpen(false);
    } finally {
      setPosting(false);
    }
  };

  const filteredRegisterLines = useMemo(() => {
    if (!regSearch.trim()) return lines;
    const q = regSearch.trim().toLowerCase();
    return lines.filter((l) => {
      return (
        l.employeeName.toLowerCase().includes(q) ||
        l.position.toLowerCase().includes(q) ||
        l.departmentName.toLowerCase().includes(q) ||
        (l.employeeNo || "").toLowerCase().includes(q) ||
        (l.salaryGrade || "").toLowerCase().includes(q)
      );
    });
  }, [lines, regSearch]);

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
                LGU Payroll Register &amp; Top Sheet (Final Review)
              </h2>
              {isPosted ? (
                <Badge className="bg-emerald-600 text-white text-xs">POSTED &amp; LOCKED</Badge>
              ) : (
                <Badge className="bg-blue-600 text-white text-xs">DRAFT REVIEW</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Ref: <span className="font-mono font-semibold">{payrollRefNo}</span> • Cutoff Period:{" "}
              {cutoff ? `${formatDateSafe(cutoff.start_date)} to ${formatDateSafe(cutoff.end_date)} (${cutoff.cutoff_type} Half)` : "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAllPayslips}
            disabled={downloading || lines.length === 0}
            className="text-xs h-9 flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-900"
          >
            <Download className="h-4 w-4" />
            <span>{downloading ? "Downloading..." : "Download All Payslips"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportTopSheetPdf}
            className="text-xs h-9 flex items-center gap-1.5"
          >
            <FileText className="h-4 w-4 text-purple-600" />
            <span>Export Top Sheet (PDF)</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportLandbankCsv}
            className="text-xs h-9 flex items-center gap-1.5"
          >
            <Building2 className="h-4 w-4 text-emerald-600" />
            <span>Landbank CSV (LBP)</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="text-xs h-9 flex items-center gap-1.5"
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </Button>

          {!isPosted && (
            <Button
              onClick={() => setConfirmOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 flex items-center gap-1.5 px-4"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Post &amp; Finalize Payroll</span>
            </Button>
          )}
        </div>
      </div>

      {/* Summary Highlights Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-slate-500 dark:text-gray-400">Total Gross Compensation</div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-gray-100 font-mono">
            {formatPhp(summary.totalGrossPay)}
          </div>
          <div className="text-[11px] text-slate-400">
            Basic: {formatPhp(summary.totalBasicPay)} • PERA: {formatPhp(summary.totalPeraAllowance)}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-red-200 dark:border-red-950/60 bg-red-50/40 dark:bg-red-950/20 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-red-700 dark:text-red-300">Employee Deductions</div>
          <div className="text-xl font-extrabold text-red-600 dark:text-red-400 font-mono">
            {formatPhp(summary.totalPersonalDeductions)}
          </div>
          <div className="text-[11px] text-red-600/80">
            GSIS (9%): {formatPhp(summary.totalGsisEmployee)} • PH: {formatPhp(summary.totalPhilhealthEmployee)}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-950/60 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Net Take-Home Pay</div>
          <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
            {formatPhp(summary.totalNetPay)}
          </div>
          <div className="text-[11px] text-emerald-600/80">
            Disbursement to {summary.activeHeadcount} personnel
          </div>
        </div>

        <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-950/60 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">LGU Government Share</div>
          <div className="text-xl font-extrabold text-indigo-700 dark:text-indigo-400 font-mono">
            {formatPhp(summary.totalLguCounterpart)}
          </div>
          <div className="text-[11px] text-indigo-600/80">
            GSIS (12%): {formatPhp(summary.totalGsisGovernment)} • PH: {formatPhp(summary.totalPhilhealthGovernment)}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-900 bg-slate-900 text-white shadow-sm space-y-1">
          <div className="text-xs font-semibold text-indigo-200">Total LGU Appropriation</div>
          <div className="text-xl font-extrabold font-mono text-emerald-400">
            {formatPhp(summary.grandTotalAppropriation)}
          </div>
          <div className="text-[11px] text-slate-300">Public funds required (Gross + LGU Share)</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full h-auto p-1 bg-slate-100 dark:bg-gray-800">
          <TabsTrigger value="voucher" className="text-xs py-2">
            1. Disbursement Voucher &amp; Top Sheet
          </TabsTrigger>
          <TabsTrigger value="departments" className="text-xs py-2">
            2. Departmental Breakdown ({summary.departmentSummaries.length})
          </TabsTrigger>
          <TabsTrigger value="statutory" className="text-xs py-2">
            3. Statutory Remittance Schedule
          </TabsTrigger>
          <TabsTrigger value="register" className="text-xs py-2">
            4. Complete Master Roll ({lines.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Disbursement Voucher & Top Sheet */}
        <TabsContent value="voucher" className="pt-4 space-y-5">
          <Card className="border-slate-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
            <CardHeader className="border-b border-slate-100 dark:border-gray-800 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-gray-100">
                    LGU Disbursement Voucher &amp; Statutory Top Sheet
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Obligation Request (ObR) and Disbursement Voucher format for COA and Municipal Accounting.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  Obligation Request / DV Format
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                {/* Left: Employee Deductions */}
                <div className="rounded-lg border border-slate-200 dark:border-gray-800 p-4 space-y-2 bg-slate-50/50 dark:bg-gray-800/30">
                  <div className="font-bold text-slate-900 dark:text-gray-100 border-b border-slate-200 pb-1.5 flex justify-between">
                    <span>Employee Personal Deductions (Kaltas sa Sahod)</span>
                    <span className="text-blue-700 font-mono">{formatPhp(summary.totalPersonalDeductions)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                    <span>GSIS Personal Share (9%):</span>
                    <span className="font-mono font-semibold">{formatPhp(summary.totalGsisEmployee)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                    <span>PhilHealth Personal Share (2.5%):</span>
                    <span className="font-mono font-semibold">{formatPhp(summary.totalPhilhealthEmployee)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                    <span>Pag-IBIG Personal Contribution:</span>
                    <span className="font-mono font-semibold">{formatPhp(summary.totalPagibigEmployee)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                    <span>Government &amp; Benefit Loans:</span>
                    <span className="font-mono font-semibold">{formatPhp(summary.totalLoans)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-gray-800">
                    <span>BIR Withholding Tax on Compensation:</span>
                    <span className="font-mono font-semibold">{formatPhp(summary.totalTaxes)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Other Institutional / Tardiness Deductions:</span>
                    <span className="font-mono font-semibold">
                      {formatPhp(summary.totalTardinessDeductions + summary.totalOtherDeductions)}
                    </span>
                  </div>
                </div>

                {/* Right: Government Counterparts */}
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
                    <span>Total LGU Statutory Remittance:</span>
                    <span className="font-mono">
                      {formatPhp(summary.totalPersonalDeductions + summary.totalLguCounterpart)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grand Total Appropriation Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md">
                <div>
                  <div className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">
                    Total Public Fund Appropriation (Total LGU Obligation)
                  </div>
                  <div className="text-xs text-slate-300">
                    Gross Compensation ({formatPhp(summary.totalGrossPay)}) + LGU Statutory Share ({formatPhp(summary.totalLguCounterpart)})
                  </div>
                </div>
                <div className="text-2xl font-extrabold font-mono text-emerald-400">
                  {formatPhp(summary.grandTotalAppropriation)}
                </div>
              </div>

              {/* Signatures Certification Block (COA Format) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200 text-xs">
                <div className="p-3 border border-slate-200 rounded-lg space-y-4">
                  <div>
                    <div className="font-bold text-slate-800 uppercase text-[10px]">Box A: Certified Accounting</div>
                    <div className="text-slate-500 text-[11px]">Supporting documents complete, legal, and proper.</div>
                  </div>
                  <div className="pt-6 border-t border-slate-200 text-center font-bold text-slate-700">
                    CITY / MUNICIPAL ACCOUNTANT
                  </div>
                </div>

                <div className="p-3 border border-slate-200 rounded-lg space-y-4">
                  <div>
                    <div className="font-bold text-slate-800 uppercase text-[10px]">Box B: Certified Treasury</div>
                    <div className="text-slate-500 text-[11px]">Cash available in General Fund account.</div>
                  </div>
                  <div className="pt-6 border-t border-slate-200 text-center font-bold text-slate-700">
                    CITY / MUNICIPAL TREASURER
                  </div>
                </div>

                <div className="p-3 border border-slate-200 rounded-lg space-y-4">
                  <div>
                    <div className="font-bold text-slate-800 uppercase text-[10px]">Box C: Approved Payment</div>
                    <div className="text-slate-500 text-[11px]">Authorized disbursement pursuant to RA 7160.</div>
                  </div>
                  <div className="pt-6 border-t border-slate-200 text-center font-bold text-slate-700">
                    LOCAL CHIEF EXECUTIVE / MAYOR
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Departmental Breakdown */}
        <TabsContent value="departments" className="pt-4 space-y-4">
          <Card className="border-slate-200 dark:border-gray-800">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-gray-800">
              <CardTitle className="text-base font-bold">Departmental Obligation Breakdown</CardTitle>
              <CardDescription className="text-xs">
                Distribution of Personnel Services (PS) appropriation by department and office.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-gray-800 text-[11px]">
                  <TableRow>
                    <TableHead>Department / Office</TableHead>
                    <TableHead className="text-center">Headcount</TableHead>
                    <TableHead className="text-right">Basic Pay</TableHead>
                    <TableHead className="text-right">PERA</TableHead>
                    <TableHead className="text-right">Overtime / RATA</TableHead>
                    <TableHead className="text-right">Gross Pay</TableHead>
                    <TableHead className="text-right text-red-600">Deductions</TableHead>
                    <TableHead className="text-right font-semibold text-emerald-700">Net Pay</TableHead>
                    <TableHead className="text-right font-semibold text-indigo-700">LGU Share</TableHead>
                    <TableHead className="text-right font-bold text-slate-900">Total Obligation</TableHead>
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
                      <TableCell className="text-right font-mono text-blue-700">{formatPhp(dept.totalPera)}</TableCell>
                      <TableCell className="text-right font-mono">{formatPhp(dept.totalOvertime + dept.totalRata)}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatPhp(dept.totalGrossPay)}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">({formatPhp(dept.totalPersonalDeductions)})</TableCell>
                      <TableCell className="text-right font-mono font-bold text-emerald-700">{formatPhp(dept.totalNetPay)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-indigo-700">{formatPhp(dept.totalLguCounterpart)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-900">{formatPhp(dept.totalAppropriation)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Statutory Agency Remittance Schedule */}
        <TabsContent value="statutory" className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* GSIS Card */}
            <Card className="border-slate-200 dark:border-gray-800">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <span>Government Service Insurance System (GSIS)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  RA 8291 mandatory social insurance and loan remittances.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b">
                  <span>GSIS Personal Share (9%):</span>
                  <span className="font-mono font-semibold">{formatPhp(summary.totalGsisEmployee)}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span>GSIS Government Share (12%):</span>
                  <span className="font-mono font-semibold text-emerald-700">{formatPhp(summary.totalGsisGovernment)}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span>GSIS Loan Amortizations:</span>
                  <span className="font-mono font-semibold">{formatPhp(summary.totalLoans * 0.7)}</span>
                </div>
                <div className="flex justify-between py-1.5 pt-2 border-t font-bold text-slate-900">
                  <span>Total Check to GSIS:</span>
                  <span className="font-mono text-sm text-blue-700">
                    {formatPhp(summary.totalGsisEmployee + summary.totalGsisGovernment + (summary.totalLoans * 0.7))}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* PhilHealth Card */}
            <Card className="border-slate-200 dark:border-gray-800">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-emerald-600" />
                  <span>Philippine Health Insurance Corporation (PhilHealth)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Universal Health Care Act (RA 11223) 5% premium sharing.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b">
                  <span>PhilHealth Personal Share (2.5%):</span>
                  <span className="font-mono font-semibold">{formatPhp(summary.totalPhilhealthEmployee)}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span>PhilHealth Government Share (2.5%):</span>
                  <span className="font-mono font-semibold text-emerald-700">{formatPhp(summary.totalPhilhealthGovernment)}</span>
                </div>
                <div className="flex justify-between py-1.5 pt-2 border-t font-bold text-slate-900">
                  <span>Total Check to PhilHealth:</span>
                  <span className="font-mono text-sm text-emerald-700">
                    {formatPhp(summary.totalPhilhealthEmployee + summary.totalPhilhealthGovernment)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Pag-IBIG Card */}
            <Card className="border-slate-200 dark:border-gray-800">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-amber-600" />
                  <span>Home Development Mutual Fund (Pag-IBIG)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  RA 9679 mandatory housing savings and multi-purpose loans.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b">
                  <span>Pag-IBIG Personal Contribution:</span>
                  <span className="font-mono font-semibold">{formatPhp(summary.totalPagibigEmployee)}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span>Pag-IBIG Government Counterpart:</span>
                  <span className="font-mono font-semibold text-emerald-700">{formatPhp(summary.totalPagibigGovernment)}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span>Pag-IBIG MPL &amp; Calamity Loans:</span>
                  <span className="font-mono font-semibold">{formatPhp(summary.totalLoans * 0.3)}</span>
                </div>
                <div className="flex justify-between py-1.5 pt-2 border-t font-bold text-slate-900">
                  <span>Total Check to Pag-IBIG:</span>
                  <span className="font-mono text-sm text-amber-700">
                    {formatPhp(summary.totalPagibigEmployee + summary.totalPagibigGovernment + (summary.totalLoans * 0.3))}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* BIR Card */}
            <Card className="border-slate-200 dark:border-gray-800">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Scale className="h-4 w-4 text-purple-600" />
                  <span>Bureau of Internal Revenue (BIR Form 1601-C)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Monthly withholding tax remittance on compensation.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b">
                  <span>Withholding Tax on Compensation:</span>
                  <span className="font-mono font-semibold">{formatPhp(summary.totalTaxes)}</span>
                </div>
                <div className="flex justify-between py-1.5 pt-2 border-t font-bold text-slate-900">
                  <span>Total Remittance to BIR:</span>
                  <span className="font-mono text-sm text-purple-700">
                    {formatPhp(summary.totalTaxes)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 4: Complete Master Roll */}
        <TabsContent value="register" className="pt-4 space-y-4">
          <Card className="border-slate-200 dark:border-gray-800">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">Complete General Payroll Register</CardTitle>
                <CardDescription className="text-xs">
                  Individual register roll of all personnel for audit and verification.
                </CardDescription>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search employee, ID, SG..."
                  value={regSearch}
                  onChange={(e) => setRegSearch(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-gray-800 text-[11px]">
                  <TableRow>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Personnel</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Basic Pay</TableHead>
                    <TableHead className="text-right">PERA</TableHead>
                    <TableHead className="text-right">Gross Pay</TableHead>
                    <TableHead className="text-right text-red-600">Deductions</TableHead>
                    <TableHead className="text-right font-bold text-emerald-700">Net Pay</TableHead>
                    <TableHead className="text-right font-bold text-indigo-700">LGU Share</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {filteredRegisterLines.map((l) => (
                    <TableRow key={l.userId} className={l.isOnHold ? "opacity-60 bg-amber-50/20" : ""}>
                      <TableCell className="text-center">
                        {l.isOnHold ? (
                          <Badge className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0 font-bold">HOLD</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0 font-bold">ACTIVE</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">{l.employeeName}</div>
                        <div className="text-[10px] text-slate-400">{l.position} • {l.salaryGrade}</div>
                      </TableCell>
                      <TableCell className="text-slate-600">{l.departmentName}</TableCell>
                      <TableCell className="text-right font-mono">{formatPhp(l.basicPay)}</TableCell>
                      <TableCell className="text-right font-mono text-blue-700">{formatPhp(l.peraAllowance)}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatPhp(l.totalGrossPay)}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">({formatPhp(l.totalPersonalDeductions)})</TableCell>
                      <TableCell className={`text-right font-mono font-bold ${
                        l.netPay < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"
                      }`}>{formatPhp(l.netPay)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-indigo-700">{formatPhp(l.totalLguCounterpart)}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedUserId(l.userId)}
                          className="h-7 px-2 text-[11px] text-blue-600 hover:text-blue-700"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          <span>Details</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={onBack}
          className="text-xs h-9 flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Adjustments</span>
        </Button>

        {!isPosted && (
          <Button
            onClick={() => setConfirmOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 flex items-center gap-1.5 px-6"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Post &amp; Finalize Payroll Run</span>
          </Button>
        )}
      </div>

      {/* Post Confirmation Alert Dialog (Strictly no browser dialogs!) */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-600" />
              <span>Post and Finalize LGU Payroll?</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <p>
                Posting will lock all {summary.activeHeadcount} payroll records, generate official COA/DBM disbursement records, and prevent further modifications for cutoff ref <span className="font-mono font-semibold">{payrollRefNo}</span>.
              </p>
              <p className="font-semibold text-slate-800 dark:text-gray-200">
                Total Net Disbursement: {formatPhp(summary.totalNetPay)}
                <br />
                Total Public Appropriation: {formatPhp(summary.grandTotalAppropriation)}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPost}
              disabled={posting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              {posting ? "Posting..." : "Confirm & Post Payroll"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Slide-out Employee Details Sheet from Master Register */}
      <LguEmployeeDetailsSheet
        open={selectedUserId != null}
        line={selectedLine}
        cutoff={cutoff}
        payrollRefNo={payrollRefNo}
        isPosted={isPosted}
        onClose={() => setSelectedUserId(null)}
      />
    </div>
  );
}
