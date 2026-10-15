// modules/thirteenth-month/providers/thirteenthMonthApi.ts

const BASE_API = "/api/dashboard";

async function apiFetch(path: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_API}?path=${encodeURIComponent(path)}${qs ? "&" : ""}${qs}`;

  const res = await fetch(url, {
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const errMsg = json?.errors?.[0]?.message || json?.error || `HTTP ${res.status} fetching ${path}`;
    throw new Error(errMsg);
  }

  return json?.data || [];
}

export async function fetchUsers(): Promise<Record<string, unknown>[]> {
  return apiFetch("/items/user", {
    limit: "1000",
    "filter[is_employee][_eq]": "1",
    fields: "user_id,user_fname,user_mname,user_lname,user_department,user_position,user_dateOfHire,is_deleted",
  });
}

export async function fetchDepartments(): Promise<Record<string, unknown>[]> {
  return apiFetch("/items/department", {
    limit: "500",
    fields: "department_id,department_name,is_delete",
  });
}

export async function fetchWages(): Promise<Record<string, unknown>[]> {
  return apiFetch("/items/user_wage_management", {
    limit: "1000",
    fields: "id,user_id,monthly_rate,daily_wage,isCard",
  });
}

export async function fetchHolidays(): Promise<Record<string, unknown>[]> {
  return apiFetch("/items/holiday_calendar", {
    limit: "200",
    fields: "id,holiday_date,description,holiday_type",
  });
}

export async function fetchCutoffSettings(): Promise<Record<string, unknown>[]> {
  return apiFetch("/items/cutoff_settings", {
    limit: "100",
    sort: "start_date",
    fields: "id,cutoff_type,month,year,start_date,end_date,payout_date,period_status",
  });
}

export async function fetchPostedPayrollRuns(): Promise<Record<string, unknown>[]> {
  return apiFetch("/items/payroll_run", {
    limit: "200",
    "filter[status][_eq]": "POSTED",
    sort: "-cutoff_start",
    fields: "payroll_run_id,payroll_ref_no,status,department_id,cutoff_id,cutoff_start,cutoff_end,posted_at",
  });
}

export async function fetchPayrollRunEmployees(runIds?: (number | string)[]): Promise<Record<string, unknown>[]> {
  const params: Record<string, string> = {
    limit: "5000",
    fields: "id,payroll_run_id,user_id,employee_name,department_name,basic_pay,total_days_worked,gross_pay,net_pay,on_hold",
  };

  if (runIds && runIds.length > 0) {
    params["filter[payroll_run_id][_in]"] = runIds.join(",");
  }

  return apiFetch("/items/payroll_run_employee", params);
}
