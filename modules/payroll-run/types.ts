// modules/payroll-run/types.ts

// ------------------------------
// Core enums / primitives
// ------------------------------
export type PayrollStep = 1 | 2 | 3 | 4;

export type CutoffType = "FIRST" | "SECOND";
export type BenefitCode = "SSS" | "PHILHEALTH" | "PAGIBIG";

export type ManualEntryType = "EARNING" | "DEDUCTION";
export type AdjustmentType = "EARNING" | "DEDUCTION";

// ------------------------------
// Prototype-only / legacy types (kept to avoid TS errors)
// ------------------------------
export interface Adjustment {
  type: AdjustmentType;
  desc: string;
  amount: number; // positive numeric value
  recurring?: boolean;
}

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
  value: string; // "ALL" | "IT" | etc.
  label: string;
}

// ✅ must match how PayrollRunModule uses it
export type PayrollConfigState = {
  cutoffId: number | null;
  departmentId: number | null;
};

export interface ProratedPayResult {
  amount: number;
  isProrated: boolean;
  // Free-form details shown in UI only; do not parse.
  details?: {
    changeEffectiveDate: string;
    oldBasic: number;
    newBasic: number;
    daysOnOldRate: number;
    daysOnNewRate: number;
    oldDaily: number;
    newDaily: number;
    payOld: number;
    payNew: number;
    totalProrated: number;
  };
}

// ------------------------------
// Directus-backed entities
// ------------------------------
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
  status?: string | null; // OPEN, CLOSED, etc.
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

  is_deleted?: number; // 0/1
}

export interface WageProfile {
  id: number;
  user_id: number;

  daily_wage: number;
  hourly_wage: number;
  monthly_wage: number;

  is_deleted?: number; // 0/1
  isCard?: number; // 0/1
  is_card?: number; // alias for isCard

  // ✅ paid_holiday: 1 = entitled to all holiday pay; 0 = excluded from all holiday pay
  paid_holiday?: number; // 0/1

  // optional stored monthly contributions (employee share)
  sss_employee?: number;
  philhealth_employee?: number;
  pagibig_employee?: number;
}

export type AttendanceApprovalStatus =
  | "approved"
  | "rejected"
  | "pending"
  | string;

export interface AttendanceApproval {
  approval_id: number;
  employee_id: number;

  date_schedule: string; // YYYY-MM-DD

  approved_by?: number;
  approved_at?: string;

  work_minutes: number;
  late_minutes: number;
  undertime_minutes: number;
  overtime_minutes: number;

  night_diff_minutes?: number;

  remarks?: string | null;
  status: AttendanceApprovalStatus;
}

export type HolidayType = "REGULAR" | "SPECIAL" | "SPECIAL_NON_WORKING" | string;

export interface HolidayRow {
  id: number;
  holiday_date: string; // YYYY-MM-DD
  holiday_name?: string | null;
  holiday_type: HolidayType;

  // NOTE: compute.ts reads `is_paid` and `last_working_day` from Directus row as well
  is_active?: number;
  is_paid?: number; // 0/1
  last_working_day?: string | null; // YYYY-MM-DD
}

// ------------------------------
// Manual entries (adjustments)
// ------------------------------
//
// IMPORTANT: payrollRunService + compute.ts are using user_id/cutoff_id on manual entries.
// Keep these optional so UI can still pass minimal objects.
//
export type ManualEntry = {
  id?: number | string;

  cutoff_id?: number;
  user_id?: number;

  type: ManualEntryType;
  desc: string;
  amount: number;

  // classification / printing
  category?: string | null; // e.g. SHORTAGE, DR_PAYMENT, MANUAL, etc.
  deduction_kind?: string | null;

  // safe metadata passthrough
  meta?: unknown;
};

// ------------------------------
// Loans / benefits
// ------------------------------
export type EmployeeLoanStatus = "ACTIVE" | "INACTIVE" | "CLOSED" | string;

export interface EmployeeLoan {
  loan_id: number;
  user_id: number;

  loan_type: string; // VALE | CAR LOAN | COOP | etc (your system)
  monthly_payment: number;

  start_date: string; // YYYY-MM-DD
  end_date: string | null;

