// modules/payroll-run/types.ts

export type PayrollStep = 1 | 2 | 3 | 4;

export type CutoffType = "FIRST" | "SECOND";
export type BenefitCode = "SSS" | "PHILHEALTH" | "PAGIBIG";

export type AdjustmentType = "EARNING" | "DEDUCTION";

export interface Adjustment {
  type: AdjustmentType;
  desc: string;
  amount: number; // positive numeric value
  recurring?: boolean;
}

/**
 * Legacy/prototype employee row (keep if other UI files still reference it)
 */
export interface EmployeeRow {
  id: number;
  name: string;
  position: string;
  department: string;
  basic: number; // monthly basic salary
  previousNet: number; // previous cutoff's net pay
  onHold: boolean;
  adjustments: Adjustment[];
}

export interface BenefitCutoffSetting {
  id: number;
  benefit_code: BenefitCode;
  benefit_name: string;
  cutoff: CutoffType; // FIRST / SECOND
  is_active: number; // 1/0
  effective_from: string | null; // YYYY-MM-DD
  effective_to: string | null; // YYYY-MM-DD
}

export interface CutoffSetting {
  id: number;
  cutoff_type: CutoffType; // FIRST / SECOND
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  payout_date?: string | null;
  status?: string | null; // OPEN/ACTIVE/etc
}

export interface Department {
  id: number;
  name: string;
  // allow extra fields from API
  [k: string]: any;
}

export interface UserRow {
  id: number;
  first_name: string | null;
  last_name: string | null;
  department_id: number | null;
  position: string | null;
  is_deleted: number; // 1/0
  // allow extra fields from API
  [k: string]: any;
}

export interface WageProfile {
  id: number;
  user_id: number;

  daily_wage: number;
  hourly_wage: number;
  monthly_wage: number;

  is_deleted: number; // 1/0

  // employee share (monthly baseline)
  sss_employee: number;
  philhealth_employee: number;
  pagibig_employee: number;

  // allow extra fields from API
  [k: string]: any;
}

/**
 * Attendance approval row (from attendance_approval)
 * Keep fields used by compute + payrollRunService; other fields can exist.
 */
export interface AttendanceApproval {
  approval_id?: number;
  employee_id: number;
  date_schedule: string; // YYYY-MM-DD

  work_minutes: number;
  late_minutes: number;
  undertime_minutes: number;
  overtime_minutes: number;

  // optional
  night_diff_minutes?: number;

  status?: "approved" | "rejected" | string;

  [k: string]: any;
}

export type HolidayType = "REGULAR" | "SPECIAL" | "LOCAL" | "N/A" | string;

export interface HolidayRow {
  id?: number;
  holiday_date: string; // YYYY-MM-DD
  holiday_name?: string | null;
  holiday_type: HolidayType;

  [k: string]: any;
}

export type ManualEntryType = "EARNING" | "DEDUCTION";

export interface ManualEntry {
  id: number;
  cutoff_id: number;
  user_id: number;
  type: ManualEntryType;
  desc: string;
  amount: number;
  category: string | null;
}

export type LoanType = "VALE" | "CAR" | "COOP" | string;

export interface EmployeeLoan {
  loan_id: number;
  user_id: number;
  loan_type: LoanType;
  monthly_payment: number;
  start_date: string; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD | null
  status: "ACTIVE" | "CLOSED" | "CANCELLED" | string;

  [k: string]: any;
}

export type DeductOn = "FIRST" | "SECOND" | "BOTH" | string;

export interface BenefitLoanRow {
  loan_id?: number;
  id?: number;

  user_id: number;
  benefit_code: BenefitCode;

  amortization_amount?: number;
  deduct_on?: DeductOn;

  remaining_balance?: number;

  status?: "ACTIVE" | "CLOSED" | string;

  [k: string]: any;
}

/** Allowances */
export type AllowancePayCycle = "N/A" | "PER_CUTOFF" | "PER_MONTH";

export interface EmployeeAllowance {
  allowance_id: number;
  user_id: number;
  amount: number;
  description?: string | null;

  // one-time window
  cutoff_start?: string | null; // YYYY-MM-DD | null
  cutoff_end?: string | null; // YYYY-MM-DD | null

  // recurring controls
  is_recurring: number; // 1/0
  is_active: number; // 1/0
  pay_cycle: AllowancePayCycle;

  start_date?: string | null; // YYYY-MM-DD | null
  end_date?: string | null; // YYYY-MM-DD | null

  // processing flag (esp one-time)
  is_processed: number; // 1/0

