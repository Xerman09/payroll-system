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
  updated_by: number;
  sss_contribution_monthly: string;
  pagibig_contribution_monthly: string;
  philhealth_contribution_monthly: string;
};

export type WageRecord = {
  id?: number | null;
  user_id: number;
  daily_wage?: string | number;
  vacation_leave_per_year?: string | number;
  sick_leave_per_year?: string | number;
  paid_holiday?: number | 0 | 1;
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
  sss: string;
  pagibig: string;
  philhealth: string;
  lastUpdatedBy: string;
  lastUpdateDate: string;
};
