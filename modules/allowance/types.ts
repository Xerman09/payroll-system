export const ALLOWANCE_TYPES = ["Meals", "Load", "Motor Allowance", "Gas", "Others"] as const;
export type AllowanceType = (typeof ALLOWANCE_TYPES)[number];

export type User = {
  user_id: number;
  user_fname: string;
  user_mname?: string | null;
  user_lname: string;
};

export type Allowance = {
  allowance_id: number;
  user_id: number;
  amount: string | number;
  description: string;
  cutoff_start: string;
  cutoff_end: string;
  is_processed?: 0 | 1;
  created_date?: string | null;
  user_full_name?: string;
};

export type FormRow = { type: AllowanceType | ""; other?: string; amount: string };

export type AllowanceListParams = {
  page: number;
  pageSize: number;
  searchName?: string;
  searchDescription?: string;
  processed?: "all" | "processed" | "unprocessed";
};
