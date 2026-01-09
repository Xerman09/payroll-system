// modules/allowance/types.ts

export const ALLOWANCE_TYPES = [
  "Meals",
  "Load",
  "Motor Allowance",
  "Gas",
  "Others",
] as const;

export type AllowanceType = (typeof ALLOWANCE_TYPES)[number];

export type PayCycle = "N/A" | "PER_CUTOFF" | "PER_MONTH";

export type AllowanceMode = "one_time" | "recurring";

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

  cutoff_start: string | null; // YYYY-MM-DD
  cutoff_end: string | null; // YYYY-MM-DD

  is_recurring: 0 | 1 | boolean;
  is_active: 0 | 1 | boolean;
  pay_cycle: PayCycle;

  start_date: string | null; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD

  is_processed?: 0 | 1;
  created_date?: string | null;

  // Optional server-provided display
  user_full_name?: string;
};

export type AllowanceStatusFilter =
  | "all"
  | "processed"
  | "unprocessed"
  | "active"
  | "inactive";

export type AllowanceListParams = {
  page: number;
  pageSize: number;
  searchName?: string;
  searchDescription?: string;

  mode: AllowanceMode;

  status?: AllowanceStatusFilter;

  // Only applies to recurring mode
  payCycle?: "all" | PayCycle;
};

export type FormRow = {
  type: AllowanceType | "";
  other?: string;
  amount: string;
};

export type AllowanceSaveMeta =
  | {
    mode: "one_time";
    cutoff_start: string;
    cutoff_end: string;
  }
  | {
    mode: "recurring";
    pay_cycle: PayCycle;
    start_date: string;
    end_date: string | null;
    is_active: boolean;
  };
