// modules/unified/benefits-logs/components/UnifiedLogsFilters.tsx
"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { RefreshCcw, FileDown, Sigma, Search, Filter, Building2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BenefitCode, BenefitLogType, CompanySummary, UnifiedBenefitLogRow } from "../types";

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

interface UnifiedLogsFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;

  companyId: string;
  onCompanyChange: (v: string) => void;

  cutoffRange: string;
  onCutoffChange: (v: string) => void;

  benefit: BenefitCode | "ALL";
  onBenefitChange: (v: BenefitCode | "ALL") => void;

  type: BenefitLogType | "ALL";
  onTypeChange: (v: BenefitLogType | "ALL") => void;

  companies: CompanySummary[];
  rows: UnifiedBenefitLogRow[];

  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenSummary: () => void;
  onOpenExport: () => void;
  onExportCsv: () => void;
}

export default function UnifiedLogsFilters({
  search,
  onSearchChange,
  companyId,
  onCompanyChange,
  cutoffRange,
  onCutoffChange,
  benefit,
  onBenefitChange,
  type,
  onTypeChange,
  companies,
  rows,
  loading,
  refreshing,
  onRefresh,
  onOpenSummary,
  onOpenExport,
  onExportCsv,
}: UnifiedLogsFiltersProps) {
  // Extract unique cutoff ranges from current rows
  const cutoffRanges = React.useMemo(() => {
    const uniqueMap = new Map<string, string>();
    for (const r of rows) {
      if (r.cutoff_start && r.cutoff_end) {
        const key = `${r.cutoff_start}_${r.cutoff_end}`;
        if (!uniqueMap.has(key)) {
          const label = `${formatDateSafe(r.cutoff_start)} – ${formatDateSafe(r.cutoff_end)}`;
          uniqueMap.set(key, label);
        }
      }
    }
    return Array.from(uniqueMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        {/* Filter Inputs */}
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {/* Search */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
              Search Record
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Employee, account, payroll ID..."
                className="h-9 pl-8 dark:bg-gray-800 dark:border-gray-700 text-sm"
              />
            </div>
          </div>

          {/* Company Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              Company Entity
            </label>
            <Select value={companyId} onValueChange={onCompanyChange}>
              <SelectTrigger className="h-9 dark:bg-gray-800 dark:border-gray-700">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Companies ({companies.length})</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      <span>{c.name}</span>
                      {c.logCount > 0 && (
                        <span className="text-xs text-slate-400 font-mono">({c.logCount})</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cutoff Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
              Cutoff Period
            </label>
            <Select value={cutoffRange} onValueChange={onCutoffChange}>
              <SelectTrigger className="h-9 dark:bg-gray-800 dark:border-gray-700">
                <SelectValue placeholder="All Cutoffs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Cutoffs</SelectItem>
                {cutoffRanges.map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Benefit Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
              Benefit Agency
            </label>
            <Select
              value={benefit}
              onValueChange={(v) => onBenefitChange(v as BenefitCode | "ALL")}
            >
              <SelectTrigger className="h-9 dark:bg-gray-800 dark:border-gray-700">
                <SelectValue placeholder="All Agencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Agencies</SelectItem>
                <SelectItem value="SSS">SSS / GSIS</SelectItem>
                <SelectItem value="PHILHEALTH">PhilHealth</SelectItem>
                <SelectItem value="PAGIBIG">Pag-IBIG</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Type Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
              Deduction Type
            </label>
            <Select
              value={type}
              onValueChange={(v) => onTypeChange(v as BenefitLogType | "ALL")}
            >
              <SelectTrigger className="h-9 dark:bg-gray-800 dark:border-gray-700">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="CONTRIBUTION">Contribution</SelectItem>
                <SelectItem value="LOAN">Loan Deduction</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={onOpenSummary}
          >
            <Sigma className="h-4 w-4 text-primary" />
            <span>Summary</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={onExportCsv}
            disabled={rows.length === 0}
          >
            <Download className="h-4 w-4" />
            <span>CSV</span>
          </Button>

          <Button
            size="sm"
            className="h-9 gap-1.5 bg-primary hover:bg-primary/90"
            onClick={onOpenExport}
            disabled={loading || rows.length === 0}
          >
            <FileDown className="h-4 w-4" />
            <span>Export PDF</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
