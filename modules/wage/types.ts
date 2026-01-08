// @modules/wage/types.ts
export type Department = {
  department_id: number;
  department_name: string;
};

export type Employee = {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_department: number | null;
  is_deleted?: { data?: (number | null)[] } | null;
};

export type WagePayload = {
  user_id: number;
  daily_wage: number;
  vacation_leave_per_year: number;
  sick_leave_per_year: number;
  paid_holiday: number | 0 | 1;

  // ✅ Bank Card flag (DB: isCard)
  isCard: number | 0 | 1;

  // ✅ In your schema; we set this when daily_wage changes
  cutoff_wage_date_update?: string | null; // YYYY-MM-DD

  updated_by: number;
  sss_contribution_monthly: string;
  pagibig_contribution_monthly: string;
  philhealth_contribution_monthly: string;
};

export type WageRecord = {
  id?: number | null;
  user_id: number;
  daily_wage?: string | number;
  cutoff_wage_date_update?: string | null;

  vacation_leave_per_year?: string | number;
  sick_leave_per_year?: string | number;
  paid_holiday?: number | 0 | 1;

  isCard?: number | 0 | 1 | null;

  sss_contribution_monthly?: string;
  pagibig_contribution_monthly?: string;
  philhealth_contribution_monthly?: string;
  updated_by?: number | null;
  updated_date?: string | null;
  created_by?: number | null;
  created_date?: string | null;
};

export type WageDataState = {
  id: number | null;
  dailyWage: number;
  dailyWageInput: string;
  vacationLeave: number;
  sickLeave: number;
  isPaidHoliday: boolean;

  // ✅ UI state
  isCard: boolean;

  sss: string;
  pagibig: string;
  philhealth: string;
  lastUpdatedBy: string;
  lastUpdateDate: string;
};

export type WageProrationLogPayload = {
  user_id: number;
  previous_daily_wage: number;
  new_daily_wage: number;
  effective_date: string; // YYYY-MM-DD
  cutoff_id: number; // cutoff_settings.id
  updated_by: number;
};

export type CutoffSetting = {
  id: number;
  cutoff_type: string; // FIRST / SECOND
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  period_status?: string | null;
  status?: string | null;
  month?: number | null;
  year?: number | null;
};
