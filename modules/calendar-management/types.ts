export interface Holiday {
  id: number;
  holiday_date: string;
  cutoff_setting_id?: number | null;
  last_working_day?: string | null;
  description: string;
  holiday_type: string;
  is_recurring: boolean | number;
  is_paid: boolean | number;
  created_by: number;
  created_date?: string;
  updated_by?: number | null;
  updated_date?: string | null;
}

export interface CalendarUser {
  user_id: number;
  user_fname: string;
  user_lname: string;
}