  created_by?: number | null;
  created_date?: string | null;
  updated_by?: number | null;
  updated_date?: string | null;

  [k: string]: any;
}

export interface AllowanceAppliedItem {
  allowance_id: number;
  description: string;
  pay_cycle: AllowancePayCycle;
  is_recurring: boolean;
  amount_raw: number;
  amount_this_cutoff: number;
}

/** Wage proration logs */
export interface WageProrationLog {
  id: number;
  user_id: number;
  previous_daily_wage: number;
  new_daily_wage: number;
  effective_date: string; // YYYY-MM-DD
  created_at: string | null;

  [k: string]: any;
}

/** Payroll run header */
export type PayrollRunStatus = "DRAFT" | "POSTED" | "CANCELLED" | "VOID" | string;

export interface PayrollRunHeader {
  payroll_run_id: number;
  cutoff_id: number;
  cutoff_type: CutoffType;
  cutoff_start: string; // YYYY-MM-DD
  cutoff_end: string; // YYYY-MM-DD

  department_id: number | null;

  status: PayrollRunStatus;
  payroll_ref_no: string;

  headcount: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;

  variance_alert_count: number;

  remarks: string | null;

  created_by: number;
  created_at: string;

  processed_at: string | null;

  posted_by: number | null;
  posted_at: string | null;

  [k: string]: any;
}

/** Computed breakdown per employee */
export interface PayrollComputedLine {
  user_id: number;
  employee_name: string;
  position?: string | null;
  department_name?: string | null;

  // rates
  daily_rate: number;
  hourly_rate: number;
  monthly_rate: number;

  // attendance totals
  total_days_worked: number;
  total_work_minutes: number;
  late_minutes: number;
  undertime_minutes: number;
  overtime_minutes: number;
  night_diff_minutes: number;

  // earnings
  basic_pay: number;
  ot_amount: number;
  holiday_pay: number;
  rest_day_amount: number;
  night_diff_amount: number;
  allowance: number;
  retro_pay: number;
  manual_additions: number;

  // deductions
  late_deduction: number;
  undertime_deduction: number;
  shortage_deduction: number;

  // benefits
  benefit_sss: number;
  benefit_philhealth: number;
  benefit_pagibig: number;

  // employee loans
  loan_vale: number;
  loan_car: number;
  loan_coop: number;
  loan_total: number;

  dr_deduction: number;
  other_deductions: number;
  manual_deductions: number;

  total_additions: number;
  total_deductions: number;
  gross_pay: number;
  net_pay: number;

  previous_net_pay: number;
  variance_pct: number | null;
  variance_flag: boolean;

  on_hold: boolean;

  breakdown_json?: Record<string, unknown>;

  // benefit loans
  benefit_loans: number;
  benefit_loan_sss: number;
  benefit_loan_pagibig: number;
  benefit_loan_total: number;

  allowance_items?: AllowanceAppliedItem[];

  [k: string]: any;
}

/**
 * Summary (current + legacy compatibility)
 */
export interface PayrollSummary {
  // current
  headcount: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  variance_alerts: number;

  // legacy optional (if other UI still uses them)
  totalNet?: number;
  activeHeadcount?: number;
  varianceAlerts?: number;
}

export interface PayrollWorkspace {
  cutoff: CutoffSetting;
  department: Department | null;

  employees: UserRow[];
  wages: Map<number, WageProfile>;
  attendance: Map<number, AttendanceApproval[]>;

  holidays: HolidayRow[];
  manualEntries: Map<number, ManualEntry[]>;

  benefitSettings: BenefitCutoffSetting[];
  benefitMultipliers: Record<BenefitCode, number>;

  employeeLoans: Map<number, EmployeeLoan[]>;
  benefitLoans: Map<number, BenefitLoanRow[]>;

  allowances: Map<number, EmployeeAllowance[]>;

  // ✅ REQUIRED by payrollRunService.ts
  wageProrationLogs: Map<number, WageProrationLog[]>;
}

/**
 * Optional: if you still have older compute code referencing these.
 */
export interface SalaryHistoryEntry {
  user_id: number;
  old_basic: number;
  new_basic: number;
  effective_date: string; // YYYY-MM-DD
}

export interface PayrollCutoffOption {
  value: string; // "YYYY-MM-DD_YYYY-MM-DD"
  label: string;
}

export interface PayrollDepartmentOption {
  value: string; // "ALL" | etc.
  label: string;
}

export interface PayrollConfigState {
  cutoffValue: string;
  departmentValue: string;
}
