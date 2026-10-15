// modules/thirteenth-month/providers/thirteenthMonthService.ts

import * as api from "./thirteenthMonthApi";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import type {
  ThirteenthMonthHeader,
  ThirteenthMonthEmployeeLine,
  ThirteenthMonthSummary,
  CutoffDayItem,
} from "../types";

export function safeFormatDate(dStr?: string | null, pattern = "MMM dd, yyyy"): string {
  if (!dStr) return "—";
  try {
    const s = dStr.slice(0, 10);
    const parts = s.split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return format(new Date(y, m, d), pattern);
    }
    return format(new Date(dStr), pattern);
  } catch {
    return String(dStr);
  }
}

/**
 * Calculates standard working days between two dates.
 * By default, excludes Sundays (Monday-Saturday 6-day work schedule) or Sundays & Saturdays if 5-day.
 */
export function calculateWorkingDaysInRange(
  startDateStr: string,
  endDateStr: string,
  excludeSaturdays = false
): number {
  try {
    const startParts = startDateStr.slice(0, 10).split("-");
    const endParts = endDateStr.slice(0, 10).split("-");

    const start = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
    const end = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]));

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return 0;
    }

    const days = eachDayOfInterval({ start, end });
    return days.filter((d) => {
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0) return false; // Exclude Sunday
      if (excludeSaturdays && dayOfWeek === 6) return false; // Exclude Saturday if 5-day week
      return true;
    }).length;
  } catch (err) {
    console.error("Error calculating working days in range:", err);
    return 0;
  }
}

export interface MonthInterval {
  key: string; // YYYY-MM
  name: string; // "January 2026"
  short: string; // "Jan"
  startDateStr: string; // YYYY-MM-DD
  endDateStr: string;   // YYYY-MM-DD
  workingDays: number;
}

export function getMonthIntervals(startStr: string, endStr: string, excludeSaturdays = false): MonthInterval[] {
  const intervals: MonthInterval[] = [];
  try {
    const sParts = startStr.slice(0, 10).split("-");
    const eParts = endStr.slice(0, 10).split("-");
    const start = new Date(Number(sParts[0]), Number(sParts[1]) - 1, Number(sParts[2]));
    const end = new Date(Number(eParts[0]), Number(eParts[1]) - 1, Number(eParts[2]));

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    while (current <= endMonth) {
      const y = current.getFullYear();
      const m = current.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      const name = format(current, "MMMM yyyy");
      const short = format(current, "MMM");

      const firstDay = new Date(y, m, 1);
      const lastDay = new Date(y, m + 1, 0);

      const effStart = firstDay < start ? start : firstDay;
      const effEnd = lastDay > end ? end : lastDay;

      const effStartStr = format(effStart, "yyyy-MM-dd");
      const effEndStr = format(effEnd, "yyyy-MM-dd");

      const workingDays = calculateWorkingDaysInRange(effStartStr, effEndStr, excludeSaturdays);

      intervals.push({
        key,
        name,
        short,
        startDateStr: effStartStr,
        endDateStr: effEndStr,
        workingDays,
      });

      current = new Date(y, m + 1, 1);
    }
  } catch (err) {
    console.error("Error generating month intervals:", err);
  }
  return intervals;
}

export interface WorkspaceData {
  users: Record<string, unknown>[];
  departments: Record<string, unknown>[];
  wages: Record<string, unknown>[];
  cutoffSettings: Record<string, unknown>[];
  postedRuns: Record<string, unknown>[];
  runEmployees: Record<string, unknown>[];
  holidays: Record<string, unknown>[];
}

export async function loadThirteenthMonthWorkspace(): Promise<WorkspaceData> {
  const [users, departments, wages, cutoffSettings, postedRuns, holidays] = await Promise.all([
    api.fetchUsers(),
    api.fetchDepartments(),
    api.fetchWages(),
    api.fetchCutoffSettings(),
    api.fetchPostedPayrollRuns(),
    api.fetchHolidays(),
  ]);

  const runIds = postedRuns.map((r) => r.payroll_run_id || r.id).filter(Boolean) as (number | string)[];
  const runEmployees = await api.fetchPayrollRunEmployees(runIds.slice(0, 50)); // latest runs

  return {
    users,
    departments,
    wages,
    cutoffSettings,
    postedRuns,
    runEmployees,
    holidays,
  };
}

