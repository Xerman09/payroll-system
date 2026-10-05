// modules/benefit-settings/components/BenefitEmployeesDialog.tsx
"use client";

import * as React from "react";
import {
  Users,
  Search,
  Download,
  FileText,
  Shield,
  HeartPulse,
  Landmark,
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { formatMoney } from "../providers/benefitApi";
import type { EmployeeBenefitCoverage, BenefitCode } from "../types";
import { exportEmployeeBenefitsPdf } from "../utils/employeeBenefitsPdf";
import { PdfPreviewModal } from "@/components/PdfPreviewModal";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface BenefitEmployeesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  benefitCode: BenefitCode;
  coverages: EmployeeBenefitCoverage[];
  isGovernment?: boolean;
  companyName?: string;
  onSwitchToFullReport?: () => void;
}

export default function BenefitEmployeesDialog({
  open,
  onOpenChange,
  benefitCode,
  coverages,
  isGovernment = false,
  companyName = "MEN2 MARKETING CORPORATION",
  onSwitchToFullReport,
}: BenefitEmployeesDialogProps) {
  const [search, setSearch] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState<string>("ALL");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | "ENROLLED" | "NOT_ENROLLED">("ALL");

  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [pdfBlob, setPdfBlob] = React.useState<Blob | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  // Reset filters on open or benefitCode change
  React.useEffect(() => {
    if (open) {
      setSearch("");
      setDeptFilter("ALL");
      setStatusFilter("ALL");
      setCurrentPage(1);
    }
  }, [open, benefitCode]);

  const sssName = isGovernment ? "GSIS" : "SSS";
  const benefitLabel =
    benefitCode === "SSS" ? sssName : benefitCode === "PHILHEALTH" ? "PhilHealth" : "Pag-IBIG";

  const getBenefitIcon = () => {
    if (benefitCode === "SSS") return <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    if (benefitCode === "PHILHEALTH") return <HeartPulse className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
    return <Landmark className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
  };

  const getThemeColor = () => {
    if (benefitCode === "SSS") return "blue";
    if (benefitCode === "PHILHEALTH") return "emerald";
    return "amber";
  };

  // Distinct departments
  const departments = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of coverages) {
      if (c.department_name) set.add(c.department_name);
    }
    return Array.from(set).sort();
  }, [coverages]);

  // Extract relevant benefit details per employee
  const employeeRows = React.useMemo(() => {
    return coverages.map((c) => {
      const detail =
        benefitCode === "SSS"
          ? c.sss
          : benefitCode === "PHILHEALTH"
          ? c.philhealth
          : c.pagibig;

      const activeLoan = c.loans.find((l) => l.benefit_code === benefitCode);

      const hasAmount = detail.personal_share > 0;
      const isRegistered = Boolean(detail.account_no);
      const isEnrolled = hasAmount || isRegistered;

      return {
        ...c,
        detail,
        activeLoan,
        hasAmount,
        isRegistered,
        isEnrolled,
      };
    });
  }, [coverages, benefitCode]);

  // Filtered rows
  const filtered = React.useMemo(() => {
    return employeeRows.filter((row) => {
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = row.employee_name.toLowerCase().includes(q);
        const matchId = String(row.user_id).includes(q);
        const matchAcc = (row.detail.account_no || "").toLowerCase().includes(q);
        const matchDept = (row.department_name || "").toLowerCase().includes(q);
        if (!matchName && !matchId && !matchAcc && !matchDept) return false;
      }

      // Dept filter
      if (deptFilter !== "ALL" && row.department_name !== deptFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === "ENROLLED" && !row.hasAmount) return false;
      if (statusFilter === "NOT_ENROLLED" && row.hasAmount) return false;

      return true;
    });
  }, [employeeRows, search, deptFilter, statusFilter]);

  // Totals for all employees in this benefit (unfiltered)
  const totalStats = React.useMemo(() => {
    let enrolledCount = 0;
    let sumPersonal = 0;
    let sumCounterpart = 0;
    let sumTotal = 0;

    for (const r of employeeRows) {
      if (r.hasAmount) {
        enrolledCount++;
        sumPersonal += r.detail.personal_share;
        sumCounterpart += r.detail.counterpart_share;
        sumTotal += r.detail.total_contribution;
      }
    }

    return {
      enrolledCount,
      totalHeadcount: employeeRows.length,
      sumPersonal,
      sumCounterpart,
      sumTotal,
    };
  }, [employeeRows]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Handle CSV Export
  const handleExportCsv = () => {
    const headers = [
      "Employee ID",
      "Employee Name",
      "Department",
      "Position",
      `${benefitLabel} Account Number`,
      "Personal Share (Employee Deduction)",
      `${isGovernment ? "LGU" : "Employer"} Counterpart Share`,
      "Total Monthly Contribution",
      "Active Loan",
      "Status",
    ];

    const rows = filtered.map((r) => [
      r.user_id,
      `"${r.employee_name}"`,
      `"${r.department_name}"`,
      `"${r.position || ""}"`,
      `"${r.detail.account_no || ""}"`,
      r.detail.personal_share.toFixed(2),
      r.detail.counterpart_share.toFixed(2),
      r.detail.total_contribution.toFixed(2),
      r.activeLoan ? `"₱${r.activeLoan.amortization_amount.toFixed(2)}/mo (${r.activeLoan.loan_name || "Loan"})"` : `"None"`,
      r.hasAmount ? "Enrolled with Amount" : r.isRegistered ? "Registered (₱0)" : "No Benefit",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${benefitLabel}_Employees_List.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle PDF Export
  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      const blob = await exportEmployeeBenefitsPdf({
        companyName,
        isGovernment,
        filterBenefit: benefitCode,
        filterStatus: statusFilter === "ENROLLED" ? "WITH_BENEFIT" : statusFilter === "NOT_ENROLLED" ? "WITHOUT_BENEFIT" : "ALL",
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden dark:bg-gray-900 dark:border-gray-800">
          {/* Header */}
          <DialogHeader className="p-5 pb-4 bg-slate-50 dark:bg-gray-800/60 border-b dark:border-gray-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-200 dark:border-gray-700">
                  {getBenefitIcon()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-lg font-bold text-slate-900 dark:text-gray-100">
                      {benefitLabel} Enrolled Employees &amp; Contributions
                    </DialogTitle>
                    <Badge variant="outline" className="font-semibold text-xs uppercase">
                      {benefitCode}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                    Talaan ng mga empleyado na may nakalaang halaga o account para sa {benefitLabel}.
                  </p>
                </div>
              </div>

              {onSwitchToFullReport && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 h-8 dark:border-gray-700"
                  onClick={() => {
                    onOpenChange(false);
                    onSwitchToFullReport();
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Full Report Tab
                </Button>
              )}
            </div>

            {/* Quick KPI summary banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
              <div className="bg-white dark:bg-gray-900/80 p-2.5 rounded-lg border border-slate-200/80 dark:border-gray-800 shadow-2xs">
                <div className="text-[11px] text-slate-500 dark:text-gray-400 font-medium">May Kontribusyon</div>
                <div className="text-base font-bold text-slate-900 dark:text-gray-100">
                  {totalStats.enrolledCount} <span className="text-xs font-normal text-slate-400">/ {totalStats.totalHeadcount}</span>
                </div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                  {totalStats.totalHeadcount > 0 ? Math.round((totalStats.enrolledCount / totalStats.totalHeadcount) * 100) : 0}% Coverage
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900/80 p-2.5 rounded-lg border border-slate-200/80 dark:border-gray-800 shadow-2xs">
                <div className="text-[11px] text-slate-500 dark:text-gray-400 font-medium">Personal Share (Bawas)</div>
                <div className="text-base font-bold text-blue-700 dark:text-blue-400">
                  ₱{formatMoney(totalStats.sumPersonal)}
                </div>
                <div className="text-[10px] text-slate-400">Buwanang kaltas</div>
              </div>

              <div className="bg-white dark:bg-gray-900/80 p-2.5 rounded-lg border border-slate-200/80 dark:border-gray-800 shadow-2xs">
                <div className="text-[11px] text-slate-500 dark:text-gray-400 font-medium">
                  {isGovernment ? "LGU Counterpart" : "Employer Share"}
                </div>
                <div className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                  ₱{formatMoney(totalStats.sumCounterpart)}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400">Sagot ng opisina</div>
              </div>

              <div className="bg-white dark:bg-gray-900/80 p-2.5 rounded-lg border border-slate-200/80 dark:border-gray-800 shadow-2xs">
                <div className="text-[11px] text-slate-500 dark:text-gray-400 font-medium">Kabuuang Hulog (Total)</div>
                <div className="text-base font-bold text-slate-900 dark:text-gray-100">
                  ₱{formatMoney(totalStats.sumTotal)}
                </div>
                <div className="text-[10px] text-slate-400">Monthly Remittance</div>
              </div>
            </div>
          </DialogHeader>

          {/* Filters & Actions Bar */}
          <div className="px-5 py-3 border-b dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-white dark:bg-gray-900">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search */}
              <div className="relative min-w-[200px] flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Hanapin ang empleyado o account no..."
                  className="pl-8 h-8 text-xs bg-slate-50 dark:bg-gray-800"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Status Select */}
              <Select
                value={statusFilter}
                onValueChange={(val: "ALL" | "ENROLLED" | "NOT_ENROLLED") => {
                  setStatusFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[170px] h-8 text-xs bg-slate-50 dark:bg-gray-800">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Lahat ({employeeRows.length})</SelectItem>
                  <SelectItem value="ENROLLED">May Halaga ({totalStats.enrolledCount})</SelectItem>
                  <SelectItem value="NOT_ENROLLED">Walang Halaga / ₱0 ({employeeRows.length - totalStats.enrolledCount})</SelectItem>
                </SelectContent>
              </Select>

              {/* Department Select */}
              <Select
                value={deptFilter}
                onValueChange={(val) => {
                  setDeptFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[160px] h-8 text-xs bg-slate-50 dark:bg-gray-800">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Export buttons */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 dark:border-gray-700"
                onClick={handleExportCsv}
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-8 text-xs gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white"
                onClick={handleExportPdf}
                disabled={isExporting}
              >
                <FileText className="h-3.5 w-3.5" />
                {isExporting ? "Generating..." : "PDF / Print"}
              </Button>
            </div>
          </div>

          {/* Table Container */}
          <ScrollArea className="flex-1 overflow-auto max-h-[50vh]">
            <Table>
              <TableHeader className="bg-slate-100/70 dark:bg-gray-800/80 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200">
                    Employee
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200">
                    Department
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200">
                    {benefitLabel} Account No.
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 text-right">
                    Personal Share (EE)
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 text-right">
                    {isGovernment ? "LGU Share" : "Employer Share (ER)"}
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 text-right">
                    Total Monthly
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200">
                    Loan Status
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-gray-200 text-center">
                    Coverage
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-36 text-center text-slate-500 dark:text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Users className="h-8 w-8 text-slate-300 dark:text-gray-600" />
                        <span className="text-sm font-medium">Walang nahanap na empleyado.</span>
                        <span className="text-xs text-slate-400">
                          Subukang baguhin ang iyong search o filters.
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow
                      key={row.user_id}
                      className="hover:bg-slate-50/60 dark:hover:bg-gray-800/40 text-xs"
                    >
                      {/* Name & ID */}
                      <TableCell className="py-2.5 font-medium">
                        <div className="font-semibold text-slate-900 dark:text-gray-100">
                          {row.employee_name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          ID: #{row.user_id} {row.position ? `• ${row.position}` : ""}
                        </div>
                      </TableCell>

                      {/* Department */}
                      <TableCell className="py-2.5 text-slate-600 dark:text-gray-300">
                        {row.department_name}
                      </TableCell>

                      {/* Account Number */}
                      <TableCell className="py-2.5 font-mono text-[11px]">
                        {row.detail.account_no ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-gray-200 border border-slate-200 dark:border-gray-700">
                            {row.detail.account_no}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Walang Account No.</span>
                        )}
                      </TableCell>

                      {/* Personal Share */}
                      <TableCell className="py-2.5 text-right font-medium">
                        {row.detail.personal_share > 0 ? (
                          <span className="text-blue-700 dark:text-blue-400 font-semibold">
                            ₱{formatMoney(row.detail.personal_share)}
                          </span>
                        ) : (
                          <span className="text-slate-400">₱0.00</span>
                        )}
                      </TableCell>

                      {/* Employer / LGU Counterpart */}
                      <TableCell className="py-2.5 text-right font-medium">
                        {row.detail.counterpart_share > 0 ? (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            ₱{formatMoney(row.detail.counterpart_share)}
                          </span>
                        ) : (
                          <span className="text-slate-400">₱0.00</span>
                        )}
                      </TableCell>

                      {/* Total Monthly */}
                      <TableCell className="py-2.5 text-right font-bold text-slate-900 dark:text-gray-100">
                        {row.detail.total_contribution > 0 ? (
                          <span>₱{formatMoney(row.detail.total_contribution)}</span>
                        ) : (
                          <span className="text-slate-400 font-normal">₱0.00</span>
                        )}
                      </TableCell>

                      {/* Active Loan */}
                      <TableCell className="py-2.5">
                        {row.activeLoan ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                          >
                            ₱{formatMoney(row.activeLoan.amortization_amount)}/mo ({row.activeLoan.loan_name || "Loan"})
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </TableCell>

                      {/* Coverage Status Badge */}
                      <TableCell className="py-2.5 text-center">
                        {row.hasAmount ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 text-[10px] font-semibold">
                            May Hulog
                          </Badge>
                        ) : row.isRegistered ? (
                          <Badge
                            variant="outline"
                            className="text-slate-600 dark:text-gray-400 border-slate-300 text-[10px]"
                          >
                            Walang Halaga (₱0)
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 text-[10px]"
                          >
                            Hindi Rehistrado
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Footer Pagination */}
          <DialogFooter className="p-3.5 bg-slate-50 dark:bg-gray-800/60 border-t dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-xs text-slate-500 dark:text-gray-400">
              Ipinapakita: <strong>{paginated.length}</strong> sa <strong>{filtered.length}</strong> na resulta
              {filtered.length !== employeeRows.length && (
                <span> (Sinala mula sa kabuuang {employeeRows.length})</span>
              )}
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
                Pahina {currentPage} ng {totalPages}
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Preview Modal */}
      {previewOpen && pdfBlob && (
        <PdfPreviewModal
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          pdfBlob={pdfBlob}
          title={`${benefitLabel} Enrolled Employees Report`}
          fileName={`${benefitLabel}-enrolled-employees-${new Date().toISOString().slice(0, 10)}.pdf`}
        />
      )}
    </>
  );
}
