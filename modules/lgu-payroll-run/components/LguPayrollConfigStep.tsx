// modules/lgu-payroll-run/components/LguPayrollConfigStep.tsx
"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import { Calendar, Building2, FileText, ArrowRight, Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CutoffSetting, Department, LguPayrollConfigState } from "../types";

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

interface LguPayrollConfigStepProps {
  cutoffs: CutoffSetting[];
  departments: Department[];
  config: LguPayrollConfigState;
  onChange: (cfg: LguPayrollConfigState) => void;
  onProceed: () => void;
  loading?: boolean;
}

export default function LguPayrollConfigStep({
  cutoffs,
  departments,
  config,
  onChange,
  onProceed,
  loading = false,
}: LguPayrollConfigStepProps) {
  const selectedCutoff = cutoffs.find((c) => c.id === config.cutoffId);

  // Auto-generate reference when cutoff changes if empty
  const handleCutoffChange = (idStr: string) => {
    const id = parseInt(idStr, 10);
    const match = cutoffs.find((c) => c.id === id);
    let ref = config.payrollRefNo;
    if (match) {
      const year = match.start_date ? match.start_date.substring(0, 4) : "2026";
      const month = match.start_date ? match.start_date.substring(5, 7) : "09";
      ref = `LGU-PR-${year}-${month}-${match.cutoff_type}`;
    }
    onChange({
      ...config,
      cutoffId: id,
      payrollRefNo: ref,
    });
  };

  const handleDeptChange = (deptStr: string) => {
    onChange({
      ...config,
      departmentId: deptStr === "ALL" ? null : parseInt(deptStr, 10),
    });
  };

  const isValid = Boolean(config.cutoffId);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* LGU Policy Banner */}
      <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/90 via-sky-50/70 to-indigo-50/60 dark:from-blue-950/40 dark:via-sky-950/30 dark:to-indigo-950/20 p-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-lg bg-blue-600 text-white shadow-sm">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-blue-950 dark:text-blue-100">
                LGU / Public Sector Payroll Run Configuration
              </h2>
              <Badge className="bg-blue-600 text-white text-[10px] font-semibold">
                Government Standard
              </Badge>
            </div>
            <p className="text-xs text-blue-800/80 dark:text-blue-300">
              Compliant with Civil Service Commission (CSC), GSIS RA 8291, PhilHealth RA 11223, and DBM PERA guidelines.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
          <div className="bg-white/80 dark:bg-gray-900/80 p-3 rounded-lg border border-blue-200/60 dark:border-gray-800 shadow-2xs">
            <div className="font-bold text-blue-950 dark:text-blue-200 flex items-center justify-between">
              <span>GSIS Life &amp; Retirement</span>
              <span className="text-[11px] font-mono font-bold text-blue-600">21% Total</span>
            </div>
            <div className="text-slate-600 dark:text-gray-300 text-[11px] mt-1">
              Personal: <strong>9%</strong> (Employee Share)
            </div>
            <div className="text-emerald-700 dark:text-emerald-400 text-[11px] font-medium">
              LGU Share: <strong>12%</strong> (Government Counterpart)
            </div>
          </div>

          <div className="bg-white/80 dark:bg-gray-900/80 p-3 rounded-lg border border-emerald-200/60 dark:border-gray-800 shadow-2xs">
            <div className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center justify-between">
              <span>PhilHealth (UHC Law)</span>
              <span className="text-[11px] font-mono font-bold text-emerald-600">5% Total</span>
            </div>
            <div className="text-slate-600 dark:text-gray-300 text-[11px] mt-1">
              Personal: <strong>2.5%</strong> | LGU: <strong>2.5%</strong>
            </div>
            <div className="text-slate-500 dark:text-gray-400 text-[10px]">
              50/50 Equal Cost Sharing (₱10k - ₱100k cap)
            </div>
          </div>

          <div className="bg-white/80 dark:bg-gray-900/80 p-3 rounded-lg border border-amber-200/60 dark:border-gray-800 shadow-2xs">
            <div className="font-bold text-amber-950 dark:text-amber-200 flex items-center justify-between">
              <span>Pag-IBIG Fund (HDMF)</span>
              <span className="text-[11px] font-mono font-bold text-amber-600">₱400 Total</span>
            </div>
            <div className="text-slate-600 dark:text-gray-300 text-[11px] mt-1">
              Personal: <strong>₱200</strong> | LGU: <strong>₱200</strong>
            </div>
            <div className="text-slate-500 dark:text-gray-400 text-[10px]">
              DBM Circular Standard Share
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Card */}
      <Card className="border-slate-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
        <CardHeader className="pb-4 border-b border-slate-100 dark:border-gray-800">
          <CardTitle className="text-base font-bold text-slate-900 dark:text-gray-100">
            Select Pay Period &amp; Department Scope
          </CardTitle>
          <CardDescription className="text-xs">
            Set the cutoff period and filter by department or select All Departments for a consolidated payroll roll.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Cutoff Period */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span>Cutoff Period (Pay Period) *</span>
              </Label>
              <Select
                value={config.cutoffId ? String(config.cutoffId) : ""}
                onValueChange={handleCutoffChange}
              >
                <SelectTrigger className="w-full h-10 text-xs">
                  <SelectValue placeholder="Select Cutoff Period..." />
                </SelectTrigger>
                <SelectContent>
                  {cutoffs.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.cutoff_type} Cutoff: {formatDateSafe(c.start_date)} - {formatDateSafe(c.end_date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedCutoff && (
                <div className="p-2.5 rounded-md bg-slate-50 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-700 text-xs flex justify-between">
                  <span className="text-slate-500">Date Window:</span>
                  <span className="font-semibold text-slate-800 dark:text-gray-200">
                    {formatDateSafe(selectedCutoff.start_date)} to {formatDateSafe(selectedCutoff.end_date)}
                  </span>
                </div>
              )}
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span>Department / Office Scope</span>
              </Label>
              <Select
                value={config.departmentId ? String(config.departmentId) : "ALL"}
                onValueChange={handleDeptChange}
              >
                <SelectTrigger className="w-full h-10 text-xs">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Departments (Consolidated Roll)</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.department_id} value={String(d.department_id)}>
                      {d.department_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400">
                Choose a specific office or select All Departments for the complete municipal/city payroll.
              </p>
            </div>
          </div>

          {/* Reference Number & Remarks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-slate-500" />
                <span>Payroll Reference No.</span>
              </Label>
              <Input
                value={config.payrollRefNo}
                onChange={(e) => onChange({ ...config, payrollRefNo: e.target.value })}
                placeholder="LGU-PR-2026-09-1ST"
                className="h-10 text-xs font-mono font-semibold"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                Remarks / Purpose
              </Label>
              <Input
                value={config.remarks}
                onChange={(e) => onChange({ ...config, remarks: e.target.value })}
                placeholder="Regular LGU Personnel Payroll Run"
                className="h-10 text-xs"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end border-t border-slate-100 dark:border-gray-800">
            <Button
              onClick={onProceed}
              disabled={!isValid || loading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-6 h-10 flex items-center gap-2"
            >
              <span>Proceed to Compute &amp; Adjustments</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
