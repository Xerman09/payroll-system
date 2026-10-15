// modules/thirteenth-month/types.ts

export type ThirteenthMonthStatus = "DRAFT" | "CALCULATED" | "POSTED";

export interface CutoffDayItem {
  cutoff_id: number | string;
  cutoff_label: string;
  cutoff_start: string;
  cutoff_end: string;
  days_worked: number;
  run_ref: string;
}

export interface MonthDayItem {
  month_key: string;          // e.g. "2026-01"
  month_name: string;         // e.g. "January 2026"
  month_short: string;        // e.g. "Jan"
  total_working_days: number; // Standard working days in that month (e.g. 26)
  days_worked: number;        // Days employee worked in that month (e.g. 25.5)
  completion_pct: number;     // e.g. 98%
  cutoffs_count: number;      // Number of cutoffs in that month
}

export interface ThirteenthMonthHeader {
  id: string;
  batch_number: string;
  title: string;
  year: number;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  total_period_working_days: number;
  status: ThirteenthMonthStatus;
  department_filter: string | "ALL";
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ThirteenthMonthEmployeeLine {
  id: string;
  user_id: number;
  employee_name: string;
  department_id: number | null;
  department_name: string;
  position: string;
  hire_date: string | null;
  monthly_salary: number;
  period_working_days: number;
  pay_per_day: number;
  actual_days_worked: number;
  adjustment_days: number;
  effective_days_worked: number;
  computed_13th_month: number;
  advance_deduction: number;
  taxable_amount: number;
  tax_withheld: number;
  net_13th_month: number;
  payment_method: "BANK" | "CASH";
  on_hold: boolean;
  remarks?: string;
  days_breakdown: CutoffDayItem[];
  monthly_breakdown: MonthDayItem[];
}

export interface ThirteenthMonthSummary {
  total_employees: number;
  active_employees: number;
  on_hold_employees: number;
  total_working_days: number;
  total_gross_13th_month: number;
  total_advances: number;
  total_tax_withheld: number;
  total_net_payout: number;
  average_payout: number;
}
