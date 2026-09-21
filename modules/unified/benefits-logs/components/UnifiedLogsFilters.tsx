// modules/unified/benefits-logs/components/UnifiedLogsFilters.tsx
"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import {
  RefreshCcw,
  FileDown,
  Sigma,
  Search,
  Building2,
  Download,
  ChevronDown,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

  selectedCompanyIds: string[];
  onSelectedCompaniesChange: (ids: string[]) => void;

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
  selectedCompanyIds,
  onSelectedCompaniesChange,
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
  const [companySearch, setCompanySearch] = React.useState("");
  const [companyPopoverOpen, setCompanyPopoverOpen] = React.useState(false);

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

  // Filtered companies inside popover
  const filteredCompanies = React.useMemo(() => {
    if (!companySearch.trim()) return companies;
    const q = companySearch.trim().toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, companySearch]);

  const allSelected =
    companies.length > 0 && selectedCompanyIds.length === companies.length;

  const toggleCompany = (id: string) => {
    if (selectedCompanyIds.includes(id)) {
      onSelectedCompaniesChange(selectedCompanyIds.filter((x) => x !== id));
    } else {
      onSelectedCompaniesChange([...selectedCompanyIds, id]);
    }
  };

  const selectAll = () => {
    onSelectedCompaniesChange(companies.map((c) => c.id));
  };

  const clearAll = () => {
    onSelectedCompaniesChange([]);
  };

  const selectOnly = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectedCompaniesChange([id]);
  };

  // Label for trigger button
  const triggerLabel = React.useMemo(() => {
    if (companies.length === 0) return "Loading companies...";
    if (allSelected) return `All Companies (${companies.length})`;
    if (selectedCompanyIds.length === 0) return "None Selected (0)";
    if (selectedCompanyIds.length === 1) {
      const found = companies.find((c) => c.id === selectedCompanyIds[0]);
      return found ? found.name : "1 Company";
    }
    return `${selectedCompanyIds.length} of ${companies.length} Companies`;
  }, [allSelected, selectedCompanyIds, companies]);

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

          {/* Included Companies Dropdown (Multi-Select) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                Included Companies
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {selectedCompanyIds.length}/{companies.length}
              </span>
            </label>

            <Popover open={companyPopoverOpen} onOpenChange={setCompanyPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="h-9 w-full justify-between px-3 text-xs font-normal border-slate-200 dark:border-gray-700 dark:bg-gray-800"
                >
                  <span className="truncate text-left font-medium text-slate-800 dark:text-gray-200">
                    {triggerLabel}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-80 p-3" align="start">
                <div className="space-y-2.5">
                  {/* Header Actions */}
                  <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-gray-800">
                    <span className="text-xs font-bold text-slate-900 dark:text-gray-100">
                      Select Companies
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] text-primary"
                        onClick={selectAll}
                      >
                        Select All
                      </Button>
                      <span className="text-slate-300 dark:text-gray-700">|</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] text-slate-500"
                        onClick={clearAll}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  {/* Search inside Dropdown */}
                  {companies.length > 5 && (
                    <div className="relative">
                      <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        value={companySearch}
                        onChange={(e) => setCompanySearch(e.target.value)}
                        placeholder="Search companies..."
                        className="h-7 pl-7 text-xs"
                      />
                    </div>
                  )}

                  {/* Scrollable Company Checklist */}
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                    {filteredCompanies.map((c) => {
                      const isChecked = selectedCompanyIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleCompany(c.id)}
                          className="group flex items-center justify-between p-1.5 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-1">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleCompany(c.id)}
                              className="data-[state=checked]:bg-primary"
                            />
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: c.color }}
                            />
                            <span
                              className={`truncate ${
                                isChecked
                                  ? "font-semibold text-slate-900 dark:text-gray-100"
                                  : "text-slate-600 dark:text-gray-400"
                              }`}
                            >
                              {c.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {c.logCount > 0 && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {c.logCount}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => selectOnly(c.id, e)}
                              className="opacity-0 group-hover:opacity-100 text-[10px] text-primary hover:underline px-1 py-0.5 rounded transition-opacity"
                            >
                              Only
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {filteredCompanies.length === 0 && (
                      <div className="text-center py-4 text-xs text-slate-400">
                        No companies found.
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
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
