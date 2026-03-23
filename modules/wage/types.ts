// @modules/wage/types.ts

export type LoanType = "VALE" | "CAR LOAN" | "COOP";

export type Department = {
  department_id: number;
  department_name: string;
};

export type Employee = {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_department?: number | null;

  // BIT(1) in MySQL often maps to boolean or 0/1 in JS.
  is_deleted?: boolean | number | null;
};

export type WageDataState = {
  id?: number | null;

  // Salary Grade link
  schedule_id: number | null;

  dailyWageInput: string;
  dailyWage: number;
  vacationLeave: number;
  sickLeave: number;
  isPaidHoliday: boolean;
  isCard: boolean;

  sss: string;
  pagibig: string;
  philhealth: string;

  lastUpdatedBy: string;
  lastUpdateDate: string;
};

export type WageRecord = {
  id: number;
  user_id: number;

  daily_wage: string | number;
  vacation_leave_per_year: string | number;
  sick_leave_per_year: string | number;

  paid_holiday: 0 | 1 | number;
  isCard: 0 | 1 | number;

  sss_contribution_monthly: string | number | null;
  pagibig_contribution_monthly: string | number | null;
  philhealth_contribution_monthly: string | number | null;

  /** FK → salary_schedules.schedule_id; null when no grade is linked */
  schedule_id: number | null;

  cutoff_wage_date_update?: string | null;

  created_by: number | null;
  created_date: string;
  updated_by: number | null;
  updated_date: string | null;
};

export type WagePayload = {
  user_id: number;

  daily_wage: number;
  vacation_leave_per_year: number;
  sick_leave_per_year: number;

  paid_holiday: 0 | 1;
  isCard: 0 | 1;

  updated_by: number;

  sss_contribution_monthly: string;
  pagibig_contribution_monthly: string;
  philhealth_contribution_monthly: string;

  /** FK → salary_schedules.schedule_id; null to unlink */
  schedule_id?: number | null;

  cutoff_wage_date_update?: string;
};

export type WageProrationLogPayload = {
  user_id: number;
  previous_daily_wage: number;
  new_daily_wage: number;
  effective_date: string; // YYYY-MM-DD
  cutoff_id: number;
  updated_by: number;
};

export type EmployeeLoanRecord = {
  loan_id: number;
  user_id: number;

  loan_type: LoanType;
  loan_amount: string | number;
  months_to_pay: number;
  monthly_payment: string | number;

  start_date: string;
  end_date: string | null;

  interest_rate: string | number;
  interest_amount: string | number;
  net_amount_released: string | number;

  accumulated_amount: string | number;

  status: "ACTIVE" | "PAID" | "CANCELLED";

  created_by: number | null;
  created_date: string;
  updated_by: number | null;
  updated_date: string | null;
};

export type EmployeeLoanCreatePayload = {
  user_id: number;

  loan_type: LoanType;
  loan_amount: number;
  months_to_pay: number;
  monthly_payment: number;

  start_date: string;
  end_date: string | null;

  interest_rate: number;
  interest_amount: number;
  net_amount_released: number;

  accumulated_amount: number;

  status: "ACTIVE" | "PAID" | "CANCELLED";

  created_by: number;
  updated_by: number;
};

export type EmployeeLoanPatchPayload = Partial<{
  loan_type: LoanType;
  loan_amount: number;
  months_to_pay: number;
  monthly_payment: number;

  start_date: string;
  end_date: string | null;

  interest_rate: number;
  interest_amount: number;
  net_amount_released: number;

  status: "ACTIVE" | "PAID" | "CANCELLED";

  updated_by: number;
}>;

export type RetroPayRecord = {
  retro_id: number;
  user_id: number;

  amount: string | number;
  description: string | null;

  cutoff_start: string;
  cutoff_end: string;

  is_processed: 0 | 1;

  created_by: number | null;
  created_date: string;
  updated_by: number | null;
  updated_date: string | null;
};

export type RetroPayDraft = {
  amount: string;
  description: string;

  cutoff_setting_id: number | null;
  cutoff_start: string;
  cutoff_end: string;

  is_processed: 0 | 1;
};

