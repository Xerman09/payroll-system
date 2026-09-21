// modules/unified/benefits-logs/UnifiedBenefitsLogsModule.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Layers, AlertTriangle, CheckCircle2, RefreshCcw, Building2 } from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import UnifiedLogsStats from "./components/UnifiedLogsStats";
import UnifiedLogsFilters from "./components/UnifiedLogsFilters";
import UnifiedLogsTable from "./components/UnifiedLogsTable";
import UnifiedSummaryDialog from "./components/UnifiedSummaryDialog";
import UnifiedExportPreviewDialog from "./components/UnifiedExportPreviewDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type {
  UnifiedBenefitLogRow,
  CompanySummary,
  BenefitCode,
  BenefitLogType,
  UnifiedApiResponse,
} from "./types";

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

export default function UnifiedBenefitsLogsModule() {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const [allRows, setAllRows] = React.useState<UnifiedBenefitLogRow[]>([]);
  const [companies, setCompanies] = React.useState<CompanySummary[]>([]);
  const [failedCompanies, setFailedCompanies] = React.useState<
    { id: string; name: string; error: string }[]
  >([]);

  // Filter States
  const [search, setSearch] = React.useState("");
  const [companyId, setCompanyId] = React.useState("ALL");
  const [cutoffRange, setCutoffRange] = React.useState("ALL");
  const [benefit, setBenefit] = React.useState<BenefitCode | "ALL">("ALL");
  const [type, setType] = React.useState<BenefitLogType | "ALL">("ALL");

  // Modal Dialogs
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);

  // Load aggregated benefit logs from API
  const loadData = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/unified/benefits-logs", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const json: UnifiedApiResponse = await res.json();
      if (!json.success) {
        throw new Error("Failed to load compiled benefits logs");
      }

      setAllRows(json.data || []);
      setCompanies(json.companies || []);
      setFailedCompanies(json.failedCompanies || []);

      if (isRefresh) {
        toast.success("Compiled benefits logs refreshed.");
      }
    } catch (err: any) {
      console.error("Failed to load compiled benefits logs:", err);
      toast.error(err.message || "Failed to load compiled benefits logs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side filtering
  const filteredRows = React.useMemo(() => {
    const query = search.trim().toLowerCase();

    return allRows.filter((r) => {
      // Company filter
      if (companyId !== "ALL" && r.company_id !== companyId) {
        return false;
      }

      // Cutoff filter
      if (cutoffRange !== "ALL") {
        const key = `${r.cutoff_start}_${r.cutoff_end}`;
        if (key !== cutoffRange) return false;
      }

      // Benefit Code filter
      if (benefit !== "ALL" && r.benefit_code !== benefit) {
        return false;
      }

      // Type filter
      if (type !== "ALL" && r.log_type !== type) {
        return false;
      }

      // Search query
      if (!query) return true;

      const employee = (r.employee_name || "").toLowerCase();
      const account = (r.account_no || "").toLowerCase();
      const ref = (r.payroll_ref_no || "").toLowerCase();
      const company = (r.company_name || "").toLowerCase();
      const note = (r.note || "").toLowerCase();

      return (
        employee.includes(query) ||
        account.includes(query) ||
        ref.includes(query) ||
        company.includes(query) ||
        note.includes(query) ||
        String(r.user_id).includes(query)
      );
    });
  }, [allRows, search, companyId, cutoffRange, benefit, type]);

  // Export CSV Handler
  const handleExportCsv = () => {
    if (filteredRows.length === 0) {
      toast.error("No data available to export.");
      return;
    }

    const headers = [
      "Company",
      "Employee Name",
      "Department",
      "Account Number",
      "Benefit Code",
      "Log Type",
      "Deducted Amount",
      "Payroll Ref",
      "Cutoff Start",
      "Cutoff End",
      "Posted Date",
    ];

    const csvLines = [headers.join(",")];

    for (const r of filteredRows) {
      const line = [
        `"${(r.company_name || "").replace(/"/g, '""')}"`,
        `"${(r.employee_name || "").replace(/"/g, '""')}"`,
        `"${(r.department_name || "").replace(/"/g, '""')}"`,
        `"${r.account_no || ""}"`,
        r.benefit_code,
        r.log_type,
        r.deducted_amount || 0,
        `"${r.payroll_ref_no || ""}"`,
        r.cutoff_start ? `"${formatDateSafe(r.cutoff_start)}"` : '""',
        r.cutoff_end ? `"${formatDateSafe(r.cutoff_end)}"` : '""',
        r.posted_at || r.created_date ? `"${formatDateSafe(r.posted_at || r.created_date)}"` : '""',
      ];
      csvLines.push(line.join(","));
    }

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `compiled-benefits-logs-${format(new Date(), "yyyyMMdd-HHmm")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV file downloaded successfully.");
  };

  const selectedCompanyObj = companies.find((c) => c.id === companyId);
  const companyLabel = selectedCompanyObj ? selectedCompanyObj.name : "All Companies";

  return (
    <DashboardLayout>
      <div className="space-y-5 p-4 sm:p-6 max-w-[1600px] mx-auto">
        {/* Module Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <Layers className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-gray-100">
                Unified Benefits Logs
              </h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
              Compiled statutory benefits records (SSS, PhilHealth, Pag-IBIG contributions & loans) across all enterprise companies configured in .env.local.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh All</span>
            </Button>
          </div>
        </div>

        {/* Failed Companies Warning Banner (if any) */}
        {failedCompanies.length > 0 && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-900/20 p-4 text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Notice:</span> Some company instances could not be reached ({failedCompanies.map((f) => f.name).join(", ")}). Available company records are displayed below.
              </div>
            </div>
          </div>
        )}

        {/* Enterprise Company Quick Selection Chips */}
        {companies.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-500 dark:text-gray-400 font-medium shrink-0 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> Filter Company:
            </span>
            <button
              onClick={() => setCompanyId("ALL")}
              className={`px-3 py-1.5 rounded-full font-medium transition-all shrink-0 ${
                companyId === "ALL"
                  ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20"
                  : "bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700"
              }`}
            >
              All Companies ({allRows.length})
            </button>
            {companies.map((c) => {
              const isSelected = companyId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCompanyId(c.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-all shrink-0 ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20"
                      : "bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span>{c.name}</span>
                  {c.logCount > 0 && (
                    <span className="text-[10px] opacity-80 font-mono">({c.logCount})</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Aggregate KPI Stats Cards */}
        <UnifiedLogsStats
          rows={filteredRows}
          companies={companies}
          loading={loading}
        />

        {/* Filter Controls Bar */}
        <UnifiedLogsFilters
          search={search}
          onSearchChange={setSearch}
          companyId={companyId}
          onCompanyChange={setCompanyId}
          cutoffRange={cutoffRange}
          onCutoffChange={setCutoffRange}
          benefit={benefit}
          onBenefitChange={setBenefit}
          type={type}
          onTypeChange={setType}
          companies={companies}
          rows={allRows}
          loading={loading}
          refreshing={refreshing}
          onRefresh={() => loadData(true)}
          onOpenSummary={() => setSummaryOpen(true)}
          onOpenExport={() => setExportOpen(true)}
          onExportCsv={handleExportCsv}
        />

        {/* Data Table */}
        <UnifiedLogsTable rows={filteredRows} loading={loading} />

        {/* Dialogs */}
        <UnifiedSummaryDialog
          open={summaryOpen}
          onOpenChange={setSummaryOpen}
          rows={filteredRows}
          companies={companies}
        />

        <UnifiedExportPreviewDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          rows={filteredRows}
          cutoffRange={cutoffRange}
          companyFilter={companyLabel}
          benefit={benefit}
          type={type}
          search={search}
        />
      </div>
    </DashboardLayout>
  );
}
