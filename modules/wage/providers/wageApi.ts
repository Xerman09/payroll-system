// @modules/wage/providers/wageApi.ts
import type { Department, Employee, WageRecord, WagePayload } from "../types";

const BASE = "http://100.126.246.124:8060";

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

export async function fetchDepartments(): Promise<Department[]> {
  const json = await fetchJson(`${BASE}/items/department?limit=-1`);
  return json.data || [];
}

export async function fetchEmployees(): Promise<Employee[]> {
  const json = await fetchJson(`${BASE}/items/user?limit=-1`);
  const list: Employee[] = (json.data || []).filter(
    (emp: Employee) => !emp.is_deleted || emp.is_deleted.data?.[0] === 0
  );
  return list;
}

// Server-side pagination + search + filters for employees
export type EmployeeListParams = {
  page: number;
  pageSize: number;
  search?: string;
  deptId?: number | null;
  sortField?: keyof Employee;
  sortOrder?: "asc" | "desc";
};

function buildQuery(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.append(k, String(v));
  });
  return sp.toString();
}

export async function fetchEmployeesPaged({
  page,
  pageSize,
  search,
  deptId,
  sortField = "user_id",
  sortOrder = "asc",
}: EmployeeListParams): Promise<{ rows: Employee[]; total: number }> {
  const base: Record<string, string | number | undefined> = {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    meta: "filter_count",
  };

  // sort
  const sortPrefix = sortOrder === "desc" ? "-" : "";
  base.sort = `${sortPrefix}${String(sortField)}`;

  // department filter
  if (deptId) base["filter[user_department][_eq]"] = Number(deptId);

  // search across id, fname, lname
  if (search && search.trim()) {
    const s = search.trim();
    // Directus-style OR filter encoding
    base["filter[_or][0][user_id][_contains]"] = s;
    base["filter[_or][1][user_fname][_contains]"] = s;
    base["filter[_or][2][user_lname][_contains]"] = s;
  }

  const qs = buildQuery(base);
  const url = `${BASE}/items/user?${qs}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const json = await res.json();
  const data: Employee[] = (json.data || []).filter(
    (emp: Employee) => !emp.is_deleted || emp.is_deleted.data?.[0] === 0
  );
  const total: number = json?.meta?.filter_count ?? json?.meta?.total ?? data.length;
  return { rows: data, total };
}

export async function fetchUserById(userId: number) {
  const json = await fetchJson(`${BASE}/items/user/${userId}`);
  return json.data;
}

export async function fetchWageByUser(userId: number): Promise<WageRecord | null> {
  const json = await fetchJson(
    `${BASE}/items/user_wage_management?filter[user_id][_eq]=${userId}`
  );
  return (json.data && json.data[0]) || null;
}

export async function createWage(payload: WagePayload) {
  const res = await fetch(`${BASE}/items/user_wage_management`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function patchWage(id: number, payload: WagePayload) {
  const res = await fetch(`${BASE}/items/user_wage_management/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function logWageAccess(openedById: number, userId: number, remarks: string) {
  try {
    await fetch(`${BASE}/items/user_wage_access_log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, opened_by: openedById, remarks }),
    });
  } catch (e) {
    // swallow, caller can log if needed
    console.error("logWageAccess failed - WageAPI.ts:66", e);
  }
}
