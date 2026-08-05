export interface Department {
  department_id: number;
  department_name: string;
}

export interface EmploymentStatus {
  id: number;
  status_name: string;
}

export interface Employee {
  user_id?: number;
  user_email?: string | null;
  user_password?: string | null;
  user_fname: string;
  user_mname?: string | null;
  user_lname: string;
  suffix_name?: string | null;
  nickname?: string | null;
  user_contact?: string | null;
  user_province?: string | null;
  user_city?: string | null;
  user_brgy?: string | null;
  user_department?: number | null;
  user_sss?: string | null;
  user_philhealth?: string | null;
  user_tin?: string | null;
  user_position?: string | null;
  employment_status_id?: number | null;
  user_dateOfHire?: string | null;
  user_tags?: string | null;
  user_bday?: string | null;
  gender?: string | null;
  civil_status?: string | null;
  nationality?: string | null;
  citizenship?: string | null;
  place_of_birth?: string | null;
  blood_type?: string | null;
  religion?: string | null;
  spouse_name?: string | null;
  role_id?: number | null;
  user_image?: string | null;
  external_id?: string | null;
  is_deleted?: number | boolean | null;
  biometric_id?: string | null;
  has_iris_registration?: number | boolean | null;
  iris_biometric_template?: string | null;
  iris_registered_at?: string | null;
  rf_id?: string | null;
  isAdmin?: number | boolean | null;
  user_pagibig?: string | null;
  signature?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_number?: string | null;
  role?: string;
  is_employee?: number | boolean | null;
}
