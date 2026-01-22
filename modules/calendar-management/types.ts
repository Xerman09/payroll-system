export type HolidayType = "regular" | "special" | "company";

export interface Holiday {
  id: number;
  holiday_date: string; // YYYY-MM-DD
  cutoff_setting_id: number | null;
  last_working_day: string | null; // YYYY-MM-DD or null

  description: string;
  holiday_type: HolidayType;

  is_recurring: boolean | number;
  is_paid: boolean | number;

  created_by: number | null;
  created_date?: string;

  updated_by?: number | null;
  updated_date?: string | null;
}

export interface CalendarUser {
  user_id: number;
  user_fname: string;
  user_lname: string;
}

export type CutoffType = "FIRST" | "SECOND";

export interface CutoffSetting {
  id: number;
  cutoff_type: CutoffType;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  payout_date: string; // YYYY-MM-DD
  period_status: "OPEN" | "CLOSED" | string;

  month: number;
  year: number;

  status: string;
  created_by?: string | number;
  updated_by?: string | number;
  date_created?: string;
  date_updated?: string;
}
