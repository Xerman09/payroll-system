export type Employee = {
  user_id: number;
  user_fname: string;
  user_mname?: string | null;
  user_lname: string;
  user_email?: string;
  user_position?: string;
};

export type RetroPayFromApi = {
  retro_id: number;
  user_id: number | Employee; // Directus structure
  amount: string;
  description?: string | null;
  cutoff_start: string;
  cutoff_end: string;
  is_processed?: number;
  created_by?: number | null;
  created_date?: string;
  updated_by?: number | null;
  updated_date?: string | null;
};

export type RetroFormState = {
  user_id: string;
  amount: string;
  description: string;
  cutoff_start: string;
  cutoff_end: string;
};

export type SortConfig = {
  key: string;
  order: "asc" | "desc";
};
