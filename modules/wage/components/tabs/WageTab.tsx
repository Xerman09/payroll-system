// @modules/wage/components/tabs/WageTab.tsx
"use client";

import * as React from "react";
import {
  Wallet,
  CalendarDays,
  CreditCard,
  Building2,
  Info,
  GraduationCap,
  X,
} from "lucide-react";

import type { Employee, WageDataState, SalarySchedule } from "../../types";
import { WORKING_DAYS_PER_MONTH } from "../../utils/payrollConstants";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Round to 2 decimal places */
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function WageTab({
  selectedEmployee,
  wageData,
  setWageData,
  salarySchedules,
}: {
  selectedEmployee: Employee | null;
  wageData: WageDataState;
  setWageData: (upd: Partial<WageDataState>) => void;
  salarySchedules: SalarySchedule[];
}) {
  const employeeId = selectedEmployee?.user_id ?? "";

  const dailyWageValue = Number(wageData.dailyWage) || 0;
  const dailyWageDisplay = (
    Number.isFinite(dailyWageValue) ? dailyWageValue : 0
  ).toFixed(2);

  const estMonthly = React.useMemo(() => {
    // simple, friendly estimate
    const base = (Number(wageData.dailyWage) || 0) * WORKING_DAYS_PER_MONTH;
    return base.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [wageData.dailyWage]);

  // ------------------------------------------------------------------
  // Salary Grade helpers
  // ------------------------------------------------------------------

  /** The currently linked schedule object (if any) */
  const linkedSchedule = React.useMemo(
    () =>
      wageData.schedule_id != null
        ? (salarySchedules.find(
            (s) => s.schedule_id === wageData.schedule_id
          ) ?? null)
        : null,
    [wageData.schedule_id, salarySchedules]
  );

  /**
   * Tracks whether the "Apply Salary Grade" checkbox is on.
   * Initialised to true when the employee already has a schedule_id linked.
   */
  const [applyGrade, setApplyGrade] = React.useState<boolean>(
    () => wageData.schedule_id != null
  );

  // Keep applyGrade in sync when the parent reloads wage data (e.g. modal re-open)
  React.useEffect(() => {
    setApplyGrade(wageData.schedule_id != null);
  }, [wageData.schedule_id]);

  /**
   * Group schedules by effectivity_date for the select list.
   * We show them as: "Grade {g} | Step {s} — ₱{monthly} (eff. {date})"
   */
  const scheduleOptions = React.useMemo(() => {
    // Sort: newest effectivity first; within same date, by grade then step
    return [...salarySchedules].sort((a, b) => {
      const dateDiff =
        new Date(b.effectivity_date).getTime() -
        new Date(a.effectivity_date).getTime();
      if (dateDiff !== 0) return dateDiff;
      if (a.salary_grade !== b.salary_grade)
        return a.salary_grade - b.salary_grade;
      return a.step - b.step;
    });
  }, [salarySchedules]);

  /** Handle schedule selection → auto-compute daily wage */
  const handleScheduleChange = React.useCallback(
    (value: string) => {
      if (!value || value === "__clear__") {
        setWageData({ schedule_id: null });
        return;
      }

      const scheduleId = Number(value);
      const schedule = salarySchedules.find(
        (s) => s.schedule_id === scheduleId
      );

      if (!schedule) {
        setWageData({ schedule_id: null });
        return;
      }

      const monthlyRate = Number(schedule.monthly_rate) || 0;
      const computedDaily = round2(monthlyRate / WORKING_DAYS_PER_MONTH);

      setWageData({
        schedule_id: scheduleId,
        dailyWage: computedDaily,
        dailyWageInput: computedDaily.toFixed(2),
      });
    },
    [salarySchedules, setWageData]
  );

  /** Format a monthly rate nicely */
  const fmtMoney = (v: string | number) =>
    Number(v).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

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

      {/* ── Salary Grade Card ── */}
      <div className="rounded-xl border bg-white dark:bg-transparent dark:border-slate-700 shadow-sm">
        <div className="p-4 border-b dark:border-slate-700">
          <div className="flex items-center justify-between gap-3">
            {/* Left: icon + title */}
            <div className="flex items-center gap-2">
              <div
                className={`h-9 w-9 rounded-lg border flex items-center justify-center text-white transition-colors ${
                  applyGrade
                    ? "border-persian-blue-200 bg-persian-blue-600 dark:border-persian-blue-800 dark:bg-persian-blue-500"
                    : "border-slate-200 bg-slate-400 dark:border-slate-700 dark:bg-slate-600"
                }`}
              >
                <GraduationCap className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Salary Grade
                </div>
                <div className="text-xs text-slate-500">
                  {applyGrade
                    ? `Selecting a grade auto-fills the daily wage (monthly ÷ ${WORKING_DAYS_PER_MONTH}).`
                    : "Enable to link a salary grade to this employee."}
                </div>
              </div>
            </div>

            {/* Right: Apply checkbox */}
            <div className="flex items-center gap-2 shrink-0">
              <label
                htmlFor="apply-salary-grade"
                className="text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer select-none"
              >
                Apply Salary Grade
              </label>
              <Checkbox
                id="apply-salary-grade"
                checked={applyGrade}
                onCheckedChange={(checked) => {
                  const next = !!checked;
                  setApplyGrade(next);
                  if (!next) {
                    // Uncheck → clear the linked schedule
                    setWageData({ schedule_id: null });
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Card body — disabled when checkbox is off */}
        <div
          className={`p-4 space-y-3 transition-opacity ${
            applyGrade ? "opacity-100" : "opacity-40 pointer-events-none select-none"
          }`}
        >
          {/* Dropdown */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Select
                disabled={!applyGrade}
                value={
                  wageData.schedule_id != null
                    ? String(wageData.schedule_id)
                    : ""
                }
                onValueChange={handleScheduleChange}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue
                    placeholder={
                      salarySchedules.length === 0
                        ? "No salary schedules available"
                        : "Select salary grade & step…"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {scheduleOptions.map((s) => (
                    <SelectItem
                      key={s.schedule_id}
                      value={String(s.schedule_id)}
                    >
                      Grade {s.salary_grade} · Step {s.step} —{" "}
                      ₱{fmtMoney(s.monthly_rate)}/mo
                      <span className="ml-1 text-xs text-slate-400">
                        (eff. {s.effectivity_date})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear button — only shown when a grade is linked */}
            {applyGrade && wageData.schedule_id != null && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 text-slate-400 hover:text-red-500"
                title="Clear salary grade"
                onClick={() => setWageData({ schedule_id: null })}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Info strip when a grade is linked */}
          {applyGrade && linkedSchedule && (
            <div className="rounded-lg bg-persian-blue-50 dark:bg-persian-blue-900/20 border border-persian-blue-100 dark:border-persian-blue-800 px-3 py-2 text-xs text-persian-blue-800 dark:text-persian-blue-300 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold">
                Grade {linkedSchedule.salary_grade} · Step {linkedSchedule.step}
              </span>
              <span>
                Monthly ₱{fmtMoney(linkedSchedule.monthly_rate)} ÷ {WORKING_DAYS_PER_MONTH} ={" "}
                <span className="font-semibold text-persian-blue-900 dark:text-persian-blue-100">
                  ₱{round2(Number(linkedSchedule.monthly_rate) / WORKING_DAYS_PER_MONTH).toFixed(2)}
                  /day
                </span>
              </span>
              <span className="text-persian-blue-500 dark:text-persian-blue-400 text-[10px] uppercase tracking-wider font-medium">
                Effectivity: {linkedSchedule.effectivity_date}
              </span>
            </div>
          )}
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
                  {linkedSchedule && (
                    <span className="ml-1.5 text-persian-blue-600 dark:text-persian-blue-400">
                      (from grade — editable)
                    </span>
                  )}
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

                {/* subtle helper */}
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Current:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      ₱ {dailyWageDisplay}
                    </span>
                  </span>
                  <span className="hidden sm:inline">
                    Est. monthly ({WORKING_DAYS_PER_MONTH}d):{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      ₱ {estMonthly}
                    </span>
                  </span>
                </div>
              </div>

              {/* Flags */}
              <div className="sm:col-span-2 rounded-lg border bg-slate-50/60 dark:bg-slate-900/20 dark:border-slate-700 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
