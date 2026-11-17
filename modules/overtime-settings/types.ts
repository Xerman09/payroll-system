export interface GeneralSettingRow {
  id: number;
  setting_key: string;
  setting_value: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface OvertimeRateFormState {
  // Regular Workday Overtime
  payroll_overtime_rate: string;

  // Rest Day (Sunday) Overtime
  payroll_ot_rate_rest_day: string;

  // Special Holiday Overtime
  payroll_ot_rate_special_holiday: string;

  // Special Holiday + Rest Day Overtime
  payroll_ot_rate_special_rest_day: string;

  // Regular Holiday Overtime
  payroll_ot_rate_regular_holiday: string;

  // Regular Holiday + Rest Day Overtime
  payroll_ot_rate_regular_rest_day: string;

  // Night Shift Differential
  payroll_night_diff_rate: string;
}

export const DOLE_PRESETS: OvertimeRateFormState = {
  payroll_overtime_rate: "1.25",
  payroll_ot_rate_rest_day: "1.69",
  payroll_ot_rate_special_holiday: "1.69",
  payroll_ot_rate_special_rest_day: "1.95",
  payroll_ot_rate_regular_holiday: "2.60",
  payroll_ot_rate_regular_rest_day: "3.38",
  payroll_night_diff_rate: "0.10",
};

export const FLAT_PRESETS: OvertimeRateFormState = {
  payroll_overtime_rate: "1",
  payroll_ot_rate_rest_day: "1.30",
  payroll_ot_rate_special_holiday: "1.30",
  payroll_ot_rate_special_rest_day: "1.50",
  payroll_ot_rate_regular_holiday: "2.00",
  payroll_ot_rate_regular_rest_day: "2.60",
  payroll_night_diff_rate: "0.10",
};

