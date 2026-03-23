// modules/payroll-records/types.ts

export type Employee = {
  user_id: number;
  user_fname: string;
  user_mname: string | null;
  user_lname: string;
  user_department: number | null;
  user_position: string;
  user_dateOfHire: string;
  user_contact: string;
  is_deleted?: { data?: (number | null)[] };
};

export type Department = {
  department_id: number;
  department_name: string;
};

export type CutoffHistoryRow = {
  id: number;
  cutoff_setting_id: number;
  event_at: string;
  status: string | null;
  month: number;
  year: number;
  cutoff_type: string;
  start_date: string;
  end_date: string;
  payout_date: string | null;
  period_status: string | null;
};

export type PayrollRunEmployeeRow = {
  id: number;
  payroll_run_id: number | { payroll_ref_no?: string; posted_at?: string };
  payroll_ref_no?: string;
  posted_at?: string;
  user_id: number;
  employee_name: string | null;
  department_name: string | null;
  department_name_snapshot: string | null;
  cutoff_start: string;
  cutoff_end: string;
  cutoff_label: string | null;
  gross_pay: string | number;
  basic_pay: string | number;
  ot_amount: string | number;
  holiday_pay: string | number;
  rest_day_amount: string | number;
  night_diff_amount: string | number;
  total_additions: string | number;
  total_deductions: string | number;
  net_pay: string | number;
  created_at?: string;

  // ✅ New fields for Top Sheet
  total_days_worked?: string | number;
  total_work_minutes?: string | number;

  // ✅ REQUIRED for filtering
  on_hold?: number | boolean | string | null | { data?: number[] };
  is_card?: number | boolean | string | null | { data?: number[] };
};

export type EmployeeMaster = {
  user_id: number;
  user_fname: string;
  user_mname: string | null;
  user_lname: string;
};

export type TapSheetRow = {
  user_id: number;
  name_display: string;
  name_sort_key: string;
  payment_type: "BANK" | "CASH";
  gross_pay: number;
  total_additions: number;
  total_deductions: number;
  net_pay: number;
  // ✅ New fields for display
  employee_no: string;
  days_worked: number;
  work_hours: number;
  payroll_ref_no?: string;
  posted_at?: string;
};

export type TapSortKey = "name" | "gross" | "adds" | "deds" | "net";
