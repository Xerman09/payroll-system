export type User = {
  user_id: number;
  user_fname: string;
  user_mname?: string | null;
  user_lname: string;
  user_position?: string;
  user_image?: string | null;
};

export type PayrollRecord = {
  id: number;
  user_id: number;
  amount: string | number;
  description?: string | null;
  cutoff_start: string;
  cutoff_end: string;
  is_processed?: unknown;
  created_by?: number | null;
  created_date?: string | null;
  updated_by?: number | null;
  updated_date?: string | null;
  /** Optional discriminator if your Directus collection stores both in one table */
  type?: unknown;
  mode?: unknown;
  record_type?: unknown;
};

export type TabKey = "additions" | "deductions";
export type ModeKey = "addition" | "deduction";

export type SortConfig = {
  key: keyof PayrollRecord | "user_name";
  direction: "asc" | "desc";
} | null;

export type NewRecordForm = {
  user_id: number | null;
  searchText: string;
  showDropdown: boolean;
  datePicked: string;
  cutoff_start: string;
  cutoff_end: string;
  description: string;
  amountText: string;
};