  status: EmployeeLoanStatus;
}

export type DeductOn = "FIRST" | "SECOND" | "BOTH" | string;

export interface BenefitLoanRow {
  loan_id: number;
  user_id: number;

  benefit_code: string; // "SSS" | "PAGIBIG" etc (keep wide to match Directus)
  loan_name?: string | null;

  amortization_amount?: number;
  deduct_on?: DeductOn;

  remaining_balance?: number;

  status?: string;

  start_cutoff_id?: number;
  last_paid_cutoff_id?: number | null;

  reference_no?: string | null;
}

// ------------------------------
// Benefit Logs
// ------------------------------
export type BenefitLogType = "CONTRIBUTION" | "LOAN";

export interface BenefitLog {
  benefit_log_id: number;
  cutoff_id: number;
  user_id: number;
  benefit_code: BenefitCode;
  log_type: BenefitLogType;
  loan_id?: number | null;
  source_amount: number;
  deducted_amount: number;
  payroll_run_id: number;
  payroll_detail_id?: string | null;
  note?: string | null;
  created_date?: string;
}

// ------------------------------
// Allowances
// ------------------------------
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
}

export interface AllowanceAppliedItem {
  allowance_id: number;
  description: string;
  pay_cycle: AllowancePayCycle;
  is_recurring: boolean;
  amount_raw: number;
  amount_this_cutoff: number;
}
export interface RetroPayRow {
  retro_id: number; // PK
  user_id: number;
  amount: number;
  description?: string | null;
  cutoff_start: string; // YYYY-MM-DD
  cutoff_end: string; // YYYY-MM-DD
  is_processed: number; // 0/1
  created_by?: number | null;
  created_date?: string;
  updated_by?: number | null;
  updated_date?: string | null;
}

export interface CoopSavingsMembershipRow {
  id: number; // PK
  user_id: number;
  membership_id: string;
  monthly_amount: number;

  total_collection?: number;
  total_months?: number;

  start_date: string; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD | null
  is_active: number; // 0/1

  created_by?: number | null;
  created_date?: string;
  updated_by?: number | null;
  updated_date?: string | null;
}

// ------------------------------
// Wage proration logs
// ------------------------------
export interface WageProrationLog {
  id: number;
  user_id: number;

  previous_daily_wage: number;
  new_daily_wage: number;

  effective_date: string; // YYYY-MM-DD
  created_at: string | null;
}

// ------------------------------
// Payroll run header
// ------------------------------
export type PayrollRunStatus =
  | "DRAFT"
  | "POSTED"
  | "PROCESSED"
  | "CANCELLED"
  | string;

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

  // UI aliases / derived fields
  cutoff_label?: string | null;
  cutoffLabel?: string | null;
  payrollRunId?: number; // alias for payroll_run_id
}

// ------------------------------
// Workspace + summary
// ------------------------------
export interface PayrollSummary {
  headcount: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  variance_alerts: number;
  companyName?: string;
}

export interface PayrollWorkspace {
  cutoff: CutoffSetting;
  department: Department | null;

  employees: UserRow[];
  lines: PayrollComputedLine[];
  computedLines?: PayrollComputedLine[]; // alias
  computed?: PayrollComputedLine[]; // alias
  results?: PayrollComputedLine[]; // alias

  wages: Map<number, WageProfile>;
  attendance: Map<number, AttendanceApproval[]>;

  holidays: HolidayRow[];

  manualEntries: Map<number, ManualEntry[]>;

  // ✅ NEW (Option B tables)
  retroPays: Map<number, RetroPayRow[]>;
  coopSavingsMemberships: Map<number, CoopSavingsMembershipRow[]>;

  benefitSettings: BenefitCutoffSetting[];
  benefitMultipliers: Record<BenefitCode, number>;

  employeeLoans: Map<number, EmployeeLoan[]>;
  benefitLoans: Map<number, BenefitLoanRow[]>;

  allowances: Map<number, EmployeeAllowance[]>;

  wageProrationLogs: Map<number, WageProrationLog[]>;

  companyName?: string;
}


