// modules/cutoff-settings/types.ts
export type CutoffType = "FIRST" | "SECOND";
export type PeriodStatus = "OPEN" | "CLOSED";

export interface CutoffSettingRow {
  id?: number;
  status?: string; // Directus status field
  date_created?: string; // ISO
  date_updated?: string; // ISO

  month: number; // 1-12 (payroll month)
  year: number; // payroll year
  cutoff_type: CutoffType;

  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  payout_date: string | null; // YYYY-MM-DD | null

  period_status: PeriodStatus;

  created_by: string | null;
  updated_by: string | null;
}

export interface PeriodKey {
  month: number; // 1..12
  year: number;
}

export interface DefaultCutoffDates {
  FIRST: { start_date: string; end_date: string };
  SECOND: { start_date: string; end_date: string };
}
