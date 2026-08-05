export interface AttendanceLog {
  log_id: number;
  user_id: number;
  department_id: number;
  log_date: string;
  time_in: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  break_start: string | null;
  break_end: string | null;
  time_out: string | null;
  image_time_in: string | null;
  image_time_out: string | null;
  status: 'On Time' | 'Late' | 'Absent' | 'Half Day' | 'Incomplete' | 'Leave' | 'Holiday' | null;
  created_at: string;
  approve_status: 'pending' | 'approved' | 'rejected' | null;
  
  // Relations (populated by Directus)
  user?: {
    user_id: number;
    user_fname: string;
    user_lname: string;
  };
  department?: {
    department_id: number;
    department_name: string;
  };
}

export interface AttendanceApproval {
  approval_id?: number;
  employee_id: number;
  date_schedule: string;
  approved_by: number;
  approved_at?: string;
  work_minutes: number;
  late_minutes: number;
  undertime_minutes: number;
  overtime_minutes: number;
  remarks: string | null;
  status: 'approved' | 'rejected';
}

export interface DepartmentSchedule {
  schedule_id: number;
  department_id: number;
  working_days: number;
  work_start: string;
  work_end: string;
  lunch_start: string;
  lunch_end: string;
  break_start: string;
  break_end: string;
  workdays_note: string | null;
}

export interface OvertimeRequest {
  overtime_id: number;
  user_id: number;
  department_id: number | null;
  request_date: string;
  sched_timeout: string | null;
  ot_from: string;
  ot_to: string;
  duration_minutes: number;
  purpose: string | null;
  remarks: string | null;
  status: string;
  filed_at: string;
}