export type RetroPayCreatePayload = {
  user_id: number;
  amount: number;
  description: string | null;
  cutoff_start: string;
  cutoff_end: string;
  is_processed: 0 | 1;
  created_by: number;
  updated_by: number;
};

export type RetroPayPatchPayload = Partial<{
  amount: number;
  description: string | null;
  cutoff_start: string;
  cutoff_end: string;
  is_processed: 0 | 1;
  updated_by: number;
}>;

export type CutoffSetting = {
  id: number;
  cutoff_type: "FIRST" | "SECOND";
  year: number;
  month: number;
  start_date: string;
  end_date: string;
  payout_date: string;
  period_status: "OPEN" | "CLOSED" | string;
  status: "published" | "draft" | string;
  created_by: string | number | null;
  updated_by: string | number | null;
  date_created: string;
  date_updated: string;
};

// =======================================================
// PAYROLL OTHER ADDITIONS / DEDUCTIONS
// =======================================================

export type PayrollOtherAdditionRecord = {
  id: number;
  user_id: number;

  amount: string | number;
  description: string | null;

  cutoff_start: string; // YYYY-MM-DD
  cutoff_end: string; // YYYY-MM-DD

  created_by: number | null;
  created_date: string;
};

export type PayrollOtherDeductionRecord = {
  id: number;
  user_id: number;

  amount: string | number;
  type?: "SHORTAGE" | "MANUAL";
  description: string | null;

  cutoff_start: string; // YYYY-MM-DD
  cutoff_end: string; // YYYY-MM-DD

  created_by: number | null;
  created_date: string;
};

export type PayrollOtherADDraft = {
  amount: string;
  description: string;

  // UI-only helper (not part of DDL); we use it to choose a cutoff then store dates.
  cutoff_setting_id: number | null;

  cutoff_start: string; // YYYY-MM-DD
  cutoff_end: string; // YYYY-MM-DD
};

export type PayrollOtherAdditionCreatePayload = {
  user_id: number;
  amount: number;
  description: string | null;
  cutoff_start: string; // YYYY-MM-DD
  cutoff_end: string; // YYYY-MM-DD
  created_by: number | null;
};

export type PayrollOtherAdditionPatchPayload = Partial<
  Omit<PayrollOtherAdditionCreatePayload, "user_id" | "created_by">
>;

export type PayrollOtherDeductionCreatePayload = {
  user_id: number;
  amount: number;
  type?: "SHORTAGE" | "MANUAL";
  description: string | null;
  cutoff_start: string; // YYYY-MM-DD
  cutoff_end: string; // YYYY-MM-DD
  created_by: number | null;
};

export type PayrollOtherDeductionPatchPayload = Partial<
  Omit<PayrollOtherDeductionCreatePayload, "user_id" | "created_by">
>;

// =======================================================
// EMPLOYEE ALLOWANCE (employee_allowance)
// =======================================================

export type AllowancePayCycle = "N/A" | "PER_CUTOFF" | "PER_MONTH";

export type EmployeeAllowanceRecord = {
  allowance_id: number;
  user_id: number;

  amount: string | number;
  description: string | null;

  cutoff_start: string | null;
  cutoff_end: string | null;

  is_recurring: 0 | 1;
  is_active: 0 | 1;
  pay_cycle: AllowancePayCycle;

  start_date: string | null;
  end_date: string | null;

  is_processed: 0 | 1;

  created_by: number | null;
  created_date: string;
  updated_by: number | null;
  updated_date: string | null;
};

export type EmployeeAllowanceDraft = {
  amount: string;
  description: string;

  is_recurring: 0 | 1;
  pay_cycle: AllowancePayCycle;

  // One-time: select cutoff -> stored as dates
  cutoff_setting_id: number | null;
  cutoff_start: string;
  cutoff_end: string;

  // Recurring window:
  start_date: string;
  end_date: string;

  is_active: 0 | 1;
};

