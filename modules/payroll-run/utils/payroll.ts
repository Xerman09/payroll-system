import type {
  Adjustment,
  CutoffSetting,
  EmployeeRow,
  PayrollComputedLine,
  PayrollSummary,
  ProratedPayResult,
  SalaryHistoryEntry,
} from "../types";

/**
 * Parses a cutoff value in the format "YYYY-MM-DD_YYYY-MM-DD".
 * Falls back to empty strings if malformed.
 */
export function parseCutoffValue(value: string): { start: string; end: string } {
  const parts = value.split("_");
  return { start: parts[0] ?? "", end: parts[1] ?? "" };
}

/**
 * Formats a cutoff label based on its type (FIRST/SECOND).
 */
export function formatCutoffLabel(c: CutoffSetting | { cutoff_type: string; id: number }): string {
  const type = String(c.cutoff_type ?? "").toUpperCase();
  if (type === "FIRST") return "First Cutoff";
  if (type === "SECOND") return "Second Cutoff";
  return `Cutoff #${String(c.id ?? "")}`;
}

/**
 * Formats a number as Philippine Peso currency, using en-PH locale.
 * Note: Uses Intl.NumberFormat and will round to 2 decimals by default.
 */
export function formatPHP(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    amount,
  );
}

function toDateOnly(d: string): Date {
  // Treats input as date-only to minimize timezone impacts.
  // We append "T00:00:00Z" to force UTC.
  return new Date(`${d}T00:00:00Z`);
}

/**
 * Prototype parity proration:
 * - If no salary change within cutoff => semi-monthly = basic/2
 * - If change detected within cutoff => split calc using fixed days:
 *   totalWorkingDays=11, daysOnOldRate=3, daysOnNewRate=8, daily divisor=22.
 * This is intentionally simplistic; replace later with actual attendance/workday logic.
 */
export function calculateProratedPay(
  employee: Pick<EmployeeRow, "id" | "basic">,
  cutoffStart: string,
  cutoffEnd: string,
  salaryHistory: SalaryHistoryEntry[],
): ProratedPayResult {
  const start = toDateOnly(cutoffStart);
  const end = toDateOnly(cutoffEnd);

  const change = salaryHistory.find((h) => {
    if (h.user_id !== employee.id) return false;
    const eff = toDateOnly(h.effective_date);
    return eff >= start && eff <= end;
  });

  if (!change) {
    return { amount: employee.basic / 2, isProrated: false };
  }

  // Fixed prototype values
  const totalWorkingDays = 11;
  const daysOnOldRate = 3;
  const daysOnNewRate = totalWorkingDays - daysOnOldRate;

  const oldDaily = change.old_basic / 22;
  const newDaily = change.new_basic / 22;

  const payOld = daysOnOldRate * oldDaily;
  const payNew = daysOnNewRate * newDaily;
  const totalProrated = payOld + payNew;

  return {
    amount: totalProrated,
    isProrated: true,
    details: {
      changeEffectiveDate: change.effective_date,
      oldBasic: change.old_basic,
      newBasic: change.new_basic,
      daysOnOldRate,
      daysOnNewRate,
      oldDaily,
      newDaily,
      payOld,
      payNew,
      totalProrated,
    },
  };
}

export function sumAdjustments(adjustments: Adjustment[]): {
  earnings: number;
  deductions: number;
} {
  let earnings = 0;
  let deductions = 0;

  for (const adj of adjustments) {
    if (!Number.isFinite(adj.amount) || adj.amount <= 0) continue;
    if (adj.type === "EARNING") earnings += adj.amount;
    else deductions += adj.amount;
  }

  return { earnings, deductions };
}

/**
 * Computes payroll figures for one employee (prototype rules).
 */
export function computeEmployeePayroll(
  employee: EmployeeRow,
  cutoffStart: string,
  cutoffEnd: string,
  salaryHistory: SalaryHistoryEntry[],
  options: { fixedDeductions: number },
): PayrollComputedLine | null {
  if (employee.onHold) return null;

  const payData = calculateProratedPay(employee, cutoffStart, cutoffEnd, salaryHistory);

  const { earnings, deductions: adjDeductions } = sumAdjustments(employee.adjustments);

  const deductions = options.fixedDeductions + adjDeductions;
  const gross = payData.amount + earnings;
  const net = gross - deductions;

  let variancePct: number | null = null;
  let varianceAlert = false;

  if (employee.previousNet > 0) {
    const diff = net - employee.previousNet;
    variancePct = (diff / employee.previousNet) * 100;
    varianceAlert = Math.abs(variancePct) > 20;
  }

  return {
    user_id: employee.id,
    employee_name: employee.name,
    gross_pay: gross,
    total_deductions: deductions,
    net_pay: net,
    previous_net_pay: employee.previousNet,
    variance_pct: variancePct,
    variance_flag: varianceAlert,
    on_hold: false,
  } as unknown as PayrollComputedLine;
}

/**
 * Computes payroll register rows and summary totals.
 */
export function computePayrollRegister(
  employees: EmployeeRow[],
  cutoffStart: string,
  cutoffEnd: string,
  salaryHistory: SalaryHistoryEntry[],
  options: { fixedDeductions: number },
): { rows: PayrollComputedLine[]; summary: PayrollSummary } {
  const rows: PayrollComputedLine[] = [];
  let totalNet = 0;
  let totalGross = 0;
  let totalDeductions = 0;
  let headcount = 0;
  let varianceAlerts = 0;

  for (const emp of employees) {
    const row = computeEmployeePayroll(emp, cutoffStart, cutoffEnd, salaryHistory, options);
    if (!row) continue;
    rows.push(row);
    totalNet += row.net_pay;
    totalGross += row.gross_pay;
    totalDeductions += row.total_deductions;
    headcount += 1;
    if (row.variance_flag) varianceAlerts += 1;
  }

  return {
    rows,
    summary: { total_net: totalNet, total_gross: totalGross, total_deductions: totalDeductions, headcount, variance_alerts: varianceAlerts },
  };
}
// modules/payroll-run/utils/payroll.ts
export * from "./compute";