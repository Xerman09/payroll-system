// modules/payroll-run/types.ts

export type PayrollStep = 1 | 2 | 3 | 4;

export type PayrollRunStatus = "DRAFT" | "PROCESSED" | "POSTED" | "VOID";
export type CutoffType = "FIRST" | "SECOND";

export type ManualEntryType = "EARNING" | "DEDUCTION";

export type BenefitCode = "SSS" | "PAGIBIG" | "PHILHEALTH";
export type BenefitLoanCode = "SSS" | "PAGIBIG";
export type BenefitLoanDeductOn = "FIRST" | "SECOND" | "BOTH";
export type BenefitLoanStatus = "ACTIVE" | "CLOSED" | "CANCELLED";

export interface BenefitLoanRow {
  loan_id: number;
  user_id: number;
  benefit_code: BenefitLoanCode;
  loan_name?: string | null;
  reference_no?: string | null;

  amortization_amount: number;

  deduct_on: BenefitLoanDeductOn;
  start_cutoff_id: number;

  remaining_balance: number;
  last_paid_cutoff_id?: number | null;

  status: BenefitLoanStatus;
}

export interface BenefitCutoffSetting {
  id: number;
  benefit_code: BenefitCode;
  benefit_name: string;
  cutoff: CutoffType; // FIRST / SECOND
  is_active: number; // 1/0
  effective_from: string | null; // YYYY-MM-DD
  effective_to: string | null;   // YYYY-MM-DD
}

export interface CutoffSetting {
  id: number;
  cutoff_type: CutoffType; // FIRST / SECOND
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  payout_date?: string | null;
  status?: string | null; // ACTIVE, etc.
}

export interface Department {
  id: number;
  name: string;
}

export interface UserRow {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  department_id?: number | null;
  position?: string | null;
  is_deleted?: number | null;
}

export interface WageProfile {
  id: number;
  user_id: number;
  daily_wage: number;
  monthly_wage: number;
  hourly_wage: number;
  is_deleted?: number | null;

  // monthly employee values (your system stores monthly)
  sss_employee?: number | null;
  philhealth_employee?: number | null;
  pagibig_employee?: number | null;

  [k: string]: unknown;
}

export interface AttendanceApproval {
  approval_id: number;
  employee_id: number;
  date_schedule: string; // YYYY-MM-DD
  work_minutes: number;
  late_minutes: number;
  undertime_minutes: number;
  overtime_minutes: number;
  night_diff_minutes?: number | null;
  status: "approved" | "rejected";
}

export type HolidayKind = "REGULAR" | "SPECIAL_NON_WORKING";

export interface HolidayRow {
  id: number;
  holiday_date: string; // YYYY-MM-DD
  holiday_type: HolidayKind;
  description?: string | null;
  last_working_day?: string | null;
}

export interface PayrollRunHeader {
  payroll_run_id: number;
  cutoff_id: number;
  cutoff_type: CutoffType;
  cutoff_start: string;
  cutoff_end: string;
  department_id: number | null;
  status: PayrollRunStatus;
  payroll_ref_no: string;
  headcount: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  variance_alert_count: number;
  remarks?: string | null;
  created_by: number;
  created_at: string;
  processed_at?: string | null;
  posted_by?: number | null;
  posted_at?: string | null;
}

export interface ManualEntry {
  id?: number;
  cutoff_id: number;
  user_id: number;
  type: ManualEntryType;
  desc: string;
  amount: number;
  category?: string | null;
}

export interface PayrollConfigState {
  cutoffId: number | null;
  departmentId: number | null; // null = ALL
}

/** Employee loans table */
export type EmployeeLoanType = "VALE" | "CAR LOAN" | "COOP";
export type EmployeeLoanStatus = "ACTIVE" | "PAID" | "CANCELLED";

export interface EmployeeLoan {
  loan_id: number;
  user_id: number;
  loan_type: EmployeeLoanType;
  monthly_payment: number;
  start_date: string; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD | null
  status: EmployeeLoanStatus;
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

  // benefits (based on benefit_cutoff_settings)
  benefit_sss: number;
  benefit_philhealth: number;
  benefit_pagibig: number;

  // employee loans (50/50 per cutoff)
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
  benefit_loans: number; // already exists in your file
  // ADD THESE:
  benefit_loan_sss: number;
  benefit_loan_pagibig: number;
}

export interface PayrollSummary {
  headcount: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  variance_alerts: number;
}

export interface PayrollWorkspace {
  cutoff: CutoffSetting;
  department: Department | null;
  employees: UserRow[];
  wages: Map<number, WageProfile>;
  attendance: Map<number, AttendanceApproval[]>;
  holidays: HolidayRow[];
  manualEntries: Map<number, ManualEntry[]>;

  // NEW:
  benefitSettings: BenefitCutoffSetting[];
  benefitMultipliers: Record<BenefitCode, number>; // 1 or 0 (or 0.5 fallback)
  employeeLoans: Map<number, EmployeeLoan[]>;
  benefitLoans: Map<number, BenefitLoanRow[]>;


}
