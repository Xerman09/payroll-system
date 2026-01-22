// @modules/wage/components/tabs/WageTab.tsx
"use client";

import * as React from "react";
import {
  Wallet,
  CalendarDays,
  CreditCard,
  Building2,
  Info,
  BadgeCheck,
} from "lucide-react";

import type { Employee, WageDataState } from "../../types";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function WageTab({
  selectedEmployee,
  wageData,
  setWageData,
}: {
  selectedEmployee: Employee | null;
  wageData: WageDataState;
  setWageData: (upd: Partial<WageDataState>) => void;
}) {
  const employeeId = selectedEmployee?.user_id ?? "";

  const dailyWageValue = Number(wageData.dailyWage) || 0;
  const dailyWageDisplay = (
    Number.isFinite(dailyWageValue) ? dailyWageValue : 0
  ).toFixed(2);

  const estMonthly = React.useMemo(() => {
    // simple, friendly estimate (26 working days)
    const base = (Number(wageData.dailyWage) || 0) * 26;
    return base.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [wageData.dailyWage]);

  return (
    <div className="space-y-5">
      {/* Header / quick context */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Wage Details
          </div>
          <Badge
            variant="secondary"
            className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Payroll
          </Badge>
        </div>
        <div className="text-xs text-slate-500">
          Configure daily wage, leave credits, and payroll flags for the
          selected employee.
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: core wage */}
        <div className="lg:col-span-7">
          <div className="rounded-xl border bg-white dark:bg-transparent dark:border-slate-700 shadow-sm">
            <div className="p-4 border-b dark:border-slate-700">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg border border-persian-blue-200 bg-persian-blue-600 dark:border-persian-blue-800 dark:bg-persian-blue-500 flex items-center justify-center text-white">
                    <Wallet className="h-4 w-4 text-slate-100 dark:text-slate-900" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Wage Setup
                    </div>
                    <div className="text-xs text-slate-500">
                      Primary values used for payroll computations.
                    </div>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                  <Info className="h-4 w-4" />
                  <span>Auto-formats on blur</span>
                </div>
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Employee ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Employee ID
                </label>
                <Input
                  type="text"
                  value={employeeId}
                  disabled
                  className="h-10 bg-slate-50 dark:bg-slate-900/30 dark:border-slate-700"
                />
              </div>

              {/* Daily Wage */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Daily Wage
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                    ₱
                  </span>
                  <Input
                    type="text"
                    value={wageData.dailyWageInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^\d*\.?\d*$/.test(value)) {
                        setWageData({
                          dailyWageInput: value,
                          dailyWage: Number(value) || 0,
                        });
                      }
                    }}
                    onBlur={() => {
                      setWageData({
                        dailyWageInput: (
                          Number(wageData.dailyWage) || 0
                        ).toFixed(2),
                      });
                    }}
                    className="h-10 pl-8"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Current:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      ₱ {dailyWageDisplay}
                    </span>
                  </span>
                  <span className="hidden sm:inline">
                    Est. monthly (26d):{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      ₱ {estMonthly}
                    </span>
                  </span>
                </div>
              </div>

              {/* Flags */}
              <div className="sm:col-span-2 rounded-lg border bg-slate-50/60 dark:bg-slate-900/20 dark:border-slate-700 p-3">
                {/* ✅ changed to 3 columns on md to fit 3 flags nicely */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-2 pb-3">
                  {/* Paid Holiday */}
                  <div className="flex items-center justify-between gap-3 rounded-md bg-white dark:bg-transparent border dark:border-slate-700 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-slate-600 dark:text-slate-200" />
                      <div>
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                          Paid Holiday
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Include paid holidays in payout.
                        </div>
                      </div>
                    </div>

                    <Checkbox
                      checked={wageData.isPaidHoliday}
                      onCheckedChange={(checked) =>
                        setWageData({ isPaidHoliday: !!checked })
                      }
                    />
                  </div>

                  {/* Bank Card */}
                  <div className="flex items-center justify-between gap-3 rounded-md bg-white dark:bg-transparent border dark:border-slate-700 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-slate-600 dark:text-slate-200" />
                      <div>
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                          Bank Card
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Employee receives pay via card.
                        </div>
                      </div>
                    </div>

                    <Checkbox
                      checked={wageData.isCard}
                      onCheckedChange={(checked) =>
                        setWageData({ isCard: !!checked })
                      }
                    />
                  </div>

                  {/* ✅ NEW: Regular Employee */}
                
                </div>  <div className="flex items-center justify-between gap-3 rounded-md bg-white dark:bg-transparent border dark:border-slate-700 px-3 py-2 ">
                    <div className="flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-slate-600 dark:text-slate-200" />
                      <div>
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                          Regular Employee
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Mark employee as regular status.
                        </div>
                      </div>
                    </div>

                    <Checkbox
                      checked={wageData.isRegularEmployee}
                      onCheckedChange={(checked) =>
                        setWageData({ isRegularEmployee: !!checked })
                      }
                    />
                  </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: leave credits + meta */}
        <div className="lg:col-span-5 space-y-4">
          {/* Leave Credits card */}
          <div className="rounded-xl border bg-white dark:bg-transparent dark:border-slate-700 shadow-sm">
            <div className="p-4 border-b dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg border border-persian-blue-200 bg-persian-blue-600 dark:border-persian-blue-800 dark:bg-persian-blue-500 flex items-center justify-center text-white">
                  <Building2 className="h-4 w-4 text-slate-100 dark:text-slate-900" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Leave Credits
                  </div>
                  <div className="text-xs text-slate-500">
                    Stored as counts/credits used by HR policy.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {/* Vacation Leave */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Vacation Leave
                </label>
                <Input
                  type="number"
                  value={wageData.vacationLeave}
                  onChange={(e) =>
                    setWageData({ vacationLeave: Number(e.target.value) })
                  }
                  className="h-10"
                  min={0}
                />
              </div>

              {/* Sick Leave */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Sick Leave
                </label>
                <Input
                  type="number"
                  value={wageData.sickLeave}
                  onChange={(e) =>
                    setWageData({ sickLeave: Number(e.target.value) })
                  }
                  className="h-10"
                  min={0}
                />
              </div>
            </div>
          </div>

          {/* Audit / meta */}
          <div className="rounded-xl border bg-white dark:bg-transparent dark:border-slate-700 shadow-sm">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Audit Trail
                  </div>
                  <div className="text-xs text-slate-500">
                    Last update info from the wage record.
                  </div>
                </div>
              </div>

              <Separator className="my-3" />

              <div className="text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Last Updated By</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {wageData.lastUpdatedBy || "—"}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-slate-500">Last Update Date</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {wageData.lastUpdateDate || "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