export type BreakdownItem = {
  item_key: string;
  type: "EARNING" | "DEDUCTION";
  category: string;
  code?: string | null;
  description: string;
  label?: string; // legacy support
  amount: number;
  source_table?: string | null;
  source_id?: string | number | null;
  meta?: unknown;
};

export type PayrollBreakdownJson = {
  is_card?: number;
  flags?: Record<string, unknown>;
  rates?: {
    wage_profile?: {
      daily?: number;
      hourly?: number;
      monthly?: number;
    };
    base_daily?: number;
    base_hourly?: number;
    [key: string]: unknown;
  };

  earnings?: {
    basic_pay?: number;
    ot_amount?: number;
    holiday_pay?: number;
    rest_day_amount?: number;
    night_diff_amount?: number;
    allowance_total?: number;
    manual_additions?: number;
    retro_pay?: number;
    retro_items?: BreakdownItem[];

    holiday_items?: unknown[];
    allowance_items?: unknown[];
    manual_addition_items?: unknown[];
    [key: string]: unknown;
  };

  deductions?: {
    late_deduction?: number;
    undertime_deduction?: number;
    shortage_deduction?: number;
    dr_deduction?: number;

    coop_savings?: number;
    coop_savings_items?: BreakdownItem[];
    coop_loan?: number;
    coop_loan_items?: BreakdownItem[];

    benefits?: {
      sss?: number;
      philhealth?: number;
      pagibig?: number;
    };
    benefit_loans?: {
      total?: number;
      items?: unknown[];
    };
    employee_loan_items?: unknown[];
    manual_deduction_items?: unknown[];

    other_deductions?: number;
    manual_deductions?: number;
    [key: string]: unknown;
  };

  totals?: {
    gross_pay: number;
    total_deductions: number;
    net_pay: number;
  };

  cutoff?: {
    start: string;
    end: string;
    type?: string;
    id?: number;
  };

  policies?: Record<string, unknown>;
  proration?: Record<string, unknown>;
};


// ------------------------------
// Computed breakdown per employee
// ------------------------------
export interface PayrollComputedLine {
  user_id: number;

  employee_name: string;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  position_name?: string | null;
  position_snapshot?: string | null;
  department_name?: string | null;
  department_name_snapshot?: string | null;
  department_snapshot?: string | null;

  // rates
  daily_rate: number;
  basic_daily_rate?: number;
  hourly_rate: number;
  monthly_rate: number;

  // attendance totals
  total_days_worked: number;
  total_work_minutes: number;
  total_hours_worked?: number;

  late_minutes: number;
  undertime_minutes: number;
  overtime_minutes: number;
  night_diff_minutes: number;

  // earnings
  basic_pay: number;
  ot_amount: number;
  leave_amount?: number;

  // holiday totals (legacy mirror)
  holiday?: number;
  holiday_pay: number;
  holiday_days: number;

  rest_day_amount: number;
  night_diff_amount: number;

  allowance: number;
  retro_pay: number;
  retro_remarks?: string | null;
  manual_additions: number;

  // deductions
  late_deduction: number;
  undertime_deduction: number;
  shortage_deduction: number;

  // benefits contributions
  benefit_sss: number;
  benefit_philhealth: number;
  benefit_pagibig: number;

  // employee loans (50/50 per cutoff)
  loan_vale: number;
  loan_car: number;
  loan_coop: number;
  loan_total: number;

  // benefit loans (SSS/PAGIBIG)
  benefit_loan_sss?: number;
  benefit_loan_pagibig?: number;
  benefit_loan_total?: number;

  // coop / misc (optional: used by payload builder)
  coop_savings?: number;
  coop_loan?: number;

  // system deductions
  dr_deduction: number;
  other_deductions: number;
  manual_deductions: number;

  // totals
  total_additions: number;
  total_deductions: number;
  gross_pay: number;
  net_pay: number;

  // variance tracking
  previous_net_pay: number;
  variance_amount_ui?: number;
  variance_amount?: number;
  variance_pct: number | null;
  variance_flag: boolean;

  // hold
  on_hold: boolean;
  is_card?: number;

  // proration
  is_prorated?: boolean;
  proration_json?: unknown | null;

  // printable details
  breakdown_json?: PayrollBreakdownJson;
}
