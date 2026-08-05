export interface Department {
  department_id?: number;
  department_name: string;
  parent_division?: number | null;
  department_description?: string | null;
  department_head?: string | null;
  department_head_id?: number | null;
  tax_id?: number | null;
  date_added?: string | null;
}

export interface UserLookup {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_mname?: string | null;
}
