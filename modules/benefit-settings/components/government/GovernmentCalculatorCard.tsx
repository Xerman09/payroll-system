// modules/benefit-settings/components/government/GovernmentCalculatorCard.tsx
"use client";

import * as React from "react";
import { Calculator, UserCheck, ArrowRight, Wallet, Building2, Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  computeGovernmentStatutorySummary,
  formatPhp,
  GovernmentBenefitsSummary,
} from "../../utils/governmentContributions";
import type { UserData, BenefitCode, BenefitSetting } from "../../types";

interface GovernmentCalculatorCardProps {
  users: UserData[];
  settings: Record<BenefitCode, BenefitSetting>;
}

export default function GovernmentCalculatorCard({
  users,
  settings,
}: GovernmentCalculatorCardProps) {
  const [selectedUserId, setSelectedUserId] = React.useState<string>("custom");
  const [inputSalary, setInputSalary] = React.useState<number>(25000);
  const [customPagibig, setCustomPagibig] = React.useState<number>(200);

  const summary: GovernmentBenefitsSummary = React.useMemo(() => {
    return computeGovernmentStatutorySummary(inputSalary, customPagibig);
  }, [inputSalary, customPagibig]);

  // Handle employee selection
  const handleSelectUser = (val: string) => {
    setSelectedUserId(val);
    if (val === "custom") {
      setInputSalary(25000);
      return;
    }
    // Preset default test salaries for selected users if specific salary lookup isn't in user record
    setInputSalary(25000);
  };

  // Compute cutoff shares based on settings
  const gsisCutoff = settings.SSS?.cutoff || "NONE";
  const philhealthCutoff = settings.PHILHEALTH?.cutoff || "NONE";
  const pagibigCutoff = settings.PAGIBIG?.cutoff || "NONE";

  const firstCutoffEmployee =
    (gsisCutoff === "FIRST" ? summary.gsis.employeeShare : 0) +
    (philhealthCutoff === "FIRST" ? summary.philhealth.employeeShare : 0) +
    (pagibigCutoff === "FIRST" ? summary.pagibig.employeeShare : 0);

  const secondCutoffEmployee =
    (gsisCutoff === "SECOND" ? summary.gsis.employeeShare : 0) +
    (philhealthCutoff === "SECOND" ? summary.philhealth.employeeShare : 0) +
    (pagibigCutoff === "SECOND" ? summary.pagibig.employeeShare : 0);

  return (
    <Card className="border-indigo-100 dark:border-indigo-900/50 shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-indigo-50/70 via-sky-50/50 to-white dark:from-indigo-950/40 dark:via-sky-950/20 dark:to-gray-900 pb-3.5 border-b border-indigo-100 dark:border-indigo-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-sm">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-gray-100">
                Government Statutory Contribution Simulator
              </CardTitle>
              <div className="text-xs text-slate-500 dark:text-gray-400">
                Subukan ang live computation ng personal at LGU counterpart base sa sahod
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
              LGU 50/50 &amp; 12% Shared Scheme
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* Controls: Select Employee or Type Salary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
              Pumili ng Empleyado (Opsyonal)
            </Label>
            <Select value={selectedUserId} onValueChange={handleSelectUser}>
              <SelectTrigger className="w-full h-9 text-xs">
                <SelectValue placeholder="Custom Salary Input" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">✏️ Custom Salary</SelectItem>
                {users.slice(0, 20).map((u) => (
                  <SelectItem key={u.user_id} value={String(u.user_id)}>
                    {u.user_fname} {u.user_lname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
              Buwanang Sahod (Monthly Basic Salary)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₱</span>
              <Input
                type="number"
                min={0}
                step={500}
                value={inputSalary}
                onChange={(e) => setInputSalary(Math.max(0, parseFloat(e.target.value) || 0))}
                className="pl-7 h-9 text-xs font-semibold"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
              Pag-IBIG Personal Contribution
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₱</span>
              <Input
                type="number"
                min={100}
                max={5000}
                step={50}
                value={customPagibig}
                onChange={(e) => setCustomPagibig(Math.max(100, parseFloat(e.target.value) || 200))}
                className="pl-7 h-9 text-xs font-semibold"
              />
            </div>
            <div className="text-[10px] text-slate-400">Min: ₱100 | DBM standard: ₱200</div>
          </div>
        </div>

        {/* Breakdown Table */}
        <div className="rounded-lg border border-slate-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-gray-800/80 border-b border-slate-200 dark:border-gray-700 font-semibold text-slate-600 dark:text-gray-300">
                <th className="py-2.5 px-3">Statutory Agency</th>
                <th className="py-2.5 px-3">Calculation Basis</th>
                <th className="py-2.5 px-3 text-right text-blue-700 dark:text-blue-400">
                  Personal Share (Ikaw)
                </th>
                <th className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400">
                  LGU Share (Government)
                </th>
                <th className="py-2.5 px-3 text-right text-slate-800 dark:text-gray-200">
                  Total Remittance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {/* GSIS ROW */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-gray-800/40 transition-colors">
                <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-gray-100">
                  GSIS (Kapalit ng SSS)
                </td>
                <td className="py-2.5 px-3 text-slate-500 dark:text-gray-400">
                  9% Ikaw + 12% LGU = 21% of {formatPhp(summary.gsis.basisSalary)}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-blue-700 dark:text-blue-400">
                  {formatPhp(summary.gsis.employeeShare)}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                  {formatPhp(summary.gsis.governmentShare)}
                </td>
                <td className="py-2.5 px-3 text-right font-semibold text-slate-800 dark:text-gray-200">
                  {formatPhp(summary.gsis.totalContribution)}
                </td>
              </tr>

              {/* PHILHEALTH ROW */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-gray-800/40 transition-colors">
                <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-gray-100">
                  PhilHealth
                </td>
                <td className="py-2.5 px-3 text-slate-500 dark:text-gray-400">
                  5% of {formatPhp(summary.philhealth.basisSalary)} (2.5% Ikaw / 2.5% LGU)
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-blue-700 dark:text-blue-400">
                  {formatPhp(summary.philhealth.employeeShare)}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                  {formatPhp(summary.philhealth.governmentShare)}
                </td>
                <td className="py-2.5 px-3 text-right font-semibold text-slate-800 dark:text-gray-200">
                  {formatPhp(summary.philhealth.totalContribution)}
                </td>
              </tr>

              {/* PAG-IBIG ROW */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-gray-800/40 transition-colors">
                <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-gray-100">
                  Pag-IBIG (HDMF)
                </td>
                <td className="py-2.5 px-3 text-slate-500 dark:text-gray-400">
                  DBM Circular rate (₱200 standard / match)
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-blue-700 dark:text-blue-400">
                  {formatPhp(summary.pagibig.employeeShare)}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                  {formatPhp(summary.pagibig.governmentShare)}
                </td>
                <td className="py-2.5 px-3 text-right font-semibold text-slate-800 dark:text-gray-200">
                  {formatPhp(summary.pagibig.totalContribution)}
                </td>
              </tr>
            </tbody>

            {/* TOTALS FOOTER */}
            <tfoot>
              <tr className="bg-slate-100/70 dark:bg-gray-800 font-bold border-t-2 border-slate-200 dark:border-gray-700">
                <td colSpan={2} className="py-3 px-3 text-slate-700 dark:text-gray-200 uppercase tracking-wide text-[11px]">
                  Total Monthly Statutory Obligations
                </td>
                <td className="py-3 px-3 text-right text-sm text-blue-700 dark:text-blue-300">
                  {formatPhp(summary.totalEmployeeDeduction)}
                </td>
                <td className="py-3 px-3 text-right text-sm text-emerald-700 dark:text-emerald-300">
                  {formatPhp(summary.totalGovernmentCounterpart)}
                </td>
                <td className="py-3 px-3 text-right text-sm text-slate-900 dark:text-white">
                  {formatPhp(summary.grandTotalRemittance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* High-level Summary Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-600 text-white">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-gray-400">
                Kabuuang Bawas sa Sahod
              </div>
              <div className="text-sm font-bold text-blue-700 dark:text-blue-300">
                {formatPhp(summary.totalEmployeeDeduction)}
              </div>
              <div className="text-[10px] text-slate-400">
                1st: {formatPhp(firstCutoffEmployee)} | 2nd: {formatPhp(secondCutoffEmployee)}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center gap-3">
            <div className="p-2 rounded-md bg-emerald-600 text-white">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-gray-400">
                Sagot ng LGU / Government
              </div>
              <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                {formatPhp(summary.totalGovernmentCounterpart)}
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                Subsidiary counterpart ng gobyerno
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center gap-3">
            <div className="p-2 rounded-md bg-indigo-600 text-white">
              <Coins className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-gray-400">
                Kabuuang Remittance sa Ahensya
              </div>
              <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                {formatPhp(summary.grandTotalRemittance)}
              </div>
              <div className="text-[10px] text-indigo-600 dark:text-indigo-400">
                GSIS + PhilHealth + Pag-IBIG
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
