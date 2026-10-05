// modules/benefit-settings/components/EmployeeBenefitsTab.tsx
"use client";

import * as React from "react";
import {
  Users,
  Search,
  Filter,
  Download,
  FileText,
  Shield,
  HeartPulse,
  Landmark,
  Coins,
  RefreshCcw,
  X,
  Eye,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Building2,
  Calendar,
  Wallet,
} from "lucide-react";
import { formatMoney } from "../providers/benefitApi";
import type {
  EmployeeBenefitCoverage,
  BenefitReportFilter,
  CoverageStatusFilter,
  Department,
  BenefitSetting,
  BenefitCode,
} from "../types";
import { exportEmployeeBenefitsPdf } from "../utils/employeeBenefitsPdf";
import { PdfPreviewModal } from "@/components/PdfPreviewModal";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface EmployeeBenefitsTabProps {
  coverages: EmployeeBenefitCoverage[];
  departments: Department[];
  settings?: Record<BenefitCode, BenefitSetting>;
  isGovernment?: boolean;
  companyName?: string;
  loading?: boolean;
  onRefresh?: () => void;
  defaultBenefitFilter?: BenefitReportFilter;
}

export default function EmployeeBenefitsTab({
  coverages,
  departments,
  settings,
  isGovernment = false,
  companyName = "MEN2 MARKETING CORPORATION",
  loading = false,
  onRefresh,
  defaultBenefitFilter = "ALL",
}: EmployeeBenefitsTabProps) {
  const [search, setSearch] = React.useState("");
  const [benefitFilter, setBenefitFilter] = React.useState<BenefitReportFilter>(defaultBenefitFilter);
  const [statusFilter, setStatusFilter] = React.useState<CoverageStatusFilter>("ALL");
  const [deptFilter, setDeptFilter] = React.useState<string>("ALL");

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);

  const [selectedEmp, setSelectedEmp] = React.useState<EmployeeBenefitCoverage | null>(null);

  // PDF Preview state
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [pdfBlob, setPdfBlob] = React.useState<Blob | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  // Sync default filter if updated from parent
  React.useEffect(() => {
    if (defaultBenefitFilter) {
      setBenefitFilter(defaultBenefitFilter);
    }
  }, [defaultBenefitFilter]);

  const sssLabel = isGovernment ? "GSIS" : "SSS";

  // Distinct department names
  const departmentOptions = React.useMemo(() => {
    const list = departments.map((d) => d.department_name).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [departments]);

  // Overall KPI statistics
  const stats = React.useMemo(() => {
    const total = coverages.length;
    let sssCount = 0;
    let sssPersonal = 0;
    let sssCounterpart = 0;

    let phCount = 0;
    let phPersonal = 0;
    let phCounterpart = 0;

    let pagibigCount = 0;
    let pagibigPersonal = 0;
    let pagibigCounterpart = 0;

    let activeLoansCount = 0;
    let totalLoanAmort = 0;

    let grandPersonal = 0;
    let grandCounterpart = 0;
    let fullyCovered = 0;

    for (const c of coverages) {
      if (c.sss.personal_share > 0) {
        sssCount++;
        sssPersonal += c.sss.personal_share;
        sssCounterpart += c.sss.counterpart_share;
      }
      if (c.philhealth.personal_share > 0) {
        phCount++;
        phPersonal += c.philhealth.personal_share;
        phCounterpart += c.philhealth.counterpart_share;
      }
      if (c.pagibig.personal_share > 0) {
        pagibigCount++;
        pagibigPersonal += c.pagibig.personal_share;
        pagibigCounterpart += c.pagibig.counterpart_share;
      }

      if (c.loans.length > 0) {
        activeLoansCount += c.loans.length;
        totalLoanAmort += c.total_loan_amortization;
      }

      grandPersonal += c.total_personal_share;
      grandCounterpart += c.total_counterpart_share;

      if (c.has_all_benefits) {
        fullyCovered++;
      }
    }

    return {
      total,
      fullyCovered,
      sssCount,
      sssPersonal,
      sssCounterpart,
      sssTotal: sssPersonal + sssCounterpart,

      phCount,
      phPersonal,
      phCounterpart,
      phTotal: phPersonal + phCounterpart,

      pagibigCount,
      pagibigPersonal,
      pagibigCounterpart,
      pagibigTotal: pagibigPersonal + pagibigCounterpart,

      activeLoansCount,
      totalLoanAmort,

      grandPersonal,
      grandCounterpart,
      grandTotalRemittance: grandPersonal + grandCounterpart,
    };
  }, [coverages]);

  // Filtered rows
  const filtered = React.useMemo(() => {
    return coverages.filter((c) => {
      // 1. Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = c.employee_name.toLowerCase().includes(q);
        const matchId = String(c.user_id).includes(q);
        const matchDept = (c.department_name || "").toLowerCase().includes(q);
        const matchSss = (c.sss.account_no || "").toLowerCase().includes(q);
        const matchPh = (c.philhealth.account_no || "").toLowerCase().includes(q);
        const matchPagibig = (c.pagibig.account_no || "").toLowerCase().includes(q);

        if (!matchName && !matchId && !matchDept && !matchSss && !matchPh && !matchPagibig) {
          return false;
        }
      }

      // 2. Department filter
      if (deptFilter !== "ALL" && c.department_name !== deptFilter) {
        return false;
      }

      // 3. Benefit filter
      if (benefitFilter === "SSS" && !c.has_sss) return false;
      if (benefitFilter === "PHILHEALTH" && !c.has_philhealth) return false;
      if (benefitFilter === "PAGIBIG" && !c.has_pagibig) return false;
      if (benefitFilter === "LOANS" && !c.has_loans) return false;

      // 4. Coverage status filter
      if (statusFilter === "WITH_BENEFIT") {
        if (benefitFilter === "SSS" && c.sss.personal_share <= 0) return false;
        if (benefitFilter === "PHILHEALTH" && c.philhealth.personal_share <= 0) return false;
        if (benefitFilter === "PAGIBIG" && c.pagibig.personal_share <= 0) return false;
        if (benefitFilter === "ALL" && c.total_personal_share <= 0) return false;
      }

      if (statusFilter === "WITHOUT_BENEFIT") {
        if (benefitFilter === "SSS" && c.sss.personal_share > 0) return false;
        if (benefitFilter === "PHILHEALTH" && c.philhealth.personal_share > 0) return false;
        if (benefitFilter === "PAGIBIG" && c.pagibig.personal_share > 0) return false;
        if (benefitFilter === "ALL" && c.total_personal_share > 0) return false;
      }

      if (statusFilter === "WITH_LOAN" && !c.has_loans) {
        return false;
      }

      return true;
    });
  }, [coverages, search, deptFilter, benefitFilter, statusFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Export to CSV
  const handleExportCsv = () => {
    const headers = [
      "Employee ID",
      "Employee Name",
      "Department",
      "Position",
      "Monthly Rate",
      `${sssLabel} Account No`,
      `${sssLabel} EE (Deduction)`,
      `${sssLabel} ER (${isGovernment ? "LGU" : "Employer"})`,
      "PhilHealth Account No",
      "PhilHealth EE",
      `PhilHealth ER (${isGovernment ? "LGU" : "Employer"})`,
      "Pag-IBIG MID No",
      "Pag-IBIG EE",
      `Pag-IBIG ER (${isGovernment ? "LGU" : "Employer"})`,
      "Active Loans Count",
      "Monthly Loan Amortization",
      "Total Employee Deduction",
      `Total Counterpart (${isGovernment ? "LGU" : "Employer"})`,
      "Grand Total Monthly Remittance",
      "Coverage Summary",
    ];

    const rows = filtered.map((c) => [
      c.user_id,
      `"${c.employee_name}"`,
      `"${c.department_name}"`,
      `"${c.position || ""}"`,
      c.monthly_rate.toFixed(2),
      `"${c.sss.account_no || ""}"`,
      c.sss.personal_share.toFixed(2),
      c.sss.counterpart_share.toFixed(2),
      `"${c.philhealth.account_no || ""}"`,
      c.philhealth.personal_share.toFixed(2),
      c.philhealth.counterpart_share.toFixed(2),
      `"${c.pagibig.account_no || ""}"`,
      c.pagibig.personal_share.toFixed(2),
      c.pagibig.counterpart_share.toFixed(2),
      c.loans.length,
      c.total_loan_amortization.toFixed(2),
      c.total_personal_share.toFixed(2),
      c.total_counterpart_share.toFixed(2),
      c.grand_total_monthly.toFixed(2),
      c.coverage_summary,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Employee_Benefits_Coverage_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF
  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      const blob = await exportEmployeeBenefitsPdf({
        companyName,
        isGovernment,
        filterBenefit: benefitFilter,
        filterStatus: statusFilter,
        departmentLabel: deptFilter === "ALL" ? "All Departments" : deptFilter,
        searchQuery: search,
        coverages: filtered,
      });

      setPdfBlob(blob);
      setPreviewOpen(true);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Headcount & Coverage */}
        <Card className="p-3.5 bg-gradient-to-br from-slate-50 to-white dark:from-gray-900 dark:to-gray-800 border-slate-200 dark:border-gray-800 shadow-2xs">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-semibold text-slate-600 dark:text-gray-300">
              Total Employees
            </span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-gray-100">
            {stats.total}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
            <strong>{stats.fullyCovered}</strong> full statutory coverage ({stats.total > 0 ? Math.round((stats.fullyCovered / stats.total) * 100) : 0}%)
          </div>
        </Card>

        {/* SSS / GSIS */}
        <Card
          onClick={() => {
            setBenefitFilter(benefitFilter === "SSS" ? "ALL" : "SSS");
            setCurrentPage(1);
          }}
          className={`p-3.5 cursor-pointer transition-all border shadow-2xs ${
            benefitFilter === "SSS"
              ? "ring-2 ring-blue-500 bg-blue-50/60 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800"
              : "bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 hover:border-blue-300"
          }`}
        >
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-blue-600" />
              {sssLabel}
            </span>
            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
              {stats.sssCount} Enrolled
            </Badge>
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-gray-100">
            ₱{formatMoney(stats.sssPersonal)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5 flex justify-between">
            <span>{isGovernment ? "LGU" : "ER"}: ₱{formatMoney(stats.sssCounterpart)}</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">Total: ₱{formatMoney(stats.sssTotal)}</span>
          </div>
        </Card>

        {/* PhilHealth */}
        <Card
          onClick={() => {
            setBenefitFilter(benefitFilter === "PHILHEALTH" ? "ALL" : "PHILHEALTH");
            setCurrentPage(1);
          }}
          className={`p-3.5 cursor-pointer transition-all border shadow-2xs ${
            benefitFilter === "PHILHEALTH"
              ? "ring-2 ring-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
              : "bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <HeartPulse className="h-3.5 w-3.5 text-emerald-600" />
              PhilHealth
            </span>
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              {stats.phCount} Enrolled
            </Badge>
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-gray-100">
            ₱{formatMoney(stats.phPersonal)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5 flex justify-between">
            <span>{isGovernment ? "LGU" : "ER"}: ₱{formatMoney(stats.phCounterpart)}</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Total: ₱{formatMoney(stats.phTotal)}</span>
          </div>
        </Card>

        {/* Pag-IBIG */}
        <Card
          onClick={() => {
            setBenefitFilter(benefitFilter === "PAGIBIG" ? "ALL" : "PAGIBIG");
            setCurrentPage(1);
          }}
          className={`p-3.5 cursor-pointer transition-all border shadow-2xs ${
            benefitFilter === "PAGIBIG"
              ? "ring-2 ring-amber-500 bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800"
              : "bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5 text-amber-600" />
              Pag-IBIG
            </span>
            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
              {stats.pagibigCount} Enrolled
            </Badge>
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-gray-100">
            ₱{formatMoney(stats.pagibigPersonal)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5 flex justify-between">
            <span>{isGovernment ? "LGU" : "ER"}: ₱{formatMoney(stats.pagibigCounterpart)}</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">Total: ₱{formatMoney(stats.pagibigTotal)}</span>
          </div>
        </Card>

        {/* Monthly Remittance Total */}
        <Card className="p-3.5 bg-gradient-to-br from-indigo-50/70 via-blue-50/40 to-white dark:from-indigo-950/40 dark:via-blue-950/20 dark:to-gray-900 border-indigo-200 dark:border-indigo-900/60 shadow-2xs">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-indigo-600" />
              Total Remittance
            </span>
            <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
              Per Month
            </span>
          </div>
          <div className="text-base font-bold text-indigo-900 dark:text-indigo-200">
            ₱{formatMoney(stats.grandTotalRemittance)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5 flex justify-between">
            <span>EE: ₱{formatMoney(stats.grandPersonal)}</span>
            <span>{isGovernment ? "LGU" : "ER"}: ₱{formatMoney(stats.grandCounterpart)}</span>
          </div>
        </Card>
      </div>

      {/* 2. Filters & Toolbar */}
      <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Left: Search & Selectors */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Search */}
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search employee, ID, SSS/PH/PagIBIG no..."
                className="pl-8 h-9 text-xs bg-slate-50 dark:bg-gray-800"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Benefit Selector Buttons */}
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-gray-800 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setBenefitFilter("ALL");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  benefitFilter === "ALL"
                    ? "bg-white dark:bg-gray-700 text-slate-900 dark:text-gray-100 shadow-2xs"
                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900"
                }`}
              >
                All Benefits
              </button>
              <button
                type="button"
                onClick={() => {
                  setBenefitFilter("SSS");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  benefitFilter === "SSS"
                    ? "bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-2xs"
                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900"
                }`}
              >
                {sssLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBenefitFilter("PHILHEALTH");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  benefitFilter === "PHILHEALTH"
                    ? "bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900"
                }`}
              >
                PhilHealth
              </button>
              <button
                type="button"
                onClick={() => {
                  setBenefitFilter("PAGIBIG");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  benefitFilter === "PAGIBIG"
                    ? "bg-white dark:bg-gray-700 text-amber-700 dark:text-amber-300 shadow-2xs"
                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900"
                }`}
              >
                Pag-IBIG
              </button>
              <button
                type="button"
                onClick={() => {
                  setBenefitFilter("LOANS");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  benefitFilter === "LOANS"
                    ? "bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-2xs"
                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900"
                }`}
              >
                Loans ({stats.activeLoansCount})
              </button>
            </div>

            {/* Coverage Status Dropdown */}
            <Select
              value={statusFilter}
              onValueChange={(val: CoverageStatusFilter) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[180px] h-9 text-xs bg-slate-50 dark:bg-gray-800">
                <SelectValue placeholder="Coverage Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Coverage Status</SelectItem>
                <SelectItem value="WITH_BENEFIT">With Amount (&gt; ₱0.00)</SelectItem>
                <SelectItem value="WITHOUT_BENEFIT">Without Amount (₱0.00)</SelectItem>
                <SelectItem value="WITH_LOAN">With Active Loans</SelectItem>
              </SelectContent>
            </Select>

            {/* Department Dropdown */}
            <Select
              value={deptFilter}
              onValueChange={(val) => {
                setDeptFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[160px] h-9 text-xs bg-slate-50 dark:bg-gray-800">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Departments</SelectItem>
                {departmentOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5 dark:border-gray-700"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs gap-1.5 dark:border-gray-700"
              onClick={handleExportCsv}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>

            <Button
              variant="default"
              size="sm"
              className="h-9 text-xs gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white"
              onClick={handleExportPdf}
              disabled={isExporting}
            >
              <FileText className="h-3.5 w-3.5" />
              {isExporting ? "Generating..." : "Print / PDF"}
            </Button>
          </div>
        </div>

        {/* Active Filters Summary Bar */}
        {(search || deptFilter !== "ALL" || benefitFilter !== "ALL" || statusFilter !== "ALL") && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
            <span>Filtered by:</span>
            {benefitFilter !== "ALL" && (
              <Badge variant="secondary" className="gap-1 text-[11px]">
                Benefit: {benefitFilter === "SSS" ? sssLabel : benefitFilter}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setBenefitFilter("ALL")} />
              </Badge>
            )}
            {statusFilter !== "ALL" && (
              <Badge variant="secondary" className="gap-1 text-[11px]">
                Status: {statusFilter === "WITH_BENEFIT" ? "With Amount" : statusFilter === "WITHOUT_BENEFIT" ? "Without Amount" : "With Loans"}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setStatusFilter("ALL")} />
              </Badge>
            )}
            {deptFilter !== "ALL" && (
              <Badge variant="secondary" className="gap-1 text-[11px]">
                Dept: {deptFilter}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setDeptFilter("ALL")} />
              </Badge>
            )}
            {search && (
              <Badge variant="secondary" className="gap-1 text-[11px]">
                &quot;{search}&quot;
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSearch("")} />
              </Badge>
            )}
            <button
              onClick={() => {
                setSearch("");
                setBenefitFilter("ALL");
                setStatusFilter("ALL");
                setDeptFilter("ALL");
                setCurrentPage(1);
              }}
              className="text-xs text-blue-600 hover:underline ml-2"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* 3. Table Container */}
      <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-gray-800/80">
              <TableRow>
                <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 min-w-[200px]">
                  Employee
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 min-w-[130px]">
                  Department
                </TableHead>

                {/* SSS / GSIS */}
                <TableHead className="text-xs font-bold text-blue-900 dark:text-blue-300 min-w-[140px] text-right">
                  {sssLabel} (EE / {isGovernment ? "LGU" : "ER"})
                </TableHead>

                {/* PhilHealth */}
                <TableHead className="text-xs font-bold text-emerald-900 dark:text-emerald-300 min-w-[140px] text-right">
                  PhilHealth (EE / {isGovernment ? "LGU" : "ER"})
                </TableHead>

                {/* Pag-IBIG */}
                <TableHead className="text-xs font-bold text-amber-900 dark:text-amber-300 min-w-[140px] text-right">
                  Pag-IBIG (EE / {isGovernment ? "LGU" : "ER"})
                </TableHead>

                {/* Benefit Loans */}
                <TableHead className="text-xs font-bold text-purple-900 dark:text-purple-300 min-w-[120px]">
                  Active Loans
                </TableHead>

                {/* Total Monthly */}
                <TableHead className="text-xs font-bold text-slate-900 dark:text-gray-100 min-w-[140px] text-right">
                  Total Monthly
                </TableHead>

                {/* Coverage Status */}
                <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 text-center min-w-[100px]">
                  Coverage
                </TableHead>

                {/* Action */}
                <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 text-center w-[70px]">
                  Details
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-44 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCcw className="h-6 w-6 animate-spin text-blue-600" />
                      <span className="text-sm font-medium">Loading employee benefits data...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-44 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Users className="h-9 w-9 text-slate-300 dark:text-gray-600" />
                      <span className="text-sm font-medium">No employees found.</span>
                      <span className="text-xs text-slate-400">
                        Try changing your search or filter options.
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((emp) => (
                  <TableRow
                    key={emp.user_id}
                    className="hover:bg-slate-50/60 dark:hover:bg-gray-800/40 text-xs transition-colors"
                  >
                    {/* Employee Name & ID */}
                    <TableCell className="py-2.5">
                      <div className="font-semibold text-slate-900 dark:text-gray-100">
                        {emp.employee_name}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span>ID #{emp.user_id}</span>
                        {emp.position && <span>• {emp.position}</span>}
                      </div>
                    </TableCell>

                    {/* Department */}
                    <TableCell className="py-2.5 text-slate-600 dark:text-gray-300">
                      {emp.department_name}
                    </TableCell>

                    {/* SSS / GSIS */}
                    <TableCell className="py-2.5 text-right">
                      {emp.sss.personal_share > 0 ? (
                        <div>
                          <div className="font-semibold text-blue-700 dark:text-blue-400">
                            ₱{formatMoney(emp.sss.personal_share)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {isGovernment ? "LGU" : "ER"}: ₱{formatMoney(emp.sss.counterpart_share)}
                          </div>
                        </div>
                      ) : emp.sss.account_no ? (
                        <div>
                          <span className="text-slate-400 text-[11px]">₱0.00</span>
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[110px]">
                            {emp.sss.account_no}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-gray-600">—</span>
                      )}
                    </TableCell>

                    {/* PhilHealth */}
                    <TableCell className="py-2.5 text-right">
                      {emp.philhealth.personal_share > 0 ? (
                        <div>
                          <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                            ₱{formatMoney(emp.philhealth.personal_share)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {isGovernment ? "LGU" : "ER"}: ₱{formatMoney(emp.philhealth.counterpart_share)}
                          </div>
                        </div>
                      ) : emp.philhealth.account_no ? (
                        <div>
                          <span className="text-slate-400 text-[11px]">₱0.00</span>
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[110px]">
                            {emp.philhealth.account_no}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-gray-600">—</span>
                      )}
                    </TableCell>

                    {/* Pag-IBIG */}
                    <TableCell className="py-2.5 text-right">
                      {emp.pagibig.personal_share > 0 ? (
                        <div>
                          <div className="font-semibold text-amber-700 dark:text-amber-400">
                            ₱{formatMoney(emp.pagibig.personal_share)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {isGovernment ? "LGU" : "ER"}: ₱{formatMoney(emp.pagibig.counterpart_share)}
                          </div>
                        </div>
                      ) : emp.pagibig.account_no ? (
                        <div>
                          <span className="text-slate-400 text-[11px]">₱0.00</span>
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[110px]">
                            {emp.pagibig.account_no}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-gray-600">—</span>
                      )}
                    </TableCell>

                    {/* Active Loans */}
                    <TableCell className="py-2.5">
                      {emp.loans.length > 0 ? (
                        <div>
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300"
                          >
                            ₱{formatMoney(emp.total_loan_amortization)}/mo ({emp.loans.length})
                          </Badge>
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {emp.loans.map((l) => l.benefit_code).join(", ")}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-gray-600">—</span>
                      )}
                    </TableCell>

                    {/* Total Monthly */}
                    <TableCell className="py-2.5 text-right">
                      <div className="font-bold text-slate-900 dark:text-gray-100">
                        ₱{formatMoney(emp.total_personal_share)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Remit: ₱{formatMoney(emp.grand_total_monthly)}
                      </div>
                    </TableCell>

                    {/* Coverage Status */}
                    <TableCell className="py-2.5 text-center">
                      {emp.coverage_summary === "FULL" ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 text-[10px] font-semibold">
                          Complete (3/3)
                        </Badge>
                      ) : emp.coverage_summary === "PARTIAL" ? (
                        <Badge
                          variant="outline"
                          className="bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 text-[10px]"
                        >
                          Partial
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-slate-500 border-slate-300 dark:border-gray-700 text-[10px]"
                        >
                          No Benefit (₱0)
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions: View Details */}
                    <TableCell className="py-2.5 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:hover:text-gray-100"
                        onClick={() => setSelectedEmp(emp)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 4. Table Pagination Footer */}
        <div className="p-3.5 bg-slate-50/80 dark:bg-gray-800/60 border-t dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
            <span>
              Showing <strong>{paginated.length}</strong> of <strong>{filtered.length}</strong> employees
              {filtered.length !== coverages.length && (
                <span> (filtered from total {coverages.length})</span>
              )}
            </span>

            <div className="flex items-center gap-1.5 ml-4">
              <span>Per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[70px] h-7 text-xs bg-white dark:bg-gray-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5 dark:border-gray-700"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-xs font-medium px-2 text-slate-600 dark:text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5 dark:border-gray-700"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* 5. Employee Detail Dialog Modal */}
      {selectedEmp && (
        <Dialog open={Boolean(selectedEmp)} onOpenChange={(open) => !open && setSelectedEmp(null)}>
          <DialogContent className="max-w-xl p-0 overflow-hidden dark:bg-gray-900 dark:border-gray-800">
            <DialogHeader className="p-5 pb-4 bg-slate-50 dark:bg-gray-800/60 border-b dark:border-gray-800">
              <div className="flex items-start justify-between">
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900 dark:text-gray-100">
                    {selectedEmp.employee_name}
                  </DialogTitle>
                  <div className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                    Employee ID #{selectedEmp.user_id} • {selectedEmp.department_name}
                    {selectedEmp.position ? ` • ${selectedEmp.position}` : ""}
                  </div>
                </div>

                <Badge
                  className={
                    selectedEmp.coverage_summary === "FULL"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : selectedEmp.coverage_summary === "PARTIAL"
                      ? "bg-sky-100 text-sky-800 border-sky-300"
                      : "bg-slate-100 text-slate-800 border-slate-300"
                  }
                >
                  {selectedEmp.coverage_summary} COVERAGE
                </Badge>
              </div>
            </DialogHeader>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Compensation info */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-gray-800/40 p-3 rounded-lg border border-slate-200/80 dark:border-gray-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Daily Wage</span>
                  <div className="font-bold text-slate-900 dark:text-gray-100">
                    ₱{formatMoney(selectedEmp.daily_wage)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Monthly Basic Rate</span>
                  <div className="font-bold text-slate-900 dark:text-gray-100">
                    ₱{formatMoney(selectedEmp.monthly_rate)}
                  </div>
                </div>
              </div>

              {/* Statutory Breakdown Cards */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-800 dark:text-gray-200">
                  Statutory Benefit Contributions
                </div>

                {/* SSS / GSIS */}
                <div className="p-3 rounded-lg border border-blue-100 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/20 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-blue-600" />
                      {sssLabel}
                    </span>
                    <span className="font-mono text-[11px] text-slate-600 dark:text-gray-300">
                      {selectedEmp.sss.account_no ? `No: ${selectedEmp.sss.account_no}` : "No SSS ID Registered"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-blue-100/80 dark:border-blue-900/40">
                    <div>
                      <div className="text-[10px] text-slate-500">Personal Share</div>
                      <div className="font-bold text-blue-700 dark:text-blue-400">
                        ₱{formatMoney(selectedEmp.sss.personal_share)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">{isGovernment ? "LGU Share" : "Employer Share"}</div>
                      <div className="font-bold text-emerald-700 dark:text-emerald-400">
                        ₱{formatMoney(selectedEmp.sss.counterpart_share)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500">Total Remittance</div>
                      <div className="font-bold text-slate-900 dark:text-gray-100">
                        ₱{formatMoney(selectedEmp.sss.total_contribution)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* PhilHealth */}
                <div className="p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <HeartPulse className="h-3.5 w-3.5 text-emerald-600" />
                      PhilHealth
                    </span>
                    <span className="font-mono text-[11px] text-slate-600 dark:text-gray-300">
                      {selectedEmp.philhealth.account_no ? `No: ${selectedEmp.philhealth.account_no}` : "No PhilHealth ID"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-emerald-100/80 dark:border-emerald-900/40">
                    <div>
                      <div className="text-[10px] text-slate-500">Personal (2.5%)</div>
                      <div className="font-bold text-emerald-700 dark:text-emerald-400">
                        ₱{formatMoney(selectedEmp.philhealth.personal_share)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">{isGovernment ? "LGU (2.5%)" : "Employer (2.5%)"}</div>
                      <div className="font-bold text-emerald-700 dark:text-emerald-400">
                        ₱{formatMoney(selectedEmp.philhealth.counterpart_share)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500">Total (5%)</div>
                      <div className="font-bold text-slate-900 dark:text-gray-100">
                        ₱{formatMoney(selectedEmp.philhealth.total_contribution)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pag-IBIG */}
                <div className="p-3 rounded-lg border border-amber-100 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <Landmark className="h-3.5 w-3.5 text-amber-600" />
                      Pag-IBIG Fund
                    </span>
                    <span className="font-mono text-[11px] text-slate-600 dark:text-gray-300">
                      {selectedEmp.pagibig.account_no ? `MID: ${selectedEmp.pagibig.account_no}` : "No MID Registered"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-amber-100/80 dark:border-amber-900/40">
                    <div>
                      <div className="text-[10px] text-slate-500">Personal Share</div>
                      <div className="font-bold text-amber-700 dark:text-amber-400">
                        ₱{formatMoney(selectedEmp.pagibig.personal_share)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">{isGovernment ? "LGU Share" : "Employer Share"}</div>
                      <div className="font-bold text-amber-700 dark:text-amber-400">
                        ₱{formatMoney(selectedEmp.pagibig.counterpart_share)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500">Total Monthly</div>
                      <div className="font-bold text-slate-900 dark:text-gray-100">
                        ₱{formatMoney(selectedEmp.pagibig.total_contribution)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Loans (if any) */}
              {selectedEmp.loans.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center justify-between">
                    <span>Active Benefit Loans ({selectedEmp.loans.length})</span>
                    <span className="font-semibold text-purple-700">
                      Total Amortization: ₱{formatMoney(selectedEmp.total_loan_amortization)}/mo
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedEmp.loans.map((l) => (
                      <div
                        key={l.loan_id}
                        className="bg-purple-50/50 dark:bg-purple-950/20 p-2.5 rounded-md border border-purple-200/60 dark:border-purple-900/40 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-purple-950 dark:text-purple-200">
                            {l.loan_name || `${l.benefit_code} Loan`}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Ref: {l.reference_no || "N/A"} • Deduct: {l.deduct_on} Cutoff
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-purple-700 dark:text-purple-400">
                            ₱{formatMoney(l.amortization_amount)}/mo
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Bal: ₱{formatMoney(l.remaining_balance)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary Total Card */}
              <div className="bg-slate-900 text-white dark:bg-gray-800 p-3.5 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <div className="text-slate-400 font-medium">Kabuuang Buwanang Kaltas (EE)</div>
                  <div className="text-lg font-bold text-white">
                    ₱{formatMoney(selectedEmp.total_personal_share)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-400 font-medium">Kabuuang Remittance (EE + {isGovernment ? "LGU" : "ER"})</div>
                  <div className="text-lg font-bold text-emerald-400">
                    ₱{formatMoney(selectedEmp.grand_total_monthly)}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="p-3 bg-slate-50 dark:bg-gray-800/60 border-t dark:border-gray-800">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setSelectedEmp(null)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* PDF Preview Modal */}
      {previewOpen && pdfBlob && (
        <PdfPreviewModal
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          pdfBlob={pdfBlob}
          title="Employee Benefits Coverage & Remittance Report"
          fileName={`employee-benefits-report-${new Date().toISOString().slice(0, 10)}.pdf`}
        />
      )}
    </div>
  );
}
