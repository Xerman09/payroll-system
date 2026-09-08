// modules/benefit-settings/components/government/GovernmentBenefitCards.tsx
"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Shield, HeartPulse, Landmark, User, Clock, CheckCircle2, Info } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BenefitSetting, BenefitCode } from "../../types";

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

interface GovernmentBenefitCardsProps {
  settings: Record<BenefitCode, BenefitSetting>;
  getUserName: (id: number | null) => string;
  onCutoff: (code: BenefitCode, val: BenefitSetting["cutoff"]) => void;
  isReadOnly?: boolean;
}

export default function GovernmentBenefitCards({
  settings,
  getUserName,
  onCutoff,
  isReadOnly = false,
}: GovernmentBenefitCardsProps) {
  const gsisSetting = settings.SSS; // GSIS maps to SSS slot in database
  const philhealthSetting = settings.PHILHEALTH;
  const pagibigSetting = settings.PAGIBIG;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* 1. GSIS CARD */}
      <Card className="flex flex-col border-blue-200/80 dark:border-blue-900/50 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-b from-blue-50/40 to-white dark:from-blue-950/20 dark:to-gray-900">
        <CardHeader className="pb-3 border-b border-blue-100 dark:border-blue-900/40">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-600 text-white shadow-sm">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-gray-100">
                  GSIS
                </CardTitle>
                <div className="text-xs text-blue-700 dark:text-blue-400 font-medium">
                  Gov&apos;t Service Insurance System
                </div>
              </div>
            </div>
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 hover:bg-blue-200 border-blue-300">
              Kapalit ng SSS
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-4 pt-4 text-sm">
          {/* Contribution Rate Overview */}
          <div className="rounded-lg bg-blue-50/80 dark:bg-blue-950/40 p-3 border border-blue-200/60 dark:border-blue-900/40 space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-blue-950 dark:text-blue-200 pb-1 border-b border-blue-200/50 dark:border-blue-900/40">
              <span>Total Contribution</span>
              <span className="text-sm font-bold text-blue-700 dark:text-blue-300">21% of Salary</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded border border-blue-100 dark:border-gray-700">
                <div className="text-slate-500 dark:text-gray-400 font-medium">Personal Share (Ikaw)</div>
                <div className="text-base font-bold text-blue-700 dark:text-blue-300">9%</div>
                <div className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">
                  Bawas agad sa payslip
                </div>
              </div>
              <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded border border-blue-100 dark:border-gray-700">
                <div className="text-slate-500 dark:text-gray-400 font-medium">LGU Share (Gov&apos;t)</div>
                <div className="text-base font-bold text-emerald-700 dark:text-emerald-400">12%</div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                  LGU ang magbabayad
                </div>
              </div>
            </div>
          </div>

          {/* Example Calculation Box */}
          <div className="rounded-md bg-slate-50 dark:bg-gray-800/50 p-2.5 border border-slate-200 dark:border-gray-700 text-xs space-y-1">
            <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-gray-300">
              <Info className="h-3.5 w-3.5 text-blue-600" />
              <span>Halimbawa: Sahod ₱25,000</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-gray-300 pt-1">
              <span>Ikaw (9%): <strong className="text-blue-700 dark:text-blue-400">₱2,250.00</strong></span>
              <span>LGU (12%): <strong className="text-emerald-700 dark:text-emerald-400">₱3,000.00</strong></span>
            </div>
            <div className="text-right text-[11px] font-semibold text-slate-500 dark:text-gray-400">
              Total Remittance = ₱5,250.00
            </div>
          </div>

          {/* Cutoff Setting */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
              Deduction Cutoff Schedule
            </Label>
            <Select
              disabled={isReadOnly}
              value={gsisSetting?.cutoff || "NONE"}
              onValueChange={(val) =>
                onCutoff("SSS", val === "NONE" ? null : (val as BenefitSetting["cutoff"]))
              }
            >
              <SelectTrigger className="w-full h-9 text-xs bg-white dark:bg-gray-800">
                <SelectValue placeholder="Select Cutoff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">None / Disabled</SelectItem>
                <SelectItem value="FIRST">First Cutoff (1st Half)</SelectItem>
                <SelectItem value="SECOND">Second Cutoff (2nd Half)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Effectivity Period */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Effective From</span>
              <Input
                readOnly
                value={formatDateSafe(gsisSetting?.effective_from)}
                className="h-8 text-xs bg-slate-100 dark:bg-gray-800 border-none cursor-default font-medium"
              />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Effective To</span>
              <Input
                readOnly
                value={formatDateSafe(gsisSetting?.effective_to)}
                className="h-8 text-xs bg-slate-100 dark:bg-gray-800 border-none cursor-default font-medium"
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-2 pb-2.5 bg-blue-50/50 dark:bg-blue-950/20 border-t border-blue-100 dark:border-blue-900/40 text-[11px] text-slate-500 dark:text-gray-400 flex items-center justify-between">
          <div className="flex items-center gap-1 truncate">
            <User className="h-3 w-3 text-slate-400" />
            <span>Updated: {getUserName(gsisSetting?.updated_by)}</span>
          </div>
          <span>{formatDateSafe(gsisSetting?.updated_date)}</span>
        </CardFooter>
      </Card>

      {/* 2. PHILHEALTH CARD */}
      <Card className="flex flex-col border-emerald-200/80 dark:border-emerald-900/50 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-b from-emerald-50/40 to-white dark:from-emerald-950/20 dark:to-gray-900">
        <CardHeader className="pb-3 border-b border-emerald-100 dark:border-emerald-900/40">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-sm">
                <HeartPulse className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-gray-100">
                  PhilHealth
                </CardTitle>
                <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  Philippine Health Insurance
                </div>
              </div>
            </div>
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 hover:bg-emerald-200 border-emerald-300">
              50 / 50 Hati
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-4 pt-4 text-sm">
          {/* Contribution Rate Overview */}
          <div className="rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 p-3 border border-emerald-200/60 dark:border-emerald-900/40 space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-emerald-950 dark:text-emerald-200 pb-1 border-b border-emerald-200/50 dark:border-emerald-900/40">
              <span>Total Contribution</span>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">5% of Salary</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded border border-emerald-100 dark:border-gray-700">
                <div className="text-slate-500 dark:text-gray-400 font-medium">Personal Share</div>
                <div className="text-base font-bold text-emerald-700 dark:text-emerald-300">2.5%</div>
                <div className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">
                  Bawas sa payslip
                </div>
              </div>
              <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded border border-emerald-100 dark:border-gray-700">
                <div className="text-slate-500 dark:text-gray-400 font-medium">Government Share</div>
                <div className="text-base font-bold text-emerald-700 dark:text-emerald-400">2.5%</div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                  LGU counterpart
                </div>
              </div>
            </div>
            <div className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 pt-0.5 font-medium">
              Bracket: ₱10,000 (floor) hanggang ₱100,000 (ceiling)
            </div>
          </div>

          {/* Example Calculation Box */}
          <div className="rounded-md bg-slate-50 dark:bg-gray-800/50 p-2.5 border border-slate-200 dark:border-gray-700 text-xs space-y-1">
            <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-gray-300">
              <Info className="h-3.5 w-3.5 text-emerald-600" />
              <span>Halimbawa: Sahod ₱25,000</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-gray-300 pt-1">
              <span>Ikaw (2.5%): <strong className="text-emerald-700 dark:text-emerald-400">₱625.00</strong></span>
              <span>LGU (2.5%): <strong className="text-emerald-700 dark:text-emerald-400">₱625.00</strong></span>
            </div>
            <div className="text-right text-[11px] font-semibold text-slate-500 dark:text-gray-400">
              Total = ₱1,250.00
            </div>
          </div>

          {/* Cutoff Setting */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
              Deduction Cutoff Schedule
            </Label>
            <Select
              disabled={isReadOnly}
              value={philhealthSetting?.cutoff || "NONE"}
              onValueChange={(val) =>
                onCutoff("PHILHEALTH", val === "NONE" ? null : (val as BenefitSetting["cutoff"]))
              }
            >
              <SelectTrigger className="w-full h-9 text-xs bg-white dark:bg-gray-800">
                <SelectValue placeholder="Select Cutoff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">None / Disabled</SelectItem>
                <SelectItem value="FIRST">First Cutoff (1st Half)</SelectItem>
                <SelectItem value="SECOND">Second Cutoff (2nd Half)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Effectivity Period */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Effective From</span>
              <Input
                readOnly
                value={formatDateSafe(philhealthSetting?.effective_from)}
                className="h-8 text-xs bg-slate-100 dark:bg-gray-800 border-none cursor-default font-medium"
              />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Effective To</span>
              <Input
                readOnly
                value={formatDateSafe(philhealthSetting?.effective_to)}
                className="h-8 text-xs bg-slate-100 dark:bg-gray-800 border-none cursor-default font-medium"
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-2 pb-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border-t border-emerald-100 dark:border-emerald-900/40 text-[11px] text-slate-500 dark:text-gray-400 flex items-center justify-between">
          <div className="flex items-center gap-1 truncate">
            <User className="h-3 w-3 text-slate-400" />
            <span>Updated: {getUserName(philhealthSetting?.updated_by)}</span>
          </div>
          <span>{formatDateSafe(philhealthSetting?.updated_date)}</span>
        </CardFooter>
      </Card>

      {/* 3. PAG-IBIG CARD */}
      <Card className="flex flex-col border-amber-200/80 dark:border-amber-900/50 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-b from-amber-50/40 to-white dark:from-amber-950/20 dark:to-gray-900">
        <CardHeader className="pb-3 border-b border-amber-100 dark:border-amber-900/40">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-600 text-white shadow-sm">
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-gray-100">
                  Pag-IBIG Fund
                </CardTitle>
                <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                  HDMF Mutual Fund (DBM Circular)
                </div>
              </div>
            </div>
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 hover:bg-amber-200 border-amber-300">
              ₱200 DBM Standard
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-4 pt-4 text-sm">
          {/* Contribution Rate Overview */}
          <div className="rounded-lg bg-amber-50/80 dark:bg-amber-950/40 p-3 border border-amber-200/60 dark:border-amber-900/40 space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-amber-950 dark:text-amber-200 pb-1 border-b border-amber-200/50 dark:border-amber-900/40">
              <span>Standard Monthly</span>
              <span className="text-sm font-bold text-amber-700 dark:text-amber-300">₱200.00 / mo</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded border border-amber-100 dark:border-gray-700">
                <div className="text-slate-500 dark:text-gray-400 font-medium">Personal Share</div>
                <div className="text-base font-bold text-amber-700 dark:text-amber-300">₱100 - ₱200</div>
                <div className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">
                  Standard DBM rate
                </div>
              </div>
              <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded border border-amber-100 dark:border-gray-700">
                <div className="text-slate-500 dark:text-gray-400 font-medium">Government Share</div>
                <div className="text-base font-bold text-amber-700 dark:text-amber-400">₱100 - ₱200</div>
                <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                  LGU match
                </div>
              </div>
            </div>
            <div className="text-[11px] text-amber-900/80 dark:text-amber-300/80 pt-0.5 font-medium">
              Below ₱1,500 sahod: 1% Ikaw, 2% LGU. Tinaasan na nung 2024 halos lahat ₱200 na.
            </div>
          </div>

          {/* Example Calculation Box */}
          <div className="rounded-md bg-slate-50 dark:bg-gray-800/50 p-2.5 border border-slate-200 dark:border-gray-700 text-xs space-y-1">
            <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-gray-300">
              <Info className="h-3.5 w-3.5 text-amber-600" />
              <span>Standard Monthly Contribution</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-gray-300 pt-1">
              <span>Personal (DBM): <strong className="text-amber-700 dark:text-amber-400">₱200.00</strong></span>
              <span>LGU Share: <strong className="text-amber-700 dark:text-amber-400">₱200.00</strong></span>
            </div>
            <div className="text-right text-[11px] font-semibold text-slate-500 dark:text-gray-400">
              Total Remittance = ₱400.00
            </div>
          </div>

          {/* Cutoff Setting */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
              Deduction Cutoff Schedule
            </Label>
            <Select
              disabled={isReadOnly}
              value={pagibigSetting?.cutoff || "NONE"}
              onValueChange={(val) =>
                onCutoff("PAGIBIG", val === "NONE" ? null : (val as BenefitSetting["cutoff"]))
              }
            >
              <SelectTrigger className="w-full h-9 text-xs bg-white dark:bg-gray-800">
                <SelectValue placeholder="Select Cutoff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">None / Disabled</SelectItem>
                <SelectItem value="FIRST">First Cutoff (1st Half)</SelectItem>
                <SelectItem value="SECOND">Second Cutoff (2nd Half)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Effectivity Period */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Effective From</span>
              <Input
                readOnly
                value={formatDateSafe(pagibigSetting?.effective_from)}
                className="h-8 text-xs bg-slate-100 dark:bg-gray-800 border-none cursor-default font-medium"
              />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Effective To</span>
              <Input
                readOnly
                value={formatDateSafe(pagibigSetting?.effective_to)}
                className="h-8 text-xs bg-slate-100 dark:bg-gray-800 border-none cursor-default font-medium"
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-2 pb-2.5 bg-amber-50/50 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900/40 text-[11px] text-slate-500 dark:text-gray-400 flex items-center justify-between">
          <div className="flex items-center gap-1 truncate">
            <User className="h-3 w-3 text-slate-400" />
            <span>Updated: {getUserName(pagibigSetting?.updated_by)}</span>
          </div>
          <span>{formatDateSafe(pagibigSetting?.updated_date)}</span>
        </CardFooter>
      </Card>
    </div>
  );
}
