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
    "filter[payroll_run_id][status][_eq]": "POSTED",
    fields: "id,payroll_run_id,user_id,employee_name,department_name,cutoff_start,cutoff_end,cutoff_label,total_days_worked,daily_rate,monthly_rate,basic_pay,gross_pay,net_pay,on_hold",
  };

  if (runIds && runIds.length > 0) {
    params["filter[payroll_run_id][_in]"] = runIds.join(",");
  }

  return apiFetch("/items/payroll_run_employee", params);
}

export async function fetch13thMonthConfig(): Promise<Record<string, any> | null> {
  try {
    const rows = await apiFetch("/items/general_setting", {
      "filter[setting_key][_eq]": "thirteenth_month_config",
      limit: "1",
    });
    if (Array.isArray(rows) && rows.length > 0) {
      const val = rows[0].setting_value;
      if (typeof val === "string") {
        return JSON.parse(val);
      } else if (val && typeof val === "object") {
        return val;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch 13th month config from server:", err);
  }
  return null;
}

export async function save13thMonthConfig(header: Record<string, any>): Promise<boolean> {
  try {
    const rows = await apiFetch("/items/general_setting", {
      "filter[setting_key][_eq]": "thirteenth_month_config",
      limit: "1",
    });

    const payload = {
      setting_key: "thirteenth_month_config",
      setting_value: JSON.stringify(header),
    };

    let res: Response;
    if (Array.isArray(rows) && rows.length > 0 && rows[0].id) {
      const existingId = rows[0].id;
      const url = `${BASE_API}?path=${encodeURIComponent(`/items/general_setting/${existingId}`)}`;
      res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setting_value: JSON.stringify(header) }),
      });
    } else {
      const url = `${BASE_API}?path=${encodeURIComponent("/items/general_setting")}`;
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.errors?.[0]?.message || `HTTP ${res.status}`);
    }
    return true;
  } catch (err) {
    console.error("Failed to save 13th month config to database:", err);
    return false;
  }
}

export async function fetch13thMonthAdjustments(year: number): Promise<Record<string, any> | null> {
  try {
    const key = `thirteenth_month_adjustments_${year}`;
    const rows = await apiFetch("/items/general_setting", {
      "filter[setting_key][_eq]": key,
      limit: "1",
    });
    if (Array.isArray(rows) && rows.length > 0) {
      const val = rows[0].setting_value;
      if (typeof val === "string") {
        return JSON.parse(val);
      } else if (val && typeof val === "object") {
        return val;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch 13th month adjustments from server:", err);
  }
  return null;
}

export async function save13thMonthAdjustments(year: number, adjustments: Record<string, any>): Promise<boolean> {
  try {
    const key = `thirteenth_month_adjustments_${year}`;
    const rows = await apiFetch("/items/general_setting", {
      "filter[setting_key][_eq]": key,
      limit: "1",
    });

    const payload = {
      setting_key: key,
      setting_value: JSON.stringify(adjustments),
    };

    let res: Response;
    if (Array.isArray(rows) && rows.length > 0 && rows[0].id) {
      const existingId = rows[0].id;
      const url = `${BASE_API}?path=${encodeURIComponent(`/items/general_setting/${existingId}`)}`;
      res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setting_value: JSON.stringify(adjustments) }),
      });
    } else {
      const url = `${BASE_API}?path=${encodeURIComponent("/items/general_setting")}`;
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.errors?.[0]?.message || `HTTP ${res.status}`);
    }
    return true;
  } catch (err) {
    console.error("Failed to save 13th month adjustments to database:", err);
    return false;
  }
}