export type EmployeeAllowanceCreatePayload = {
  user_id: number;
  amount: number;
  description: string | null;

  cutoff_start: string | null;
  cutoff_end: string | null;

  is_recurring: 0 | 1;
  is_active: 0 | 1;
  pay_cycle: AllowancePayCycle;

  start_date: string | null;
  end_date: string | null;

  is_processed: 0 | 1;

  created_by: number | null;
  updated_by: number | null;
};

export type EmployeeAllowancePatchPayload = Partial<
  Omit<EmployeeAllowanceCreatePayload, "user_id" | "created_by">
>;

// =======================================================
// BENEFIT LOANS (benefit_loans)
// =======================================================

export type BenefitCode = "SSS" | "PAGIBIG" | "PHILHEALTH";
export type LoanBenefitCode = "SSS" | "PAGIBIG";

export type BenefitLoanDeductOn = "FIRST" | "SECOND" | "BOTH";
/** Alias for BenefitLoanDeductOn – used by BenefitsTab */
export type DeductOn = BenefitLoanDeductOn;
export type BenefitLoanStatus = "ACTIVE" | "CLOSED" | "CANCELLED";

export type BenefitLoanRecord = {
  loan_id: number;
  user_id: number;

  benefit_code: LoanBenefitCode;
  loan_name: string | null;
  reference_no: string | null;

  principal_amount: string | number;
  interest_amount: string | number;
  total_payable: string | number;
  accumulated_amount: string | number;

  amortization_amount: string | number;
  terms_installments: number;

  deduct_on: BenefitLoanDeductOn;
  start_cutoff_id: number;

  paid_installments: number;
  remaining_balance: string | number;

  last_paid_cutoff_id: string | null;

  status: BenefitLoanStatus;
  remarks: string | null;

  created_by: number | null;
  created_date: string;
  updated_by: number | null;
  updated_date: string | null;
};

export type BenefitLoanDraft = {
  benefit_code: LoanBenefitCode | "";
  loan_name: string;
  reference_no: string;

  principal_amount: string;
  interest_amount: string;

  // computed
  total_payable: string;
  amortization_amount: string;

  terms_installments: string;
  deduct_on: BenefitLoanDeductOn;

  start_cutoff_id: number | null;

  // tracked by payroll, but keep in draft for correct remaining calc
  paid_installments: number;

  // computed
  remaining_balance: string;

  status: BenefitLoanStatus;
  remarks: string;
};

export type BenefitLoanCreatePayload = {
  user_id: number;
  benefit_code: LoanBenefitCode;
  loan_name: string | null;
  reference_no: string | null;

  principal_amount: number;
  interest_amount: number;
  total_payable: number;

  amortization_amount: number;
  terms_installments: number;

  deduct_on: BenefitLoanDeductOn;
  start_cutoff_id: number;

  paid_installments: number;
  remaining_balance: number;
  last_paid_cutoff_id: string | null;

  status: BenefitLoanStatus;
  remarks: string | null;

  created_by: number | null;
  updated_by: number | null;
};

export type BenefitLoanPatchPayload = Partial<
  Omit<BenefitLoanCreatePayload, "user_id" | "created_by">
>;
// =======================================================
// STOCK PURCHASE / DR PAYMENT (dr_payment)
// =======================================================

export type DRPaymentMethod =
  | "PAYROLL_DEDUCTION"
  | "CASH"
  | "CHECK"
  | "BANK_TRANSFER"
  | "OTHERS";

export type DRPaymentRecord = {
  dr_payment_id: number;

  delivery_receipt_number: string;
  employee_id: number;

  cutoff_from: string; // YYYY-MM-DD
  cutoff_to: string; // YYYY-MM-DD

  payroll_ref_no: string | null;
  is_posted_to_payroll: 0 | 1 | number;

  payment_date: string; // YYYY-MM-DD
  amount_paid: string | number;

  payment_method: DRPaymentMethod | null;
  remarks: string | null;

  created_at?: string; // if Directus exposes it
  created_by?: number | null;
};

export type DRPaymentDraft = {
  delivery_receipt_number: string;

  // helper select (optional); if chosen, it will populate cutoff_from/to
  cutoff_setting_id: number | null;

  cutoff_from: string; // YYYY-MM-DD
  cutoff_to: string; // YYYY-MM-DD

  payment_date: string; // YYYY-MM-DD
  amount_paid: string;

  payment_method: DRPaymentMethod;
  payroll_ref_no: string;
  is_posted_to_payroll: 0 | 1;

  remarks: string;
};

