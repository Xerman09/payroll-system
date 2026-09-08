// modules/lgu-payroll-run/components/LguPayrollConfigStep.tsx
"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import { Calendar, Building2, FileText, ArrowRight, Landmark, Info, Shield, HeartPulse } from "lucide-react";
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
      <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/90 via-sky-50/70 to-indigo-50/60 dark:from-blue-950/40 dark:via-sky-950/30 dark:to-indigo-950/20 p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-600 text-white shadow-sm">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-blue-950 dark:text-blue-100">
                LGU / Public Sector Payroll Run
              </h2>
              <Badge className="bg-blue-600 text-white text-[10px] font-semibold">
                Government Standard
              </Badge>
            </div>
            <p className="text-xs text-blue-800/80 dark:text-blue-300">
              Sa LGU / government, hati ang government sa hulog ng mga kawani.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
          <div className="bg-white/80 dark:bg-gray-900/80 p-3 rounded-lg border border-blue-200/60 dark:border-gray-800">
            <div className="font-bold text-blue-950 dark:text-blue-200 flex items-center justify-between">
              <span>GSIS (Kapalit ng SSS)</span>
              <span className="text-[11px] font-mono font-bold text-blue-600">21%</span>
            </div>
            <div className="text-slate-600 dark:text-gray-300 text-[11px] mt-1">
              Personal: <strong>9%</strong> (Bawas agad)
            </div>
            <div className="text-emerald-700 dark:text-emerald-400 text-[11px] font-medium">
              LGU Share: <strong>12%</strong>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-gray-900/80 p-3 rounded-lg border border-emerald-200/60 dark:border-gray-800">
            <div className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center justify-between">
              <span>PhilHealth (UHC)</span>
              <span className="text-[11px] font-mono font-bold text-emerald-600">5%</span>
            </div>
            <div className="text-slate-600 dark:text-gray-300 text-[11px] mt-1">
              Personal: <strong>2.5%</strong> | LGU: <strong>2.5%</strong>
            </div>
            <div className="text-slate-500 dark:text-gray-400 text-[10px]">
              50/50 Hati (₱10,000 - ₱100,000 cap)
            </div>
          </div>

          <div className="bg-white/80 dark:bg-gray-900/80 p-3 rounded-lg border border-amber-200/60 dark:border-gray-800">
            <div className="font-bold text-amber-950 dark:text-amber-200 flex items-center justify-between">
              <span>Pag-IBIG Fund</span>
              <span className="text-[11px] font-mono font-bold text-amber-600">₱200</span>
            </div>
            <div className="text-slate-600 dark:text-gray-300 text-[11px] mt-1">
              Personal: <strong>₱200</strong> | LGU: <strong>₱200</strong>
            </div>
            <div className="text-slate-500 dark:text-gray-400 text-[10px]">
              Alinsunod sa DBM Circular
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Card */}
      <Card className="border-slate-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
        <CardHeader className="pb-4 border-b border-slate-100 dark:border-gray-800">
          <CardTitle className="text-base font-bold text-slate-900 dark:text-gray-100">
            Pumili ng Cutoff at Tanggapan (Office)
          </CardTitle>
          <CardDescription className="text-xs">
            Itakda ang panahon ng payroll at kung aling tanggapan o departamento ang ipoproseso.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Cutoff Period */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span>Panahon ng Cutoff (Pay Period) *</span>
              </Label>
              <Select
                value={config.cutoffId ? String(config.cutoffId) : ""}
                onValueChange={handleCutoffChange}
              >
                <SelectTrigger className="w-full h-10 text-xs">
                  <SelectValue placeholder="Pumili ng Cutoff..." />
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
                  <span className="text-slate-500">Saklaw na Petsa:</span>
                  <span className="font-semibold text-slate-800 dark:text-gray-200">
                    {formatDateSafe(selectedCutoff.start_date)} hanggang {formatDateSafe(selectedCutoff.end_date)}
                  </span>
                </div>
              )}
            </div>

            {/* Department / Office */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span>Tanggapan / Departamento (Office)</span>
              </Label>
              <Select
                value={config.departmentId ? String(config.departmentId) : "ALL"}
                onValueChange={handleDeptChange}
              >
                <SelectTrigger className="w-full h-10 text-xs">
                  <SelectValue placeholder="Lahat ng Tanggapan (All Offices)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Lahat ng Tanggapan (All LGU Offices)</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.department_id} value={String(d.department_id)}>
                      {d.department_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400">
                Piliin ang partikular na tanggapan (hal. Treasury, Mayor&apos;s Office) o Lahat para sa consolidated roll.
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
                Puna o Tala (Remarks)
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
              <span>Magpatuloy sa Kalkulasyon (Compute)</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
