
import { BenefitCode } from "./types";

// =======================================================
// BENEFIT LOGS (benefit_logs)
// =======================================================

export type BenefitLogType = "CONTRIBUTION" | "LOAN";

export type BenefitLogRecord = {
  benefit_log_id: number;
  cutoff_id: number;
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

  // Maps to cutoff_id (1=First, 2=Second)
  cutoff_period: "1" | "2";

  // Input for payroll_detail_id
  payroll_id_input: string;

  deducted_amount: string;
  note: string;

  created_date: string; // YYYY-MM-DD
};

export type BenefitLogCreatePayload = {
  cutoff_id: number;
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
  Omit<BenefitLogCreatePayload, "user_id">
>;
