
export type Allowance = {
  allowance_id: number;
  user_id: number;
  amount: string | number;
  description: string;
  cutoff_start: string; // yyyy-mm-dd
  cutoff_end: string;
  is_processed?: number;
  created_by?: number | null;
  created_date?: string;
  updated_by?: number | null;
  updated_date?: string | null;
  // optionally server may provide user name; handle gracefully
  user_full_name?: string;
};

export type User = {
  user_id: number;
  user_fname: string;
  user_mname?: string | null;
  user_lname: string;
  // plus other user fields from your API
};
