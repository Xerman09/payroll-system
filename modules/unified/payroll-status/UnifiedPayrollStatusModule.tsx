// modules/unified/payroll-status/UnifiedPayrollStatusModule.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  Layers,
  Building2,
  RefreshCcw,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import OverallStatusBanner from "./components/OverallStatusBanner";
import StatusFilters from "./components/StatusFilters";
import CompanyPayrollStatusTable from "./components/CompanyPayrollStatusTable";
import DepartmentBreakdownModal from "./components/DepartmentBreakdownModal";

import type {
  CompanyPayrollStatus,
  OverallPayrollStatus,
  AvailableCutoffOption,
  CompanyPayrollStatusType,
  UnifiedPayrollStatusApiResponse,
} from "./types";

const initialOverall: OverallPayrollStatus = {
  total_companies: 0,
  online_companies: 0,
  completed_companies: 0,
  in_progress_companies: 0,
  pending_companies: 0,
  offline_companies: 0,
  overall_percentage: 0,
  total_enterprise_gross: 0,
  total_enterprise_net: 0,
  total_enterprise_deductions: 0,
  total_enterprise_headcount: 0,
  overall_status_label: "PENDING",
  cutoff_label: "Loading Cutoff...",
};

function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d =
      typeof dateStr === "string" && dateStr.includes("T")
        ? parseISO(dateStr)
        : new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return format(d, "MMM dd, yyyy");
  } catch {
    return String(dateStr);
  }
}

export default function UnifiedPayrollStatusModule() {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const [companies, setCompanies] = React.useState<CompanyPayrollStatus[]>([]);
  const [overall, setOverall] = React.useState<OverallPayrollStatus>(initialOverall);
  const [availableCutoffs, setAvailableCutoffs] = React.useState<AvailableCutoffOption[]>([]);

  // Filter States
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<CompanyPayrollStatusType | "ALL">("ALL");
  const [selectedCutoff, setSelectedCutoff] = React.useState<string>("CURRENT");

  // Detail Modal State
  const [selectedCompany, setSelectedCompany] = React.useState<CompanyPayrollStatus | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  // Fetch data from API
  const loadData = React.useCallback(
    async (isRefresh = false, cutoffKey?: string) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const queryCutoff = cutoffKey ?? selectedCutoff;
        const url = `/api/unified/payroll-status?cutoff=${encodeURIComponent(queryCutoff)}`;

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }

        const json: UnifiedPayrollStatusApiResponse = await res.json();
        if (!json.success) {
          throw new Error(json.error || "Failed to load company payroll statuses");
        }

        setCompanies(json.data || []);
        setOverall(json.overall || initialOverall);
        setAvailableCutoffs(json.available_cutoffs || []);

        if (isRefresh) {
          toast.success("Payroll statuses refreshed successfully.");
        }
      } catch (err: any) {
        console.error("Error loading payroll statuses:", err);
        toast.error(err.message || "Failed to load payroll statuses.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedCutoff]
  );

  React.useEffect(() => {
    loadData(false, selectedCutoff);
  }, [selectedCutoff]);

  const handleCutoffChange = (newCutoff: string) => {
    setSelectedCutoff(newCutoff);
  };

  // Filtered companies based on search and status tabs
  const filteredCompanies = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return companies.filter((c) => {
      // Status filter
      if (statusFilter !== "ALL") {
        if (c.status !== statusFilter) return false;
      }

      // Search filter
      if (q) {
        const matchName = c.company_name.toLowerCase().includes(q);
        const matchId = c.company_id.toLowerCase().includes(q);
        const matchDesc = c.company_description?.toLowerCase().includes(q);
        const matchDept = c.departments_detail.some((d) =>
          d.name.toLowerCase().includes(q)
        );
        if (!matchName && !matchId && !matchDesc && !matchDept) return false;
      }

      return true;
    });
  }, [companies, statusFilter, search]);

  const handleSelectCompany = (c: CompanyPayrollStatus) => {
    setSelectedCompany(c);
    setModalOpen(true);
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (companies.length === 0) {
      toast.error("No company records to export.");
      return;
    }

    try {
      const headers = [
        "Company ID",
        "Company Name",
        "Status",
        "Cutoff Period",
        "Payout Date",
        "Completed Departments",
        "Total Departments",
        "Completion %",
        "Employees Processed",
        "Net Disbursed (PHP)",
        "Gross Pay (PHP)",
      ];

      const csvRows = [headers.join(",")];

      filteredCompanies.forEach((c) => {
        const cutoffPeriod = c.current_cutoff
          ? `${c.current_cutoff.start_date || ""} to ${c.current_cutoff.end_date || ""}`
          : "N/A";
        const payoutDate = c.current_cutoff?.payout_date || "N/A";

        const row = [
          `"${c.company_id}"`,
          `"${c.company_name.replace(/"/g, '""')}"`,
          `"${c.status}"`,
          `"${cutoffPeriod}"`,
          `"${payoutDate}"`,
          c.departments_completed,
          c.departments_total,
          `${c.progress_percentage}%`,
          c.financials.headcount,
          c.financials.total_net.toFixed(2),
          c.financials.total_gross.toFixed(2),
        ];

        csvRows.push(row.join(","));
      });

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
      const link = document.createElement("a");
      link.setAttribute("href", csvContent);
      link.setAttribute(
        "download",
        `enterprise-payroll-status-${format(new Date(), "yyyyMMdd-HHmm")}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Exported payroll status CSV successfully.");
    } catch (err: any) {
      toast.error("Failed to generate CSV export: " + err.message);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Page Title & Breadcrumb header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
              <span>Unified Reports</span>
              <span>/</span>
              <span className="font-semibold text-slate-700 dark:text-gray-200">
                Company Payroll Status
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-gray-100 sm:text-3xl">
              Company Payroll Status
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
              Monitor real-time payroll completion status, approval stages, and disbursement totals across all enterprise business units.
            </p>
          </div>
        </div>

        {/* Overall Status Banner */}
        <OverallStatusBanner overall={overall} loading={loading} />

        {/* Filter & Control Bar */}
        <StatusFilters
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          selectedCutoff={selectedCutoff}
          onCutoffChange={handleCutoffChange}
          availableCutoffs={availableCutoffs}
          overall={overall}
          refreshing={refreshing}
          onRefresh={() => loadData(true)}
          onExportCsv={handleExportCsv}
        />

        {/* Main Company Status Table */}
        <CompanyPayrollStatusTable
          companies={filteredCompanies}
          onSelectCompany={handleSelectCompany}
          loading={loading}
        />

        {/* Department Breakdown Modal */}
        <DepartmentBreakdownModal
          company={selectedCompany}
          open={modalOpen}
          onOpenChange={setModalOpen}
        />
      </div>
    </DashboardLayout>
  );
}
