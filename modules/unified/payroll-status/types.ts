// modules/unified/payroll-status/types.ts

export type CompanyPayrollStatusType =
  | "COMPLETED"
  | "IN_PROGRESS"
  | "PENDING"
  | "NO_CUTOFF"
  | "OFFLINE";

export type DepartmentRunStatus =
  | "POSTED"
  | "PENDING_APPROVER"
  | "PENDING_CHECKER"
  | "PROCESSED"
  | "DRAFT"
  | "NOT_STARTED";

export interface DepartmentPayrollDetail {
  id: number;
  name: string;
  status: DepartmentRunStatus;
  isCompleted: boolean;
  payroll_ref_no?: string | null;
  payroll_run_id?: number | null;
  headcount?: number;
  total_net?: number;
  total_gross?: number;
  posted_at?: string | null;
  updated_at?: string | null;
}

export interface CutoffInfo {
  id: number | null;
  label: string;
  cutoff_type: string | null;
  start_date: string | null;
  end_date: string | null;
  payout_date: string | null;
  paid_day_plus_one?: string | null;
  is_current: boolean;
}

export interface CompanyPayrollStatus {
  company_id: string;
  company_name: string;
  company_color: string;
  company_description: string;
  status: CompanyPayrollStatusType;
  status_label: string;
  current_cutoff: CutoffInfo | null;
  departments_total: number;
  departments_completed: number;
  progress_percentage: number;
  runs_summary: {
    draft: number;
    pending_checker: number;
    pending_approver: number;
    processed: number;
    posted: number;
    total: number;
  };
  financials: {
    total_gross: number;
    total_deductions: number;
    total_net: number;
    headcount: number;
  };
  departments_detail: DepartmentPayrollDetail[];
  error?: string;
  last_updated: string;
}

export interface OverallPayrollStatus {
  total_companies: number;
  online_companies: number;
  completed_companies: number;
  in_progress_companies: number;
  pending_companies: number;
  offline_companies: number;
  overall_percentage: number;
  total_enterprise_gross: number;
  total_enterprise_net: number;
  total_enterprise_deductions: number;
  total_enterprise_headcount: number;
  overall_status_label: "COMPLETED" | "IN_PROGRESS" | "PENDING" | "ATTENTION_REQUIRED";
  cutoff_label: string;
}

export interface AvailableCutoffOption {
  key: string;
  label: string;
  start_date: string;
  end_date: string;
  cutoff_type?: string;
}

export interface UnifiedPayrollStatusApiResponse {
  success: boolean;
  data: CompanyPayrollStatus[];
  overall: OverallPayrollStatus;
  available_cutoffs: AvailableCutoffOption[];
  timestamp: string;
  error?: string;
}
