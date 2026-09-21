// modules/unified/benefits-logs/types.ts

export type BenefitCode = "SSS" | "PAGIBIG" | "PHILHEALTH";
export type BenefitLogType = "CONTRIBUTION" | "LOAN";

export interface UnifiedBenefitLogRow {
  benefit_log_id: string | number; // unique key for UI

  // Multi-Company Origin
  company_id: string;
  company_name: string;
  company_color: string;

  cutoff_id: number;
  cutoff_start?: string | null;
  cutoff_end?: string | null;
  cutoff_type?: string | null;

  user_id: number;
  employee_name?: string;
  account_no?: string | null;
  department_name?: string | null;

  benefit_code: BenefitCode;
  benefit_name?: string;

  log_type: BenefitLogType;
  loan_id: number | null;

  source_amount: number;
  deducted_amount: number;

  payroll_run_id: number | null;
  payroll_ref_no?: string;
  posted_at?: string | null;

  note: string | null;
  created_date?: string | null;
}

export interface CompanySummary {
  id: string;
  name: string;
  color: string;
  description?: string;
  logCount: number;
  totalDeductions: number;
  status: "ok" | "error" | "empty";
  error?: string;
}

export interface UnifiedApiResponse {
  success: boolean;
  data: UnifiedBenefitLogRow[];
  companies: CompanySummary[];
  totalLogs: number;
  totalAmount: number;
  failedCompanies?: { id: string; name: string; error: string }[];
  timestamp: string;
}

export interface UnifiedFilterState {
  search: string;
  companyId: string; // "ALL" or company_id
  cutoffRange: string; // "ALL" or "YYYY-MM-DD_YYYY-MM-DD"
  benefitCode: BenefitCode | "ALL";
  logType: BenefitLogType | "ALL";
}