export type DRPaymentCreatePayload = {
  delivery_receipt_number: string;
  employee_id: number;

  cutoff_from: string; // YYYY-MM-DD
  cutoff_to: string; // YYYY-MM-DD

  payroll_ref_no: string | null;
  is_posted_to_payroll: 0 | 1;

  payment_date: string; // YYYY-MM-DD
  amount_paid: number;

  payment_method: DRPaymentMethod;
  remarks: string | null;

  created_by: number | null;
};

export type DRPaymentPatchPayload = Partial<
  Omit<DRPaymentCreatePayload, "employee_id" | "created_by">
>;
// =======================================================
// COOP SAVINGS MEMBERSHIP (coop_savings_membership)
// =======================================================

export type CoopSavingsMembershipRecord = {
  id: number;
  user_id: number;

  membership_id: string;

  monthly_amount: string | number;
  total_collection: string | number;
  total_months: number;

  start_date: string; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD | null

  is_active: 0 | 1 | number;

  created_by: number | null;
  created_date: string;

  updated_by: number | null;
  updated_date: string | null;
};

export type CoopSavingsMembershipCreatePayload = {
  user_id: number;

  membership_id: string;

  monthly_amount: number;
  total_collection: number; // keep explicit to avoid Directus schema quirks
  total_months: number;

  start_date: string; // YYYY-MM-DD
  end_date: string | null;

  is_active: 0 | 1;

  created_by: number | null;
  updated_by: number | null;
};

export type CoopSavingsMembershipPatchPayload = Partial<
  Omit<CoopSavingsMembershipCreatePayload, "user_id" | "created_by">
>;

// =======================================================
// BENEFIT LOGS (benefit_logs)
// =======================================================

export type BenefitLogType = "CONTRIBUTION" | "LOAN";

export type BenefitLogRecord = {
  benefit_log_id: number;
  cutoff_id: number;

  cutoff_start: string | null;
  cutoff_end: string | null;
  cutoff_type: "FIRST" | "SECOND" | null;

  user_id: number;

  benefit_code: BenefitCode;
  log_type: BenefitLogType;

  loan_id: number | null;

  source_amount: string | number;
  deducted_amount: string | number;

  payroll_run_id: number;
  payroll_detail_id: string | null;

  note: string | null;
  created_date: string;
};

export type BenefitLogDraft = {
  benefit_code: BenefitCode;

  // Selected cutoff_settings.id; "0" or "other" for manual
  cutoff_setting_id: string;

  manual_cutoff_start: string;
  manual_cutoff_end: string;
  manual_cutoff_type: "FIRST" | "SECOND" | "";

  // Input for payroll_detail_id
  payroll_id_input: string;

  deducted_amount: string;
  note: string;

  created_date: string; // YYYY-MM-DD
};

export type BenefitLogCreatePayload = {
  cutoff_id: number;

  cutoff_start: string | null;
  cutoff_end: string | null;
  cutoff_type: "FIRST" | "SECOND" | null;

  user_id: number;
  benefit_code: BenefitCode;
  log_type: BenefitLogType;

  loan_id: number | null;

  source_amount: number;
  deducted_amount: number;

  payroll_run_id: number;
  payroll_detail_id: string | null;

  note: string | null;
  created_date?: string;
};

export type BenefitLogPatchPayload = Partial<
  Omit<BenefitLogCreatePayload, "user_id" | "created_by">
>;
// =======================================================
// SALARY SCHEDULES (salary_schedules)
// =======================================================

export type SalarySchedule = {
  schedule_id: number;
  effectivity_date: string; // YYYY-MM-DD
  salary_grade: number; // 1-33
  step: number; // 1-8
  monthly_rate: string | number;

  created_at?: string;
  updated_at?: string;
};

export type SalarySchedulePayload = {
  effectivity_date: string;
  salary_grade: number;
  step: number;
  monthly_rate: number;
};
