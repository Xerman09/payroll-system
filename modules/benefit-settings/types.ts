export type BenefitCode = "SSS" | "PAGIBIG" | "PHILHEALTH";
export type CutoffType = "FIRST" | "SECOND" | null;

export interface BenefitSetting {
  id: number;
  benefit_code: BenefitCode;
  benefit_name: string;
  cutoff: CutoffType;
  is_active: number;
  effective_from: string | null;
  effective_to: string | null;
  updated_by: number | null;
  updated_date: string | null;
}

export interface UserData {
  user_id: number;
  user_fname: string;
  user_lname: string;
}

export interface BenefitSettingRaw extends BenefitSetting { }