export function computeEmployeeLines(
  header: ThirteenthMonthHeader,
  workspace: WorkspaceData,
  manualAdjustments: Record<number, { adjustment_days?: number; advance_deduction?: number; on_hold?: boolean; remarks?: string }> = {}
): { lines: ThirteenthMonthEmployeeLine[]; summary: ThirteenthMonthSummary } {
  const { users, departments, wages, postedRuns, runEmployees } = workspace;

  // Active departments map
  const deptMap = new Map<number, string>();
  departments.forEach((d) => {
    deptMap.set(Number(d.department_id || d.id), String(d.department_name || d.name || ""));
  });

  // Wage profile map by user_id
  const wageMap = new Map<number, { monthly_rate: number; daily_rate: number; payment_method: string }>();
  wages.forEach((w) => {
    const uId = Number(w.user_id);
    if (uId) {
      const monthly = Number(w.monthly_rate || 0);
      const daily = Number(w.daily_wage || (w as any).daily_rate || 0);
      const isCard = (w as any).isCard;
      const method = isCard === 0 || isCard === false || isCard === "0" ? "CASH" : "BANK";
      wageMap.set(uId, { monthly_rate: monthly, daily_rate: daily, payment_method: method });
    }
  });

  // Active runs map in the target date range
  const startYmd = header.start_date.slice(0, 10);
  const endYmd = header.end_date.slice(0, 10);

  const runsInRange = postedRuns.filter((r) => {
    const rStart = r.cutoff_start ? String(r.cutoff_start).slice(0, 10) : "";
    const rEnd = r.cutoff_end ? String(r.cutoff_end).slice(0, 10) : "";
    if (!rStart || !rEnd) return false;
    // Overlaps or inside range
    return rStart <= endYmd && rEnd >= startYmd;
  });

  const validRunIds = new Set(runsInRange.map((r) => Number(r.payroll_run_id || r.id)));

  // Map employee days worked across runs
  const employeeDaysMap = new Map<number, CutoffDayItem[]>();
  runEmployees.forEach((re) => {
    const runId = Number(re.payroll_run_id);
    const userId = Number(re.user_id);
    if (!userId) return;

    if (validRunIds.has(runId)) {
      const parentRun = runsInRange.find((r) => Number(r.payroll_run_id || r.id) === runId);
      const days = Number(re.total_days_worked ?? re.days_worked ?? 0);
      const item: CutoffDayItem = {
        cutoff_id: runId,
        cutoff_label: parentRun?.cutoff_start && parentRun?.cutoff_end
          ? `${safeFormatDate(String(parentRun.cutoff_start))} – ${safeFormatDate(String(parentRun.cutoff_end))}`
          : `Run #${runId}`,
        cutoff_start: String(parentRun?.cutoff_start || ""),
        cutoff_end: String(parentRun?.cutoff_end || ""),
        days_worked: days,
        run_ref: String(parentRun?.payroll_ref_no || `RUN-${runId}`),
      };

      const existing = employeeDaysMap.get(userId) || [];
      existing.push(item);
      employeeDaysMap.set(userId, existing);
    }
  });

  // Filter active users
  const activeUsers = users.filter((u) => {
    const udel = u.is_deleted as any;
    const delVal = typeof udel === "object" && udel !== null && "data" in udel ? udel.data?.[0] : udel;
    if (delVal === 1 || delVal === true || delVal === "1" || Number(delVal) === 1) return false;

    if (header.department_filter !== "ALL" && String(u.user_department) !== String(header.department_filter)) {
      return false;
    }
    return true;
  });

  const totalPeriodWorkingDays = Math.max(1, header.total_period_working_days);

  const lines: ThirteenthMonthEmployeeLine[] = activeUsers.map((u) => {
    const userId = Number(u.user_id || u.id);
    const fname = String(u.user_fname || "");
    const lname = String(u.user_lname || "");
    const mname = u.user_mname ? ` ${u.user_mname}` : "";
    const employeeName = `${fname}${mname} ${lname}`.trim() || `Employee #${userId}`;

    const deptId = u.user_department != null ? Number(u.user_department) : null;
    const departmentName = deptId != null ? deptMap.get(deptId) || "General" : "Unassigned";

    const wage = wageMap.get(userId) || { monthly_rate: 0, daily_rate: 0, payment_method: "BANK" };
    const monthlySalary = wage.monthly_rate > 0 ? wage.monthly_rate : (wage.daily_rate > 0 ? wage.daily_rate * 26 : 0);

    // Formula Step 1: Pay Per Day = Monthly Salary / Total Working Days in Period
    const payPerDay = totalPeriodWorkingDays > 0 ? Math.round((monthlySalary / totalPeriodWorkingDays) * 10000) / 10000 : 0;

    // Formula Step 2: Employee total days worked
    const daysBreakdown = employeeDaysMap.get(userId) || [];
    let actualDaysWorked = daysBreakdown.reduce((sum, item) => sum + item.days_worked, 0);

    // Fallback: If no digitized historical cutoffs exist yet in system, fallback to full period days or prorated from hire date
    if (actualDaysWorked === 0 && daysBreakdown.length === 0) {
      if (u.user_dateOfHire) {
        const hireYmd = String(u.user_dateOfHire).slice(0, 10);
        const effectiveStart = hireYmd > startYmd ? hireYmd : startYmd;
        actualDaysWorked = calculateWorkingDaysInRange(effectiveStart, endYmd);
      } else {
        actualDaysWorked = totalPeriodWorkingDays;
      }
    }

    const manual = manualAdjustments[userId] || {};
    const adjustmentDays = Number(manual.adjustment_days || 0);
    const effectiveDaysWorked = Math.max(0, actualDaysWorked + adjustmentDays);

    // Formula Step 3: Total Work * Per Day Pay
    const computed13thMonth = Math.round(effectiveDaysWorked * payPerDay * 100) / 100;

    // Deductions & Tax (₱90,000 threshold under TRAIN Law)
    const advanceDeduction = Number(manual.advance_deduction || 0);
    const taxableAmount = Math.max(0, computed13thMonth - 90000);
    const taxWithheld = taxableAmount > 0 ? Math.round(taxableAmount * 0.15 * 100) / 100 : 0;

    const net13thMonth = Math.max(0, Math.round((computed13thMonth - advanceDeduction - taxWithheld) * 100) / 100);

    const monthIntervals = getMonthIntervals(startYmd, endYmd);

    const monthlyBreakdown = monthIntervals.map((mi) => {
      const cutoffsInMonth = daysBreakdown.filter((item) => {
        const cEnd = item.cutoff_end ? item.cutoff_end.slice(0, 7) : "";
        const cStart = item.cutoff_start ? item.cutoff_start.slice(0, 7) : "";
        return cEnd === mi.key || cStart === mi.key;
      });

      let days = cutoffsInMonth.reduce((sum, item) => sum + item.days_worked, 0);

      if (cutoffsInMonth.length === 0 && daysBreakdown.length === 0) {
        if (u.user_dateOfHire) {
          const hireYmd = String(u.user_dateOfHire).slice(0, 10);
          if (hireYmd > mi.endDateStr) {
            days = 0;
          } else if (hireYmd >= mi.startDateStr && hireYmd <= mi.endDateStr) {
            days = calculateWorkingDaysInRange(hireYmd, mi.endDateStr);
          } else {
            days = mi.workingDays;
          }
        } else {
          days = mi.workingDays;
        }
      }

      const completionPct = mi.workingDays > 0 ? Math.min(100, Math.round((days / mi.workingDays) * 100)) : 0;

      return {
        month_key: mi.key,
        month_name: mi.name,
        month_short: mi.short,
        total_working_days: mi.workingDays,
        days_worked: days,
        completion_pct: completionPct,
        cutoffs_count: cutoffsInMonth.length,
      };
    });

    return {
      id: `line-${userId}`,
      user_id: userId,
      employee_name: employeeName,
      department_id: deptId,
      department_name: departmentName,
      position: String(u.user_position || "Staff"),
      hire_date: u.user_dateOfHire ? String(u.user_dateOfHire).slice(0, 10) : null,
      monthly_salary: monthlySalary,
      period_working_days: totalPeriodWorkingDays,
      pay_per_day: payPerDay,
      actual_days_worked: actualDaysWorked,
      adjustment_days: adjustmentDays,
      effective_days_worked: effectiveDaysWorked,
      computed_13th_month: computed13thMonth,
      advance_deduction: advanceDeduction,
      taxable_amount: taxableAmount,
      tax_withheld: taxWithheld,
      net_13th_month: net13thMonth,
      payment_method: (wage.payment_method === "CASH" ? "CASH" : "BANK"),
      on_hold: Boolean(manual.on_hold),
      remarks: manual.remarks || "",
      days_breakdown: daysBreakdown,
      monthly_breakdown: monthlyBreakdown,
    };
  });

  // Calculate summary metrics
  const activeLines = lines.filter((l) => !l.on_hold);
  const totalGross = activeLines.reduce((sum, l) => sum + l.computed_13th_month, 0);
  const totalAdv = activeLines.reduce((sum, l) => sum + l.advance_deduction, 0);
  const totalTax = activeLines.reduce((sum, l) => sum + l.tax_withheld, 0);
  const totalNet = activeLines.reduce((sum, l) => sum + l.net_13th_month, 0);

  const summary: ThirteenthMonthSummary = {
    total_employees: lines.length,
    active_employees: activeLines.length,
    on_hold_employees: lines.filter((l) => l.on_hold).length,
    total_working_days: totalPeriodWorkingDays,
    total_gross_13th_month: totalGross,
    total_advances: totalAdv,
    total_tax_withheld: totalTax,
    total_net_payout: totalNet,
    average_payout: activeLines.length > 0 ? Math.round((totalNet / activeLines.length) * 100) / 100 : 0,
  };

  return { lines, summary };
}
