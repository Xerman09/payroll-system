// modules/unified/payroll-status/components/StatusFilters.tsx
"use client";

import * as React from "react";
import { Search, RefreshCcw, Download, Filter, Calendar } from "lucide-react";
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
import type { CompanyPayrollStatusType, AvailableCutoffOption, OverallPayrollStatus } from "../types";

interface StatusFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: CompanyPayrollStatusType | "ALL";
  onStatusFilterChange: (status: CompanyPayrollStatusType | "ALL") => void;
  selectedCutoff: string;
  onCutoffChange: (cutoffKey: string) => void;
  availableCutoffs: AvailableCutoffOption[];
  overall: OverallPayrollStatus;
  refreshing: boolean;
  onRefresh: () => void;
  onExportCsv: () => void;
}

export default function StatusFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  selectedCutoff,
  onCutoffChange,
  availableCutoffs,
  overall,
  refreshing,
  onRefresh,
  onExportCsv,
}: StatusFiltersProps) {
  const {
    total_companies,
    completed_companies,
    in_progress_companies,
    pending_companies,
    offline_companies,
  } = overall;

  const filterTabs: Array<{
    id: CompanyPayrollStatusType | "ALL";
    label: string;
    count: number;
    color?: string;
  }> = [
    { id: "ALL", label: "All Companies", count: total_companies },
    {
      id: "COMPLETED",
      label: "Completed",
      count: completed_companies,
      color: "text-emerald-700 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/20",
    },
    {
      id: "IN_PROGRESS",
      label: "In Progress",
      count: in_progress_companies,
      color: "text-blue-700 bg-blue-500/10 dark:text-blue-400 dark:bg-blue-500/20",
    },
    {
      id: "PENDING",
      label: "Pending",
      count: pending_companies,
      color: "text-amber-700 bg-amber-500/10 dark:text-amber-400 dark:bg-amber-500/20",
    },
    ...(offline_companies > 0
      ? [
          {
            id: "OFFLINE" as const,
            label: "Offline",
            count: offline_companies,
            color: "text-rose-700 bg-rose-500/10 dark:text-rose-400 dark:bg-rose-500/20",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-3">
      {/* Top Filter Controls Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search company name, entity ID, or description..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-xs bg-white dark:bg-gray-900 shadow-sm rounded-xl border-slate-200/80 dark:border-gray-800"
          />
        </div>

        {/* Right Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Cutoff Selector */}
          {availableCutoffs.length > 0 && (
            <div className="w-56">
              <Select value={selectedCutoff} onValueChange={onCutoffChange}>
                <SelectTrigger className="h-9 text-xs bg-white dark:bg-gray-900 shadow-sm rounded-xl border-slate-200/80 dark:border-gray-800">
                  <Calendar className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                  <SelectValue placeholder="Select Cutoff Window" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="CURRENT" className="text-xs font-semibold">
                    ⭐ Current Active Cutoff
                  </SelectItem>
                  {availableCutoffs.map((c) => (
                    <SelectItem key={c.key} value={c.key} className="text-xs">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Export to CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            className="h-9 text-xs rounded-xl shadow-sm border-slate-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 gap-1.5 hover:bg-slate-50 dark:hover:bg-gray-800"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-9 text-xs rounded-xl shadow-sm border-slate-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 gap-1.5 hover:bg-slate-50 dark:hover:bg-gray-800"
          >
            <RefreshCcw
              className={`h-3.5 w-3.5 text-slate-500 ${refreshing ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter Tabs / Pills */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {filterTabs.map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onStatusFilterChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                  : "bg-white text-slate-600 hover:bg-slate-100/80 border border-slate-200/70 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800 dark:hover:bg-gray-800"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-2xs font-semibold ${
                  isActive
                    ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                    : tab.color || "bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
