// modules/payroll-run/utils/payrollRunEmployee.mapper.ts
import type { PayrollComputedLine, PayrollRunHeader } from "../types";

function n(v: any): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function toIntFlag(v: any): number {
  if (typeof v === "boolean") return v ? 1 : 0;
  const x = n(v);
  return x ? 1 : 0;
}

function extractHolidayDays(line: PayrollComputedLine): number {
  // Prefer explicit computed value
  const direct = (line as any).holiday_days;
  if (Number.isFinite(Number(direct))) return round2(n(direct));

  // Fallback: derive from breakdown_json holiday_items where total > 0
  const items = (line as any)?.breakdown_json?.earnings?.holiday_items;
  if (!Array.isArray(items)) return 0;

  const countPaid = items.filter((x: any) => n(x?.total) > 0).length;
  return round2(countPaid);
}

/**
 * Maps compute.ts output -> Directus payload for payroll_run_employee table.
 * This isolates DB column names from compute/UI names.
 */
export function toPayrollRunEmployeeInsert(args: {
  line: PayrollComputedLine;
  run: PayrollRunHeader; // must have payroll_run_id, cutoff fields, etc.
  cutoffLabel?: string | null;
  createdBy?: number | null;
}) {
  const { line, run } = args;

  // Variance amount can be derived at persistence layer
  const varianceAmount = round2(n(line.net_pay) - n(line.previous_net_pay));

  // If you still carry legacy columns in DB, mirror them here safely
  const position = ((line as any).position ?? null) as any;
  const deptName = ((line as any).department_name ?? null) as any;

  const holidayAmount = round2(
    n((line as any).holiday ?? (line as any).holiday_pay ?? 0),
  );
  const holidayDays = extractHolidayDays(line);

  // Coop loan mirror: your table has BOTH loan_coop and coop_loan
  const loanCoop = round2(n((line as any).loan_coop ?? 0));

  const isProrated = toIntFlag((line as any).is_prorated ?? 0);

  return {
    // keys MUST match Directus field names
    user_id: n((line as any).user_id),

    employee_name: (line as any).employee_name ?? null,
    position: position,
    department_name: deptName,

    // optional legacy snapshot columns (if they exist in your table)
    position_name: position,
    department_name_snapshot: deptName,

    payroll_run_id: n((run as any).payroll_run_id),
    cutoff_start: (run as any).cutoff_start,
    cutoff_end: (run as any).cutoff_end,
    cutoff_type: (run as any).cutoff_type ?? null,
    cutoff_id: (run as any).cutoff_id ?? null,
    cutoff_label: args.cutoffLabel ?? null,

    // rates
    daily_rate: round2(n((line as any).daily_rate)),
    basic_daily_rate: round2(n((line as any).daily_rate)), // keep your current policy
    hourly_rate: round2(n((line as any).hourly_rate)),
    monthly_rate: round2(n((line as any).monthly_rate)),

    // attendance totals
    total_days_worked: n((line as any).total_days_worked),
    total_work_minutes: n((line as any).total_work_minutes),
    late_minutes: n((line as any).late_minutes),
    undertime_minutes: n((line as any).undertime_minutes),
    overtime_minutes: n((line as any).overtime_minutes),
    night_diff_minutes: n((line as any).night_diff_minutes),
    total_hours_worked: round2(n((line as any).total_hours_worked ?? 0)),

    // earnings
    basic_pay: round2(n((line as any).basic_pay)),
    ot_amount: round2(n((line as any).ot_amount)),
    leave_amount: round2(n((line as any).leave_amount ?? 0)),
    retro_pay: round2(n((line as any).retro_pay ?? 0)),
    retro_remarks: (line as any).retro_remarks ?? null,

    // holiday legacy mirrors
    holiday: holidayAmount,
    holiday_pay: round2(n((line as any).holiday_pay)),
    holiday_days: round2(holidayDays),

    rest_day_amount: round2(n((line as any).rest_day_amount)),
    night_diff_amount: round2(n((line as any).night_diff_amount)),

    allowance: round2(n((line as any).allowance)),
    manual_additions: round2(n((line as any).manual_additions)),

    // deductions
    late_deduction: round2(n((line as any).late_deduction)),
    undertime_deduction: round2(n((line as any).undertime_deduction)),
    shortage_deduction: round2(n((line as any).shortage_deduction)),

    // government benefits
    benefit_sss: round2(n((line as any).benefit_sss)),
    benefit_philhealth: round2(n((line as any).benefit_philhealth)),
    benefit_pagibig: round2(n((line as any).benefit_pagibig)),

    // employee loans
    loan_vale: round2(n((line as any).loan_vale)),
    loan_car: round2(n((line as any).loan_car)),
    loan_coop: loanCoop,
    // ✅ mirror to coop_loan too (important if UI/API reads this column instead)
    coop_loan: loanCoop,

    loan_total: round2(n((line as any).loan_total)),

    // benefit loans (canonical compute fields)
    benefit_loan_sss: round2(n((line as any).benefit_loan_sss)),
    benefit_loan_pagibig: round2(n((line as any).benefit_loan_pagibig)),
    benefit_loan_total: round2(n((line as any).benefit_loan_total)),

    // legacy duplicates if your DB still has them; keep mirrored to prevent reporting drift
    benefit_sss_loan: round2(n((line as any).benefit_loan_sss)),
    benefit_pagibig_loan: round2(n((line as any).benefit_loan_pagibig)),

    // other deductions
    dr_deduction: round2(n((line as any).dr_deduction)),
    other_deductions: round2(n((line as any).other_deductions)),
    manual_deductions: round2(n((line as any).manual_deductions)),

    // totals
    total_additions: round2(n((line as any).total_additions)),
    total_deductions: round2(n((line as any).total_deductions)),
    gross_pay: round2(n((line as any).gross_pay)),
    net_pay: round2(n((line as any).net_pay)),

    // flags / variance
    previous_net_pay: round2(n((line as any).previous_net_pay)),
    variance_amount: varianceAmount,
    // ✅ mirror variance_amount_ui so the UI doesn't see null/0 unexpectedly
    variance_amount_ui: round2(n((line as any).variance_amount_ui ?? varianceAmount)),
    variance_pct: (line as any).variance_pct == null ? null : n((line as any).variance_pct),
    variance_flag: (line as any).variance_flag ? 1 : 0,

    on_hold: (line as any).on_hold ? 1 : 0,

    // proration flags
    is_prorated: isProrated,
    proration_json: (line as any).proration_json ?? null,

    // json blobs
    breakdown_json: (line as any).breakdown_json ?? null,

    created_by: args.createdBy ?? null,
  };
}
