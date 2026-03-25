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
}

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
