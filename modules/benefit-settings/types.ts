// modules/benefit-settings/types.ts
export type BenefitCode = "SSS" | "PAGIBIG" | "PHILHEALTH";
export type CutoffType = "FIRST" | "SECOND" | null;

// === Benefit Settings (existing) ===
export interface BenefitSetting {
  id: number;
  benefit_code: BenefitCode;
  benefit_name: string;
  cutoff: CutoffType;
  is_active: number;
  effective_from: string | null;
  effective_to: string | null;
  updated_by: number | null;
  updated_date: string | null;
}

export interface UserData {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_department?: number | null;
  user_position?: string | null;
  user_sss?: string | null;
  user_philhealth?: string | null;
  user_pagibig?: string | null;
  user_tin?: string | null;
  is_deleted?: boolean | number | { data?: number[] } | null;
  is_employee?: boolean | number | null;
}

export interface UserWageRecord {
  id: number;
  user_id: number;
  daily_wage?: number | string | null;
  monthly_rate?: number | string | null;
  sss_contribution_monthly?: number | string | null;
  philhealth_contribution_monthly?: number | string | null;
  pagibig_contribution_monthly?: number | string | null;
  working_days_per_month?: number | string | null;
  schedule_id?: number | null;
  cutoff_wage_date_update?: string | null;
  updated_by?: number | null;
  updated_date?: string | null;
}

export interface EmployeeBenefitDetail {
  enrolled: boolean;
  account_no: string | null;
  personal_share: number;
  counterpart_share: number; // Employer or LGU share
  total_contribution: number;
}

export interface EmployeeActiveLoanSummary {
  loan_id: number;
  benefit_code: LoanBenefitCode;
  loan_name: string | null;
  reference_no: string | null;
  principal_amount: number;
  amortization_amount: number;
  remaining_balance: number;
  deduct_on: DeductOn;
  status: BenefitLoanStatus;
}

export interface EmployeeBenefitCoverage {
  user_id: number;
  employee_name: string;
  department_id: number | null;
  department_name: string;
  position: string | null;
  daily_wage: number;
  monthly_rate: number;

  // Statutory coverage
  sss: EmployeeBenefitDetail;
  philhealth: EmployeeBenefitDetail;
  pagibig: EmployeeBenefitDetail;

  // Loans
  loans: EmployeeActiveLoanSummary[];
  total_loan_amortization: number;

  // Aggregate monthly amounts
  total_personal_share: number;
  total_counterpart_share: number;
  grand_total_monthly: number;

  // Coverage flags
  has_any_benefit: boolean;
  has_all_benefits: boolean;
  has_sss: boolean;
  has_philhealth: boolean;
  has_pagibig: boolean;
  has_loans: boolean;

  has_sss_amount: boolean;
  has_philhealth_amount: boolean;
  has_pagibig_amount: boolean;
  has_sss_id: boolean;
  has_philhealth_id: boolean;
  has_pagibig_id: boolean;

  is_active: boolean;
  is_deleted: boolean;

  coverage_summary: "FULL" | "PARTIAL" | "NONE";
}

export type BenefitReportFilter = "ALL" | "SSS" | "PHILHEALTH" | "PAGIBIG" | "LOANS";
export type CoverageStatusFilter =
  | "ALL"
  | "ACTIVE_ONLY"
  | "INACTIVE_ONLY"
  | "HAS_SSS"
  | "NO_SSS"
  | "HAS_PHILHEALTH"
  | "NO_PHILHEALTH"
  | "HAS_PAGIBIG"
  | "NO_PAGIBIG"
  | "FULL_COVERAGE"
  | "WITH_BENEFIT"
  | "WITHOUT_BENEFIT"
  | "WITH_LOAN"
  | "HAS_SSS_ID"
  | "MISSING_SSS_ID";



export interface Department {
  department_id: number;
  department_name: string;
}


// === Cutoff settings (needed for loan schedule display) ===
export interface CutoffSetting {
  id: number;
  cutoff_type: "FIRST" | "SECOND";
  start_date: string;
  end_date: string;
  period_status?: string;
}

// === Benefit Loans (NEW) ===
// PhilHealth has NO loans
export type LoanBenefitCode = Exclude<BenefitCode, "PHILHEALTH">; // "SSS" | "PAGIBIG"
export type BenefitLoanStatus = "ACTIVE" | "CLOSED" | "CANCELLED";
export type DeductOn = "FIRST" | "SECOND" | "BOTH";

export interface BenefitLoan {
  loan_id: number;

  user_id: number;
  benefit_code: LoanBenefitCode;

  loan_name: string | null;
  reference_no: string | null;

  principal_amount: number;
  interest_amount: number;
  total_payable: number;

  amortization_amount: number;
  terms_installments: number;

  deduct_on: DeductOn;
  start_cutoff_id: number;

  paid_installments: number;
  remaining_balance: number;
  last_paid_cutoff_id: number | null;

  status: BenefitLoanStatus;
  remarks: string | null;

  created_by: number | null;
  created_date: string;
  updated_by: number | null;
  updated_date: string | null;
}

// === Benefit Logs (REFECTORED; VIEW ONLY) ===
export type BenefitLogType = "CONTRIBUTION" | "LOAN";

export interface BenefitLogRow {
  benefit_log_id: string | number; // unique key for UI

  cutoff_id: number;
  cutoff_start?: string | null;
  cutoff_end?: string | null;
  cutoff_type?: string | null;

  user_id: number;
  employee_name?: string;
  account_no?: string | null;

  benefit_code: BenefitCode;
  benefit_name?: string;

  log_type: BenefitLogType;
  loan_id: number | null;

  source_amount: number;
  deducted_amount: number;

  payroll_run_id: number;
  payroll_ref_no?: string;
  posted_at?: string | null;

  note: string | null;
  created_date: string;
}
