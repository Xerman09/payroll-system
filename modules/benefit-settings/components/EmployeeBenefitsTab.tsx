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
import { Switch } from "@/components/ui/switch";

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
  const [activeOnly, setActiveOnly] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<"FOCUSED" | "ALL_COLUMNS">("FOCUSED");

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
    const baseList = activeOnly ? coverages.filter((c) => c.is_active) : coverages;
    const total = baseList.length;
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

    for (const c of baseList) {
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
  }, [coverages, activeOnly]);

  // Filtered rows
  const filtered = React.useMemo(() => {
    return coverages.filter((c) => {
      // 0. Active employee filter
      if (activeOnly && !c.is_active) return false;
      if (statusFilter === "ACTIVE_ONLY" && !c.is_active) return false;
      if (statusFilter === "INACTIVE_ONLY" && c.is_active) return false;

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
      if (statusFilter === "HAS_SSS" && !c.has_sss_amount) return false;
      if (statusFilter === "NO_SSS" && c.has_sss_amount) return false;

      if (statusFilter === "HAS_PHILHEALTH" && !c.has_philhealth_amount) return false;
      if (statusFilter === "NO_PHILHEALTH" && c.has_philhealth_amount) return false;

      if (statusFilter === "HAS_PAGIBIG" && !c.has_pagibig_amount) return false;
      if (statusFilter === "NO_PAGIBIG" && c.has_pagibig_amount) return false;

      if (statusFilter === "FULL_COVERAGE" && !c.has_all_benefits) return false;

      if (statusFilter === "HAS_SSS_ID" && !c.has_sss_id) return false;
      if (statusFilter === "MISSING_SSS_ID" && c.has_sss_id) return false;

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
  }, [coverages, activeOnly, search, deptFilter, benefitFilter, statusFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Export to CSV
  const handleExportCsv = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (benefitFilter === "SSS" && viewMode === "FOCUSED") {
      headers = [
        "Employee ID",
        "Employee Name",
        "Department",
        "Position",
        "Monthly Rate",
        `${sssLabel} Account No`,
        `${sssLabel} EE (Deduction)`,
        `${sssLabel} ER (${isGovernment ? "LGU" : "Employer"})`,
        `${sssLabel} Total Contribution`,
        `${sssLabel} Active Loan Amortization`,
        "Coverage Status",
      ];
      rows = filtered.map((c) => {
        const sLoans = c.loans.filter((l) => l.benefit_code === "SSS");
        const amort = sLoans.reduce((sum, l) => sum + l.amortization_amount, 0);
        return [
          c.user_id,
          `"${c.employee_name}"`,
          `"${c.department_name}"`,
          `"${c.position || ""}"`,
          c.monthly_rate.toFixed(2),
          `"${c.sss.account_no || ""}"`,
          c.sss.personal_share.toFixed(2),
          c.sss.counterpart_share.toFixed(2),
          c.sss.total_contribution.toFixed(2),
          amort.toFixed(2),
          c.sss.personal_share > 0 ? "Active" : c.sss.account_no ? "Registered (₱0)" : "No Benefit",
        ];
      });
    } else if (benefitFilter === "PHILHEALTH" && viewMode === "FOCUSED") {
      headers = [
        "Employee ID",
        "Employee Name",
        "Department",
        "Position",
        "Monthly Rate",
        "PhilHealth PIN",
        "PhilHealth EE (2.5%)",
        `PhilHealth ER (${isGovernment ? "LGU" : "Employer"} 2.5%)`,
        "PhilHealth Total (5%)",
        "Coverage Status",
      ];
      rows = filtered.map((c) => [
        c.user_id,
        `"${c.employee_name}"`,
        `"${c.department_name}"`,
        `"${c.position || ""}"`,
        c.monthly_rate.toFixed(2),
        `"${c.philhealth.account_no || ""}"`,
        c.philhealth.personal_share.toFixed(2),
        c.philhealth.counterpart_share.toFixed(2),
        c.philhealth.total_contribution.toFixed(2),
        c.philhealth.personal_share > 0 ? "Active" : c.philhealth.account_no ? "Registered (₱0)" : "No Benefit",
      ]);
    } else if (benefitFilter === "PAGIBIG" && viewMode === "FOCUSED") {
      headers = [
        "Employee ID",
        "Employee Name",
        "Department",
        "Position",
        "Monthly Rate",
        "Pag-IBIG MID No",
        "Pag-IBIG EE",
        `Pag-IBIG ER (${isGovernment ? "LGU" : "Employer"})`,
        "Pag-IBIG Total",
        "Pag-IBIG Active Loan Amortization",
        "Coverage Status",
      ];
      rows = filtered.map((c) => {
        const pLoans = c.loans.filter((l) => l.benefit_code === "PAGIBIG");
        const amort = pLoans.reduce((sum, l) => sum + l.amortization_amount, 0);
        return [
          c.user_id,
          `"${c.employee_name}"`,
          `"${c.department_name}"`,
          `"${c.position || ""}"`,
          c.monthly_rate.toFixed(2),
          `"${c.pagibig.account_no || ""}"`,
          c.pagibig.personal_share.toFixed(2),
          c.pagibig.counterpart_share.toFixed(2),
          c.pagibig.total_contribution.toFixed(2),
          amort.toFixed(2),
          c.pagibig.personal_share > 0 ? "Active" : c.pagibig.account_no ? "Registered (₱0)" : "No Benefit",
        ];
      });
    } else {
      headers = [
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

      rows = filtered.map((c) => [
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
    }

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${benefitFilter !== "ALL" ? benefitFilter + "_" : ""}Employee_Benefits_Coverage_Report_${new Date().toISOString().slice(0, 10)}.csv`
    );
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
            <Badge
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setBenefitFilter("SSS");
                setStatusFilter(statusFilter === "HAS_SSS" ? "ALL" : "HAS_SSS");
                setCurrentPage(1);
              }}
              title={`Click to filter only employees with ${sssLabel} (> ₱0.00)`}
              className={`text-[10px] cursor-pointer transition-colors ${
                statusFilter === "HAS_SSS"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-200"
              }`}
            >
              {stats.sssCount} Enrolled {statusFilter === "HAS_SSS" ? "✓" : ""}
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
            <Badge
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setBenefitFilter("PHILHEALTH");
                setStatusFilter(statusFilter === "HAS_PHILHEALTH" ? "ALL" : "HAS_PHILHEALTH");
                setCurrentPage(1);
              }}
              title="Click to filter only employees with PhilHealth (> ₱0.00)"
              className={`text-[10px] cursor-pointer transition-colors ${
                statusFilter === "HAS_PHILHEALTH"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200"
              }`}
            >
              {stats.phCount} Enrolled {statusFilter === "HAS_PHILHEALTH" ? "✓" : ""}
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
            <Badge
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setBenefitFilter("PAGIBIG");
                setStatusFilter(statusFilter === "HAS_PAGIBIG" ? "ALL" : "HAS_PAGIBIG");
                setCurrentPage(1);
              }}
              title="Click to filter only employees with Pag-IBIG (> ₱0.00)"
              className={`text-[10px] cursor-pointer transition-colors ${
                statusFilter === "HAS_PAGIBIG"
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-200"
              }`}
            >
              {stats.pagibigCount} Enrolled {statusFilter === "HAS_PAGIBIG" ? "✓" : ""}
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

            {/* Active Employees Only Toggle */}
            <Button
              type="button"
              variant={activeOnly ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setActiveOnly(!activeOnly);
                setCurrentPage(1);
              }}
              className={`h-9 text-xs gap-1.5 transition-all ${
                activeOnly
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs"
                  : "text-slate-600 dark:text-slate-300 border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800"
              }`}
              title={activeOnly ? "Currently showing Active Employees Only. Click to include inactive accounts." : "Currently showing all. Click to filter only active employees."}
            >
              <Users className="h-3.5 w-3.5" />
              {activeOnly ? "Active Only" : "All Statuses"}
            </Button>

            {/* Quick SSS Filter Button */}
            <Button
              type="button"
              variant={statusFilter === "HAS_SSS" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatusFilter(statusFilter === "HAS_SSS" ? "ALL" : "HAS_SSS");
                setCurrentPage(1);
              }}
              className={`h-9 text-xs gap-1.5 transition-all ${
                statusFilter === "HAS_SSS"
                  ? "bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-2xs"
                  : "text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/50"
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              Has {sssLabel} Only (&gt; ₱0)
            </Button>

            {/* Coverage Status Dropdown */}
            <Select
              value={statusFilter}
              onValueChange={(val: CoverageStatusFilter) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[195px] h-9 text-xs bg-slate-50 dark:bg-gray-800">
                <SelectValue placeholder="Coverage Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Coverage Status</SelectItem>
                <SelectItem value="ACTIVE_ONLY" className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Active Employees Only
                </SelectItem>
                <SelectItem value="INACTIVE_ONLY" className="text-rose-600 dark:text-rose-400">
                  Inactive / Terminated Only
                </SelectItem>
                <SelectItem value="HAS_SSS" className="text-blue-600 dark:text-blue-400 font-medium">
                  Has {sssLabel} Only (&gt; ₱0.00)
                </SelectItem>
                <SelectItem value="NO_SSS">No {sssLabel} (₱0.00)</SelectItem>
                <SelectItem value="HAS_PHILHEALTH" className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Has PhilHealth Only (&gt; ₱0.00)
                </SelectItem>
                <SelectItem value="NO_PHILHEALTH">No PhilHealth (₱0.00)</SelectItem>
                <SelectItem value="HAS_PAGIBIG" className="text-amber-600 dark:text-amber-400 font-medium">
                  Has Pag-IBIG Only (&gt; ₱0.00)
                </SelectItem>
                <SelectItem value="NO_PAGIBIG">No Pag-IBIG (₱0.00)</SelectItem>
                <SelectItem value="FULL_COVERAGE" className="text-purple-600 dark:text-purple-400 font-medium">
                  Complete Coverage (All 3)
                </SelectItem>
                <SelectItem value="WITH_LOAN">With Active Loans</SelectItem>
                <SelectItem value="WITH_BENEFIT">With Any Benefit (&gt; ₱0.00)</SelectItem>
                <SelectItem value="WITHOUT_BENEFIT">Zero Benefits (₱0.00)</SelectItem>
                <SelectItem value="HAS_SSS_ID">With {sssLabel} ID Registered</SelectItem>
                <SelectItem value="MISSING_SSS_ID">Missing {sssLabel} ID</SelectItem>
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

        {/* Benefit-specific interactive banner with quick toggle */}
        {benefitFilter === "SSS" && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600 shrink-0" />
              <span>
                Filtering by <strong>{sssLabel}</strong> statutory benefit.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Column View Mode Switcher */}
              <div className="inline-flex rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setViewMode("FOCUSED")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    viewMode === "FOCUSED"
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-white"
                  }`}
                >
                  {sssLabel} Only Columns
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("ALL_COLUMNS")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    viewMode === "ALL_COLUMNS"
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-white"
                  }`}
                >
                  All Benefit Columns
                </button>
              </div>

              {/* Only with SSS contribution switch */}
              <div className="flex items-center gap-2">
                <label htmlFor="filter-has-sss-only" className="cursor-pointer font-medium select-none text-blue-800 dark:text-blue-300">
                  Only with {sssLabel} deduction (&gt; ₱0.00):
                </label>
                <Switch
                  id="filter-has-sss-only"
                  checked={statusFilter === "HAS_SSS"}
                  onCheckedChange={(checked) => {
                    setStatusFilter(checked ? "HAS_SSS" : "ALL");
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {benefitFilter === "PHILHEALTH" && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-900 dark:text-emerald-200">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                Filtering by <strong>PhilHealth</strong> statutory benefit.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-md border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setViewMode("FOCUSED")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    viewMode === "FOCUSED"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-white"
                  }`}
                >
                  PhilHealth Only Columns
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("ALL_COLUMNS")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    viewMode === "ALL_COLUMNS"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-white"
                  }`}
                >
                  All Benefit Columns
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="filter-has-ph-only" className="cursor-pointer font-medium select-none text-emerald-800 dark:text-emerald-300">
                  Only with PhilHealth deduction (&gt; ₱0.00):
                </label>
                <Switch
                  id="filter-has-ph-only"
                  checked={statusFilter === "HAS_PHILHEALTH"}
                  onCheckedChange={(checked) => {
                    setStatusFilter(checked ? "HAS_PHILHEALTH" : "ALL");
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {benefitFilter === "PAGIBIG" && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                Filtering by <strong>Pag-IBIG</strong> statutory benefit.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-md border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setViewMode("FOCUSED")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    viewMode === "FOCUSED"
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-white"
                  }`}
                >
                  Pag-IBIG Only Columns
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("ALL_COLUMNS")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    viewMode === "ALL_COLUMNS"
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-white"
                  }`}
                >
                  All Benefit Columns
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="filter-has-pagibig-only" className="cursor-pointer font-medium select-none text-amber-800 dark:text-amber-300">
                  Only with Pag-IBIG deduction (&gt; ₱0.00):
                </label>
                <Switch
                  id="filter-has-pagibig-only"
                  checked={statusFilter === "HAS_PAGIBIG"}
                  onCheckedChange={(checked) => {
                    setStatusFilter(checked ? "HAS_PAGIBIG" : "ALL");
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {benefitFilter === "LOANS" && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-xs text-purple-900 dark:text-purple-200">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-purple-600 shrink-0" />
              <span>
                Filtering by <strong>Benefit Loans</strong> masterlist.
              </span>
            </div>
            <div className="inline-flex rounded-md border border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-800 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setViewMode("FOCUSED")}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  viewMode === "FOCUSED"
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-white"
                }`}
              >
                Loans Only Columns
              </button>
              <button
                type="button"
                onClick={() => setViewMode("ALL_COLUMNS")}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  viewMode === "ALL_COLUMNS"
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-white"
                }`}
              >
                All Benefit Columns
              </button>
            </div>
          </div>
        )}

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
              <Badge variant="secondary" className="gap-1 text-[11px] bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200">
                Status: {
                  statusFilter === "ACTIVE_ONLY"
                    ? "Active Employees Only"
                    : statusFilter === "INACTIVE_ONLY"
                    ? "Inactive / Terminated"
                    : statusFilter === "HAS_SSS"
                    ? `Has ${sssLabel} (> ₱0.00)`
                    : statusFilter === "NO_SSS"
                    ? `No ${sssLabel} (₱0.00)`
                    : statusFilter === "HAS_PHILHEALTH"
                    ? "Has PhilHealth (> ₱0.00)"
                    : statusFilter === "NO_PHILHEALTH"
                    ? "No PhilHealth (₱0.00)"
                    : statusFilter === "HAS_PAGIBIG"
                    ? "Has Pag-IBIG (> ₱0.00)"
                    : statusFilter === "NO_PAGIBIG"
                    ? "No Pag-IBIG (₱0.00)"
                    : statusFilter === "FULL_COVERAGE"
                    ? "Full Coverage (All 3)"
                    : statusFilter === "WITH_BENEFIT"
                    ? "With Amount (> ₱0.00)"
                    : statusFilter === "WITHOUT_BENEFIT"
                    ? "Zero Amount (₱0.00)"
                    : statusFilter === "HAS_SSS_ID"
                    ? `With ${sssLabel} ID`
                    : statusFilter === "MISSING_SSS_ID"
                    ? `Missing ${sssLabel} ID`
                    : "With Loans"
                }
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
              {benefitFilter === "SSS" && viewMode === "FOCUSED" ? (
                /* Focused SSS Table Header - Completely hides PhilHealth & Pag-IBIG */
                <TableRow>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 min-w-[200px]">
                    Employee
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 min-w-[130px]">
                    Department
                  </TableHead>
                  <TableHead className="text-xs font-bold text-blue-900 dark:text-blue-300 min-w-[140px]">
                    {sssLabel} Account No
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 min-w-[110px] text-right">
                    Monthly Rate
                  </TableHead>
                  <TableHead className="text-xs font-bold text-blue-900 dark:text-blue-300 min-w-[130px] text-right">
                    EE Deduction
                  </TableHead>
                  <TableHead className="text-xs font-bold text-blue-900 dark:text-blue-300 min-w-[130px] text-right">
                    ER Share ({isGovernment ? "LGU" : "Employer"})
                  </TableHead>
                  <TableHead className="text-xs font-bold text-blue-900 dark:text-blue-300 min-w-[140px] text-right">
                    Total SSS Remittance
                  </TableHead>
                  <TableHead className="text-xs font-bold text-purple-900 dark:text-purple-300 min-w-[110px]">
                    SSS Loan
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 text-center min-w-[90px]">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 text-center w-[70px]">
                    Details
                  </TableHead>
                </TableRow>
              ) : benefitFilter === "PHILHEALTH" && viewMode === "FOCUSED" ? (
                /* Focused PhilHealth Table Header - Completely hides SSS & Pag-IBIG */
                <TableRow>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 min-w-[200px]">
                    Employee
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 min-w-[130px]">
                    Department
                  </TableHead>
                  <TableHead className="text-xs font-bold text-emerald-900 dark:text-emerald-300 min-w-[140px]">
                    PhilHealth PIN
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 min-w-[110px] text-right">
                    Monthly Rate
                  </TableHead>
                  <TableHead className="text-xs font-bold text-emerald-900 dark:text-emerald-300 min-w-[130px] text-right">
                    EE Share (2.5%)
                  </TableHead>
                  <TableHead className="text-xs font-bold text-emerald-900 dark:text-emerald-300 min-w-[130px] text-right">
                    ER Share (2.5%)
                  </TableHead>
                  <TableHead className="text-xs font-bold text-emerald-900 dark:text-emerald-300 min-w-[140px] text-right">
                    Total PhilHealth (5%)
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 text-center min-w-[90px]">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 text-center w-[70px]">
                    Details
                  </TableHead>
                </TableRow>
              ) : benefitFilter === "PAGIBIG" && viewMode === "FOCUSED" ? (
                /* Focused Pag-IBIG Table Header - Completely hides SSS & PhilHealth */
                <TableRow>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 min-w-[200px]">
                    Employee
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 min-w-[130px]">
                    Department
                  </TableHead>
                  <TableHead className="text-xs font-bold text-amber-900 dark:text-amber-300 min-w-[140px]">
                    Pag-IBIG MID No
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 min-w-[110px] text-right">
                    Monthly Rate
                  </TableHead>
                  <TableHead className="text-xs font-bold text-amber-900 dark:text-amber-300 min-w-[130px] text-right">
                    EE Share
                  </TableHead>
                  <TableHead className="text-xs font-bold text-amber-900 dark:text-amber-300 min-w-[130px] text-right">
                    ER Share ({isGovernment ? "LGU" : "Employer"})
                  </TableHead>
                  <TableHead className="text-xs font-bold text-amber-900 dark:text-amber-300 min-w-[140px] text-right">
                    Total Pag-IBIG Remittance
                  </TableHead>
                  <TableHead className="text-xs font-bold text-purple-900 dark:text-purple-300 min-w-[110px]">
                    Pag-IBIG Loan
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 text-center min-w-[90px]">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 text-center w-[70px]">
                    Details
                  </TableHead>
                </TableRow>
              ) : benefitFilter === "LOANS" && viewMode === "FOCUSED" ? (
                /* Focused Loans Table Header */
                <TableRow>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 min-w-[200px]">
                    Employee
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 min-w-[130px]">
                    Department
                  </TableHead>
                  <TableHead className="text-xs font-bold text-purple-900 dark:text-purple-300 min-w-[110px]">
                    Active Loans
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 min-w-[220px]">
                    Benefit Loans Breakdown
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 dark:text-gray-100 min-w-[140px] text-right">
                    Monthly Amortization
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 text-center w-[70px]">
                    Details
                  </TableHead>
                </TableRow>
              ) : (
                /* All Statutory Benefits Overview Header */
                <TableRow>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 min-w-[200px]">
                    Employee
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 min-w-[130px]">
                    Department
                  </TableHead>

                  {/* SSS / GSIS */}
                  <TableHead className="text-xs font-bold text-blue-900 dark:text-blue-300 min-w-[155px] text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{sssLabel} (EE / {isGovernment ? "LGU" : "ER"})</span>
                      <button
                        type="button"
                        title={statusFilter === "HAS_SSS" ? "Clear SSS filter" : `Filter only employees that have ${sssLabel} (> ₱0)`}
                        onClick={() => {
                          setStatusFilter(statusFilter === "HAS_SSS" ? "ALL" : "HAS_SSS");
                          setCurrentPage(1);
                        }}
                        className={`p-1 rounded transition-colors ${
                          statusFilter === "HAS_SSS"
                            ? "bg-blue-600 text-white shadow-2xs"
                            : "text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                        }`}
                      >
                        <Filter className="h-3 w-3" />
                      </button>
                    </div>
                  </TableHead>

                  {/* PhilHealth */}
                  <TableHead className="text-xs font-bold text-emerald-900 dark:text-emerald-300 min-w-[155px] text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span>PhilHealth (EE / {isGovernment ? "LGU" : "ER"})</span>
                      <button
                        type="button"
                        title={statusFilter === "HAS_PHILHEALTH" ? "Clear PhilHealth filter" : "Filter only employees that have PhilHealth (> ₱0)"}
                        onClick={() => {
                          setStatusFilter(statusFilter === "HAS_PHILHEALTH" ? "ALL" : "HAS_PHILHEALTH");
                          setCurrentPage(1);
                        }}
                        className={`p-1 rounded transition-colors ${
                          statusFilter === "HAS_PHILHEALTH"
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                        }`}
                      >
                        <Filter className="h-3 w-3" />
                      </button>
                    </div>
                  </TableHead>

                  {/* Pag-IBIG */}
                  <TableHead className="text-xs font-bold text-amber-900 dark:text-amber-300 min-w-[155px] text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Pag-IBIG (EE / {isGovernment ? "LGU" : "ER"})</span>
                      <button
                        type="button"
                        title={statusFilter === "HAS_PAGIBIG" ? "Clear Pag-IBIG filter" : "Filter only employees that have Pag-IBIG (> ₱0)"}
                        onClick={() => {
                          setStatusFilter(statusFilter === "HAS_PAGIBIG" ? "ALL" : "HAS_PAGIBIG");
                          setCurrentPage(1);
                        }}
                        className={`p-1 rounded transition-colors ${
                          statusFilter === "HAS_PAGIBIG"
                            ? "bg-amber-600 text-white shadow-2xs"
                            : "text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                        }`}
                      >
                        <Filter className="h-3 w-3" />
                      </button>
                    </div>
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
              )}
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={
                      benefitFilter === "ALL" || viewMode === "ALL_COLUMNS"
                        ? 9
                        : benefitFilter === "SSS" || benefitFilter === "PAGIBIG"
                        ? 10
                        : benefitFilter === "PHILHEALTH"
                        ? 9
                        : 6
                    }
                    className="h-44 text-center text-slate-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCcw className="h-6 w-6 animate-spin text-blue-600" />
                      <span className="text-sm font-medium">Loading employee benefits data...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={
                      benefitFilter === "ALL" || viewMode === "ALL_COLUMNS"
                        ? 9
                        : benefitFilter === "SSS" || benefitFilter === "PAGIBIG"
                        ? 10
                        : benefitFilter === "PHILHEALTH"
                        ? 9
                        : 6
                    }
                    className="h-44 text-center text-slate-500"
                  >
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
                    {/* Common: Employee Name & ID */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 dark:text-gray-100">
                          {emp.employee_name}
                        </span>
                        {!emp.is_active && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 text-rose-600 border-rose-300 bg-rose-50 dark:bg-rose-950/40">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span>ID #{emp.user_id}</span>
                        {emp.position && <span>• {emp.position}</span>}
                      </div>
                    </TableCell>

                    {/* Common: Department */}
                    <TableCell className="py-2.5 text-slate-600 dark:text-gray-300">
                      {emp.department_name}
                    </TableCell>

                    {/* CASE 1: SSS FOCUSED VIEW - NO PhilHealth, NO Pag-IBIG */}
                    {benefitFilter === "SSS" && viewMode === "FOCUSED" ? (
                      <>
                        {/* SSS Account No */}
                        <TableCell className="py-2.5">
                          {emp.sss.account_no ? (
                            <span className="font-mono text-xs font-medium text-slate-800 dark:text-gray-200">
                              {emp.sss.account_no}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-gray-600">—</span>
                          )}
                        </TableCell>

                        {/* Monthly Rate */}
                        <TableCell className="py-2.5 text-right font-medium text-slate-700 dark:text-gray-300">
                          ₱{formatMoney(emp.monthly_rate)}
                        </TableCell>

                        {/* EE Deduction */}
                        <TableCell className="py-2.5 text-right font-semibold text-blue-700 dark:text-blue-400">
                          ₱{formatMoney(emp.sss.personal_share)}
                        </TableCell>

                        {/* ER Share */}
                        <TableCell className="py-2.5 text-right text-slate-600 dark:text-gray-300">
                          ₱{formatMoney(emp.sss.counterpart_share)}
                        </TableCell>

                        {/* Total Contribution */}
                        <TableCell className="py-2.5 text-right font-bold text-blue-900 dark:text-blue-200">
                          ₱{formatMoney(emp.sss.total_contribution)}
                        </TableCell>

                        {/* SSS Loan */}
                        <TableCell className="py-2.5">
                          {(() => {
                            const sLoans = emp.loans.filter((l) => l.benefit_code === "SSS");
                            if (sLoans.length === 0) return <span className="text-slate-300 dark:text-gray-600">—</span>;
                            const amort = sLoans.reduce((acc, l) => acc + l.amortization_amount, 0);
                            return (
                              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300">
                                ₱{formatMoney(amort)}/mo
                              </Badge>
                            );
                          })()}
                        </TableCell>

                        {/* SSS Status */}
                        <TableCell className="py-2.5 text-center">
                          {emp.sss.personal_share > 0 ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-semibold">
                              Active
                            </Badge>
                          ) : emp.sss.account_no ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 text-[10px]">
                              Registered (₱0)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400 border-slate-300 dark:border-gray-700 text-[10px]">
                              No Benefit
                            </Badge>
                          )}
                        </TableCell>
                      </>
                    ) : benefitFilter === "PHILHEALTH" && viewMode === "FOCUSED" ? (
                      /* CASE 2: PHILHEALTH FOCUSED VIEW - NO SSS, NO Pag-IBIG */
                      <>
                        {/* PhilHealth PIN */}
                        <TableCell className="py-2.5">
                          {emp.philhealth.account_no ? (
                            <span className="font-mono text-xs font-medium text-slate-800 dark:text-gray-200">
                              {emp.philhealth.account_no}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-gray-600">—</span>
                          )}
                        </TableCell>

                        {/* Monthly Rate */}
                        <TableCell className="py-2.5 text-right font-medium text-slate-700 dark:text-gray-300">
                          ₱{formatMoney(emp.monthly_rate)}
                        </TableCell>

                        {/* EE Share (2.5%) */}
                        <TableCell className="py-2.5 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                          ₱{formatMoney(emp.philhealth.personal_share)}
                        </TableCell>

                        {/* ER Share (2.5%) */}
                        <TableCell className="py-2.5 text-right text-slate-600 dark:text-gray-300">
                          ₱{formatMoney(emp.philhealth.counterpart_share)}
                        </TableCell>

                        {/* Total Contribution (5%) */}
                        <TableCell className="py-2.5 text-right font-bold text-emerald-900 dark:text-emerald-200">
                          ₱{formatMoney(emp.philhealth.total_contribution)}
                        </TableCell>

                        {/* PhilHealth Status */}
                        <TableCell className="py-2.5 text-center">
                          {emp.philhealth.personal_share > 0 ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-semibold">
                              Active
                            </Badge>
                          ) : emp.philhealth.account_no ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 text-[10px]">
                              Registered (₱0)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400 border-slate-300 dark:border-gray-700 text-[10px]">
                              No Benefit
                            </Badge>
                          )}
                        </TableCell>
                      </>
                    ) : benefitFilter === "PAGIBIG" && viewMode === "FOCUSED" ? (
                      /* CASE 3: PAG-IBIG FOCUSED VIEW - NO SSS, NO PhilHealth */
                      <>
                        {/* Pag-IBIG MID No */}
                        <TableCell className="py-2.5">
                          {emp.pagibig.account_no ? (
                            <span className="font-mono text-xs font-medium text-slate-800 dark:text-gray-200">
                              {emp.pagibig.account_no}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-gray-600">—</span>
                          )}
                        </TableCell>

                        {/* Monthly Rate */}
                        <TableCell className="py-2.5 text-right font-medium text-slate-700 dark:text-gray-300">
                          ₱{formatMoney(emp.monthly_rate)}
                        </TableCell>

                        {/* EE Share */}
                        <TableCell className="py-2.5 text-right font-semibold text-amber-700 dark:text-amber-400">
                          ₱{formatMoney(emp.pagibig.personal_share)}
                        </TableCell>

                        {/* ER Share */}
                        <TableCell className="py-2.5 text-right text-slate-600 dark:text-gray-300">
                          ₱{formatMoney(emp.pagibig.counterpart_share)}
                        </TableCell>

                        {/* Total Contribution */}
                        <TableCell className="py-2.5 text-right font-bold text-amber-900 dark:text-amber-200">
                          ₱{formatMoney(emp.pagibig.total_contribution)}
                        </TableCell>

                        {/* Pag-IBIG Loan */}
                        <TableCell className="py-2.5">
                          {(() => {
                            const pLoans = emp.loans.filter((l) => l.benefit_code === "PAGIBIG");
                            if (pLoans.length === 0) return <span className="text-slate-300 dark:text-gray-600">—</span>;
                            const amort = pLoans.reduce((acc, l) => acc + l.amortization_amount, 0);
                            return (
                              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300">
                                ₱{formatMoney(amort)}/mo
                              </Badge>
                            );
                          })()}
                        </TableCell>

                        {/* Pag-IBIG Status */}
                        <TableCell className="py-2.5 text-center">
                          {emp.pagibig.personal_share > 0 ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-semibold">
                              Active
                            </Badge>
                          ) : emp.pagibig.account_no ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 text-[10px]">
                              Registered (₱0)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400 border-slate-300 dark:border-gray-700 text-[10px]">
                              No Benefit
                            </Badge>
                          )}
                        </TableCell>
                      </>
                    ) : benefitFilter === "LOANS" && viewMode === "FOCUSED" ? (
                      /* CASE 4: LOANS FOCUSED VIEW */
                      <>
                        <TableCell className="py-2.5">
                          <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 font-semibold">
                            {emp.loans.length} Active {emp.loans.length === 1 ? "Loan" : "Loans"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {emp.loans.map((l) => (
                              <Badge
                                key={l.loan_id}
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {l.benefit_code}: ₱{formatMoney(l.amortization_amount)}/mo
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-right font-bold text-purple-900 dark:text-purple-200">
                          ₱{formatMoney(emp.total_loan_amortization)}
                        </TableCell>
                      </>
                    ) : (
                      /* CASE 5: ALL STATUTORY BENEFITS OVERVIEW (All Columns) */
                      <>
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
                      </>
                    )}

                    {/* Common: Actions: View Details */}
                    <TableCell className="py-2.5 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:hover:text-gray-100"
                        onClick={() => setSelectedEmp(emp)}
                        title="View details"
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
